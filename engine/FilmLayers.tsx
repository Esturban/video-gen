// REUSE_CHECKED: 1_social/py/video-gen/engine/Video.tsx   Video plays beats one after another with cross fades; this plays overlapping layers inside one beat
// Layered film beat (CMO-8248, promoted from the Riyadh Lab thank-you film): one beat that runs a whole short film from data. Each
// layer is a time window (from, len, in beat seconds) holding engine film parts drawn in order on that layer's own clock, so a
// continuous background (an atlas, a skyline) can run under scenes that come and go. The film style (palette, font, margins) is
// set once on the beat as `style` and read by every film part.
//   beat: { "kind": "film", "style": {...}, "layers": [{ "from": 0, "len": 63, "parts": [{ "part": "atlas", "props": {...} }] }] }
import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { useBeat } from "./beat";
import { CityTimeline } from "./CityTimeline";
import { DistrictMap } from "./DistrictMap";
import { DEFAULT_FILM_STYLE, FilmPalette, FilmStyle, FilmStyleContext, Stars, TopScrim } from "./kinetic";
import { IsoSkyline } from "./IsoSkyline";
import { EndCard, PartnerWall } from "./PartnerWall";
import { StoryAtlas } from "./StoryAtlas";
import { TimedLines } from "./TimedLines";
import { ToolCallouts } from "./ToolCallouts";
import { TrackRows } from "./TrackRows";
import { WalkRing } from "./WalkRing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PARTS: Record<string, React.FC<any>> = {
  stars: Stars,
  scrim: TopScrim,
  lines: TimedLines,
  atlas: StoryAtlas,
  skyline: IsoSkyline,
  walkRing: WalkRing,
  district: DistrictMap,
  cityTimeline: CityTimeline,
  callouts: ToolCallouts,
  tracks: TrackRows,
  wall: PartnerWall,
  endCard: EndCard,
};
export const FILM_PARTS = Object.keys(PARTS);

export type FilmLayer = { from: number; len: number; parts: { part: string; props?: Record<string, unknown> }[] };
type FilmBeat = { style?: Partial<Omit<FilmStyle, "C">> & { C?: Partial<FilmPalette> }; layers?: FilmLayer[] };

export const filmStyleOf = (s: FilmBeat["style"]): FilmStyle => ({ ...DEFAULT_FILM_STYLE, ...(s ?? {}), C: { ...DEFAULT_FILM_STYLE.C, ...(s?.C ?? {}) } });

export const FilmLayers: React.FC = () => {
  const beat = useBeat() as unknown as FilmBeat;
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const style = filmStyleOf(beat.style);
  const layers = beat.layers ?? [];
  return (
    <FilmStyleContext.Provider value={style}>
      <AbsoluteFill style={{ background: style.C.night, overflow: "hidden" }}>
        {layers.map((layer, i) => (
          <Sequence key={i} from={f(layer.from)} durationInFrames={f(layer.len)} layout="none">
            <AbsoluteFill>
              {layer.parts.map((p, k) => {
                const Part = PARTS[p.part];
                if (!Part) throw new Error(`film layer ${i}: part "${p.part}" is not a film part (has: ${FILM_PARTS.join(", ")})`);
                return <Part key={k} {...(p.props ?? {})} />;
              })}
            </AbsoluteFill>
          </Sequence>
        ))}
      </AbsoluteFill>
    </FilmStyleContext.Provider>
  );
};
