// REUSE_CHECKED: 1_social/py/video-gen/engine/DualTimeline.tsx (one svg per frame, config on the SCENE clock, beat.x ?? scene.data.x: same pattern here),
//   1_social/py/video-gen/engine/beat.tsx (useBeat/useScene/useBrand/useCrispSeconds), 1_social/py/video-gen/engine/fonts.ts, 1_social/py/video-gen/engine/ledgerRowsMath.js.
// LedgerRows (CMO-8236): a ledger of rows under three column heads. Each row: a two-line label, a name chip (dim outline, then solid fill),
// and a dashed slot that can never hold a number (the config schema has no value field; ledgerRowsMath.validateConfig throws on one).
// The config is beat.ledger or scene.data.ledger, on the SCENE clock (beat.start + seconds), so one ledger runs on unbroken across beats.
// Every value comes from frameAt(config, W, H, t): no state, any frame draws alone. Shape carries meaning too: solid chip vs outline chip, dashed slot.
import React from "react";
import { useVideoConfig } from "remotion";
import { useBeat, useBrand, useCrispSeconds, useScene } from "./beat";
import { FONT } from "./fonts";
import { frameAt } from "./ledgerRowsMath.js";

const DEFAULT_COLORS = { chip: "accent", slot: "wait", slotPulse: "waitSoft", guide: "line" };

type Tx = { key: string; text: string; x: number; y: number; px: number; op: number; anchor: "start" | "middle" | "end"; weight: number; tone: string; lit?: number };
type Row = { i: number; y: number; op: number; dim: number; chip: { x0: number; x1: number; y0: number; h: number; lit: number }; slot: { x0: number; y0: number; w: number; h: number; pulse: number; dash: number } };
type Guide = { i: number; y: number; x0: number; x1: number; op: number };

export const LedgerRows: React.FC = () => {
  const { width: W, height: H } = useVideoConfig();
  const brand = useBrand();
  const scene = useScene();
  const beat = useBeat();
  const t = beat.start + useCrispSeconds();
  const cfg = (beat.ledger ?? (scene.data as { ledger?: unknown } | undefined)?.ledger) as Parameters<typeof frameAt>[0] & { colors?: Record<string, string> };
  if (!cfg) throw new Error(`beat ${beat.n}: LedgerRows needs beat.ledger or scene.data.ledger`);
  const c = brand.colors;
  const pal = { ...DEFAULT_COLORS, ...(cfg.colors ?? {}) } as Record<string, string>;
  const col = (k: string) => c[pal[k]] ?? c[k] ?? pal[k] ?? k;
  const F = frameAt(cfg, W, H, t);
  const s = F.s;
  const font = { fontFamily: FONT } as const;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, background: brand.background, ...font }}>
      <rect width={W} height={H} fill={brand.background} />

      {F.guides.filter((g: Guide) => g.op > 0).map((g: Guide) => (
        <line key={`guide-${g.i}`} x1={g.x0} x2={g.x1} y1={g.y} y2={g.y} stroke={col("guide")} strokeWidth={2 * s} opacity={g.op} />
      ))}

      {F.rows.filter((r: Row) => r.op > 0).map((r: Row) => (
        <g key={`row-${r.i}`} opacity={r.op * r.dim}>
          <rect x={r.chip.x0} y={r.chip.y0} width={r.chip.x1 - r.chip.x0} height={r.chip.h} rx={r.chip.h / 2}
            fill={col("chip")} fillOpacity={r.chip.lit} stroke={col("chip")} strokeOpacity={0.4 + 0.6 * r.chip.lit} strokeWidth={3 * s} />
          {r.slot.pulse > 0 && <rect x={r.slot.x0} y={r.slot.y0} width={r.slot.w} height={r.slot.h} rx={14 * s} fill={col("slotPulse")} opacity={0.9 * r.slot.pulse} />}
          <rect x={r.slot.x0 + 1.5 * s} y={r.slot.y0 + 1.5 * s} width={r.slot.w - 3 * s} height={r.slot.h - 3 * s} rx={14 * s} fill="none"
            stroke={col("slot")} strokeWidth={(3 + 2 * r.slot.pulse) * s} strokeDasharray={`${12 * s} ${9 * s}`} strokeDashoffset={-r.slot.dash} />
        </g>
      ))}

      {F.texts.filter((x: Tx) => x.op > 0).map((x: Tx) => {
        const at = { x: x.x, y: x.y, textAnchor: x.anchor, fontSize: x.px, fontWeight: x.weight, ...font };
        if (x.lit === undefined) return <text key={x.key} {...at} fill={c[x.tone] ?? c.ink} opacity={x.op}>{x.text}</text>;
        // chip lettering cross-fades from inkSoft on the outline to paper on the solid fill, never a one-frame colour swap
        return (
          <g key={x.key} opacity={x.op}>
            {x.lit < 1 && <text {...at} fill={c.inkSoft} opacity={1 - x.lit}>{x.text}</text>}
            {x.lit > 0 && <text {...at} fill={c.paper} opacity={x.lit}>{x.text}</text>}
          </g>
        );
      })}
    </svg>
  );
};
