// Pointer component for UI-demo scenes: import { Pointer } from "@video/engine/pointer". Feed it waypoints; all maths is pointerPath.js (pure, tested).
// Glides ease-in-out, decelerates to a stop before each press, squashes on the press, rings a ripple, never teleports. Hold before start and after end.
// Coordinates are the parent's: place it inside the same positioned container as the UI it points at.
import React from "react";
import { useSeconds } from "./beat";
import { pointerState, type Waypoint } from "./pointerPath.js";
import { mix } from "./motionMath.js";

export { pointerState, pressTimes, type Waypoint } from "./pointerPath.js";

const PRESS_SQUASH = 0.16; // pointer scale lost at full press depth
const RIPPLE_R0 = 0.35; // ripple starts at this fraction of its full size...
const RIPPLE_R1 = 1.25; // ...and grows to this one
const RIPPLE_SIZE = 64; // px, full-size diameter

export type PointerProps = { waypoints: ReadonlyArray<Waypoint>; ink: string; paper: string; accent: string; dwell?: number; hold?: number };

export const Pointer: React.FC<PointerProps> = ({ waypoints, ink, paper, accent, dwell, hold }) => {
  const t = useSeconds();
  const s = pointerState(waypoints, t, { dwell, hold });
  return (
    <div style={{ position: "absolute", left: s.x, top: s.y, width: 0, height: 0 }}>
      {s.ripples.map((r, i) => (
        <div
          key={i}
          style={{
            position: "absolute", left: -RIPPLE_SIZE / 2, top: -RIPPLE_SIZE / 2, width: RIPPLE_SIZE, height: RIPPLE_SIZE, borderRadius: RIPPLE_SIZE / 2,
            border: `2px solid ${accent}`, opacity: 0.6 * (1 - r.k), transform: `scale(${mix(RIPPLE_R0, RIPPLE_R1, 1 - (1 - r.k) ** 3)})`,
          }}
        />
      ))}
      <svg width={31} height={40} viewBox="0 0 31 40" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", transformOrigin: "3px 3px", transform: `scale(${1 - PRESS_SQUASH * s.press})` }}>
        <path d="M3 3L3 31L10.5 24L16.5 36L22 33L16 21L27 20Z" fill={ink} stroke={paper} strokeWidth={2.2} strokeLinejoin="round" />
      </svg>
    </div>
  );
};
