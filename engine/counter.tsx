// Counting-up number for key figures. Reusable: import { Counter, CountedText } from "@video/engine/counter".
// Value is a pure function of the beat clock (countValue.js), so it is exact on any frame, in any order, at any fps.
import React from "react";
import { useSeconds } from "./beat";
import { countValue, splitCounted } from "./countValue.js";

export { countValue, splitCounted } from "./countValue.js";

export type CountSpec = { from?: number; to: number; start: number; end: number };

/**
 * One counting number. Digits are tabular so the figure does not jitter, and the box is as wide as the final number
 * (right aligned) so surrounding text does not shift while it counts.
 */
export const Counter: React.FC<CountSpec & { style?: React.CSSProperties }> = ({ from = 0, to, start, end, style }) => {
  const t = useSeconds();
  const digits = String(Math.max(Math.abs(from), Math.abs(to))).length;
  return (
    <span style={{ display: "inline-block", minWidth: `${digits}ch`, textAlign: "right", fontVariantNumeric: "tabular-nums", ...style }}>
      {countValue(t, { from, to, start, end })}
    </span>
  );
};

/**
 * Copy with some of its whole numbers counting up: `tokens` are the numbers in `text` to count, in order of appearance
 * (so the string stays the real copy and the data says which parts roll). Each later token starts `stagger` seconds after
 * the previous; all of them land together at `end`.
 */
export const CountedText: React.FC<{ text: string; tokens: string[]; start: number; end: number; stagger?: number; from?: number }> = ({ text, tokens, start, end, stagger = 0, from = 0 }) => (
  <>
    {splitCounted(text, tokens).map((p, i) => ("text" in p
      ? <React.Fragment key={i}>{p.text}</React.Fragment>
      : <Counter key={i} from={from} to={p.num} start={Math.min(start + p.index * stagger, end - 0.1)} end={end} />))}
  </>
);
