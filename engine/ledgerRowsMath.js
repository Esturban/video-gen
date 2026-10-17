// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/dualTimelineMath.js (MARGIN, TEXT_MIN_PX, PULSE_HZ, EM, EM_BOLD, textRect: imported; its lanes and axis do not fit a table),
//   1_social/py/video-gen/engine/flowNetworkMath.js (pickLayout, wrapText, fillVars: imported), 1_social/py/video-gen/engine/motionMath.js (win, eased: imported).
// Pure maths for LedgerRows (CMO-8236): a ledger of N rows under three column heads. Each row is a two-line label, a name chip that goes
// from dim outline to solid fill, and a dashed slot that can NEVER hold a number: the slot schema has no value field, only an empty label.
// Every value is a function of (config, W, H, t), so any frame draws alone. Every opacity fades linearly, so none steps more than
// MAX_ALPHA_STEP per frame at 30 fps (nothing flashes); positions ease out.
import { EM, EM_BOLD, PULSE_HZ, TEXT_MIN_PX } from "./dualTimelineMath.js";
import { fillVars, pickLayout, wrapText } from "./flowNetworkMath.js";
import { eased, win } from "./motionMath.js";

export const MAX_ALPHA_STEP = 0.15; // per frame at 30 fps
const ROW_IN_S = 0.5; // slide-in from 24 px below
const ROW_RISE = 24;
const CHIP_FADE_S = 0.3;
const SLOT_LABEL_S = 0.4;
const FADE_S = 0.5;
const CAP_IN_S = 0.35;
const CAP_OUT_S = 0.3;
const FOCUS_FADE_S = 0.5;
export const MAX_CRAWL_PX_S = 40; // the empty-slot dashes march no faster than this (design px per second): a calm wait, never a flicker
const SLOT_KEYS = new Set(["state", "emptyLabel", "labelAt"]);
const ROW_KEYS = new Set(["label", "meta", "at", "chip", "slot"]);

/** Design layouts in px at their own size. cols: label x, chip [x0, x1], slot [x0, w]; rows: first top, pitch, slot height. */
export const LAYOUTS = {
  tall: {
    size: [1080, 1920], heads: { y: 250, px: 30, lineGap: 36 }, label: { x: 64, w: 476 }, chip: { x0: 556, x1: 686, h: 60, px: 34 }, slot: { x0: 700, w: 316, h: 88 },
    rows: { top: 330, pitch: 132, labelPx: 32, metaPx: 30, line1: 30, line2: 70 }, badgeX: 1016,
    cap: { x: 540, y: 1334, w: 950, px: 44, align: "middle" }, source: { y: 1600, w: 952 }, footerY: 1700,
  },
  wide: {
    size: [1920, 1080], heads: { y: 92, px: 30, lineGap: 36 }, label: { x: 192, w: 960 }, chip: { x0: 1180, x1: 1310, h: 56, px: 34 }, slot: { x0: 1412, w: 316, h: 78 },
    rows: { top: 112, pitch: 94, labelPx: 32, metaPx: 30, line1: 30, line2: 66 }, badgeX: 1728,
    cap: { x: 64, y: 820, w: 1792, px: 48, align: "start" }, source: { y: 930, w: 1792 }, footerY: 980,
  },
  square: {
    size: [1080, 1080], heads: { y: 92, px: 30, lineGap: 36 }, label: { x: 64, w: 476 }, chip: { x0: 556, x1: 686, h: 56, px: 34 }, slot: { x0: 700, w: 316, h: 80 },
    rows: { top: 150, pitch: 94, labelPx: 32, metaPx: 30, line1: 30, line2: 68 }, badgeX: 1016,
    cap: { x: 540, y: 836, w: 952, px: 40, align: "middle" }, source: { y: 930, w: 952 }, footerY: 1006,
  },
};

const nonEmpty = (x) => typeof x === "string" && x.trim().length > 0;
const unknownKey = (obj, allowed) => Object.keys(obj).find((k) => !allowed.has(k));

/** Throws a message naming the problem. A slot or row that carries a value never renders. */
export function validateConfig(cfg) {
  if (!cfg || !Array.isArray(cfg.rows) || !cfg.rows.length) throw new Error('LedgerRows config needs a "rows" array');
  let prevAt = -Infinity;
  cfg.rows.forEach((r, i) => {
    if ("value" in r || "amount" in r || (r.slot && ("value" in r.slot || "amount" in r.slot))) throw new Error(`row ${i}: a ledger row carries no value, the slot schema has only emptyLabel`);
    const extraRow = unknownKey(r, ROW_KEYS);
    if (extraRow) throw new Error(`row ${i}: unknown key "${extraRow}"`);
    if (!nonEmpty(r.label) || !nonEmpty(r.meta)) throw new Error(`row ${i} needs a label and a meta line`);
    if (!(r.at >= prevAt)) throw new Error(`row ${i}: rows must be in time order`);
    prevAt = r.at;
    if (!r.chip || !nonEmpty(r.chip.text) || !(r.chip.litAt >= r.at)) throw new Error(`row ${i}: chip needs text and a litAt at or after the row's at`);
    const s = r.slot;
    if (!s) throw new Error(`row ${i} needs a slot`);
    const extraSlot = unknownKey(s, SLOT_KEYS);
    if (extraSlot) throw new Error(`row ${i}: slot key "${extraSlot}" is not allowed, a slot has only state, emptyLabel, labelAt`);
    if (s.state !== "empty") throw new Error(`row ${i}: slot state must be "empty"`);
    if (!Array.isArray(s.emptyLabel) || !s.emptyLabel.every(nonEmpty)) throw new Error(`row ${i}: slot emptyLabel must be an array of lines`);
  });
  const f = cfg.focus;
  if (f && !(Number.isInteger(f.row) && f.row >= 0 && f.row < cfg.rows.length && f.until > f.at)) throw new Error("focus needs a row index inside the ledger and at < until");
  if (cfg.slotCrawl !== undefined && !(cfg.slotCrawl >= 0 && cfg.slotCrawl <= MAX_CRAWL_PX_S)) throw new Error(`slotCrawl must be 0 to ${MAX_CRAWL_PX_S} px per second`);
  for (const c of cfg.captions ?? []) if (!(c.until > c.at) || !Array.isArray(c.lines)) throw new Error("every caption needs at < until and a lines array");
}

/** 0..1 linear fade in over [a, a + d]. */
const fadeIn = (t, a, d) => win(t, a, a + d);
/** Shown over [a, b]: linear in, linear out, so no step is steeper than 1 / (fade * fps). */
const shown = (t, a, b, fin = CAP_IN_S, fout = CAP_OUT_S) => Math.min(fadeIn(t, a, fin), 1 - win(t, b - fout, b));

/** One text item; tones are ink, inkSoft or paper (on a solid chip). */
const T = (key, text, x, y, px, op, o = {}) => ({ key, text, x, y, px, op, anchor: "start", weight: 500, tone: "ink", ...o });

function geometry(cfg, W, H) {
  const { name, L: base, s } = pickLayout(LAYOUTS, W, H);
  const L = { ...base, ...(cfg.layouts?.[name] ?? {}) };
  const ox = (W - L.size[0] * s) / 2;
  const oy = (H - L.size[1] * s) / 2;
  return { name, L, s, X: (x) => ox + x * s, Y: (y) => oy + y * s };
}

/** Focus dim factor for row i: 1, or easing down to focus.dim while the focus window runs. */
function dimAt(cfg, i, t) {
  const f = cfg.focus;
  if (!f || i === f.row) return 1;
  const k = Math.min(fadeIn(t, f.at, FOCUS_FADE_S), 1 - win(t, f.until, f.until + FOCUS_FADE_S));
  return 1 - (1 - (f.dim ?? 0.4)) * k;
}

/** Slow outline breath on the focus slot, PULSE_HZ at most, starting from 0 and easing out before the window ends. */
function pulseAt(cfg, i, t) {
  const f = cfg.focus;
  if (!f || !f.pulse || i !== f.row || t < f.at || t > f.until) return 0;
  return (0.5 - 0.5 * Math.cos(2 * Math.PI * PULSE_HZ * (t - f.at))) * (1 - win(t, f.until - FOCUS_FADE_S, f.until));
}

function rowsAt(cfg, G, t, vars) {
  const { L, s, X, Y } = G;
  const rows = [];
  const texts = [];
  cfg.rows.forEach((r, i) => {
    const top = Y(L.rows.top + i * L.rows.pitch);
    const lift = ROW_RISE * s * (1 - eased(t, r.at, r.at + ROW_IN_S, "easeOutCubic"));
    const op = fadeIn(t, r.at, ROW_IN_S);
    const dim = dimAt(cfg, i, t);
    const y = top + lift;
    const sh = L.slot.h * s;
    const cy = y + sh / 2;
    const ch = L.chip.h * s;
    const lit = fadeIn(t, r.chip.litAt, CHIP_FADE_S);
    // the empty slot's dashes march slowly round its outline from the moment the row lands: still waiting for a number, a pure function of t
    const dash = Math.max(0, t - r.at) * (cfg.slotCrawl ?? 0) * s;
    const slot = { x0: X(L.slot.x0), y0: y, w: L.slot.w * s, h: sh, pulse: pulseAt(cfg, i, t), dash };
    rows.push({ i, y, op, dim, chip: { x0: X(L.chip.x0), x1: X(L.chip.x1), y0: cy - ch / 2, h: ch, lit }, slot });
    const o = op * dim;
    texts.push(T(`row-${i}-label`, fillVars(r.label, vars), X(L.label.x), y + L.rows.line1 * s, L.rows.labelPx * s, o, { weight: 600 }));
    texts.push(T(`row-${i}-meta`, fillVars(r.meta, vars), X(L.label.x), y + L.rows.line2 * s, L.rows.metaPx * s, o, { tone: "inkSoft" }));
    const cpx = L.chip.px * s;
    texts.push(T(`chip-${i}`, r.chip.text, (X(L.chip.x0) + X(L.chip.x1)) / 2, cy + cpx * 0.35, cpx, o * (0.6 + 0.4 * lit), { anchor: "middle", weight: 600, tone: "inkSoft", lit }));
    const n = r.slot.emptyLabel.length;
    const spx = TEXT_MIN_PX * s;
    const gap = spx * 1.13;
    const lo = fadeIn(t, r.slot.labelAt ?? Infinity, SLOT_LABEL_S);
    r.slot.emptyLabel.forEach((line, li) => {
      const by = cy + (li - (n - 1) / 2) * gap + spx * 0.3;
      texts.push(T(`slot-${i}-${li}`, line, slot.x0 + slot.w / 2, by, spx, o * lo, { anchor: "middle", tone: "inkSoft" }));
    });
  });
  return { rows, texts };
}

function headTexts(cfg, G, t, vars) {
  const h = cfg.heads;
  if (!h) return [];
  const { L, s, X, Y } = G;
  const px = L.heads.px * s;
  const op = fadeIn(t, h.at ?? 0, FADE_S);
  const out = wrapText(h.label, L.label.w * s, px).map((txt, i) => T(`head-label-${i}`, txt, X(L.label.x), Y(L.heads.y) + i * L.heads.lineGap * s, px, op, { tone: "inkSoft" }));
  out.push(T("head-chip", h.chip, X(L.chip.x0), Y(L.heads.y), px, op, { tone: "inkSoft" }));
  out.push(T("head-slot", h.slot, X(L.slot.x0), Y(L.heads.y), px, op, { tone: "inkSoft" }));
  const b = cfg.badge;
  if (b) out.push(T("badge", fillVars(b.text, vars), X(L.badgeX), Y(L.heads.y), px, shown(t, b.at, b.until, FADE_S, FADE_S), { anchor: "end", weight: 600 }));
  return out;
}

function captionTexts(cfg, G, t, vars) {
  const { L, s, X, Y } = G;
  const C = L.cap;
  const px = C.px * s;
  const out = [];
  for (const [ci, cap] of (cfg.captions ?? []).entries()) {
    if (t < cap.at || t > cap.until) continue;
    let row = 0;
    for (const [li, line] of cap.lines.entries()) {
      const spec = typeof line === "string" ? { text: line } : line;
      const op = shown(t, cap.at + (spec.delay ?? 0), cap.until);
      for (const [wi, txt] of wrapText(fillVars(spec.text, vars), C.w * s * (EM / EM_BOLD), px).entries()) {
        out.push(T(`cap-${ci}-${li}-${wi}`, txt, X(C.x), Y(C.y) + row * px * 1.25, px, op, { anchor: C.align, weight: 700 }));
        row++;
      }
    }
    if (cap.source) {
      const sp = TEXT_MIN_PX * s;
      for (const [wi, txt] of wrapText(fillVars(cap.source, vars), L.source.w * s, sp).entries()) {
        out.push(T(`src-${ci}-${wi}`, txt, X(C.x), Y(L.source.y) + wi * sp * 1.25, sp, shown(t, cap.at, cap.until), { anchor: C.align, tone: "inkSoft" }));
      }
    }
  }
  if (cfg.footer && t >= cfg.footer.at) {
    out.push(T("footer", cfg.footer.text, X(C.x), Y(L.footerY), TEXT_MIN_PX * s, fadeIn(t, cfg.footer.at, FADE_S), { anchor: C.align, tone: "inkSoft" }));
  }
  return out;
}

/** Faint row guides that sketch the empty ledger in beat 1, one hairline under each row slot. */
function guidesAt(cfg, G, t) {
  const g = cfg.guides;
  if (!g) return [];
  const { L, s, X, Y } = G;
  return cfg.rows.map((_, i) => ({ i, y: Y(L.rows.top + i * L.rows.pitch + L.slot.h + (L.rows.pitch - L.slot.h) / 2), x0: X(L.label.x), x1: X(L.slot.x0 + L.slot.w), op: fadeIn(t, g.at + i * (g.step ?? 0), FADE_S) }));
}

/** The whole frame at time t (scene clock, seconds). No state: the same inputs always give the same frame. */
export function frameAt(cfg, W, H, t) {
  validateConfig(cfg);
  const vars = cfg.vars ?? {};
  const G = geometry(cfg, W, H);
  const { rows, texts: rowTexts } = rowsAt(cfg, G, t, vars);
  const guides = guidesAt(cfg, G, t);
  const texts = [...headTexts(cfg, G, t, vars), ...rowTexts, ...captionTexts(cfg, G, t, vars)];
  const alphas = {};
  for (const x of texts) alphas[`text:${x.key}`] = x.op;
  for (const r of rows) {
    alphas[`row:${r.i}`] = r.op * r.dim;
    alphas[`chipfill:${r.i}`] = r.op * r.dim * r.chip.lit;
    alphas[`pulse:${r.i}`] = r.slot.pulse;
  }
  for (const g of guides) alphas[`guide:${g.i}`] = g.op;
  return { s: G.s, layout: G.name, rows, guides, texts, alphas };
}
