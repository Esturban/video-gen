// REUSE_CHECKED: 1_social/py/video-gen/engine/captions.tsx   captions follow narration word times at the bottom; these are authored title lines placed by hand
// Timed title lines (CMO-8248, promoted from the Riyadh Lab thank-you film): blocks of kinetic lines at a fixed top, each line with its
// own in and out time, optional blur-in, or a word-by-word reveal with its own fade out. Colour is a palette key or any CSS colour.
// Optional scrim behind them. Local seconds.
import React from "react";
import { ramp } from "./kineticMath.js";
import { FilmPalette, Line, TextBlock, TopScrim, useFilmStyle, useSec, WordsOn } from "./kinetic";

export type TimedLine = {
  text: string;
  at: number;
  until?: number;
  size?: number;
  weight?: number;
  color?: string;
  blurIn?: boolean;
  words?: boolean; // reveal word by word (WordsOn) instead of as one line
  out?: [number, number]; // words only: fade the whole line out between these times
};
export type LineBlock = { top: number; lines: TimedLine[] };

const ink = (C: FilmPalette, color?: string) => (color && color in C ? C[color as keyof FilmPalette] : color);

export const TimedLines: React.FC<{ blocks: LineBlock[]; scrim?: { height: number; opacity?: number } }> = ({ blocks, scrim }) => {
  const t = useSec();
  const { C } = useFilmStyle();
  return (
    <>
      {scrim ? <TopScrim height={scrim.height} opacity={scrim.opacity} /> : null}
      {blocks.map((b, k) => (
        <TextBlock key={k} top={b.top}>
          {b.lines.map((l) =>
            l.words ? (
              <div key={l.text} style={{ opacity: l.out ? 1 - ramp(t, l.out[0], l.out[1]) : 1 }}>
                <WordsOn t={t} at={l.at} text={l.text} size={l.size} />
              </div>
            ) : (
              <Line key={l.text} t={t} at={l.at} until={l.until} size={l.size} weight={l.weight} color={ink(C, l.color)} blurIn={l.blurIn}>
                {l.text}
              </Line>
            ),
          )}
        </TextBlock>
      ))}
    </>
  );
};
