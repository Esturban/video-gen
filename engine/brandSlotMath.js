// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/motionMath.js (our own) for the eased fade; the brand slot is new, nothing in the engine placed a signature or logo before.
// Pure maths for the brand slot: validate scene.json's "brandSlot", turn a time into an opacity and a handwriting-wipe progress, and say where it sits.
// The slot is an overlay rendered by Video.tsx only when scene.json has a "brandSlot" field; with the field absent nothing is rendered and nothing changes.
import { eased } from "./motionMath.js";

export const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];

/** Defaults. Sizes are for a 1440 px canvas and scale with min(width, height) / 1440. */
export const SLOT_DEFAULTS = Object.freeze({
  corner: "bottom-right",
  fontSize: 64, // px of the signature
  logoHeight: 72, // px of a logo
  margin: 64, // px from the canvas edges
  fadeStart: 1, // seconds: the slot stays invisible for the first second
  fadeDur: 1.4, // seconds the signature takes to be "written" (left to right wipe)
  opacity: 0.55, // of the brand ink at full reveal: a low-key mark
});

export const REFERENCE_SIZE = 1440;

/**
 * Validate and complete a scene's brandSlot spec. Throws with a message naming the field, so a typo fails the check before a render.
 * Returns { corner, text, logo, fontSize, logoHeight, margin, fadeStart, fadeDur, opacity }.
 * @param {any} spec
 */
export function resolveBrandSlot(spec) {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) throw new Error("brandSlot must be an object like { text, corner, logo }");
  const out = { ...SLOT_DEFAULTS, text: "", logo: null, ...spec };
  if (!CORNERS.includes(out.corner)) throw new Error(`brandSlot.corner "${out.corner}" is not one of ${CORNERS.join(", ")}`);
  const hasLogo = typeof out.logo === "string" && out.logo.length > 0;
  if (out.logo !== null && out.logo !== undefined && !hasLogo) throw new Error("brandSlot.logo must be null or a path inside the scene's assets folder");
  if (hasLogo && /^(?:[a-z]+:)?\/\/|^\//i.test(out.logo)) throw new Error(`brandSlot.logo "${out.logo}" must be a relative path inside assets/, not a URL or absolute path`);
  if (hasLogo && out.logo.split("/").includes("..")) throw new Error(`brandSlot.logo "${out.logo}" must stay inside assets/`);
  if (!hasLogo && !(typeof out.text === "string" && out.text.trim().length > 0)) throw new Error("brandSlot needs text, or a logo path");
  for (const key of ["fontSize", "logoHeight", "margin", "fadeStart", "fadeDur", "opacity"]) if (!Number.isFinite(out[key]) || out[key] < 0) throw new Error(`brandSlot.${key} must be a number of 0 or more`);
  if (out.opacity > 1 || out.fadeDur === 0) throw new Error("brandSlot.opacity must be 0 to 1 and fadeDur above 0");
  return { ...out, logo: hasLogo ? out.logo : null };
}

/** What the slot shows: the logo image when one is set, else the text. */
export const slotContent = (spec) => (spec.logo ? { kind: "logo", src: spec.logo } : { kind: "text", text: spec.text });

/**
 * Opacity and left-to-right reveal at time t. Both are 0 until fadeStart, then rise together and hold (opacity at its resting value, reveal at 1).
 * Monotonic non-decreasing, so once the slot is in it stays in.
 */
export function brandSlotState(t, spec) {
  const reveal = eased(t, spec.fadeStart, spec.fadeStart + spec.fadeDur, "easeInOutSine");
  const fade = eased(t, spec.fadeStart, spec.fadeStart + Math.min(0.5, spec.fadeDur), "smooth");
  return { reveal, opacity: spec.opacity * fade };
}

/** Absolute-position style for a corner: { left | right, top | bottom } in px, scaled for the canvas. Pure, so the safe margin is testable. */
export function slotPlacement(corner, margin, width, height) {
  const m = margin * (Math.min(width, height) / REFERENCE_SIZE);
  return {
    ...(corner.endsWith("left") ? { left: m } : { right: m }),
    ...(corner.startsWith("top") ? { top: m } : { bottom: m }),
  };
}

/** Scale factor for sizes defined on the 1440 reference canvas. */
export const slotScale = (width, height) => Math.min(width, height) / REFERENCE_SIZE;
