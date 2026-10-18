// @ts-check
// REUSE_CHECKED: 4_agents/sh/thinking/wiki/domains/clients/atomcamp/mashreq-agile-coaches/source/motion/video/src/theme.tsx  rgbOf/alpha and the brand-to-role map (C, as content-thinking mashreq-demo1/theme.tsx had it) lifted here; the BuildCard maths from 4_agents/sh/thinking/wiki/domains/clients/atomcamp/mashreq-agile-coaches/source/motion/video/src/Demo.tsx
// Pure maths for AppMock and CoachDemo (CMO-8248). Every value is a function of its inputs, so any frame draws on its own.

const WHITE = "#fff"; // card face and text on a dark stage; a brand may override with an "onDark" colour
const LAST_RESORT = "#888888";

/** Each role and the brand colour keys it may come from, first present wins. Chains end on keys the house brands share. */
const ROLES = {
  dark: ["navy", "deep", "ink"],
  deep: ["deep", "navy", "ink"],
  accent: ["green", "accent"],
  sage: ["sage", "inkSoft", "muted"],
  alert: ["alert", "hot", "accent"],
  amber: ["amber", "alert", "hot", "accent"],
  red: ["red", "alert", "accent"],
  ok: ["ok", "green", "accent"],
  soft: ["soft", "inkSoft", "muted"],
  line: ["line"],
  paper: ["paper", "card"],
  mist: ["mist", "paper", "card"],
  ink: ["ink"],
  muted: ["muted", "inkSoft", "ink"],
  rule: ["rule", "mist", "paper", "line"],
  glow: ["glow", "green", "accent"],
  onDark: ["onDark"],
  card: ["cardFace"],
};

/** Brand colours to the roles the mock parts draw with. onDark and card default to white; any other missing role falls back to ink, then grey. */
export function mockPalette(colors) {
  const c = colors ?? {};
  const pick = (keys) => keys.map((k) => c[k]).find((v) => typeof v === "string" && v.length > 0);
  /** @type {Record<string, string>} */
  const out = {};
  for (const [role, keys] of Object.entries(ROLES)) {
    const v = pick(keys);
    out[role] = v ?? (role === "onDark" || role === "card" ? WHITE : c.ink ?? LAST_RESORT);
  }
  return out;
}

/** "#rrggbb" as [r, g, b]. */
export const rgbOf = (hex) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** A hex colour at alpha a; any non-hex colour (rgba, named) passes through unchanged. */
export const alpha = (color, a) => (/^#[0-9a-fA-F]{6}/.test(color) ? `rgba(${rgbOf(color).join(",")},${a})` : color);

/** Characters shown at eased progress k of a typed string, and whether the caret shows (only while typing). */
export const typedState = (len, k) => ({ n: Math.round(len * k), caret: k > 0 && k < 1 });

/** Characters of the joined lines shown at progress k (lines joined with one newline). */
export const streamCount = (lines, k) => Math.round(lines.join("\n").length * k);

/** A whole number counting up to `to` at progress k. */
export const countUp = (to, k) => Math.round(to * k);

/** Build card cues as beat fractions: steps arrive across the narration, the prompt at 72 percent of it. */
export function buildCues({ voiceAt = 0.4, voice, duration }, steps) {
  const d = duration > 0 ? duration : 1;
  const v = voice ?? Math.max(3.5, d - voiceAt - 1);
  const stepAt = Array.from({ length: steps }, (_, i) => (voiceAt + 2 + i * ((v - 3) / Math.max(1, steps))) / d);
  return { stepAt, promptAt: (voiceAt + v * 0.72) / d };
}

/** The [a, b] window (beat fractions) in which line i of n lights up, inside the span hl. */
export const emailLineWindow = (hl, i, n) => {
  const w = (hl[1] - hl[0]) / n;
  return [hl[0] + i * w, hl[0] + (i + 0.6) * w];
};

/** Replace every "$key" string (whole string, one word) with scene data[key], deeply. A missing key throws, naming it. */
export function resolveRefs(value, data) {
  if (typeof value === "string") {
    const m = /^\$([A-Za-z_]\w*)$/.exec(value);
    if (!m) return value;
    if (!(m[1] in (data ?? {}))) throw new Error(`stage reference ${value} is not in scene.json data`);
    return data[m[1]];
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, data));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v, data)]));
  return value;
}

/** Vertical offset of a looping scroll: speed px per second, wrapping every `wrap` px. */
export const scrollOffset = (s, speed, wrap) => -((s * speed) % wrap);

/** The small label above a demo beat, from its kind; labels overrides by kind. */
export const stageLabel = (kind, labels = {}) =>
  labels[kind] ?? (kind === "problem" ? "The problem" : kind === "result" || kind === "proof" ? "The result" : "What the agent does");

/** The on-screen data tag for a beat: beat.tag, then data.tagFor[n], then data.exampleTag, then "Example data". An empty string means no tag. */
export const beatTag = (beat, data = {}) => beat.tag ?? data.tagFor?.[beat.n] ?? data.exampleTag ?? "Example data";
