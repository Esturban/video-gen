// Scene variants (CMO-7577): one scene, several compositions. Each variant is the SAME beats and assets rendered at its own size, with per-beat layout overrides
// (camera, layout, anything a kind reads) so a 9:16 cut is re-composed for the tall frame, not a crop of the master.
// scene.json: "variants": { "9x16": { "size": [1080, 1920], "layoutOverrides": { "0": { "layout": {...}, "camera": [...] } } } }
// Pure: no file or render access. bin/video renders each variant as its own composition; the checklist reports variantProblems per variant.

const NAME = /^(\d+)x(\d+)$/;
/** Beat keys a variant may not override: timing and content stay shared, so every variant lines up with the one narration track. */
export const LOCKED_BEAT_KEYS = ["n", "start", "end", "kind", "pace", "narration", "voiceAt", "voice", "caption", "tl"];
const ASPECT_TOLERANCE = 0.01; // 1 percent: 1080x1920 is exactly 9:16; a near-miss like 1080x1350 for 4x5 also passes

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Objects merge key by key, recursively; anything else (arrays included) in `over` replaces. Returns a new object, never mutates. */
function deepMerge(base, over) {
  if (!isPlainObject(base) || !isPlainObject(over)) return over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = deepMerge(base[k], v);
  return out;
}

function sizeProblems(name, size) {
  if (!Array.isArray(size) || size.length !== 2 || !size.every((x) => Number.isInteger(x) && x > 0)) return [`size must be [width, height] in whole px, got ${JSON.stringify(size)}`];
  const problems = size.some((x) => x % 2 !== 0) ? [`size ${size.join("x")} must be even on both sides (h264 needs even sides)`] : [];
  const m = NAME.exec(name);
  if (m) {
    const want = Number(m[1]) / Number(m[2]);
    const got = size[0] / size[1];
    if (Math.abs(got - want) / want > ASPECT_TOLERANCE) problems.push(`size ${size.join("x")} is not the ${m[1]}:${m[2]} aspect its name says`);
  }
  return problems;
}

function overrideProblems(scene, overrides) {
  if (overrides === undefined) return [];
  if (!isPlainObject(overrides)) return ["layoutOverrides must be an object keyed by beat number"];
  const beats = new Set((scene.beats ?? []).map((b) => String(b.n)));
  const problems = [];
  for (const [n, over] of Object.entries(overrides)) {
    if (!beats.has(n)) { problems.push(`layoutOverrides names beat ${n}, which the scene does not have`); continue; }
    if (!isPlainObject(over)) { problems.push(`layoutOverrides.${n} must be an object of beat fields`); continue; }
    const locked = Object.keys(over).filter((k) => LOCKED_BEAT_KEYS.includes(k));
    if (locked.length) problems.push(`layoutOverrides.${n} may not change ${locked.map((k) => `"${k}"`).join(", ")}: timing and content are shared by every variant`);
  }
  return problems;
}

/**
 * Problems per variant, as { [name]: string[] }; an empty array means that variant is fine. A scene with no variants gives {}.
 * A "variants" field that is not an object gives { variants: [...] }.
 */
export function variantProblems(scene) {
  if (scene.variants === undefined) return {};
  if (!isPlainObject(scene.variants)) return { variants: ["variants must be an object like { \"9x16\": { size, layoutOverrides } }"] };
  return Object.fromEntries(Object.entries(scene.variants).map(([name, v]) => {
    if (!isPlainObject(v)) return [name, ["a variant must be an object { size, layoutOverrides }"]];
    const problems = NAME.test(name) ? [] : [`variant name "${name}" must be <w>x<h>, like 9x16 or 1x1`];
    return [name, [...problems, ...sizeProblems(name, v.size), ...overrideProblems(scene, v.layoutOverrides)]];
  }));
}

/** [{ name, size }] for every declared variant, in scene order. */
export const variantSizes = (scene) => (isPlainObject(scene.variants) ? Object.entries(scene.variants).map(([name, v]) => ({ name, size: v.size })) : []);

/** The scene as one variant renders it: its size, its overrides merged into the beats, `variant` set, the variants map dropped. A new object; the scene is untouched. */
export function resolveVariant(scene, name) {
  const v = scene.variants?.[name];
  if (!v) throw new Error(`no variant "${name}" in ${scene.name}; it has: ${variantSizes(scene).map((x) => x.name).join(", ") || "none"}`);
  const overrides = v.layoutOverrides ?? {};
  const { variants, ...rest } = scene;
  return { ...rest, size: [...v.size], variant: name, beats: scene.beats.map((b) => (overrides[b.n] ? deepMerge(b, overrides[b.n]) : b)) };
}

/** File stem of a variant's outputs: <scene>-<variant>, e.g. data-story-morph-9x16. */
export const variantFileName = (sceneName, variant) => `${sceneName}-${variant}`;
