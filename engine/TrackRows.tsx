// REUSE_CHECKED: 1_social/py/video-gen/engine/OfferSteps.tsx   offer steps are a tabbed card; these are full-width rows with a drawn glyph, one per programme track
// Programme tracks (CMO-8248, promoted from the Riyadh Lab thank-you film): a heading, then one full-width row per track with a
// line glyph in a ring, popping in one after another, the whole layer fading out at `outAt`.
import React from "react";
import { Glyph, GlyphKind } from "./glyphs";
import { ramp } from "./kineticMath.js";
import { Line, TextBlock, tint, TopScrim, useFilmStyle, useSec } from "./kinetic";

export type Track = { title: string; icon: GlyphKind };

const ROW_TOP = 370;
const ROW_STEP = 196;
const FIRST_AT = 1.2;
const STEP = 0.8;

export const TrackRows: React.FC<{ heading: string; tracks: Track[]; outAt?: [number, number]; scrim?: number }> = ({ heading, tracks, outAt = [8.4, 9], scrim = 460 }) => {
  const t = useSec();
  const { C, font, side, top } = useFilmStyle();
  const out = ramp(t, outAt[0], outAt[1]);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - out }}>
      <TopScrim height={scrim} />
      <TextBlock top={top}>
        <Line t={t} at={0.3} size={96} weight={700}>
          {heading}
        </Line>
      </TextBlock>
      {tracks.map((tr, i) => {
        const at = FIRST_AT + i * STEP;
        const p = ramp(t, at, at + 0.45);
        const pop = t > at ? 1 + 0.05 * Math.sin(Math.min(1, (t - at) / 0.4) * Math.PI) : 1;
        return (
          <div
            key={tr.title}
            style={{
              position: "absolute",
              left: side,
              right: side,
              top: ROW_TOP + i * ROW_STEP + (1 - p) * 24,
              height: ROW_STEP - 14,
              opacity: p,
              transform: `scale(${pop})`,
              transformOrigin: "left center",
              display: "flex",
              alignItems: "center",
              gap: 26,
              padding: "0 26px",
              borderRadius: 24,
              border: `3px solid ${C.teal}`,
              background: tint(C.night, 0.9),
              boxShadow: `0 0 28px ${tint(C.teal, 0.3 * p)}`,
            }}
          >
            <div style={{ width: 104, height: 104, borderRadius: 52, border: `3px solid ${C.amber}`, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Glyph kind={tr.icon} size={72} color={C.amber} />
            </div>
            <div style={{ fontFamily: font, fontSize: 66, fontWeight: 700, lineHeight: 1.05, color: C.white }}>{tr.title}</div>
          </div>
        );
      })}
    </div>
  );
};
