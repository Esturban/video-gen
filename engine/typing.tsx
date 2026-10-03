// Typing component for UI-demo scenes: import { Typing } from "@video/engine/typing". Text revealed character by character with a caret.
// The reveal is typingState.js (pure, tested): monotonic, lands exactly on the full string, then holds. Times are seconds on the beat clock.
import React from "react";
import { useSeconds } from "./beat";
import { caretVisible, shownChars, type TypingSpec } from "./typingState.js";

export { caretVisible, shownChars, timeOfChar, typedText, typingEnd, type TypingSpec } from "./typingState.js";

const CARET_W = 3; // px
const CARET_GAP = 3; // px between the last character and the caret

export type TypingProps = TypingSpec & {
  focusAt: number; // when the caret first appears (the field gains focus)
  hideCaretAt?: number; // when the caret goes away for good
  caretColor: string;
  caretHeight?: number; // px
  style?: React.CSSProperties;
};

export const Typing: React.FC<TypingProps> = ({ text, start, cps, pauses, focusAt, hideCaretAt, caretColor, caretHeight = 36, style }) => {
  const t = useSeconds();
  const spec = { text, start, cps, pauses };
  const shown = text.slice(0, shownChars(t, spec));
  const caret = caretVisible(t, spec, focusAt, hideCaretAt);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", whiteSpace: "pre", ...style }}>
      <span>{shown}</span>
      <span style={{ display: "inline-block", width: CARET_W, height: caretHeight, marginLeft: CARET_GAP, borderRadius: 1, background: caretColor, opacity: caret ? 1 : 0 }} />
    </span>
  );
};
