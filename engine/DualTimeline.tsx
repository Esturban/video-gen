// REUSE_CHECKED: 1_social/py/video-gen/engine/FlowNetwork.tsx (one svg per frame, paper halo on labels, config on the SCENE clock: same pattern here),
//   1_social/py/video-gen/engine/beat.tsx (useBeat/useScene/useBrand/useSeconds), 1_social/py/video-gen/engine/fonts.ts, 1_social/py/video-gen/engine/dualTimelineMath.js.
// DualTimeline (CMO-8232): lanes on one shared time axis. A continuous bar (the bond) against a chain of equal blocks (the lease),
// lanes easing apart over time, a playhead, brackets, and an amber gap band that never renders without its label.
// The config is beat.timeline or scene.data.timeline, on the SCENE clock (beat.start + seconds), so one timeline runs on unbroken across beats.
// Every value comes from frameAt(config, W, H, t): no state, any frame draws alone. All lettering is ink or inkSoft, never the fill colours.
import React from "react";
import { useVideoConfig } from "remotion";
import { useBeat, useBrand, useScene, useSeconds } from "./beat";
import { FONT } from "./fonts";
import { frameAt, textRect } from "./dualTimelineMath.js";

const DEFAULT_COLORS = { bar: "accent", block: "wait", gap: "action", track: "line", playhead: "inkSoft", span: "accent", ticks: "inkSoft", tick: "ink" };

type Tx = { key: string; text: string; x: number; y: number; px: number; op: number; anchor: "start" | "middle" | "end"; weight: number; tone: string; box?: boolean; plain?: boolean; s?: number };
type Block = { i: number; rx0: number; rx1: number; y: number; h: number; op: number; fill: number };
type Bracket = { key: string; kind: string; x0: number; x1: number; y: number; hook?: number; p: number; op: number; ticks?: { x0: number; x1: number }[] };

export const DualTimeline: React.FC = () => {
  const { width: W, height: H } = useVideoConfig();
  const brand = useBrand();
  const scene = useScene();
  const beat = useBeat();
  const t = beat.start + useSeconds();
  const cfg = (beat.timeline ?? (scene.data as { timeline?: unknown } | undefined)?.timeline) as Parameters<typeof frameAt>[0];
  if (!cfg) throw new Error(`beat ${beat.n}: DualTimeline needs beat.timeline or scene.data.timeline`);
  const c = brand.colors;
  const pal = { ...DEFAULT_COLORS, ...(cfg.colors ?? {}) } as Record<string, string>;
  const col = (k: string) => c[pal[k]] ?? c[k] ?? pal[k] ?? k;
  const F = frameAt(cfg, W, H, t);
  const s = F.s;
  const font = { fontFamily: FONT } as const;
  const halo = (w: number) => ({ stroke: c.paper, strokeWidth: w, paintOrder: "stroke" as const, strokeLinejoin: "round" as const });

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, background: brand.background, ...font }}>
      <rect width={W} height={H} fill={brand.background} />

      {F.gap.op > 0 && <rect x={F.gap.x0} y={F.gap.y0} width={F.gap.x1 - F.gap.x0} height={Math.max(0, F.gap.y1 - F.gap.y0)} rx={12 * s} fill={col("gap")} opacity={F.gap.alpha} />}

      {F.lanes.map((l: { id: string; y: number; op: number }) => <line key={`track-${l.id}`} x1={F.axis.x0} x2={F.axis.x1} y1={l.y} y2={l.y} stroke={col("track")} strokeWidth={3 * s} strokeLinecap="round" opacity={l.op} />)}
      <g opacity={F.axis.op}>
        <line x1={F.axis.x0} x2={F.axis.x1} y1={F.axis.y} y2={F.axis.y} stroke={col("track")} strokeWidth={3 * s} />
        <line x1={F.axis.x0} x2={F.axis.x0} y1={F.lanes[0].y - 40 * s} y2={F.axis.y} stroke={c.inkSoft} strokeWidth={2 * s} strokeDasharray={`${6 * s} ${8 * s}`} />
        <circle cx={F.axis.x0} cy={F.axis.y} r={9 * s} fill={c.ink} />
        <line x1={F.axis.x1} x2={F.axis.x1} y1={F.axis.y - 14 * s} y2={F.axis.y + 14 * s} stroke={c.ink} strokeWidth={4 * s} opacity={F.axis.capOp} />
      </g>

      {F.bar && F.bar.p > 0 && (
        <g opacity={F.bar.op}>
          <rect x={F.bar.x0} y={F.bar.y - F.bar.h / 2} width={Math.max(F.bar.h, F.bar.xe - F.bar.x0)} height={F.bar.h} rx={F.bar.h / 2} fill={col("bar")} />
          <line x1={F.bar.x1} x2={F.bar.x1} y1={F.bar.y - F.bar.h * 0.8} y2={F.bar.y + F.bar.h * 0.8} stroke={c.ink} strokeWidth={5 * s} strokeLinecap="round" opacity={F.bar.capOp} />
        </g>
      )}

      {F.blocks.map((b: Block) => (
        <g key={`blk-${b.i}`} opacity={b.op}>
          <rect x={b.rx0} y={b.y - b.h / 2} width={b.rx1 - b.rx0} height={b.h} rx={8 * s} fill={col("block")} fillOpacity={b.fill} stroke={col("block")} strokeWidth={3 * s} strokeDasharray={b.fill < 1 ? `${10 * s} ${7 * s}` : undefined} />
        </g>
      ))}
      {F.ticks.map((k: { i: number; x: number; y: number; r: number; op: number; pulse: number }) => (
        <circle key={`tk-${k.i}`} cx={k.x} cy={k.y} r={k.r * (1 + 0.25 * k.pulse)} fill={c.paper} stroke={col("tick")} strokeWidth={3 * s} opacity={k.op} />
      ))}

      {F.brackets.map((b: Bracket) => (b.kind === "span" ? (
        <path key={b.key} d={`M${b.x0} ${b.y + (b.hook ?? 0)} L${b.x0} ${b.y} L${b.x0 + (b.x1 - b.x0) * b.p} ${b.y}${b.p >= 1 ? ` L${b.x1} ${b.y + (b.hook ?? 0)}` : ""}`} fill="none" stroke={col("span")} strokeWidth={4 * s} strokeLinejoin="round" opacity={b.op} />
      ) : (
        <g key={b.key} opacity={b.op}>
          {(b.ticks ?? []).map((k, i) => <line key={i} x1={k.x0} x2={k.x0 + (k.x1 - k.x0) * b.p} y1={b.y} y2={b.y} stroke={col("ticks")} strokeWidth={3 * s} strokeDasharray={`${8 * s} ${6 * s}`} />)}
        </g>
      )))}

      {F.playhead && F.playhead.op > 0 && <line x1={F.playhead.x} x2={F.playhead.x} y1={F.playhead.y0} y2={F.playhead.y1} stroke={col("playhead")} strokeWidth={3 * s} opacity={F.playhead.op} />}

      {F.texts.filter((x: Tx) => x.op > 0).map((x: Tx) => {
        const r = x.box ? textRect(x) : null;
        return (
          <g key={x.key} opacity={x.op}>
            {r && <rect x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0} rx={(r.y1 - r.y0) / 2} fill={c.card ?? c.paper} stroke={c.line} strokeWidth={2 * s} />}
            <text x={r ? (r.x0 + r.x1) / 2 : x.x} y={x.y} textAnchor={r ? "middle" : x.anchor} fontSize={x.px} fontWeight={x.weight} fill={c[x.tone] ?? c.ink} {...(r || x.plain ? {} : halo(8 * s))} {...font}>{x.text}</text>
          </g>
        );
      })}
    </svg>
  );
};
