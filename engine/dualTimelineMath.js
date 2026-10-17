// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/growLineMath.js (clamp01, smooth: imported, not copied),
//   1_social/py/video-gen/engine/flowNetworkMath.js (pickLayout, wrapText, fillVars, window01: imported; its graph maths is a force layout, not a time axis).
// Pure maths for DualTimeline (CMO-8232): lanes on one shared time axis. A continuous bar on one lane, a chain of equal blocks on another,
// lane spacing as one eased function of time, a playhead, brackets over block ranges, and a labelled gap band between the lanes.
// Every value is a function of (config, W, H, t), so any frame draws alone.
import { clamp01, smooth } from "./growLineMath.js";
import { fillVars, pickLayout, window01, wrapText } from "./flowNetworkMath.js";

export const MARGIN = 64; // px at 1080 wide: no text rectangle leaves this
export const TEXT_MIN_PX = 30; // every label, source line and footer is at least this big
export const PULSE_HZ = 0.5; // decision ticks and the gap band breathe at or under 1 Hz, never a flash
export const EM = 0.56; // glyph width as a fraction of font size, regular and medium weights
export const EM_BOLD = 0.6; // the same for semibold and bold
const FADE_S = 0.5;
const GAP_BASE = 0.26; // amber band alpha at rest; the pulse adds up to GAP_DEPTH
const GAP_DEPTH = 0.1;
const BOX_PAD = 16;

/** Design layouts in px at their own size. Lane labels sit in a left gutter (64 to x0), so the axis starts at x0, clear of "Lease". */
export const LAYOUTS = {
  tall: { size: [1080, 1920], x0: 208, x1: 1016, bondY: 520, barH: 56, lanePx: 36, px: 30, axisGap: 122, cap: { x: 540, y: 1330, w: 900, px: 44, align: "middle" }, source: { y: 1600, w: 950 }, footerY: 1700 },
  wide: { size: [1920, 1080], x0: 224, x1: 1728, bondY: 210, barH: 48, lanePx: 36, px: 30, axisGap: 116, cap: { x: 64, y: 810, w: 1500, px: 48, align: "start" }, source: { y: 930, w: 1700 }, footerY: 1000 },
  square: { size: [1080, 1080], x0: 208, x1: 1016, bondY: 200, barH: 48, lanePx: 36, px: 30, axisGap: 106, cap: { x: 540, y: 770, w: 900, px: 40, align: "middle" }, source: { y: 885, w: 950 }, footerY: 990 },
};

const bump = (u) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u)); // one rise and fall over u in 0..1
const nonEmpty = (x) => typeof x === "string" && x.trim().length > 0;

/** Screen rectangle of a text item, from an estimated glyph width; boxed items (chips) include their padding. */
export function textRect(tx) {
  const pad = tx.box ? BOX_PAD * (tx.s ?? 1) : 0;
  const w = tx.text.length * (tx.weight >= 600 ? EM_BOLD : EM) * tx.px + 2 * pad;
  const x0 = tx.anchor === "middle" ? tx.x - w / 2 : tx.anchor === "end" ? tx.x - w : tx.x;
  return { x0, x1: x0 + w, y0: tx.y - 0.8 * tx.px - pad * 0.6, y1: tx.y + 0.25 * tx.px + pad * 0.6 };
}

/** Throws a message naming the problem; a gap band without its label never renders. */
export function validateConfig(cfg) {
  if (!cfg || !Array.isArray(cfg.lanes) || !cfg.lanes.length) throw new Error('DualTimeline config needs a "lanes" array');
  const ids = new Set();
  for (const l of cfg.lanes) { if (ids.has(l.id)) throw new Error(`lane "${l.id}" is used twice`); ids.add(l.id); }
  for (const key of ["bar", "blocks"]) if (cfg[key] && !ids.has(cfg[key].lane)) throw new Error(`${key} lane "${cfg[key].lane}" is not a lane`);
  const ax = cfg.axis;
  if (!ax || !(ax.to > ax.from)) throw new Error("axis needs from < to");
  const sp = cfg.spread;
  if (!sp || !(sp.base > 0) || !(sp.dur > 0)) throw new Error("spread needs a positive base and dur");
  let prev = { at: -Infinity, px: sp.base };
  for (const st of sp.steps ?? []) {
    if (!(st.px >= prev.px)) throw new Error(`spread steps must rise in px, ${st.px} after ${prev.px}`);
    if (!(st.at >= prev.at)) throw new Error("spread steps must be in time order");
    prev = st;
  }
  const K = cfg.blocks?.items?.length ?? 0;
  if (cfg.blocks && (!(cfg.blocks.years > 0) || K * cfg.blocks.years > ax.to - ax.from)) throw new Error(`blocks: ${K} x ${cfg.blocks.years} years do not fit the axis`);
  for (const b of cfg.brackets ?? []) {
    if (b.kind === "span" && !(b.from >= 0 && b.to < K && b.from <= b.to)) throw new Error(`bracket span ${b.from}..${b.to} is outside block 0..${K - 1}`);
    if (b.kind !== "span" && b.kind !== "ticks") throw new Error(`bracket kind must be span or ticks, got ${b.kind}`);
    if (!nonEmpty(b.label)) throw new Error("every bracket needs a label");
  }
  if (cfg.gap) {
    if (!nonEmpty(cfg.gap.label)) throw new Error("gap band needs a label string, it never renders without one");
    if (cfg.gap.px !== undefined && !(cfg.gap.px >= TEXT_MIN_PX)) throw new Error(`gap label px must be ${TEXT_MIN_PX} or larger`);
    if (!(cfg.gap.fromBlock >= 0 && cfg.gap.fromBlock < Math.max(K, 1))) throw new Error("gap fromBlock is not a block");
  }
}

/** Lane spacing in design px: base, then each step eases in over spread.dur. Never shrinks when steps rise. */
export function spreadAt(sp, t) {
  return (sp.steps ?? []).reduce((acc, st, i, all) => acc + (st.px - (i ? all[i - 1].px : sp.base)) * smooth(t, st.at, st.at + sp.dur), sp.base);
}

function geometry(cfg, W, H) {
  const { name, L: base, s } = pickLayout(LAYOUTS, W, H);
  const L = { ...base, ...(cfg.layouts?.[name] ?? {}) };
  const ox = (W - L.size[0] * s) / 2; // centre the design box if the aspect is not exact
  const oy = (H - L.size[1] * s) / 2;
  const X = (x) => ox + x * s;
  const Y = (y) => oy + y * s;
  return { name, L, s, X, Y, x0: X(L.x0), x1: X(L.x1) };
}

function lanesAt(cfg, G, t) {
  const sep = spreadAt(cfg.spread, t) * G.s;
  const bondY = G.Y(G.L.bondY);
  const maxSep = Math.max(cfg.spread.base, ...(cfg.spread.steps ?? []).map((x) => x.px)) * G.s;
  const lanes = cfg.lanes.map((l, i) => ({ id: l.id, label: l.label, y: bondY + i * sep, op: smooth(t, l.at ?? 0, (l.at ?? 0) + FADE_S) }));
  const h = G.L.barH * G.s;
  const axisY = bondY + (cfg.lanes.length - 1) * maxSep + h / 2 + G.L.axisGap * G.s;
  return { sep, lanes, h, axisY, by: Object.fromEntries(lanes.map((l) => [l.id, l])) };
}

function blocksAt(cfg, G, R, t) {
  const B = cfg.blocks;
  if (!B) return { blocks: [], ticks: [] };
  const w = (B.years / (cfg.axis.to - cfg.axis.from)) * (G.x1 - G.x0);
  const lane = R.by[B.lane];
  const inset = 3 * G.s;
  const K = B.items.length;
  const blocks = B.items.map((it, i) => ({
    i, x0: G.x0 + i * w, x1: G.x0 + (i + 1) * w, rx0: G.x0 + i * w + inset, rx1: G.x0 + (i + 1) * w - inset,
    y: lane.y, h: R.h, op: smooth(t, it.at, it.at + 0.4), fill: smooth(t, it.fill ?? it.at, (it.fill ?? it.at) + 0.5),
  }));
  const ph = cfg.playhead;
  const ticks = blocks.map((b, i) => {
    const showAt = (i < K - 1 ? B.items[i + 1].at : B.items[i].fill ?? B.items[i].at) + 0.2;
    const cross = ph ? ph.at + ph.dur * (b.x1 - G.x0) / (G.x1 - G.x0) : Infinity;
    const pulse = bump((t - cross) * PULSE_HZ * 2); // one rise and fall in 1 / (2 * PULSE_HZ) s
    return { i, x: b.x1, y: lane.y - R.h / 2 - 34 * G.s, r: 22 * G.s, op: smooth(t, showAt, showAt + 0.4), pulse };
  });
  return { blocks, ticks, w };
}

function bracketsAt(cfg, G, R, blocks, t) {
  const lease = R.by[cfg.blocks?.lane];
  if (!lease) return [];
  return (cfg.brackets ?? []).map((b, i) => {
    const dim = b.dim ? 1 - (1 - b.dim.to) * smooth(t, b.dim.at, b.dim.at + 0.6) : 1;
    const op = smooth(t, b.draw[0], b.draw[0] + 0.3) * dim;
    const p = smooth(t, b.draw[0], b.draw[1]);
    const labelOp = smooth(t, b.draw[1] - 0.3, b.draw[1] + 0.2) * dim;
    if (b.kind === "span") {
      return { key: `br-${i}`, kind: "span", x0: blocks[b.from].x0, x1: blocks[b.to].x1, y: lease.y - R.h / 2 - 70 * G.s, hook: 14 * G.s, p, op, labelOp, label: b.label };
    }
    const y = lease.y + R.h / 2 + 16 * G.s;
    return { key: `br-${i}`, kind: "ticks", x0: blocks[0].x0, x1: blocks[blocks.length - 1].x1, y, p, op, labelOp, label: b.label, ticks: blocks.map((k) => ({ x0: k.rx0 + 6 * G.s, x1: k.rx1 - 6 * G.s })) };
  });
}

function gapAt(cfg, G, R, blocks, t) {
  const g = cfg.gap;
  if (!g) return { op: 0, alpha: 0, pulse: 0 };
  const top = R.lanes[0];
  const bottom = R.by[cfg.blocks?.lane] ?? R.lanes[R.lanes.length - 1];
  const pad = 28 * G.s;
  const op = smooth(t, g.at, g.at + (g.fade ?? 1));
  const pulse = t > g.at ? 0.5 - 0.5 * Math.cos(2 * Math.PI * PULSE_HZ * (t - g.at)) : 0;
  const x0 = blocks.length ? blocks[g.fromBlock].x0 : G.x0;
  return { x0, x1: G.x1, y0: top.y + R.h / 2 + pad, y1: bottom.y - R.h / 2 - pad, op, alpha: op * (GAP_BASE + GAP_DEPTH * pulse), pulse };
}

/** One text item; tone is always ink or inkSoft, so gold and amber are never used for lettering. */
const T = (key, text, x, y, px, op, o = {}) => ({ key, text, x, y, px, op, anchor: "start", weight: 500, tone: "ink", ...o });

function captionTexts(cfg, G, t, vars) {
  const C = G.L.cap;
  const s = G.s;
  const px = C.px * s;
  const out = [];
  for (const [ci, cap] of (cfg.captions ?? []).entries()) {
    if (t < cap.at || t > cap.until) continue;
    let row = 0;
    for (const [li, line] of cap.lines.entries()) {
      const spec = typeof line === "string" ? { text: line } : line;
      const op = window01(t, cap.at + (spec.delay ?? 0), cap.until);
      for (const [wi, txt] of wrapText(fillVars(spec.text, vars), C.w * s * (EM / EM_BOLD), px).entries()) {
        out.push(T(`cap-${ci}-${li}-${wi}`, txt, G.X(C.x), G.Y(C.y) + row * px * 1.25, px, op, { anchor: C.align, weight: 700 }));
        row++;
      }
    }
    if (cap.source) {
      const sp = TEXT_MIN_PX * s;
      for (const [wi, txt] of wrapText(fillVars(cap.source, vars), G.L.source.w * s, sp).entries()) {
        out.push(T(`src-${ci}-${wi}`, txt, G.X(C.x), G.Y(G.L.source.y) + wi * sp * 1.25, sp, window01(t, cap.at, cap.until), { anchor: C.align, tone: "inkSoft" }));
      }
    }
  }
  return out;
}

function laneTexts(cfg, G, R, bar, blocks, ticks, brackets, gap, t, vars) {
  const s = G.s;
  const px = G.L.px * s;
  const ax = cfg.axis;
  const out = R.lanes.map((l) => T(`lane-${l.id}`, l.label, G.X(MARGIN), l.y + G.L.lanePx * s * 0.35, G.L.lanePx * s, l.op, { weight: 600 }));
  if (bar) {
    for (const [i, c] of (cfg.bar.chips ?? []).entries()) {
      out.push(T(`chip-${i}`, fillVars(c.text, vars), G.x0 + c.at * (G.x1 - G.x0), bar.y - bar.h / 2 - 34 * s, px, smooth(bar.p, c.at, c.at + 0.06), { anchor: "middle", box: true, s }));
    }
  }
  const yearY = R.axisY + 40 * s;
  out.push(T("year-start", ax.startLabel, G.x0, yearY, px, smooth(t, ax.at ?? 0, (ax.at ?? 0) + FADE_S), { anchor: "middle", weight: 600 }));
  if (ax.endLabel) out.push(T("year-end", ax.endLabel, G.x1, yearY, px, smooth(t, ax.endAt, ax.endAt + FADE_S), { anchor: "end", weight: 600 }));
  if (ax.note) out.push(T("scale-note", ax.note.text, (G.x0 + G.x1) / 2, yearY, px, smooth(t, ax.note.at, ax.note.at + FADE_S), { anchor: "middle", tone: "inkSoft" }));
  for (const b of blocks) out.push(T(`block-${b.i}`, cfg.blocks.label, (b.x0 + b.x1) / 2, b.y + px * 0.35, px, b.op, { anchor: "middle", weight: 600, plain: true }));
  for (const k of ticks) out.push(T(`tick-${k.i}`, "?", k.x, k.y + px * 0.35, px, k.op, { anchor: "middle", weight: 600, plain: true }));
  const note = cfg.blocks?.note;
  if (note && blocks.length) {
    const lane = R.by[cfg.blocks.lane];
    const op = note.until ? window01(t, note.at, note.until) : smooth(t, note.at, note.at + FADE_S);
    out.push(T("blocks-note", note.text, blocks[blocks.length - 1].x1, lane.y + R.h / 2 + 62 * s, px, op, { anchor: "end", tone: "inkSoft" }));
  }
  for (const b of brackets) {
    const y = b.kind === "span" ? b.y - 18 * s : b.y + 46 * s;
    out.push(T(`${b.key}-label`, b.label, b.kind === "span" ? (b.x0 + b.x1) / 2 : b.x0, y, px, b.labelOp, { anchor: b.kind === "span" ? "middle" : "start" }));
  }
  const span = brackets.find((b) => b.kind === "span");
  if (cfg.chip && span) out.push(T("sources-chip", cfg.chip.text, G.x1, span.y - 18 * s, px, window01(t, cfg.chip.at, cfg.chip.until ?? Infinity), { anchor: "end", box: true, s }));
  if (cfg.gap && gap.op > 0) out.push(T("gap-label", cfg.gap.label, (gap.x0 + gap.x1) / 2, (gap.y0 + gap.y1) / 2 + 0.3 * (cfg.gap.px ?? G.L.px) * s, (cfg.gap.px ?? G.L.px) * s, gap.op, { anchor: "middle", weight: 600 }));
  if (cfg.footer) {
    const f = cfg.footer;
    const op = f.until ? window01(t, f.at, f.until) : smooth(t, f.at, f.at + FADE_S);
    if (t >= f.at) out.push(T("footer", f.text, G.X(G.L.cap.x), G.Y(G.L.footerY), TEXT_MIN_PX * s, op, { anchor: G.L.cap.align, tone: "inkSoft" }));
  }
  return out;
}

/** The whole frame at time t (body clock, seconds). No state: the same inputs always give the same frame. */
export function frameAt(cfg, W, H, t) {
  validateConfig(cfg);
  const vars = cfg.vars ?? {};
  const G = geometry(cfg, W, H);
  const R = lanesAt(cfg, G, t);
  const barLane = cfg.bar ? R.by[cfg.bar.lane] : null;
  const p = cfg.bar ? smooth(t, cfg.bar.draw[0], cfg.bar.draw[1]) : 0;
  const bar = barLane ? { x0: G.x0, x1: G.x1, xe: G.x0 + p * (G.x1 - G.x0), y: barLane.y, h: R.h, p, op: barLane.op, capOp: smooth(t, cfg.bar.draw[1], cfg.bar.draw[1] + 0.3) } : null;
  const { blocks, ticks } = blocksAt(cfg, G, R, t);
  const ph = cfg.playhead;
  const playhead = ph ? { x: G.x0 + (G.x1 - G.x0) * clamp01((t - ph.at) / ph.dur), y0: R.lanes[0].y - R.h / 2 - 20 * G.s, y1: R.lanes[R.lanes.length - 1].y + R.h / 2 + 20 * G.s, op: window01(t, ph.at, ph.at + ph.dur + 0.4, 0.2, 0.3) } : null;
  const brackets = bracketsAt(cfg, G, R, blocks, t);
  const gap = gapAt(cfg, G, R, blocks, t);
  const axisOp = smooth(t, cfg.axis.at ?? 0, (cfg.axis.at ?? 0) + FADE_S);
  const axis = { y: R.axisY, x0: G.x0, x1: G.x1, op: axisOp, capOp: smooth(t, cfg.axis.endAt, cfg.axis.endAt + FADE_S) };
  const pulses = [...ticks.map((k) => ({ key: `tick-${k.i}`, v: k.pulse })), { key: "gap", v: gap.pulse }];
  const texts = [...laneTexts(cfg, G, R, bar, blocks, ticks, brackets, gap, t, vars), ...captionTexts(cfg, G, t, vars)];
  return { s: G.s, layout: G.name, sep: R.sep, lanes: R.lanes, axis, bar, blocks, ticks, playhead, brackets, gap, pulses, texts };
}
