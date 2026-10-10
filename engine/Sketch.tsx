// REUSE_CHECKED: none
// Hand-drawn, Excalidraw-style diagram part (CMO-6823). The beat carries `shapes` (data); each is drawn stroke by stroke from seeded jitter in engine/sketchMath.js.
// Font: Virgil (SIL OFL 1.1, Excalidraw's hand font). The scene supplies assets/fonts/Virgil.woff2 and its licence file.
// Shape fields: t (line | arrow | rect | ellipse | person | text | count), at [start, end] seconds, out [start, end] fade-out, ink and fill (brand colour key or hex), w stroke width.
// Everything is a pure function of time and props; text and strokes read the crisp clock so nothing ghosts under motion blur.
import React, { useMemo } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { useBeat, useBrand, useCrispSeconds } from "./beat";
import { win } from "./motionMath.js";
import { SEED, boilVariant, buildShape, countAt, drawProgress, formatInt, boilStrokes, hashSeed, revealStrokes, shapeOpacity, strokesToPath, textWidth } from "./sketchMath.js";

const FAMILY = "Virgil, 'Segoe Print', 'Bradley Hand', cursive";
const hold = delayRender("Load Virgil");
new FontFace("Virgil", `url(${staticFile("fonts/Virgil.woff2")})`)
  .load()
  .then((f) => {
    document.fonts.add(f);
    continueRender(hold);
  })
  .catch((e) => cancelRender(e));

const DEFAULT_CANVAS: [number, number] = [1920, 1080];
const STROKE_PX = 5;
const FILL_PX = 3;
const FILL_LAG = 0.1; // seconds after the outline finishes before the hatch starts
const FILL_DUR = 0.7;
const FILL_OPACITY = 0.55;
const CLIP_PAD = 14; // px of slack on a text reveal so the pen edge never slices a glyph

type Shape = {
  t: string; at: [number, number]; out?: [number, number]; ink?: string; fill?: string; sw?: number; fillAt?: [number, number];
  text?: string; size?: number; x?: number; y?: number; anchor?: "start" | "middle" | "end"; from?: number; to?: number; suffix?: string;
  [k: string]: unknown;
};

const SketchShape: React.FC<{ shape: Shape; index: number; t: number; colors: Record<string, string>; geo: ReturnType<typeof buildShape> }> = ({ shape, index, t, colors, geo }) => {
  const ink = colors[shape.ink ?? "ink"] ?? shape.ink ?? colors.ink;
  const op = shapeOpacity(t, shape.out);
  if (op <= 0 || t < shape.at[0] - 0.3) return null;
  if (shape.t === "text" || shape.t === "count") {
    const size = shape.size ?? 56;
    const body = shape.t === "count" ? `${formatInt(countAt(t, shape))}${shape.suffix ?? ""}` : String(shape.text);
    const anchor = shape.anchor ?? "start";
    const w = textWidth(shape.t === "count" ? `${formatInt(shape.to ?? 0)}${shape.suffix ?? ""}` : body, size);
    const left = (shape.x ?? 0) - (anchor === "middle" ? w / 2 : anchor === "end" ? w : 0);
    const p = shape.t === "count" ? win(t, shape.at[0] - 0.3, shape.at[0]) : drawProgress(t, shape.at);
    if (p <= 0) return null;
    const clipId = `reveal-${index}`;
    return (
      <g opacity={op}>
        {p < 1 && shape.t === "text" ? (
          <clipPath id={clipId}><rect x={left - CLIP_PAD} y={(shape.y ?? 0) - size * 1.3} width={w * p + CLIP_PAD * 2} height={size * 1.9} /></clipPath>
        ) : null}
        <text x={shape.x} y={shape.y} fontFamily={FAMILY} fontSize={size} fill={ink} textAnchor={anchor} opacity={shape.t === "count" ? p : 1} clipPath={p < 1 && shape.t === "text" ? `url(#${clipId})` : undefined}>{body}</text>
      </g>
    );
  }
  if (!geo) return null;
  const p = drawProgress(t, shape.at);
  if (p <= 0) return null;
  const fillColor = colors[shape.fill ?? ""] ?? shape.fill;
  const fa = shape.fillAt ?? [shape.at[1] + FILL_LAG, shape.at[1] + FILL_LAG + FILL_DUR];
  const fillP = shape.fill ? win(t, fa[0], fa[1]) : 0;
  return (
    <g opacity={op} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {fillP > 0 ? <path d={strokesToPath(revealStrokes(geo.fills, fillP))} stroke={fillColor} strokeWidth={FILL_PX} opacity={FILL_OPACITY} /> : null}
      <path d={strokesToPath(revealStrokes(geo.strokes, p))} stroke={ink} strokeWidth={shape.sw ?? STROKE_PX} />
    </g>
  );
};

export const Sketch: React.FC = () => {
  const beat = useBeat();
  const brand = useBrand();
  const t = useCrispSeconds();
  const shapes = (beat.shapes ?? []) as Shape[];
  const [W, H] = (beat.canvas as [number, number] | undefined) ?? DEFAULT_CANVAS;
  const variant = boilVariant(t);
  const base = useMemo(() => shapes.map((s, i) => buildShape(s, hashSeed(SEED, i))), [shapes]);
  const geos = useMemo(
    () => base.map((g, i) => (g ? { strokes: boilStrokes(g.strokes, hashSeed(SEED, i), variant), fills: boilStrokes(g.fills, hashSeed(SEED, i, 1), variant) } : g)),
    [base, variant],
  );
  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {shapes.map((s, i) => (
          <SketchShape key={i} shape={s} index={i} t={t} colors={brand.colors} geo={geos[i]} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
