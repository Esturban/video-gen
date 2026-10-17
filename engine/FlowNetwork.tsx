// REUSE_CHECKED: 1_social/py/video-gen/engine/GrowLine.tsx (one svg per frame, raw clock for shapes and crisp clock for text, paper halo on labels: same pattern here),
//   1_social/py/video-gen/engine/beat.tsx (useBeat/useScene/useBrand/useSeconds/useCrispSeconds), 1_social/py/video-gen/engine/fonts.ts, 1_social/py/video-gen/engine/flowNetworkMath.js (this round).
// FlowNetwork (CMO-8211): a money-flow graph. Nodes are equal plain-text circles, edges run payer to payee with width on a log of dollars and
// meaning carried by line style (solid, dashed, dotted) plus a value and kind label. Deals land on a timeline; the layout relaxes after each.
// The config is beat.network or scene.data.network, on the SCENE clock (beat.start + seconds), so one graph runs on unbroken across beats.
// Every value comes from frameAt(config, W, H, t): no state, any frame draws alone.
import React from "react";
import { useVideoConfig } from "remotion";
import { useBeat, useBrand, useCrispSeconds, useScene, useSeconds } from "./beat";
import { FONT } from "./fonts";
import { frameAt, quadPath } from "./flowNetworkMath.js";

type V2 = [number, number];
const DASH: Record<string, (w: number, s: number) => string | undefined> = {
  solid: () => undefined,
  dashed: (_w, s) => `${18 * s} ${12 * s}`,
  dotted: (w) => `0.1 ${w * 2.4}`,
};
const BIG_HALO = 0.28; // paper halo around the big figure as a fraction of its size: wide enough to knock out the edges that run behind it
const DEFAULT_COLORS = { solid: "accent", dashed: "ink", dotted: "inkSoft", warm: "action", cool: "accent", dot: "ink" };

type Caption = {
  key: string; align: string;
  rows: { key: string; text: string; x: number; y: number; px: number; role: string; weight: number; op: number }[];
  chip: { lines: string[]; px: number; x: number; y: number; op: number } | null;
  source: { text: string; x: number; y: number; px: number; op: number } | null;
  big: { text: string; near: string; op: number } | null;
};

export const FlowNetwork: React.FC = () => {
  const { width: W, height: H } = useVideoConfig();
  const brand = useBrand();
  const scene = useScene();
  const beat = useBeat();
  const t = beat.start + useSeconds();
  const tc = beat.start + useCrispSeconds();
  const cfg = (beat.network ?? (scene.data as { network?: unknown } | undefined)?.network) as Parameters<typeof frameAt>[0];
  if (!cfg) throw new Error(`beat ${beat.n}: FlowNetwork needs beat.network or scene.data.network`);
  const c = brand.colors;
  const col = (key: string) => c[key] ?? key;
  const pal = { ...DEFAULT_COLORS, ...(cfg.colors ?? {}) } as Record<string, string>;
  const F = frameAt(cfg, W, H, t, tc);
  const { s, L } = F;
  const font = { fontFamily: FONT } as const;
  const halo = (w: number) => ({ stroke: c.paper, strokeWidth: w, paintOrder: "stroke" as const, strokeLinejoin: "round" as const });
  const labelPx = (L.labelPx ?? 34) * s;
  const valuePx = (L.edgePx ?? 30) * s;
  const kindPx = (L.edgeKindPx ?? 24) * s;
  const by = Object.fromEntries(F.nodes.map((n: { id: string }) => [n.id, n]));

  const arrow = (tip: V2, dir: V2, size: number, open: boolean, color: string, op: number, key: string) => {
    const base: V2 = [tip[0] - dir[0] * size, tip[1] - dir[1] * size];
    const nx = -dir[1] * size * 0.55;
    const ny = dir[0] * size * 0.55;
    const pts = `${(base[0] + nx).toFixed(2)},${(base[1] + ny).toFixed(2)} ${tip[0].toFixed(2)},${tip[1].toFixed(2)} ${(base[0] - nx).toFixed(2)},${(base[1] - ny).toFixed(2)}`;
    return open
      ? <polyline key={key} points={pts} fill="none" stroke={color} strokeWidth={4 * s} strokeLinecap="round" strokeLinejoin="round" opacity={op * 0.55} />
      : <polygon key={key} points={pts} fill={color} opacity={op} />;
  };

  const captionChip = (chip: NonNullable<Caption["chip"]>, anchor: string) => {
    const w = Math.max(...chip.lines.map((l) => l.length)) * 0.56 * chip.px + 40 * s;
    const h = chip.lines.length * chip.px * 1.25 + chip.px * 0.7;
    const x = anchor === "middle" ? chip.x - w / 2 : chip.x;
    return (
      <g opacity={chip.op}>
        <rect x={x} y={chip.y} width={w} height={h} rx={chip.px * 0.7} fill={c.accentSoft ?? c.card} stroke={c.accent} strokeWidth={2 * s} />
        {chip.lines.map((l, i) => <text key={i} x={x + w / 2} y={chip.y + chip.px * (1.2 + i * 1.25)} textAnchor="middle" fontSize={chip.px} fontWeight={500} fill={c.ink} {...font}>{l}</text>)}
      </g>
    );
  };

  const edgeChip = (lines: string[], x: number, y0: number) => {
    const w = Math.max(...lines.map((l) => l.length)) * 0.56 * kindPx + 28 * s;
    const h = kindPx * (0.6 + lines.length * 1.15);
    return (
      <g>
        <rect x={x - w / 2} y={y0} width={w} height={h} rx={kindPx * 0.8} fill={c.card} stroke={c.line} strokeWidth={2 * s} />
        {lines.map((l, i) => <text key={i} x={x} y={y0 + kindPx * (1.12 + i * 1.15)} textAnchor="middle" fontSize={kindPx} fontWeight={500} fill={c.ink} {...font}>{l}</text>)}
      </g>
    );
  };

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, background: brand.background, ...font }}>
      <defs>
        <radialGradient id="fn-warm">
          <stop offset="0.55" stopColor={col(pal.warm)} stopOpacity={0.5} />
          <stop offset="1" stopColor={col(pal.warm)} stopOpacity={0} />
        </radialGradient>
        {F.edges.filter((e: { open: boolean }) => e.open).map((e: { id: string; full: V2[]; style: string }) => (
          <linearGradient key={e.id} id={`fn-open-${e.id}`} gradientUnits="userSpaceOnUse" x1={e.full[0][0]} y1={e.full[0][1]} x2={e.full[2][0]} y2={e.full[2][1]}>
            <stop offset="0" stopColor={col(pal[e.style])} stopOpacity={1} />
            <stop offset="1" stopColor={col(pal[e.style])} stopOpacity={0.2} />
          </linearGradient>
        ))}
      </defs>
      <rect width={W} height={H} fill={brand.background} />

      {F.ripples.map((r: { key: string; x: number; y: number; r: number; op: number }) => <circle key={r.key} cx={r.x} cy={r.y} r={r.r} fill="none" stroke={col(pal.warm)} strokeWidth={3 * s} opacity={r.op} />)}
      {F.glows.filter((g: { kind: string }) => g.kind === "warm").map((g: { key: string; x: number; y: number; r: number; op: number }) => <circle key={g.key} cx={g.x} cy={g.y} r={g.r * 1.45} fill="url(#fn-warm)" opacity={g.op} />)}

      {F.edges.map((e: { id: string; style: string; open: boolean; width: number; drawn: V2[]; tip: V2; tipDir: V2; op: number; p: number }) => {
        const color = col(pal[e.style]);
        const gap = e.width * 1.6 + 4 * s;
        const tip: V2 = [e.tip[0] + e.tipDir[0] * gap, e.tip[1] + e.tipDir[1] * gap];
        return (
          <g key={e.id} opacity={e.op}>
            <path d={quadPath(e.drawn)} fill="none" stroke={e.open ? `url(#fn-open-${e.id})` : color} strokeWidth={e.width} strokeDasharray={DASH[e.style](e.width, s)} strokeLinecap="round" />
            {arrow(tip, e.tipDir, Math.max(16 * s, e.width * 2.3), e.open, color, Math.min(1, e.p * 3), `${e.id}-a`)}
          </g>
        );
      })}
      {F.edges.map((e: { id: string; dot: { at: V2; op: number } | null; width: number }) => e.dot && <circle key={`${e.id}-d`} cx={e.dot.at[0]} cy={e.dot.at[1]} r={Math.max(7 * s, e.width * 0.8)} fill={col(pal.dot)} opacity={e.dot.op} />)}

      {F.nodes.map((n: { id: string; x: number; y: number; r: number; op: number }) => (
        <circle key={n.id} cx={n.x} cy={n.y} r={n.r} fill={c.card} stroke={c.ink} strokeWidth={3 * s} opacity={n.op} />
      ))}
      {F.glows.map((g: { key: string; kind: string; x: number; y: number; r: number; op: number }) => (
        <circle key={`${g.key}-ring`} cx={g.x} cy={g.y} r={g.r + 11 * s} fill="none" stroke={col(pal[g.kind])} strokeWidth={6 * s} opacity={g.op} />
      ))}
      {F.ghosts.map((g: { key: string; x: number; y: number; r: number; op: number }) => (
        <circle key={g.key} cx={g.x} cy={g.y} r={g.r} fill="none" stroke={c.inkSoft} strokeWidth={3 * s} strokeDasharray={`${10 * s} ${9 * s}`} opacity={g.op} />
      ))}
      {F.nodes.map((n: { id: string; x: number; y: number; scale: number; textOp: number; lines: string[] }) => {
        const px = labelPx * Math.min(n.scale, 1.35);
        const lh = px * 1.08;
        const y0 = n.y - ((n.lines.length - 1) * lh) / 2 + px * 0.35;
        return (
          <text key={`${n.id}-l`} textAnchor="middle" fontSize={px} fontWeight={600} fill={c.ink} opacity={n.textOp} {...font}>
            {n.lines.map((line, i) => <tspan key={i} x={n.x} y={y0 + i * lh}>{line}</tspan>)}
          </text>
        );
      })}

      {F.edges.map((e: { id: string; value?: string; kind?: string; chip?: string; chipOp: number; chipLines: string[]; chipAt: V2; label: { x: number; y: number; op: number } }) => (e.value || e.kind || e.chip) && e.label.op > 0 && (
        <g key={`${e.id}-t`} opacity={e.label.op}>
          {e.value && <text x={e.label.x} y={e.label.y} textAnchor="middle" fontSize={valuePx} fontWeight={600} fill={c.ink} {...halo(8 * s)} {...font}>{e.value}</text>}
          {e.kind && <text x={e.label.x} y={e.label.y + kindPx * 1.15} textAnchor="middle" fontSize={kindPx} fontWeight={500} fill={c.ink} {...halo(7 * s)} {...font}>{e.kind}</text>}
          {e.chip && e.chipOp > 0 && <g opacity={e.chipOp}>{edgeChip(e.chipLines, e.label.x + e.chipAt[0], e.label.y + kindPx * 1.6 + e.chipAt[1])}</g>}
        </g>
      ))}

      {F.captions.map((cap: Caption) => {
        const anchor = cap.align === "middle" ? "middle" : "start";
        const big = cap.big ? by[cap.big.near] : null;
        const bigPx = (L.big?.px ?? 120) * s;
        const place = L.big?.place ?? "right";
        const bx = big ? (place === "right" ? big.x + big.r + 34 * s : place === "left" ? big.x - big.r - 34 * s : big.x) : 0;
        const bY = big ? (place === "below" ? big.y + big.r + bigPx * 0.95 : big.y + bigPx * 0.36) : 0;
        return (
          <g key={cap.key}>
            {cap.rows.map((r) => <text key={r.key} x={r.x} y={r.y} textAnchor={anchor} fontSize={r.px} fontWeight={r.weight} fill={r.role === "small" ? c.inkSoft : c.ink} opacity={r.op} {...halo(10 * s)} {...font}>{r.text}</text>)}
            {cap.chip && captionChip(cap.chip, anchor)}
            {big && cap.big && <text x={bx} y={bY} textAnchor={place === "right" ? "start" : place === "left" ? "end" : "middle"} fontSize={bigPx} fontWeight={600} fill={col(pal.warm)} opacity={cap.big.op} {...halo(bigPx * BIG_HALO)} {...font}>{cap.big.text}</text>}
            {cap.source && <text x={cap.source.x} y={cap.source.y} textAnchor={anchor} fontSize={cap.source.px} fontWeight={500} fill={c.inkSoft} opacity={cap.source.op} {...halo(8 * s)} {...font}>{cap.source.text}</text>}
          </g>
        );
      })}
      {F.notes.map((n: { id: string; x: number; y: number; px: number; anchor: string; op: number; text: string }) => (
        <text key={n.id} x={n.x} y={n.y} textAnchor={n.anchor as "start" | "middle" | "end"} fontSize={n.px} fontWeight={500} fill={c.inkSoft} opacity={n.op} {...halo(8 * s)} {...font}>{n.text}</text>
      ))}
    </svg>
  );
};
