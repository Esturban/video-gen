# Engine plan: motion, camera and typography parts

Plan only. No engine code, no edits outside `plans/`. Repo: video-gen, base origin/dev at 8548b27, worktree `/private/tmp/claude-501/vg-r3`. Effort numbers are my estimates for one engineer who has read the files, not measured.

## Goal

Add seven pure, seek-safe engine upgrades from `runtime-upgrades.md` rows 12 to 16 and 18 to 20, with no change to any existing scene's render:

| Row | Upgrade | New or changed default behaviour |
| :- | :- | :- |
| 12 | Per-beat transition kind (dip, cut, cross) | none: absent field means today's dip |
| 13 | Aha zoom-out with speed cap and largest-zoom-delta lint | lint runs only on beats that opt in |
| 14 | Log-zoom time mapping and scale-ladder zoom | new functions and one new part, opt in |
| 15 | History echo sparkline inside the aha number card | off unless `echo` is set |
| 16 | Expected-vs-actual ghost line | off unless `ghost` is set; `trend` untouched |
| 18 | Year roll then slam | new part, opt in |
| 19 | Emphasis flag on the aha caption word | off unless `captions.emphasis` is set |
| 20 | Per-script font pair and right-to-left safe text | Latin text renders exactly as today |

Rules every item obeys (from README "Where visual parts live" and CLAUDE.md): maths in a `*Math.js` file with a node:test case, new `.tsx` parts get a case in `engine/seekPurity.test.mjs` (its coverage test fails otherwise), no `Math.random`, `Date.now`, `performance.now`, timers or CSS transitions in `engine/`, text and digits on the crisp clock, shapes on the raw clock. Note: `AGENTS.md` named by `CLAUDE.md` is not present in this checkout (ls shows CLAUDE.md, GEMINI.md, README.md only), so the README is the rule source. Also `package.json` "test" is an explicit file list, so every new `*.test.mjs` must be appended there or `npm test` will not run it.

## Files and functions

Verified = I read the file in this worktree. Everything under "new" is a proposal.

### Shared test support (all items)

| File | Change | Status |
| :- | :- | :- |
| `engine/renderHarness.mjs` (new) | `renderPart(jsx, beat, frame, opts)` returns the HTML string of one part at one frame, using the same esbuild plus stub-remotion method as `seekPurity.test.mjs` lines 1 to 30 and 131 to 187 | method verified; esbuild is imported by that test but not listed in package.json (no node_modules here), so where it comes from is unverified |
| `engine/golden/*.html` and `engine/golden.test.mjs` (new) | markup snapshots per (part, frame). A missing file is written on first run and the test says so; the env var `UPDATE_GOLDEN=1` rewrites. Frame PNG judgement stays human, see each item's "Golden frames" | no golden mechanism exists today (grep for "golden" in bin, engine, README, CLAUDE.md found nothing) |
| `package.json` "test" | append each new test file | verified list is explicit |
| `fixtures/engine-r3/` (new) | scenes used by the stills below, laid out like `fixtures/taste-swoosh` (brands/, scenes/promo/<name>/) | layout verified; how `bin/video` is pointed at a fixtures root is unverified (README says `list with a root directory argument`) |

### Row 12: per-beat transition kind

Today (verified, `Video.tsx`): each beat is its own `Sequence`; `Fader` fades the beat out over the last `fade` frames and the next in over its first `fade` frames, so every boundary is a dip through `brand.background`. `fade` is `Math.round((scene.fade ?? 0.5) * fps)`; first beat has no fade in, last no fade out, `fade === 0` means none.

| File | Function or type | Change |
| :- | :- | :- |
| `engine/transitionMath.js` (new) | `transitionPlan`, `boundaryAlphas` | pure plan of every boundary and the two alphas at a frame |
| `engine/transitionMath.test.mjs` (new) | | see Test cases |
| `engine/Video.tsx` | `Fader` | replace props `fade`, `first`, `last` with `inFrames`, `outFrames`; body keeps the same two `interpolate` calls |
| `engine/Video.tsx` | `Video` | build `plan = transitionPlan(beats, fade, fps)`; Sequence `durationInFrames` becomes `frames + plan[i].extend` |
| `engine/beat.tsx` | `Beat`, `Scene` types | add `transition?`, `transitionLen?` to Beat; `transition?` to Scene |
| `bin/lib/variants.mjs` | `LOCKED_BEAT_KEYS` (line 8, verified) | add `"transition"`, `"transitionLen"` so a variant cannot retime a boundary |
| `bin/lib/checklist.mjs` | new `checkTransitions(scene)`, called from `runChecklist` (line 179) | validation, see Interface |

Design choice for `cross`: the outgoing beat's Sequence is extended by `len` frames past its end and holds at full opacity while the incoming beat (later in the DOM, so on top) fades in over `len`. The incoming beat's clock is not shifted, so narration alignment and every `useSeconds` value stay exact. Cost: the outgoing beat renders `len` extra frames and its local clock runs past its own end (parts clamp via `progress`; unverified for every kind).

### Row 13: aha zoom-out with speed cap and largest-zoom-delta lint

| File | Function | Change |
| :- | :- | :- |
| `engine/cameraMath.js` (verified, 45 lines) | `cameraSegments`, `peakRates`, `cameraLint` (new exports) | read only; `cameraAt` and `viewBoxFor` unchanged |
| `engine/cameraMath.test.mjs` (new; none exists today) | | see Test cases |
| `bin/lib/checklist.mjs` | new `checkCamera(scene)` | for each beat that has both `camera` and `ahaZoom`, call `cameraLint`; FAIL items listed by code |
| `engine/morph.ts` | re-export line | add `cameraLint` so scenes can import it from the same door as `cameraAt` |

`chartStoryMath.js` `validate()` is deliberately not touched (it is the file row 15 changes; this keeps the two lanes conflict free). The lint measures the real spline, not the key spacing: the monotone cubic in `cameraAt` can peak well above the average rate between two keys, so the speed cap is checked on samples of `cameraAt` itself.

### Row 14: log-zoom mapping and scale ladder

| File | Function | Change |
| :- | :- | :- |
| `engine/cameraMath.js` | `cameraAtLog`, `ladderKeys`, `lodAlpha` (new) | `cameraAtLog` calls `cameraAt` on keys whose zoom channel is `ln(zoom)` and returns `exp(zoom)`; a monotone ln curve stays monotone in zoom, so no overshoot |
| `engine/ScaleLadder.tsx` (new) | `ScaleLadder` | SVG part: concentric labelled rungs inside one world, viewBox from `viewBoxFor(cameraAtLog(...))`, each rung faded by `lodAlpha`; text on the crisp clock, shapes on the raw clock; reads `beat.ladder` |
| `engine/seekPurity.test.mjs` | `BEATS`, `CASES` | add `ScaleLadder` case |
| `engine/morph.ts` | re-export | add `cameraAtLog`, `ladderKeys`, `lodAlpha` |

Rungs are expected to share one focal point (`cx`, `cy`); with a moving focal point, exponential zoom plus linear pan makes the target slide on screen. That case is reported by `ladderKeys` as a problem rather than solved (no extra maths, see Risk).

### Row 15: history echo sparkline in the aha card

| File | Function | Change |
| :- | :- | :- |
| `engine/bentoMath.js` (verified) | `sparkGeometry` (new) | same partial-draw as `areaGeometry` but plots the series itself, min-max scaled; the existing `areaGeometry` plots `cumulative(values)` (a running total), which is not the history line. Share the partial-draw loop by extracting an internal `drawPartial(full, baseY, k)` used by both, and re-run `bentoMath.test.mjs` unchanged |
| `engine/chartStoryMath.js` (verified) | `buildStory` | read optional `cfg.echo`; add `echo` to the object returned by `at(t)` (null when absent); `validate()` gets one rule for `echo` shape |
| `engine/chartStory.tsx` (verified) | `ChartStory` | one `<g clipPath="url(#story-num-clip)">` after the number `<text>`, drawing `s.echo.line` as a polyline plus the tip dot, on the crisp clock `s` |
| `engine/chartStoryMath.test.mjs` | | add cases |

### Row 16: expected-vs-actual ghost line

What the scene-level version already does (read `ct-r2/video/scenes/promo/ghost-expected-vs-actual/scene.json` and `kinds.tsx`): kind `line` maps to `GrowLine`; beat 0 has `reveal {from -1, to -1}` so no data draws while `trend` (draw [0.1, 0.7], label "Expected: about 4x per year") draws; beats 1 and 2 keep it with `trend.draw [-1, 0]` and grow or hold the actual line; callouts on idx 5 and 8; legend; `stat` "114,000x" on all three beats.

What the engine part must add, because `trend` cannot do it:

| Gap in `trend` (verified in `GrowLine.tsx`: line from `a = pts[0]` to `b = pts[n-1]`) | Engine addition |
| :- | :- |
| The ghost is a chord between the actual first and last points, so it is a fit to the data, not an expectation, and the two lines always meet at both ends | `ghost` is computed from a rule that does not use the last point: base value plus a growth factor per step |
| The label "about 4x per year" is hand typed; the data gives 114,000^(1/8) = about 4.4 | label gets `{rate}` filled from the rule, so text cannot disagree with the line |
| No statement of who expected it, so a made-up straw man is possible | `by` (required, non-empty) printed under the label, and the lint rejects a missing `by` |
| No divergence point; the aha is left to the viewer's eye | `divergeRatio` finds the first index where actual over ghost passes the ratio; a bracket and a counted gap number draw there |
| Straight chord ignores the series; drawn only between two points | ghost is a polyline through every x of the series, tip-by-tip like the actual line |
| Nothing checks the ghost stays on the plot | lint: every ghost value inside `10^yDomain` or the ghost is cut off silently |
| `stat` shows the 114,000x answer from frame 0 of beat 0 (spoils the aha) | scene concern, not engine: delay `stat` to beat 1 or later. Noted so the scene author sees it |

| File | Function | Change |
| :- | :- | :- |
| `engine/growLineMath.js` (verified) | `ghostValues`, `divergenceIndex`, `gapRatio`, `ghostLint` (new) | pure |
| `engine/GrowLine.tsx` (verified) | `GrowBeat` type, `GrowLine` body | add optional `ghost`; render dashed polyline with `visiblePoints(ghostPts, ghostTip)` and `pathOf`; bracket and counted ratio use `countValue` and `arrivalAlpha(tipCrisp, idx)` on the crisp clock; `trend` branch left byte for byte as is |
| `engine/growLineMath.test.mjs` | | add cases |
| `engine/seekPurity.test.mjs` | `GROW_BEAT` | add `ghost` to the existing case (no new part, so no new CASES key) |
| `bin/lib/checklist.mjs` | `checkGhost(scene)` | runs `ghostLint` on beats with `ghost` |

### Row 18: year roll then slam

| File | Function | Change |
| :- | :- | :- |
| `engine/countValue.js` (verified) | `rollValue` (new) | integer shown while rolling through a given list of years |
| `engine/kineticMath.js` (verified) | `popScale` exists and is unused for years; reuse unchanged | |
| `engine/YearRoll.tsx` (new) | `YearRoll`, `YearRollBeat` | tabular-digit span on `useCrispSeconds`; `YearRoll` takes props, `YearRollBeat` reads `beat.yearRoll` and renders null when absent |
| `engine/seekPurity.test.mjs` | `CASES` | add `YearRoll` case |

`Counter` is not reused for the roll because it steps through every integer between `from` and `to`, which would show years that have no fact. It is reused for nothing else here; the README line about `Counter` stays true.

### Row 19: emphasis flag on the caption word

Verified: `captionPages` copies the word objects into pages (`groups.push([w])` then maps `words: g`), so an extra `emph` field on a word survives with no change to `captionPages`. `captionStyle` returns `{...derived, ...brand.captions}`.

| File | Function | Change |
| :- | :- | :- |
| `engine/captionMath.js` | `markEmphasis` (new), `captionStyle` | `markEmphasis(words, rules)` returns new word objects with `emph: true` on matches (no mutation); `captionStyle` derived block gains `emphBox` (default = `highlight`), `emphInk` (default = `highlightInk`) |
| `engine/captions.tsx` (verified, 46 lines) | `Captions`, `CaptionWord` type, `CaptionOptions` type | `CaptionWord` gains `emph?`; options gain `emphasis?`; per word span: if active and `emph`, apply `transform: scale(popScale(t, w.start, 0.22, 0.1))` and `emphBox`/`emphInk`; no padding change, so no reflow |
| `engine/Video.tsx` | `Captions` call (already passes `options`) | no change needed |
| `engine/beat.tsx` | `Scene.captions` type | add `emphasis?` to the object form |
| `bin/lib/checklist.mjs` | `checkCaptions` (line 142, verified to exist) | FAIL if `emphasis` has more than one rule (one aha per video) or a rule has no `word` |
| `engine/captionMath.test.mjs` | | add cases |

### Row 20: per-script font pair and right-to-left safe text

Verified in `kinetic.tsx` `Line`: `letterSpacing: -0.5` and `transformOrigin: "left center"`; `WordsOn` uses `marginRight: size * 0.26` and splits on spaces; `captions.tsx` plate is a flex-wrap row with no `direction`; `fonts.ts` loads Geist only, at import time, and `cancelRender`s if a face is missing.

| File | Function | Change |
| :- | :- | :- |
| `engine/kineticMath.js` | `scriptOf`, `lineTypography` (new) | pure; decide script and the style fields |
| `engine/kinetic.tsx` | `FilmStyle`, `Line`, `WordsOn` | `FilmStyle.fonts?: { arabic?: string }`; `Line` and `WordsOn` take `dir?` and call `lineTypography`; `WordsOn` uses `marginInlineEnd` |
| `engine/scriptFonts.ts` (new) | `useScriptFont(script)` | loads the Arabic face on first use only, with `delayRender`, guarded by `typeof FontFace`; Latin-only scenes never touch it, so `fonts.ts` and every existing scene stay as they are |
| `engine/captions.tsx` | `Captions` | per page, `direction: rtl` on the flex container when `scriptOf(page text)` is arabic; font from `style.fonts.arabic` |
| `engine/captionMath.js` | `captionStyle` | accept `brand.captions.fonts` |
| `bin/lib/checklist.mjs` | `checkScripts(dir, scene)` | FAIL when a beat or caption text is Arabic and `assets/fonts/` has no Arabic face named in `scene.data.film.style.fonts` or the brand; reuses the `FONT_REF` idea of `checkFonts` (line 78) |
| `fixtures/engine-r3/scenes/promo/arabic-line/` (new) | scene, kinds, one OFL Arabic face in `assets/fonts/` | the fixture for the still. Which face and its licence: unverified, pick and check before committing |

## Interface sketch

Signatures only.

```js
// engine/transitionMath.js
export const TRANSITIONS = ["dip", "cut", "cross"];
/** One entry per beat: how long it fades in and out, and how many frames its Sequence is extended. */
export function transitionPlan(beats, sceneFadeFrames, fps, sceneKind /* "dip" */) { /* returns { inFrames, outFrames, extend, kind }[] */ }
/** Opacity of the outgoing and incoming beat f frames after the incoming beat starts. */
export function boundaryAlphas(kind, frame, len) { /* returns { out, inn } */ }
```

```js
// engine/cameraMath.js additions
export const AHA_DEFAULTS = { maxLogZoomPerS: 0.35, maxScreenPxPerS: 900, direction: "any", margin: 1 };
export function cameraSegments(keys) { /* [{ i, t0, t1, dLogZoom, worldDist }] */ }
export function peakRates(keys, t0, t1, stepS) { /* { logZoomPerS, screenPxPerS } sampled from cameraAt */ }
export function cameraLint(keys, ahaZoom) { /* [{ code, message }]; empty means pass */ }
export function cameraAtLog(t, keys) { /* { cx, cy, zoom } */ }
export function ladderKeys(rungs, opts) { /* { keys, problems } */ }
export function lodAlpha(logZoom, centreLog, halfWidthLog) { /* 0..1 */ }
```

```js
// engine/bentoMath.js
export function sparkGeometry(values, box, k) { /* { full, line, tip } */ }
// engine/chartStoryMath.js: at(t).echo is { line, tip, opacity, box } or null
```

```js
// engine/growLineMath.js
export function ghostValues(n, spec) { /* number[] of n expected values from spec.base and spec.ratePerStep */ }
export function divergenceIndex(actual, ghost, ratio) { /* first i with actual[i]/ghost[i] >= ratio, else -1 */ }
export function gapRatio(actualV, ghostV) { /* number, >= 0 */ }
export function ghostLint(beat) { /* [{ code, message }] */ }
```

```js
// engine/countValue.js
export function rollValue(t, { years, start, end }) { /* integer from years, never a year not in the list */ }
// engine/kineticMath.js
export function scriptOf(text) { /* "arabic" | "latin" */ }
export function lineTypography({ text, dir, fonts, font, size }) { /* { direction, fontFamily, letterSpacing, transformOrigin, textAlign, lineHeight } */ }
// engine/captionMath.js
export function markEmphasis(words, rules) { /* new word array with emph: true; throws when a rule matches nothing */ }
```

```ts
// engine/YearRoll.tsx
export const YearRoll: React.FC<{ years: number[]; start: number; end: number; size?: number; color?: string; weight?: number; popAt?: number }>;
export const YearRollBeat: React.FC; // reads beat.yearRoll
// engine/ScaleLadder.tsx
export const ScaleLadder: React.FC; // reads beat.ladder
```

### scene.json fields added (all optional, absent means today's behaviour)

| Where | Field | Type and default | Meaning |
| :- | :- | :- | :- |
| scene | `transition` | `"dip"`, `"cut"` or `"cross"`, default `"dip"` | default kind for every boundary |
| beat | `transition` | same, default = scene value | how the PREVIOUS beat hands over to this one; ignored on beat 0 |
| beat | `transitionLen` | seconds, default `scene.fade ?? 0.5` | length of the dip or cross; `cut` ignores it |
| beat (with `camera`) | `ahaZoom` | `{ window: [a, b], direction?: "out" or "in" or "any", maxLogZoomPerS?, maxScreenPxPerS?, margin? }`, absent means no lint | the aha segment and its caps |
| beat | `ladder` | `{ cx, cy, rungs: [{ zoom, label, fact? }], holdS?: 1.2, driftPct?: 0.015, totalS }`, absent means no ladder | read by `ScaleLadder`; compiled by `ladderKeys` |
| story beat | `echo` | `{ window?: [a, b] (default tl.count), mode?: "series" or "cumulative" (default "series"), height?: 60, stroke?: 5 }`, absent means null | sparkline in the aha card |
| line beat | `ghost` | `{ base: { idx, value }, ratePerStep, label (may contain {rate}), by (required), source?, draw: [a, b], divergeRatio?: 2, gapLabel?: "{n}x above" }` | independent expectation |
| beat | `yearRoll` | `{ years: number[], start, end, popAt?: end, size?, x?, y? }` | read by `YearRollBeat` |
| scene.captions (object form) | `emphasis` | `[{ word, beat?, occurrence?: 1 }]`, default `[]`, at most one rule | which spoken word gets the pop |
| `data.film.style` | `fonts` | `{ arabic?: string }`, default none | per-script family |
| Line / WordsOn props | `dir` | `"ltr"`, `"rtl"` or `"auto"`, default `"auto"` | auto picks rtl for Arabic text only |

## Test cases

All are node:test. Names are proposed file::test name. "Seek purity" means the value at t, after evaluating other times, equals a fresh evaluation at t (for pure maths) or, for a `.tsx` part, the existing t=7, t=2, t=7 harness in `seekPurity.test.mjs`.

### Row 12: `engine/transitionMath.test.mjs`

| Test name | Assertions |
| :- | :- |
| default plan equals the old fader | for beats without `transition` and fade 0.5 s at 30 fps: every entry `{ inFrames: 15, outFrames: 15, extend: 0, kind: "dip" }`, except beat 0 `inFrames 0` and the last beat `outFrames 0`; fade 0 gives all zeros |
| dip alphas match the old interpolate | `boundaryAlphas("dip", f, 15)` returns out `1 - f/15` and inn `f/15` at f = 0, 7, 15 (as the old two `interpolate` calls) |
| cut has no overlap and no fade | plan: `inFrames 0`, previous `outFrames 0`, `extend 0`; alphas `{ out: 0, inn: 1 }` at f = 0 |
| cross extends the outgoing beat only | previous entry `extend === len`, incoming `inFrames === len`; `boundaryAlphas("cross", f, len)` has `out === 1` for f < len and `inn` rising 0 to 1 |
| cross keeps the incoming beat clock | no entry changes any beat's `from`; the test recomputes `from` for all beats and compares to `Math.round(start * fps)` |
| unknown kind throws | `transitionPlan` with `transition: "wipe"` throws /transition/ |
| cross longer than half a beat throws | beat of 1 s with `transitionLen 0.8` throws |
| seek purity | `boundaryAlphas` called at f = 9, 3, 9 gives equal results; plan is deep equal when computed twice |

`checklist` test (add to `bin/lib/checklist.test.mjs`): scene with `transition: "cross"` on beat 0 FAILs item `transitions`; scene with no transition fields PASSes it. Variants test (add to `bin/lib/variants.test.mjs`): a variant `layoutOverrides` that sets `transition` is rejected, because the key is now locked.

### Row 13 and 14: `engine/cameraMath.test.mjs`

Fixture keys: the `STORY.camera` array in `seekPurity.test.mjs`.

| Test name | Assertions |
| :- | :- |
| cameraSegments reports log zoom delta | for keys `[12.4,..,1]` and `[14.7,..,1.25]`: segment dLogZoom equals `Math.log(1.25)` within 1e-9 (0.2231) |
| aha with the largest zoom delta passes | window covering a segment of ln(2) and all others below 0.2: `cameraLint` returns `[]` |
| aha not largest fails | on the fixture keys with `ahaZoom.window [22.8, 24.6]` (zoom 1.1 to 0.92, ln ratio 0.1788) while the 12.4 to 14.7 push is 0.2231: result contains code `aha-not-largest` |
| direction out rejects a push in | window over 1.0 to 1.25 with `direction "out"`: code `aha-wrong-direction` |
| speed cap uses the real spline | keys with a long hold then a fast move: `peakRates(...).logZoomPerS` is greater than the average `dLogZoom / (t1 - t0)` (assert strictly greater) and the lint flags `aha-too-fast` when the cap is set between the two |
| old scene passes | lint of every key list in `fixtures` and the `data-story` beat shape with no `ahaZoom` is skipped: `checkCamera` returns no item |
| cameraAtLog equal screen time per rung | keys with zoom 1, 10, 100 and equal key spacing: `cameraAtLog` zoom at the midpoint of each segment equals `sqrt(z0 * z1)` within 1e-6 (geometric mean), while `cameraAt` gives the arithmetic mean |
| cameraAtLog never overshoots | sample 600 points over zoom 1, 1, 50, 50: min >= 1 and max <= 50 |
| cameraAtLog equals cameraAt at keys | at every key time `zoom` equals the key zoom within 1e-9; cx, cy equal `cameraAt` |
| ladderKeys constant log speed | rungs 1, 4, 16, 64 with `totalS 12`: every move segment has the same `dLogZoom / duration` within 1e-9 |
| ladderKeys hold then drift | each rung yields two keys with zoom equal and `cx` differing by at most `driftPct * width`, never zero (no dead frame) |
| ladderKeys flags a moving focal point | rungs with different `cx` return a problem `focal-moves` |
| ladderKeys caps rungs | 6 rungs return `too-many-rungs` (limit 5, from the collector note) |
| lodAlpha | 1 at centre, 0 outside half width, symmetric in log space, monotone toward the edge |
| seek purity (math) | `cameraAtLog(9)`, `cameraAtLog(2)`, `cameraAtLog(9)` first and third deep equal |
| ScaleLadder seek purity | new CASES entry in `seekPurity.test.mjs`: t=7, t=2, t=7 markup equal |

### Row 15: add to `engine/chartStoryMath.test.mjs` and `engine/bentoMath.test.mjs`

| Test name | Assertions |
| :- | :- |
| echo absent is null and story unchanged | `buildStory(STORY).at(t).echo === null` for t in 0, 15, 25; the rest of `at(t)` deep equals the output of a build with the new code and no `echo` (compare to a stored JSON of three times captured before the change) |
| sparkGeometry full draw ends on the last value | k = 1: `tip` equals `full.at(-1)`; `line.length === values.length` |
| sparkGeometry is the series, not the total | values `[5, 1, 5]`: middle point lower than the ends (a running total would rise) |
| partial draw is monotone in x | x of `tip` is nondecreasing as k goes 0, 0.25, 0.5, 0.75, 1 |
| areaGeometry unchanged | existing cases pass untouched after `drawPartial` is extracted |
| echo draws with the count | at `tl.count[0]` the tip x equals the first point; at `tl.count[1]` equals the last |
| echo stays inside the card | for t in the count window to `split[0]`: every echo point has `|x - number.cx| <= cardW / 2` and `|y - number.cy| <= cardH / 2` |
| echo fades with the number | `echo.opacity` equals `number.opacity` at 10 sampled times |
| echo has no text | the returned object has no `label` or `text` key (legibility floor on 9x16, from the collector) |
| seek purity | existing `chartStory` CASES entry rendered with `echo` set in `STORY`: t=7, 2, 7 equal |
| golden: echo frames | golden markup at t = `count[1]` and `count[1] + 1.0` |

### Row 16: add to `engine/growLineMath.test.mjs`

| Test name | Assertions |
| :- | :- |
| ghostValues from a rule | base `{ idx 0, value 1e22 }`, ratePerStep 4, n 5: `[1e22, 4e22, 1.6e23, 6.4e23, 2.56e24]` within 1e-9 relative |
| ghost does not touch the last actual point | for the Epoch-shaped series the ratio ghost[8]/actual[8] is not within 1 percent (fails `ghostLint` code `ghost-is-a-fit` if it is, and endpoints coincide) |
| divergenceIndex | actual `[1,3,9,100]`, ghost `[1,3,9,27]`, ratio 2: returns 3; ratio 5: returns 3; actual below ghost everywhere: returns -1 |
| gapRatio | 100 over 27 is 3.7037 within 1e-4 |
| ghostLint requires `by` | missing or empty `by`: code `ghost-unsourced` |
| ghostLint domain | any ghost value outside `10^yDomain[0]` to `10^yDomain[1]`: code `ghost-off-plot` |
| label rate | `{rate}` replaced by rate formatted to one decimal; label with no placeholder untouched |
| bracket timing | bracket alpha is 0 before the tip reaches `divergenceIndex - 0.35` and 1 after it (reuses `arrivalAlpha`) |
| gap number counts and lands | `countValue` at bracket start is 0, at end equals `Math.round(gapRatio)`, holds after |
| trend path unchanged | a beat with `trend` and no `ghost` renders the same markup as before the change (golden captured from current HEAD before editing) |
| seek purity | GROW_BEAT with `ghost` added: t=7, 2, 7 equal |
| golden: divergence | golden markup at the frame just before the bracket, the bracket arrival frame, and 1 s after |

### Row 18: `engine/countValue.test.mjs` and `engine/kineticMath.test.mjs`

| Test name | Assertions |
| :- | :- |
| rollValue visits only listed years | years `[2018, 2021, 2023, 2026]`, 600 samples over [start, end]: every value is in the list |
| rollValue is monotone and exact | nondecreasing; `t <= start` gives 2018; `t >= end` gives 2026 exactly; holds after |
| rollValue refuses bad input | empty list, a non-integer, or unsorted years throw |
| slam starts after the landing | `popScale(end, end, 0.18, 0.12) === 1` and `popScale(end + 1/30, ...) > 1`; value at `end` is already the final year |
| slam onset frame | the first frame whose time exceeds `end` (using `wordFrame` from `captionMath.js` as the frame rule) has scale > 1; the previous frame has scale 1 and final year |
| scale is back to 1 after the pop | `popScale(end + 0.18, ...)` within 1e-12 of 1 |
| YearRoll seek purity | new CASES entry, t=7, 2, 7 equal |
| YearRollBeat absent field | renders empty markup when `beat.yearRoll` is undefined |
| golden: roll and slam | markup at mid roll, at landing, at onset + 3 frames |

### Row 19: `engine/captionMath.test.mjs`

| Test name | Assertions |
| :- | :- |
| markEmphasis flags one word | words with the token twice; rule `{ word, occurrence: 2 }` flags only the second; originals are not mutated (`Object.isFrozen` on a frozen input does not throw) |
| beat filter | rule with `beat: 2` ignores a match in beat 1 |
| normalisation | "114,000x." matches rule "114,000x" (case and trailing punctuation folded) |
| unmatched rule throws | message names the rule |
| emph survives pagination | `captionPages(markEmphasis(...))` pages contain the flagged word with `emph === true` |
| old output unchanged | `captionPages` and `captionAt` results on the existing test words deep equal the stored values |
| captionStyle defaults | `emphBox === highlight`, `emphInk === highlightInk` when the brand sets none; a brand `captions.emphBox` overrides |
| Captions seek purity | existing `captions` CASES entry plus one with an `emph` word: t=7, 2, 7 equal |
| pop only on the active emph word | markup at the word's start + 0.11 s has `scale(` with a value above 1 on that span only; at start - 0.1 s and start + 1 s no transform scale above 1 |
| checklist: two rules FAIL | `checkCaptions` returns FAIL for `emphasis` of length 2 |

### Row 20: `engine/kineticMath.test.mjs`, `engine/scriptFonts` case, checklist

| Test name | Assertions |
| :- | :- |
| scriptOf | Latin string gives "latin"; Arabic string gives "arabic"; digits and punctuation alone give "latin"; mixed with more Arabic letters than Latin gives "arabic" |
| lineTypography latin is the old style | `{ letterSpacing: -0.5, transformOrigin: "left center", direction: "ltr" }` and lineHeight 1.12, deep equal to what `Line` hard codes today |
| lineTypography arabic is join safe | `letterSpacing` is 0 (never negative), `transformOrigin` is "right center", `direction` is "rtl", lineHeight at least 1.3 |
| dir override | `dir: "ltr"` on Arabic text returns the ltr style; `dir: "rtl"` on Latin returns rtl |
| font pick | `fonts.arabic` is used for Arabic and ignored for Latin; absent falls back to `font` |
| Line seek purity | new CASES entries in the existing `kinetic` list: one Latin line (must equal the markup captured at HEAD), one Arabic line at t=7, 2, 7 |
| Arabic markup has no negative tracking | the Arabic case markup contains `letter-spacing:0` and never `letter-spacing:-`; and contains `direction:rtl` |
| WordsOn rtl margin | uses `margin-inline-end`, not `margin-right`, for rtl |
| Captions rtl | a page of Arabic words renders `direction:rtl` on the plate, the Latin page does not |
| useScriptFont guards | with no `FontFace` global the hook does not throw and does not call `delayRender` for Latin text |
| checklist script-fonts | scene with Arabic copy and no Arabic face FAILs `script-fonts`; with the face PASSes; Latin-only scene PASSes untouched |

## Golden frames

There is no golden mechanism today, so two kinds, and neither is a pixel diff in CI:

1. Markup goldens (automatic): `engine/golden/<part>-<case>-t<ms>.html`, written by `renderHarness.mjs`, compared in `engine/golden.test.mjs`. The two regression goldens that matter most are captured from current HEAD before any edit: `GrowLine` with `trend` only, `Line` Latin, `Captions` without `emph`, and `Video` boundary alphas at fade 0.5. They prove old scenes do not move.
2. Reviewed stills (human, on the fixture scenes): `bin/video stills <scene>` writes one PNG per beat plus a PDF, no video render. Frames at a named time inside a beat need a range render; flag name is in `bin/video help` (README: "render only: re-render seconds S to E as PNG stills in range-S-E"). Each item's named stills:

| Row | Fixture scene | Stills to look at |
| :- | :- | :- |
| 12 | `engine-r3/transition-trio` (3 beats: dip, cut, cross) | last frame of beat n and first of beat n+1 for each kind; for cross the two middle frames |
| 13 | `engine-r3/aha-zoomout` | frame before the pull-back, mid pull-back, rest frame |
| 14 | `engine-r3/scale-ladder` | one still at the rest of each of 4 rungs |
| 15 | `engine-r3/echo-card` | count start, count end, 1 s after |
| 16 | the existing `ghost-expected-vs-actual` copied with `ghost` in place of `trend` | frame before divergence, bracket arrival, hold |
| 18 | `engine-r3/year-slam` | mid roll, landing, onset plus 3 frames |
| 19 | `engine-r3/caption-emph` | word start minus 2 frames, plus 3 frames, plus 15 frames |
| 20 | `engine-r3/arabic-line` | the Arabic line fully in, and the Latin control line |

## Acceptance command

| Step | Command | Expected exit |
| :- | :- | :- |
| 1 | `cd /private/tmp/claude-501/vg-r3 && npm test` | 0, with the new test files listed in the "test" script and the seek purity coverage test green |
| 2 | `bin/video check ghost-expected-vs-actual` against the unmodified scene | 0 (old scene still passes every new check) |
| 3 | `bin/video check` on the `ghost` fixture with `by` removed | 2, item `ghost` FAIL |
| 4 | `bin/video check` on a fixture whose `ahaZoom` window is not the largest zoom change | 2, item `camera` FAIL |
| 5 | `bin/video check` on a fixture with Arabic copy and no Arabic face | 2, item `script-fonts` FAIL |
| 6 | `bin/video check` on a fixture with `transition: "cross"` on beat 0 | 2, item `transitions` FAIL |
| 7 | `bin/video stills engine-r3/<scene>` for each fixture, then open the PNGs named in the table above | 0; judged by eye, verdict pasted in the `reviews/` file |
| 8 | grep of `engine/` for impure calls is part of `bin/video check` (README, Seek purity A) | included in steps 2 to 6 |

Step 1 is the gate for a merge. Steps 3 to 6 are negative controls: each must exit 2, otherwise the lint is not wired.

## Order

Dependency and conflict map: shared files are `package.json` (every item appends), `seekPurity.test.mjs` (14, 15, 16, 18, 19, 20), `bin/lib/checklist.mjs` (12, 13, 16, 19, 20), `captions.tsx` and `captionMath.js` (19 then 20), `cameraMath.js` (13 then 14), `chartStoryMath.js` and `chartStory.tsx` (15 only, because 13 stays out of them).

| Step | Item | Why here | Verify before moving on |
| :- | :- | :- | :- |
| 0 | harness and regression goldens | proves old scenes do not move | `npm test` green on HEAD with the goldens captured |
| 1 | 13 camera lint | smallest, pure, no render path | cameraMath tests |
| 2 | 14 log zoom and ladder | builds on 13's segment helpers | cameraMath tests plus ScaleLadder seek case |
| 3 | 18 year roll | independent, all parts exist | countValue tests, YearRoll seek case |
| 4 | 15 echo | one lane in chartStory | chartStoryMath tests, golden |
| 5 | 19 emphasis | small, and must precede 20 in `captions.tsx` | captionMath tests |
| 6 | 20 script fonts and RTL | needs the caption edit in place; needs a font decision | arabic fixture still |
| 7 | 16 ghost | largest change in `GrowLine`; do it with the trend golden already stored | growLine tests, ghost still |
| 8 | 12 transitions | touches `Video.tsx`, the root every scene goes through, so last and alone, with the Step 0 golden as the guard | transitionMath tests plus step 2 of the acceptance table |

Parallel option for several seats: lane A (13, 14), lane B (15), lane C (18), lane D (19, 20), lane E (16), lane F (12). Merge conflicts are limited to the three shared files above and are line-append conflicts.

Effort (my estimates): 13 S (about 2 h), 14 M (about 6 h, the part is most of it), 15 S (about 3 h), 18 S (about 2 h), 19 S (about 2 h), 20 M (about 6 h, fixture and font are most of it), 16 M (about 6 h), 12 M (about 5 h). Total about 32 h one engineer, about 8 h wall clock across six lanes plus merge.

## Risk

| Row | Risk | Mitigation |
| :- | :- | :- |
| 12 | `Video.tsx` is on the path of every scene; a wrong default moves all of them | default plan equals old numbers by test, Step 0 golden, built last |
| 12 | `cross` makes the outgoing beat run past its own end, and a kind that throws or loops there would break the render | clamp check across every kind is unverified; the fixture uses two kinds with distinct clocks; cross is opt in |
| 12 | `cross` over a transparent-background beat shows both beats at full opacity during the overlap | document: cross is for beats that paint their own background; lint warns when the scene uses a kind known to be transparent (list to be built, unverified) |
| 13 | thresholds `maxLogZoomPerS 0.35` and `maxScreenPxPerS 900` are guesses | start as warnings for old scenes (they are opt in anyway); tune on two renders before making them FAIL |
| 14 | with a moving focal point, exponential zoom plus linear pan makes the target slide | `ladderKeys` rejects it; no weighted-pan maths added (not needed for a centred ladder) |
| 14 | zoom ratio above about 20 smears strokes and shrinks text below the legibility floor | rung limit 5 and `lodAlpha` swap; rung label size is computed from zoom in `ScaleLadder` (to be written with a minimum px test) |
| 15 | sparkline falls under the 32 px mark floor on 9x16 | no labels, height from the card; variant `layout` can raise it; checked in the 9x16 still |
| 15 | `areaGeometry` refactor could change the bento | extraction covered by unchanged existing tests |
| 16 | the ghost can still be a straw man if `by` is made up | `by` is only a presence check; the human fact check stays in the facts file process (README). Lint cannot prove the expectation was real |
| 16 | two lines on a log axis exaggerate the gap if read as linear | gap label states the ratio in words; axis stays labelled |
| 18 | rolling years can imply data | roll visits listed years only; test enforces |
| 18 | slam time is typed by hand until row 8 (cue from word timing) exists | `popAt` accepts a number now; wiring to `words.json` is a separate item, not planned here |
| 19 | the caption sync check reads highlight coloured pixels in the bottom band; an `emphBox` different from `highlight` or a 10 percent pop could confuse it | default `emphBox` equals `highlight`; do not set a different `emphBox` until `bin/lib/captionsync.mjs` has been read and a run done (not read in this pass) |
| 19 | one aha word per video is policy, not physics | checklist FAIL at more than one rule |
| 20 | Arabic font: file choice, licence, and that the renderer machine can load it are unverified; Arabic text has not been rendered in any pass so far (the defect is verified by reading, not by a render) | fixture still is the proof; choose an OFL face and record its licence in `assets/` before use |
| 20 | `lineHeight`, shaping and bidi for mixed Latin and Arabic lines (numbers inside Arabic) can still misplace digits | `unicodeBidi: plaintext` plus a mixed-line still; if it fails, mixed lines are out of scope and the checklist rejects them |
| 20 | `captions.tsx` plate for rtl changes flex order, so the "active word" box moves in visual order | the active index is logical, so it follows reading order; verified only by the fixture still |
| all | `package.json` test list is hand kept; a forgotten file is a silent gap | acceptance step 1 greps that every `engine/*.test.mjs` is listed (add one assert in `checklist.test.mjs` or a one line script) |
| all | no node_modules in this worktree, so nothing here has been run | first action of the build is `npm ci` and a green `npm test` on HEAD |

## Not verified

| Item | What was not done |
| :- | :- |
| Any test or command above | nothing was executed; no `npm ci` or `npm test` in this worktree (node_modules absent) |
| `AGENTS.md` | named by CLAUDE.md but absent from the checkout; rules taken from the README and CLAUDE.md only |
| esbuild source | `seekPurity.test.mjs` imports it, package.json does not list it |
| `bin/video` internals | I read only the help text, the `gate`/`check` lines and `checklist.mjs` function names; not `checkFonts`, `checkCaptions` or `runChecklist` bodies, so exact insertion lines are open; `bin/lib/captionsync.mjs`, `webpack-override.mjs`, and how a fixtures root is selected were not read |
| `FilmLayers.tsx`, `TimedLines.tsx`, `PartnerWall.tsx`, `LoopHandoff.tsx` | not read; they call `Line` and `WordsOn`, so row 20 must be checked against their call sites (PartnerWall imports `Line`, seen by grep) |
| Every beat kind under a cross overlap | whether each clamps cleanly past its own end |
| `DataStory.tsx` below line 30 and `counter.tsx` use sites | the echo and year parts assume the existing overlay layout |
| Collector claims | row text for 12 to 20 and the four collectors were read; their evidence ids were not checked against `catalogue.md` |
| Dash and number checks | `growthPerStep` figure (114,000^(1/8) about 4.4) is arithmetic from the scene's own stat and 8 steps, not from running the code; the ln values 0.2231 and 0.1788 are hand computed from the `STORY.camera` keys in `seekPurity.test.mjs` |
| Ghost scene location | the scene is at `ct-r2/video/scenes/promo/ghost-expected-vs-actual` (a sibling worktree), not under the main content-thinking path the brief named, which has no such folder |
| Effort hours | estimates, not measured |
