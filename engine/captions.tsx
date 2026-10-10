// REUSE_CHECKED: 1_social/py/video-gen/engine/brandSlot.tsx   same overlay pattern (rendered by Video.tsx from a scene flag, sizes scale with the frame); maths in captionMath.js
// Word-timed captions (CMO-7584): a page of words on a plate near the bottom, the spoken word in a highlight box.
// Words come from words.json (bin/video render, local whisper-cli) on scene.words; look from the brand file (captionMath.captionStyle).
// The clock is crisp (engine/crispTime.js), so motion blur never ghosts two words at once and a word switches on one exact frame.
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useBrand, useScene } from "./beat";
import { captionAt, captionPages, captionStyle } from "./captionMath.js";
import { crispTime } from "./crispTime.js";

export type CaptionWord = { text: string; start: number; end: number; beat?: number };
export type CaptionOptions = { maxWords?: number; maxGap?: number; linger?: number };

const REFERENCE_HEIGHT = 1080;
/** "#rrggbb" plus an alpha, as rgba(): the plate is see-through, the words and highlight on it are not. */
const withAlpha = (hex: string, a: number) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")}, ${a})`;

export const Captions: React.FC<{ words: CaptionWord[]; options?: CaptionOptions }> = ({ words, options }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const render = useScene().render;
  const style = captionStyle(useBrand());
  const pages = React.useMemo(() => captionPages(words, options ?? {}), [words, options]);
  const t = render ? crispTime(frame / fps, render.fps, render.blur) : frame / fps;
  const at = captionAt(pages, t);
  if (!at) return null;
  const scale = Math.min(width, height) / REFERENCE_HEIGHT;
  const size = style.size * scale;
  const pad = 0.18 * size;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: style.bottom * height, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ maxWidth: width * 0.84, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `${0.12 * size}px ${0.08 * size}px`, padding: `${0.3 * size}px ${0.45 * size}px`,
        borderRadius: 0.36 * size, background: withAlpha(style.plate, style.plateOpacity), fontFamily: style.font, fontWeight: style.weight, fontSize: size, lineHeight: 1.15 }}>
        {pages[at.page].words.map((w: CaptionWord, i: number) => {
          const on = i === at.active;
          // Every word carries the same padding, so the line never reflows when the highlight moves.
          return (
            <span key={i} style={{ padding: `${pad * 0.4}px ${pad}px`, borderRadius: pad, background: on ? style.highlight : "transparent", color: on ? style.highlightInk : style.ink, whiteSpace: "nowrap" }}>
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
