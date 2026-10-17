// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/motionMath.js (tween, eased, mix: reused for every channel, so nothing moves except through an eased interval);
//   1_social/py/video-gen/engine/growLineMath.js and 1_social/py/video-gen/engine/chartStoryMath.js (fixed chart chains, no graph of nodes and edges, so not reusable for a money-flow network);
//   1_social/py/video-gen/engine/sketchMath.js (hand-drawn shapes from seeded jitter, no layout solver).
// Pure maths for FlowNetwork: a directed money-flow graph whose layout relaxes as deals land.
// Everything is a function of the config, the frame size and the time t (seconds on the scene clock), so any frame can be drawn alone and in any order.
// The force-directed relaxation is a fixed-iteration solver started from the step's anchors: no randomness, no state between frames.
import { clamp, eased, mix, tween } from "./motionMath.js";

export const ENTER_S = 0.9; // a node slides from its waiting spot to its place in the graph over this long
export const APPEAR_S = 0.6; // fade-in of a node label in the opening scatter
export const ACTIVATE_S = 0.5; // a node brightens from WAIT_OPACITY to full once it gets its first edge
export const WAIT_OPACITY = 0.4; // storyboard: non-active nodes sit at 40 percent until their first edge
export const TEXT_FLOOR = 0.7; // dimmed text never drops below this opacity of ink on paper (about 5.8:1 on the ev-advisory paper), so every label stays readable; dimmed text is drawn in ink, never inkSoft
export const DRAW_S = 0.5; // an edge draws from payer to payee over this long
export const DOT_TRIP_S = 0.8; // first trip of the money dot, payer to payee, after the edge lands
export const DOT_LOOP_S = 3.2; // then it loops slowly while the edge stays
export const DOT_FADE_S = 0.2; // the dot fades in on landing, never pops
export const DRIFT_PX = 8; // slow drift of a waiting node, px at layout scale 1
export const DRIFT_PERIOD_S = 7;
export const CAPTION_IN_S = 0.35;
export const CAPTION_OUT_S = 0.3;
export const GLOW_FADE_S = 0.6;
export const WARM_PULSE_HZ = 0.5; // weak-link glow: at or under 1 Hz, a slow breathe, never a flash
export const LABEL_HIDE_LOOK = 0.3; // an edge dimmed to this look or below drops its value label (focus beats), so receded labels never clutter the figure in focus
export const EM = 0.56; // average glyph width of Geist SemiBold as a fraction of font size, for wrapping only
const RELAX_ITERS = 90;

/** Pick the layout whose design aspect is closest to W / H (log distance), and the scale from its design size to this frame. */
export function pickLayout(layouts, W, H) {
  if (!(W > 0) || !(H > 0)) throw new Error(`pickLayout needs a positive size, got ${W} x ${H}`);
  const names = Object.keys(layouts ?? {});
  if (!names.length) throw new Error("FlowNetwork config has no layouts");
  const want = Math.log(W / H);
  const dist = (n) => Math.abs(Math.log(layouts[n].size[0] / layouts[n].size[1]) - want);
  const best = names.reduce((a, n) => (dist(n) < dist(a) ? n : a), names[0]);
  const L = layouts[best];
  return { name: best, L, s: Math.min(W / L.size[0], H / L.size[1]) };
}

/** Edge stroke width from dollars on a log scale: lo dollars gets wMin, hi gets wMax. */
export function edgeWidth(usd, lo, hi, wMin, wMax) {
  if (!(usd > 0) || !(lo > 0) || !(hi >= lo)) throw new Error(`edgeWidth needs positive dollars, got ${usd} in ${lo}..${hi}`);
  if (hi === lo) return wMax;
  return wMin + clamp((Math.log10(usd) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (wMax - wMin);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => { const l = len(v); return l > 0 ? [v[0] / l, v[1] / l] : [1, 0]; };
const lerp2 = (a, b, u) => [mix(a[0], b[0], u), mix(a[1], b[1], u)];

/** Control point of a quadratic edge from a to b, pushed sideways by bend times the chord length (positive bends to the left of a->b on screen). */
export function controlPoint(a, b, bend) {
  const d = sub(b, a);
  return [(a[0] + b[0]) / 2 + d[1] * bend, (a[1] + b[1]) / 2 - d[0] * bend];
}

/** Point at u on the quadratic p0, c, p1. */
export const quadAt = (p0, c, p1, u) => lerp2(lerp2(p0, c, u), lerp2(c, p1, u), u);

/** Unit tangent at u on the quadratic. */
export const quadTangent = (p0, c, p1, u) => unit(sub(lerp2(c, p1, u), lerp2(p0, c, u)));

/** The part of the quadratic from 0 to u, as a quadratic of its own (de Casteljau split): [p0, c', end]. */
export function splitQuad(p0, c, p1, u) {
  const q = clamp(u);
  return [p0, lerp2(p0, c, q), quadAt(p0, c, p1, q)];
}

/** Edge geometry between two circles: the curve starts on the payer's rim and stops `gap` px short of the payee's rim. */
export function edgeCurve(a, ra, b, rb, bend, gap = 0) {
  const c0 = controlPoint(a, b, bend);
  const ta = unit(sub(c0, a));
  const tb = unit(sub(c0, b));
  const p0 = [a[0] + ta[0] * ra, a[1] + ta[1] * ra];
  const p1 = [b[0] + tb[0] * (rb + gap), b[1] + tb[1] * (rb + gap)];
  return { p0, c: controlPoint(p0, p1, bend), p1 };
}

/** SVG path data of a quadratic, two decimals so the output is stable. */
export const quadPath = ([p0, c, p1]) => `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} Q${c[0].toFixed(2)} ${c[1].toFixed(2)} ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;

/**
 * Fixed-iteration force-directed relaxation. Each node is held by a spring to its target, every edge pulls its two ends together
 * when they are further apart than `rest` times their mean radius, and circles closer than their radii plus `gap` are pushed apart.
 * Same input, same output: no randomness, the iteration count is fixed.
 * @param {{ id: string, x: number, y: number, r: number }[]} nodes targets in px
 * @param {[string, string][]} edges
 * @param {{ x0: number, y0: number, x1: number, y1: number }} box nodes stay inside, rim included
 * @param {{ anchorK?: number, edgeK?: number, rest?: number, gap?: number, iters?: number }} [opts]
 */
export function relax(nodes, edges, box, opts = {}) {
  const { anchorK = 0.18, edgeK = 0.035, rest = 2.6, gap = 28, iters = RELAX_ITERS } = opts;
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const pos = nodes.map((n) => [n.x, n.y]);
  const pairs = edges.filter(([a, b]) => idx.has(a) && idx.has(b) && a !== b).map(([a, b]) => [idx.get(a), idx.get(b)]);
  for (let it = 0; it < iters; it++) {
    const f = pos.map((p, i) => [(nodes[i].x - p[0]) * anchorK, (nodes[i].y - p[1]) * anchorK]);
    for (const [i, j] of pairs) {
      const d = sub(pos[j], pos[i]);
      const l = len(d);
      const want = (rest * (nodes[i].r + nodes[j].r)) / 2;
      if (l <= want) continue;
      const pull = (edgeK * (l - want)) / l;
      f[i][0] += d[0] * pull; f[i][1] += d[1] * pull;
      f[j][0] -= d[0] * pull; f[j][1] -= d[1] * pull;
    }
    for (let i = 0; i < pos.length; i++) { pos[i][0] += f[i][0]; pos[i][1] += f[i][1]; }
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const d = sub(pos[j], pos[i]);
        const l = len(d);
        const min = nodes[i].r + nodes[j].r + gap;
        if (l >= min) continue;
        const u = l > 0 ? [d[0] / l, d[1] / l] : [1, 0];
        const push = (min - l) / 2;
        pos[i][0] -= u[0] * push; pos[i][1] -= u[1] * push;
        pos[j][0] += u[0] * push; pos[j][1] += u[1] * push;
      }
    }
    for (let i = 0; i < pos.length; i++) {
      const r = nodes[i].r;
      pos[i][0] = clamp(pos[i][0], box.x0 + r, box.x1 - r);
      pos[i][1] = clamp(pos[i][1], box.y0 + r, box.y1 - r);
    }
  }
  return Object.fromEntries(nodes.map((n, i) => [n.id, pos[i]]));
}

/** Greedy word wrap by estimated width (EM per char): lines no wider than maxW px where a word allows it. */
export function wrapText(text, maxW, px) {
  if (!(px > 0) || !(maxW > 0)) throw new Error(`wrapText needs positive sizes, got ${maxW} and ${px}`);
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && next.length * EM * px > maxW) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Fill {name.field} placeholders from vars, so one scene.json field can carry a figure and its date. An unknown name throws, so a typo fails the render. */
export function fillVars(text, vars = {}) {
  return String(text).replace(/\{([\w.]+)\}/g, (_, path) => {
    const v = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), vars);
    if (v === undefined || typeof v === "object") throw new Error(`FlowNetwork text names {${path}}, which is not in vars`);
    return String(v);
  });
}

/** 0..1 visibility of something shown over [a, b]: eases in from a, eases out to 0 at b. */
export const window01 = (t, a, b, fin = CAPTION_IN_S, fout = CAPTION_OUT_S) => Math.min(eased(t, a, a + fin), 1 - eased(t, b - fout, b));

/** Money dot along an edge that landed at `land`: a first trip in DOT_TRIP_S, then slow loops that fade in and out at the ends. Null before landing. */
export function dotAt(t, land) {
  const age = t - land;
  if (age < 0) return null;
  if (age < DOT_TRIP_S) {
    const u = eased(t, land, land + DOT_TRIP_S, "easeInOutSine");
    return { u, op: Math.min(eased(age, 0, DOT_FADE_S), 1 - eased(u, 0.85, 1)) };
  }
  const u = ((age - DOT_TRIP_S) / DOT_LOOP_S) % 1;
  return { u, op: Math.sin(Math.PI * u) };
}

const snap0 = (v) => (v < 1e-4 ? 0 : v); // tween residue (1e-45 and the like) is "off", so the part can skip the element

const zoneOf = (L, s) => {
  const [x0, y0, x1, y1] = L.zone;
  return { x0: x0 * s, y0: y0 * s, x1: x1 * s, y1: y1 * s };
};
const inZone = (z, f) => [mix(z.x0, z.x1, f[0]), mix(z.y0, z.y1, f[1])];

/** Validate a config: every edge, glow, ghost, ripple and step names known nodes; every layout has an anchor and a wait spot per node. Throws on the first problem. */
export function validateConfig(cfg) {
  const fail = (msg) => { throw new Error(`FlowNetwork: ${msg}`); };
  for (const key of ["nodes", "edges", "steps"]) if (!Array.isArray(cfg?.[key])) fail(`config needs a "${key}" array`);
  if (!cfg.nodes.length) fail("config has no nodes");
  if (!cfg.steps.length) fail("config needs at least one step");
  if (!cfg.layouts || !Object.keys(cfg.layouts).length) fail("config has no layouts");
  const finite = (v, where) => { if (!Number.isFinite(v)) fail(`${where} must be a finite number of seconds, got ${v}`); };
  const ids = new Set();
  for (const n of cfg.nodes) { if (ids.has(n.id)) fail(`node id "${n.id}" is used twice`); ids.add(n.id); finite(n.enter, `node ${n.id} enter`); }
  const known = (id, where) => { if (!ids.has(id)) fail(`${where} names node "${id}", which is not in nodes`); };
  const edgeIds = new Set();
  for (const e of cfg.edges) {
    if (edgeIds.has(e.id)) fail(`edge id "${e.id}" is used twice`);
    edgeIds.add(e.id);
    known(e.from, `edge ${e.id}`); known(e.to, `edge ${e.id}`); finite(e.at, `edge ${e.id} at`);
    if (!["solid", "dashed", "dotted"].includes(e.style)) fail(`edge ${e.id}: style must be solid, dashed or dotted`);
    if (!(e.usd > 0)) fail(`edge ${e.id}: usd must be a positive number of dollars`);
    if (e.chip !== undefined && !String(e.chip).trim()) fail(`edge ${e.id}: chip is empty`);
  }
  for (const g of cfg.glows ?? []) {
    g.ids.forEach((id) => known(id, "glow")); finite(g.at, "glow at"); finite(g.until, "glow until");
    if (!["warm", "cool"].includes(g.kind)) fail(`glow kind must be warm or cool, got ${g.kind}`);
  }
  for (const g of cfg.ghosts ?? []) { known(g.id, "ghost"); finite(g.at, "ghost at"); finite(g.until, "ghost until"); if (!(g.scale > 0)) fail("ghost scale must be positive"); }
  for (const r of cfg.ripples ?? []) { r.ids.forEach((id) => known(id, "ripple")); finite(r.at, "ripple at"); finite(r.until, "ripple until"); }
  for (const c of cfg.captions ?? []) { finite(c.at, "caption at"); finite(c.until, "caption until"); if (c.big) known(c.big.near, "caption big figure"); }
  let prev = -Infinity;
  for (const st of cfg.steps) {
    finite(st.at, `step ${st.name} at`);
    if (st.at < prev) fail(`step ${st.name} starts at ${st.at}, before the step listed above it: list steps in time order`);
    prev = st.at;
    if (!(st.dur > 0)) fail(`step ${st.name}: dur must be positive`);
    for (const [id, v] of Object.entries(st.scale ?? {})) { known(id, `step ${st.name}`); if (!(v > 0)) fail(`step ${st.name}: scale of ${id} must be positive`); }
    if (st.restScale !== undefined && !(st.restScale > 0)) fail(`step ${st.name}: restScale must be positive`);
    if (Array.isArray(st.keep)) st.keep.forEach((id) => known(id, `step ${st.name}`));
  }
  for (const [name, L] of Object.entries(cfg.layouts)) {
    if (!Array.isArray(L.size) || !Array.isArray(L.zone) || !(L.r > 0) || !L.caption) fail(`layout ${name} needs size, zone, r and caption`);
    for (const id of ids) {
      if (!L.anchors?.[id]) fail(`layout ${name} has no anchor for ${id}`);
      if (!L.wait?.[id]) fail(`layout ${name} has no wait spot for ${id}`);
    }
  }
  return cfg;
}

const kept = (st, id) => st.keep === undefined || st.keep === "all" || st.keep.includes(id);

/**
 * Relaxed target positions for every step, in px, plus per-node scale and look (dim factor) per step. Only nodes that have entered by the
 * end of a step and edges that have started by its start take part in the relaxation; the others keep their anchors (not drawn there yet).
 */
export function stepTargets(cfg, L, s) {
  const z = zoneOf(L, s);
  const r = L.r * s;
  return cfg.steps.map((st) => {
    const over = L.steps?.[st.name] ?? {};
    const raw = cfg.nodes.map((n) => {
      const keep = kept(st, n.id);
      const scale = st.scale?.[n.id] ?? (keep ? 1 : st.restScale ?? 1);
      const anchor = over[n.id] ?? (st.recede && !keep ? lerp2(L.anchors[n.id], L.wait[n.id], st.recede) : L.anchors[n.id]);
      const [x, y] = inZone(z, anchor);
      return { id: n.id, x, y, r: r * scale, scale, look: keep ? 1 : st.dim ?? 1, entered: n.enter <= st.at + st.dur };
    });
    const live = raw.filter((n) => n.entered);
    const edges = cfg.edges.filter((e) => e.at <= st.at).map((e) => [e.from, e.to]);
    const opts = { ...(L.relax ?? {}) };
    if (st.edgePull !== undefined) opts.edgeK = (opts.edgeK ?? 0.035) * st.edgePull; // a focus step can hold its composition instead of being dragged by its edges
    const solved = relax(live, edges, z, opts);
    return Object.fromEntries(raw.map((n) => [n.id, { x: solved[n.id]?.[0] ?? n.x, y: solved[n.id]?.[1] ?? n.y, scale: n.scale, look: n.look }]));
  });
}

const channel = (t, steps, targets, id, key) =>
  tween(t, targets[0][id][key], steps.map((st, i) => ({ at: st.at, dur: st.dur, to: targets[i][id][key], curve: "easeInOutCubic" })));

const firstEdgeAt = (cfg, id) => Math.min(Infinity, ...cfg.edges.filter((e) => e.from === id || e.to === id).map((e) => e.at));

/** Node state at time t: position (px), radius, opacity of the shape and of its label. */
export function nodesAt(cfg, L, s, targets, t) {
  const z = zoneOf(L, s);
  return cfg.nodes.map((n, i) => {
    const [wx, wy] = inZone(z, L.wait[n.id]);
    const ph = i * 1.7;
    const w = (2 * Math.PI * t) / DRIFT_PERIOD_S;
    const act = eased(t, n.enter, n.enter + ENTER_S, "easeInOutCubic");
    const x = mix(wx + Math.sin(w + ph) * DRIFT_PX * s, channel(t, cfg.steps, targets, n.id, "x"), act);
    const y = mix(wy + Math.cos(w / 1.3 + ph) * DRIFT_PX * s, channel(t, cfg.steps, targets, n.id, "y"), act);
    const scale = mix(1, channel(t, cfg.steps, targets, n.id, "scale"), act);
    const look = channel(t, cfg.steps, targets, n.id, "look");
    const appear = eased(t, n.appear ?? 0, (n.appear ?? 0) + APPEAR_S);
    const first = firstEdgeAt(cfg, n.id);
    const activeOp = Number.isFinite(first) ? mix(WAIT_OPACITY, 1, eased(t, first, first + ACTIVATE_S)) : WAIT_OPACITY;
    return { id: n.id, lines: n.lines ?? [n.id], x, y, r: L.r * s * scale, scale, look, op: appear * activeOp * look, textOp: appear * Math.max(activeOp * look, TEXT_FLOOR) };
  });
}

/** Edge state at time t: drawn part of the curve, width, opacity, label point, money dot. Edges not yet started are left out. */
export function edgesAt(cfg, L, s, nodes, t, tc) {
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const usd = cfg.edges.map((e) => e.usd);
  const lo = Math.min(...usd);
  const hi = Math.max(...usd);
  const w = cfg.widths ?? { min: 3, max: 14 };
  return cfg.edges.flatMap((e) => {
    const p = eased(t, e.at, e.at + DRAW_S, "easeInOutCubic");
    if (p <= 0) return [];
    const a = by[e.from];
    const b = by[e.to];
    const width = edgeWidth(e.usd, lo, hi, w.min, w.max) * s;
    const curve = edgeCurve([a.x, a.y], a.r, [b.x, b.y], b.r, e.bend ?? 0.08, width * 1.6 + 4 * s);
    const drawn = splitQuad(curve.p0, curve.c, curve.p1, p);
    const lab = { u: 0.5, side: 1, off: 46, ...(e.label ?? {}), ...(L.labels?.[e.id] ?? {}) };
    const lp = quadAt(curve.p0, curve.c, curve.p1, lab.u);
    const tan = quadTangent(curve.p0, curve.c, curve.p1, lab.u);
    const nrm = [tan[1] * lab.side, -tan[0] * lab.side];
    const look = Math.min(a.look, b.look);
    const dot = dotAt(t, e.at + DRAW_S);
    return [{
      id: e.id, style: e.style, open: !!e.open, value: e.value, kind: e.kind, chip: e.chip, width, p,
      full: [curve.p0, curve.c, curve.p1], drawn, tip: drawn[2], tipDir: quadTangent(drawn[0], drawn[1], drawn[2], 1), op: look,
      label: { x: lp[0] + (nrm[0] * lab.off + (lab.dx ?? 0)) * s, y: lp[1] + (nrm[1] * lab.off + (lab.dy ?? 0)) * s, op: snap0(eased(tc, e.at + 0.3, e.at + 0.8) * eased(look, LABEL_HIDE_LOOK, LABEL_HIDE_LOOK + 0.08) * Math.max(look, TEXT_FLOOR)) },
      chipOp: e.chip ? window01(tc, e.at + 0.6, e.chipUntil ?? Infinity) : 0,
      chipLines: e.chip ? wrapText(e.chip, (lab.chipW ?? 1e6) * s, (L.edgeKindPx ?? 24) * s) : [],
      chipAt: [(lab.chipDx ?? 0) * s, (lab.chipDy ?? 0) * s],
      dot: dot && p >= 1 ? { at: quadAt(curve.p0, curve.c, curve.p1, dot.u), op: dot.op * look } : null,
    }];
  });
}

/** Caption blocks visible at tc (crisp clock), with each line wrapped and stacked, and its opacity. */
export function captionsAt(cfg, L, s, tc, vars) {
  const C = L.caption;
  return (cfg.captions ?? []).flatMap((c, ci) => {
    const vis = window01(tc, c.at, c.until);
    if (vis <= 0) return [];
    const box = c.center ? { ...C, ...(C.center ?? {}) } : C;
    let y = box.y * s;
    const rows = [];
    for (const [li, line] of (c.lines ?? []).entries()) {
      const role = line.role ?? "head";
      const px = (role === "body" ? box.bodyPx ?? box.headPx : role === "small" ? box.smallPx ?? box.sourcePx ?? C.sourcePx : box.headPx) * s;
      const op = window01(tc, c.at + (line.delay ?? 0), c.until);
      for (const text of wrapText(fillVars(line.text, vars), box.w * s, px)) {
        y += px * 1.2;
        rows.push({ key: `${ci}-${li}-${rows.length}`, text, x: box.x * s, y, px, role, weight: role === "head" ? 600 : 500, op });
      }
    }
    const chip = c.chip ? { lines: wrapText(fillVars(c.chip, vars), (box.w - 48) * s, box.chipPx * s), px: box.chipPx * s, x: box.x * s, y: y + 20 * s, op: window01(tc, c.at + (c.chipDelay ?? 0.5), c.until) } : null;
    const source = c.source ? { text: fillVars(c.source, vars), x: box.x * s, y: (box.sourceY ?? C.sourceY) * s, px: (box.sourcePx ?? C.sourcePx) * s, op: vis } : null;
    const big = c.big ? { text: fillVars(c.big.text, vars), near: c.big.near, op: window01(tc, c.at + (c.big.delay ?? 0), c.until) } : null;
    return [{ key: `c${ci}`, align: box.align ?? "start", rows, chip, source, big }];
  });
}

/** Persistent small notes (footer, attributions) visible at tc. A note with no spot in this layout is not drawn. */
export function notesAt(cfg, L, s, tc, vars) {
  return (cfg.notes ?? []).flatMap((n) => {
    const op = window01(tc, n.at, n.until, 0.5, 0.4);
    const at = L.notes?.[n.id];
    if (op <= 0 || !at) return [];
    return [{ id: n.id, text: fillVars(n.text, vars), x: at.x * s, y: at.y * s, px: at.px * s, anchor: at.anchor ?? "start", op }];
  });
}

/** Glows (warm pulse or cool ring), ghost rings and stress ripples at t, tied to the nodes' current positions. */
export function effectsAt(cfg, nodes, t) {
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const glows = (cfg.glows ?? []).flatMap((g, gi) => {
    const env = window01(t, g.at, g.until, GLOW_FADE_S, GLOW_FADE_S);
    if (env <= 0) return [];
    const pulse = g.kind === "warm" ? 0.62 + 0.38 * Math.sin(2 * Math.PI * WARM_PULSE_HZ * (t - g.at)) : 1;
    return g.ids.map((id) => ({ key: `g${gi}-${id}`, kind: g.kind, x: by[id].x, y: by[id].y, r: by[id].r, op: env * pulse * Math.max(by[id].look, 0.5) }));
  });
  const ghosts = (cfg.ghosts ?? []).flatMap((g, gi) => {
    const op = window01(t, g.at, g.until, 0.6, 0.6);
    const n = by[g.id];
    return op > 0 ? [{ key: `h${gi}`, x: n.x, y: n.y, r: (n.r / n.scale) * g.scale, op }] : [];
  });
  const ripples = (cfg.ripples ?? []).flatMap((rp, ri) => {
    const env = window01(t, rp.at, rp.until, 0.5, 0.6);
    if (env <= 0) return [];
    const period = rp.period ?? 1.6;
    return rp.ids.flatMap((id) => [0, 0.5].map((off) => {
      const age = ((((t - rp.at) / period + off) % 1) + 1) % 1;
      const n = by[id];
      return { key: `r${ri}-${id}-${off}`, x: n.x, y: n.y, r: n.r * (1 + ((rp.reach ?? 1.9) - 1) * age), op: env * Math.sin(Math.PI * age) * 0.7 };
    }));
  });
  return { glows, ghosts, ripples };
}

/**
 * The whole frame at scene time t (raw clock, for shapes) and tc (crisp clock, for text). Pure: same arguments, same result.
 * @param {any} cfg FlowNetwork config (scene.json data.network, or beat.network)
 */
export function frameAt(cfg, W, H, t, tc = t) {
  validateConfig(cfg);
  const { name, L, s } = pickLayout(cfg.layouts, W, H);
  const targets = stepTargets(cfg, L, s);
  const nodes = nodesAt(cfg, L, s, targets, t);
  const vars = cfg.vars ?? {};
  const docked = dockChips(edgesAt(cfg, L, s, nodes, t, tc), captionsAt(cfg, L, s, tc, vars), L, s);
  return { layout: name, s, L, nodes, ...docked, notes: notesAt(cfg, L, s, tc, vars), ...effectsAt(cfg, nodes, t) };
}

/**
 * A layout can dock an edge's chip into the caption block (labels[edgeId].chipDock = "caption") when the graph has no room for it,
 * for example a square frame. The chip then takes the caption's chip slot under its rows, with the edge chip's own fade, and is not drawn on the edge.
 * A caption that already carries a chip keeps it, and the edge keeps its chip on the graph.
 */
export function dockChips(edges, captions, L, s) {
  const C = L.caption;
  let caps = captions;
  const outEdges = edges.map((e) => {
    if (!e.chip || e.chipOp <= 0 || L.labels?.[e.id]?.chipDock !== "caption") return e;
    const i = caps.findIndex((c) => !c.chip && c.rows.length > 0);
    if (i < 0) return e;
    const cap = caps[i];
    const last = cap.rows[cap.rows.length - 1];
    const px = C.chipPx * s;
    const chip = { lines: wrapText(e.chip, (C.w - 48) * s, px), px, x: last.x, y: last.y + 20 * s, op: e.chipOp };
    caps = caps.map((c, j) => (j === i ? { ...c, chip } : c));
    return { ...e, chipOp: 0 };
  });
  return { edges: outEdges, captions: caps };
}
