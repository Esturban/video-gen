// The shape of the beat in scene.json. Every string, step and timing on screen comes from here, so a new offer is a scene.json edit.
export type Step = { title: string; body: string; rows?: string[]; icon?: "ring" | "check"; note?: string };
export type Timeline = { pillIn: number; toCard: number; cursorIn: number; tab2: number; tab3: number; cta: number; cursorOut: number };
export type OfferCfg = {
  category: string; // the offer name, first on screen
  tabs: [string, string, string];
  steps: [Step, Step, Step];
  cta: string; // the single button, which the shell collapses into
  endNote: string; // small line under the final pill
  count?: { note?: string[]; endNote?: string[]; stagger?: number }; // whole numbers inside note / endNote that count up from 0 as the line reveals
  tl: Timeline;
};
export const DEFAULT_TL: Timeline = { pillIn: 0.2, toCard: 1.5, cursorIn: 2.9, tab2: 4.2, tab3: 6.8, cta: 8.3, cursorOut: 10.2 };
