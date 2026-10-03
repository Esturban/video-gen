// The motion vocabulary scenes import as "@video/engine/motion": named easing curves, springStep, stagger helpers, and tween (the no-teleport helper).
// The maths lives in motionMath.js so node:test can run it; webpack resolves "motion.js" before "motion.ts", so the pure file must not share this base name.
export { EASINGS, clamp, ease, eased, mix, springStep, staggerProgress, staggerStart, tween, win } from "./motionMath.js";
export type EaseName = "linear" | "easeOutCubic" | "easeOutQuint" | "easeInOutCubic" | "smooth";
