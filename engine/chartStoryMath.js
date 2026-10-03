// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/morphMath.js (this round) and 1_social/py/video-gen/engine/motionMath.js, countValue.js (rounds 2 and 3). Method reference only, no code copied: Remocn/remocn (MIT) animated-bar-chart, animated-line-chart, rolling-number and infinite-bento-pan for the look of staggered bars, a drawn line with an end dot, a rolling figure and a camera that glides across one canvas.
// The data-story chain as pure maths: one series becomes a ring of wedges, the ring unrolls into a strip, the strip settles into bars, the bars settle into a line,
// the line is drawn into its end dot (absorb), the dot swells into a big number, and the number card splits into a row of small cards. Every element is ONE polygon that
// is interpolated through the stages (see morphMath.js), so each stage visibly becomes the next. at(t) is a pure function of time: any frame renders alone.
import { cameraAt } from "./cameraMath.js";
import { mixRgb, parseColor, rgbCss } from "./colorMath.js";
import { countValue } from "./countValue.js";
import { bentRectPoly, circlePoly, morphPoly, pointPoly, polyArea, roundedRectPoly, segmentQuad } from "./morphMath.js";
import { eased, mix } from "./motionMath.js";
import { areaGeometry, shareSegments, stackedSegments, tileReveal } from "./bentoMath.js";

/** Stage windows every story needs, each [startSeconds, endSeconds]. Order of the chain is the order listed. */
export const STAGE_WINDOWS = ["dotIn", "toRing", "unroll", "toBars", "toLine", "absorb", "swell", "count", "toCard", "split", "cardsIn"];
/** Extra windows for the little text: labels under the bars, the baseline rule. */
export const EXTRA_WINDOWS = ["labelsIn", "baselineIn"];
/** Optional window: when present the bento (stacked share bar and running-total area under the cards) is built, [start, end] of the first tile. */
export const BENTO_WINDOW = "bentoIn";

/** Layout defaults on a 1440 canvas, world coordinates in px. Scene data can override any group key by key. */
export const DEFAULT_LAYOUT = {
  ring: { cx: 0, cy: 0, inner: 170, outer: 262, dotR: 44, dotStart: 0.7, gap: 30 },
  strip: { cx: 1000, cy: 0 },
  bars: { baseY: 240, width: 150, gap: 60, maxH: 420, radius: 12 },
  line: { baseY: 200, height: 380, stroke: 10, dotR: 20 },
  number: { cx: 2150, cy: 0, circleR: 200, cardW: 520, cardH: 340, cardR: 56 },
  cards: { width: 200, height: 300, radius: 36, gap: 28 },
  bento: { gapY: 40, tileH: 300, radius: 36, gap: 28, stackW: 640, barH: 64, barRadius: 14, barGap: 4, areaH: 150, areaStroke: 6, tipR: 9 },
};

const TINT_MAX = 0.6; // lightest wedge is the accent mixed this far toward white
const COLLAPSED_AREA = 0.5; // px squared: a poly smaller than this is not drawn

/** Easing per stage. The unroll sweeps the longest distance, so it uses the sine curve: a lower peak speed means less motion-blur smear. */
const STAGE_CURVES = { unroll: "easeInOutSine" };

const win = (cfg, name, shift = 0) => {
  const w = cfg.tl[name];
  return [w[0] + shift, w[1]];
};

function validate(cfg) {
  const problems = [];
  const n = cfg.values?.length ?? 0;
  if (n < 2 || !cfg.values.every((v) => Number.isFinite(v) && v > 0)) problems.push("values needs at least two positive numbers");
  if (!Array.isArray(cfg.labels) || cfg.labels.length !== n) problems.push("labels must have one entry per value");
  if (cfg.cards !== undefined && (!Array.isArray(cfg.cards) || cfg.cards.length < 1 || !cfg.cards.every((c) => typeof c.label === "string" && Number.isFinite(c.share)))) problems.push("cards, when given, needs entries { label, share }; leave it out to derive one card per value");
  for (const name of [...STAGE_WINDOWS, ...EXTRA_WINDOWS]) {
    const w = cfg.tl?.[name];
    if (!Array.isArray(w) || w.length !== 2 || !(w[1] > w[0])) problems.push(`tl.${name} must be [start, end] with end after start`);
  }
  if (!Array.isArray(cfg.camera) || cfg.camera.length < 2) problems.push("camera needs at least two keys [t, cx, cy, zoom]");
  if (problems.length) throw new Error(`chart story config: ${problems.join("; ")}`);
}

/**
 * Build a story from scene data. Returns { layout, duration hints, at(t) }.
 * cfg: { values, labels, endValue?, cards?: [{ label, share }] (default: one card per value, its share of the total), tl: windows, camera: keys, colors: { accent, ink, card, line, paper }, layout?, ringInnerLag?, splitStagger? }
 */
export function buildStory(cfg) {
  validate(cfg);
  const L = Object.fromEntries(Object.keys(DEFAULT_LAYOUT).map((g) => [g, { ...DEFAULT_LAYOUT[g], ...(cfg.layout?.[g] ?? {}) }]));
  const n = cfg.values.length;
  const total = cfg.values.reduce((a, b) => a + b, 0);
  const maxV = Math.max(...cfg.values);
  const cum = cfg.values.reduce((acc, v) => [...acc, acc[acc.length - 1] + v / total], [0]);
  const lag = cfg.ringInnerLag ?? 0.3;
  const stagger = cfg.splitStagger ?? 0.08;
  const colors = cfg.colors;
  const accent = parseColor(colors.accent);
  const shades = cfg.values.map((_, i) => mixRgb(accent, "#ffffff", TINT_MAX * ((n - 1 - i) / (n - 1))));
  const endValue = cfg.endValue ?? cfg.values[n - 1];
  const shares = shareSegments(cfg.values);
  const cards = cfg.cards ?? cfg.labels.map((label, i) => ({ label, share: shares[i] }));

  const barsW = n * L.bars.width + (n - 1) * L.bars.gap;
  const barCx = cfg.values.map((_, i) => L.strip.cx - barsW / 2 + L.bars.width / 2 + i * (L.bars.width + L.bars.gap));
  const barTop = cfg.values.map((v) => L.bars.baseY - (v / maxV) * L.bars.maxH);
  const linePt = cfg.values.map((v, i) => [barCx[i], L.line.baseY - (v / maxV) * L.line.height]);
  const nm = L.number;
  const cardsTotalW = cards.length * L.cards.width + (cards.length - 1) * L.cards.gap;
  const smallCx = cards.map((_, j) => nm.cx - cardsTotalW / 2 + L.cards.width / 2 + j * (L.cards.width + L.cards.gap));

  const barPoly = cfg.values.map((_, i) => roundedRectPoly(barCx[i], (barTop[i] + L.bars.baseY) / 2, L.bars.width, L.bars.baseY - barTop[i], L.bars.radius));
  const linePoly = cfg.values.map((_, i) => (i < n - 1 ? segmentQuad(linePt[i], linePt[i + 1], L.line.stroke) : circlePoly(linePt[i][0], linePt[i][1], L.line.dotR)));
  const absorbed = cfg.values.map(() => pointPoly(linePt[n - 1][0], linePt[n - 1][1]));
  const bigCircle = circlePoly(nm.cx, nm.cy, nm.circleR);
  const bigCard = roundedRectPoly(nm.cx, nm.cy, nm.cardW, nm.cardH, nm.cardR);
  const smallPoly = cards.map((_, j) => roundedRectPoly(smallCx[j], nm.cy, L.cards.width, L.cards.height, L.cards.radius));

  const k = (t, name, shift = 0) => eased(t, ...win(cfg, name, shift), cfg.curves?.[name] ?? STAGE_CURVES[name] ?? "smooth");

  /** The ring: a dot grows into a ring of wedges. Parameters, then the wedge as a bent strip. */
  const ringState = (t) => {
    const dot = k(t, "dotIn");
    const [a, b] = cfg.tl.toRing;
    const gOuter = eased(t, a, b, "smooth");
    const gInner = eased(t, a + lag, b, "smooth");
    const outer = mix(L.ring.dotR * mix(L.ring.dotStart, 1, dot), L.ring.outer, gOuter); // the dot is already on screen at t = 0
    const inner = mix(0, L.ring.inner, gInner);
    return { outer, inner, rm: (inner + outer) / 2, th: outer - inner, gap: L.ring.gap * gInner, gInner };
  };

  const wedgePoly = (i, t) => {
    const r = ringState(t);
    const len = 2 * Math.PI * r.rm;
    const ku = k(t, "unroll");
    return bentRectPoly({
      u0: -len / 2 + cum[i] * len + r.gap / 2, u1: -len / 2 + cum[i + 1] * len - r.gap / 2,
      v0: -r.th / 2, v1: r.th / 2,
      kappa: (1 / r.rm) * (1 - ku),
      ox: mix(L.ring.cx, L.strip.cx, ku), oy: mix(L.ring.cy - r.rm, L.strip.cy, ku),
    });
  };

  const fillOf = (i, t) => mixRgb(mixRgb(accent, shades[i], ringState(t).gInner), accent, k(t, "toLine"));

  /** Poly of element i through every stage up to and including the card. Element n-1 is the one that becomes the number card. */
  const elementPoly = (i, t) => {
    let p = wedgePoly(i, t);
    p = morphPoly(p, barPoly[i], k(t, "toBars"));
    p = morphPoly(p, linePoly[i], k(t, "toLine"));
    if (i < n - 1) return morphPoly(p, absorbed[i], k(t, "absorb")); // the line is drawn into its end dot
    p = morphPoly(p, bigCircle, k(t, "swell"));
    return morphPoly(p, bigCard, k(t, "toCard"));
  };

  const cardFill = parseColor(colors.card);

  // The bento: two tiles under the cards that show the same series as a stacked share bar and a running-total area. Built only when scene data gives tl.bentoIn.
  const B = L.bento;
  const hasBento = Array.isArray(cfg.tl[BENTO_WINDOW]);
  const tileTop = nm.cy + L.cards.height / 2 + B.gapY;
  const rowX0 = nm.cx - cardsTotalW / 2;
  const tileW = [B.stackW, cardsTotalW - B.stackW - B.gap];
  const tileX0 = [rowX0, rowX0 + B.stackW + B.gap];
  const tilePoly = tileW.map((w, i) => roundedRectPoly(tileX0[i] + w / 2, tileTop + B.tileH / 2, w, B.tileH, B.radius));
  const tileSeed = tileW.map((w, i) => roundedRectPoly(tileX0[i] + w / 2, nm.cy + L.cards.height / 2 - 2, w * 0.9, 6, 3)); // a thin line at the foot of the cards
  const PAD = 40;
  const barY = tileTop + 140;
  const bentoAt = (t) => {
    if (!hasBento) return null;
    const win0 = cfg.tl[BENTO_WINDOW];
    const reveal = tileW.map((_, i) => tileReveal(t, win0, i));
    const content = tileW.map((_, i) => eased(t, win0[0] + i * 0.18 + 0.45, win0[0] + i * 0.18 + 0.95));
    const tiles = tilePoly.map((full, i) => ({ poly: morphPoly(tileSeed[i], full, reveal[i]), shadow: reveal[i], visible: reveal[i] > 0.001 }));
    const segs = stackedSegments({ x0: tileX0[0] + PAD, width: B.stackW - 2 * PAD, gap: B.barGap }, shares, t, [win0[0] + 0.7, win0[0] + 1.5], 0.12);
    const stack = {
      title: { x: tileX0[0] + PAD, y: tileTop + 70, opacity: content[0] },
      segments: segs.map((sg, j) => ({
        poly: roundedRectPoly(sg.x + sg.w / 2, barY, Math.max(sg.w, 0.01), B.barH, Math.min(B.barRadius, sg.w / 2)),
        visible: sg.w > 1, fill: rgbCss(shades[j]),
        label: { text: cfg.labels[j], x: sg.x + sg.fullW / 2, y: barY + B.barH / 2 + 44, opacity: content[0] * eased(t, win0[0] + 1.0 + j * 0.12, win0[0] + 1.5 + j * 0.12) },
      })),
    };
    const area = areaGeometry(cfg.values, { x0: tileX0[1] + PAD, baseY: tileTop + B.tileH - 56, width: tileW[1] - 2 * PAD, height: B.areaH }, eased(t, win0[0] + 0.9, win0[0] + 2.1, "easeInOutSine"));
    return { tiles, stack, area: { title: { x: tileX0[1] + PAD, y: tileTop + 70, opacity: content[1] }, ...area, opacity: content[1], stroke: B.areaStroke, tipR: B.tipR, baseY: tileTop + B.tileH - 56, x0: tileX0[1] + PAD, x1: tileX0[1] + tileW[1] - PAD } };
  };

  return {
    layout: L,
    barCx,
    barTop,
    linePt,
    smallCx,
    at(t) {
      const wedges = cfg.values.map((_, i) => {
        const poly = elementPoly(i, t);
        return { poly, fill: rgbCss(fillOf(i, t)), visible: polyArea(poly) > COLLAPSED_AREA };
      });
      const splitting = t >= cfg.tl.split[0];
      const main = wedges[n - 1];
      const cardShapes = splitting ? cards.map((c, j) => {
        const ks = k(t, "split", j * stagger);
        return { poly: morphPoly(main.poly, smallPoly[j], ks), fill: rgbCss(mixRgb(accent, cardFill, Math.min(1, Math.max(0, (ks - 0.45) / 0.55)))), outline: ks, shadow: ks };
      }) : [];
      const fadeOut = 1 - k(t, "absorb");
      const baseX0 = barCx[0] - L.bars.width / 2 - 36;
      const baseX1 = barCx[n - 1] + L.bars.width / 2 + 36;
      const numberOpacity = eased(t, cfg.tl.count[0] - 0.1, cfg.tl.count[0] + 0.3) * (1 - eased(t, cfg.tl.split[0], cfg.tl.split[0] + 0.35));
      return {
        camera: cameraAt(t, cfg.camera),
        wedges: splitting ? wedges.slice(0, n - 1) : wedges,
        cards: cardShapes,
        baseline: { x0: baseX0, x1: baseX0 + (baseX1 - baseX0) * k(t, "baselineIn"), y: L.bars.baseY, opacity: fadeOut },
        labels: cfg.labels.map((text, i) => ({ text, x: barCx[i], y: L.bars.baseY + 62, opacity: k(t, "labelsIn", i * 0.06) * fadeOut })),
        number: { x: nm.cx, y: nm.cy, clip: main.poly, value: countValue(t, { from: 0, to: endValue, start: cfg.tl.count[0], end: cfg.tl.count[1] }), opacity: numberOpacity },
        cardContent: cards.map((c, j) => {
          const w = [cfg.tl.cardsIn[0] + j * 0.1, cfg.tl.cardsIn[1] + j * 0.1];
          return {
            x: smallCx[j], y: nm.cy, label: c.label, opacity: eased(t, w[0], w[0] + 0.5, "smooth"),
            value: countValue(t, { from: 0, to: c.share, start: w[0] + 0.2, end: w[1] + 0.2 }),
            bar: eased(t, w[0] + 0.2, w[1] + 0.2, "smooth") * (c.share / 100),
          };
        }),
        bento: bentoAt(t),
      };
    },
  };
}

/** Key moments of a story for the contact sheet and the report: { name, start, end } per stage, in time order. */
export const stageTimes = (cfg) => STAGE_WINDOWS.map((name) => ({ name, start: cfg.tl[name][0], end: cfg.tl[name][1] }));
