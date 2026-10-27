# Plan: pre-render gates (figures, probes, text-fit and font-load, area honesty)

Source rows: runtime-upgrades.md rows 4, 5, 6, 17. Plan only, no engine code written.
Read for this plan: CLAUDE.md, README.md (first 150 lines), bin/lib/{checklist,checkframes,inkgap,shape}.mjs, engine/seekPurity.test.mjs (first 60 lines), engine/chartStoryMath.js and its test head, engine/morphMath.js exports, engine/dualTimelineMath.js (head, textRect, frameAt call sites), engine/flowNetworkMath.js (fillVars), bin/video (gate, stills, settle, projectPaths, loadScene), bin/lib/cli.test.mjs and checklist.test.mjs fixture helpers, package.json. Repo has no AGENTS.md; CLAUDE.md is the rules file.

## Goal

Move five classes of defect from "found after a long render, or by eye" to "refused before render, with a named FAIL line":

1. Numbers on screen that have no source, or that differ from the spoken line (rows 4).
2. Blank first or last stills, dead keyed spans, narration longer than its beat (row 5).
3. Copy clipped inside a container, and fonts that load in the wrong weight or not at all (row 6).
4. A bar chart whose areas do not match its values (row 17).

Design constraint that shapes everything: `runChecklist` in bin/lib/checklist.mjs is synchronous, pure over files, and `bin/video check` must keep writing nothing (cli.test.mjs asserts this). Anything that needs Chrome therefore cannot live inside `runChecklist`. The plan uses two tiers:

| Tier | Where | Needs | Runs in |
|:-|:-|:-|:-|
| 1 static or model | `runChecklist` items | node only | `bin/video check`, every render, `npm test` |
| 2 browser probe | new async `bin/video probe <scene>`, also called by `render` and `stills` right after `bundleScene` and before the first frame | Remotion bundle, Chrome, ffmpeg | `render`, `stills`, `probe` |

New items are opt-in by scene field or by a condition that is false in every existing test fixture (narration present, `figures` set), so the existing `checklist PASS: 9/9` assertion in cli.test.mjs stays true.

## Files and functions

Signatures only. "Verified" means I read the file. "Unverified" means I inferred it from a neighbouring file.

### A. Shared plumbing (build first)

| File | Change | Status |
|:-|:-|:-|
| `bin/lib/checklist.mjs` | `result(id, label, problems, warnings = [])` gains a `warn` string; `runChecklist` keeps returning `[{id,label,pass,detail,warn}]` | Verified (current `result` at top of file) |
| `bin/lib/checklist.mjs` | `formatChecklist(items)` prints a `WARN` line under a passing item that has `warn`; the `checklist PASS: n/n` count in `bin/video` `gate` is unchanged | Verified |
| `bin/lib/checklist.mjs` | `loadTiming(dir)`: reads `timing.json` and merges `voice`, `voiceAt`, `start`, `end` per beat number, same merge `loadScene` in bin/video does today | Verified (`loadScene` merge lines) |
| `bin/lib/gates.mjs` (new) | Barrel for the new pure checks so checklist.mjs stays under the 400 line guide (it is 214 now): re-exports `figuresProblems`, `figsyncProblems`, `narrationFitProblems`, `deadSpanProblems` | New |

### B. Row 4: `figures` and `figsync`

Data contract (additive, optional): a beat may carry `vars`, already the convention in `engine/flowNetworkMath.js` `fillVars(text, vars)` with `{name.field}` placeholders and `cfg.vars` read in `dualTimelineMath.js` `frameAt` (verified). New rule on the var shape:

```
vars: { gdp: { value: "4.2", asOf: "2024-06", conf: "high|medium|low", source: "named dataset or filing" } }
```

Scene opts in with `"figures": true` (warn-only) or `"figures": "strict"` (FAIL). Opt-in matches how `plan` and `brief` roll out today.

| File | Function (signature only) | Job |
|:-|:-|:-|
| `bin/lib/figures.mjs` (new) | `onScreenStrings(beat): string[]` | Walk every string leaf of a beat except keys in `NON_SCREEN_KEYS = [narration, why, storyboard, kind, sfx, audio, file, src, name]`. Unverified for each kind: the key list is conservative and must be confirmed against kinds used in the pilot scene. |
| | `numbersIn(text): string[]` | Tokens like `4.2`, `1,240`, `12%`, `2024`; normalised (commas stripped, `%` and "percent" folded). |
| | `figuresProblems(scene, { strict }): string[]` | For each beat: (1) every `{name.field}` placeholder resolves (reuse `fillVars` semantics, but collect instead of throw); (2) each var used has `value`, `asOf` (ISO year or year-month), `conf` in the allowed set; (3) every number in `onScreenStrings(beat)` after placeholders are filled either came from a placeholder or is listed in the beat's `figuresOk: string[]` (the `derived` marker, for "4 yrs" or axis years). Bare numbers outside both are the FAIL. |
| `bin/lib/figsync.mjs` (new) | `spokenNumbers(narration): string[]` | Digits plus a small word map (one to twenty, hundred, thousand, "percent"). Words beyond the map are ignored and listed as a warn, not guessed. |
| | `figsyncProblems(scene, { strict }): string[]` | Per narrated beat: every spoken number must appear in that beat's resolved on-screen numbers or in `figuresOk`. Reverse direction (on-screen number never spoken) is FAIL only in strict, else WARN. |
| `bin/lib/checklist.mjs` | `runChecklist`: add `...figures` spread: `scene?.figures ? [result("figures", ...), result("figsync", ...)] : []` | Verified insertion point (next to `plan`, `brief`). |

What a model writes vs what runs: a light model drafts the `vars` block from the facts file and fills `asOf` and `conf` from the cited source (judgment). The checks above are pure string and number comparison and never call a model. The row 4 idea "light model compares fact file to stills" stays outside the gate: it is an optional review prompt over `bin/video frames` contact sheets, advisory, not an exit code.

### C. Row 5: pre-render probes

Three probes, split by tier.

| Probe | Tier | File and function | Status |
|:-|:-|:-|:-|
| narration-fit | 1 | `bin/lib/narrationfit.mjs`: `narrationFitProblems(beats, { wps = 2.5, tolerance = 0.15 }): { problems, warnings }` | New |
| dead-span lint | 1 | `bin/lib/deadspan.mjs`: `deadSpanProblems(scene, { maxHold = DEAD_MAX_HOLD_S }): { problems, warnings }` and `motionWindows(beat): [start, end][] \| null` (registry by `beat.kind`) | New |
| blank first and last stills | 2 | `bin/lib/checkframes.mjs`: new exports `probeTimes(scene): {t, why}[]` (pure) and `scoreProbeStills(stillsGrey: Buffer[], times): {pass, blank:[{t,why,std}]}` (pure, calls existing `analyse`, `BLANK_STD`); `bin/lib/probe.mjs`: `probeStills(dir, loaded, bundle)` does the Chrome and ffmpeg I/O | Verified: `analyse(buf, px)` returns `{stds, diffs}`; `BLANK_STD`, `BLANK_MAX_RUN_S` exported |

Details that matter:

- narration-fit uses the measured length when it exists: `timing.json` carries `voice` and `voiceAt` per beat (verified: `bin/video` transcripts and `narrationTrack` read `b.voice` and `b.voiceAt`). Rule: `voiceAt + voice <= end - start + tolerance` or FAIL. With no measured `voice`, estimate from word count at `wps` and emit WARN only. Beats with narration but no start and end are skipped, as `checkScene` skips them today (verified).
- dead-span needs each part to say when it moves. `engine/chartStoryMath.js` `stageTimes(cfg)` already returns `{name,start,end}` (verified), and `cfg.camera` keys are `[t,cx,cy,zoom]` (verified from the test config). `engine/dualTimelineMath.js`: keyed windows are inside `frameAt` (verified call site), no exported list (unverified beyond the head). Plan: add one exported pure function per math module, `motionWindows(cfg): [number, number][]`, each with a node:test; the registry in `deadspan.mjs` maps `kind` to the right module through the scene's `kinds.tsx` mapping. Kinds without a registered function produce one WARN line naming them (the row says warn-only for other kinds). The check unions windows (plus camera key spans where the camera moves) and fails any gap longer than `maxHold` inside a beat.
- blank probe times: first-frame blank is legal for up to `BLANK_MAX_RUN_S` (0.3 s, verified doc comment: "a clean beat before the first element lands"), so the probe is NOT t=0. Probe set: `0.4 s` (nothing drawn by then is a FAIL), `settle(beat)` for every beat (same formula as `bin/video` `settle`: `max(start, end - fade - 0.05)`, verified), and `end - 1.0 s` for the last-second still. `scene.probe: { first: 0.4, last: 1.0 }` overrides for long outro fades.
- Rendering the stills: `renderStill({ ...b, frame, output })` after `bundleScene(dir, loaded, 30)` is exactly what `stills()` in bin/video does today (verified), so the probe reuses the bundle the render already built; extra cost is `2 + n` single-frame renders. Decode each PNG to 160 px grey with `ffmpeg -i x.png -vf scale=160:160:flags=area,format=gray -f rawvideo -` and feed `analyse`. The `ff` helper in checkframes.mjs is not exported (verified); export it as `ffRun` rather than duplicating.

### D. Row 6: text-fit and font-load

Two options, because I could not verify a safe way to read DOM geometry from a Remotion bundle.

| Option | How | Cost | Risk |
|:-|:-|:-|:-|
| A, model-based (recommended first) | Parts that already compute text rects in their math module (dualTimeline has `textRect(tx)` using `EM` and `EM_BOLD` glyph width constants; ledgerRows and flowNetwork import the same helpers, verified imports) expose their text list per frame. `bin/lib/textfit.mjs` checks each rect against its container rect and the safe margin at each keyed time. Pure, runs in `bin/video check`. | S to M | Width is an estimate (0.56 and 0.6 em), so it can miss a real-font overflow by a few percent; it cannot see AppMock.tsx or CaseCard.tsx, which use `overflow: hidden` (14 `overflow` matches across engine tsx, verified by count only). |
| B, DOM probe | In `probe.mjs`, open the bundle in Chrome, seek the frame, walk text nodes, compare `scrollWidth/scrollHeight` to `clientWidth/clientHeight`. Whether `@remotion/renderer` `openBrowser` plus page evaluate can drive a composition at a chosen frame is UNVERIFIED; playwright is not in package.json (verified). A one-hour spike must prove it before any code is written. | M | Dependency and flake risk; desktop Chrome sometimes paints late (documented in browser.mjs header, verified). Use the scene's `browserFor` choice. |

Plan: ship A for parts that expose texts, record which kinds are uncovered as WARN, and run the B spike in parallel. If B works, it covers the uncovered kinds.

Font-load, same split:

| Layer | Tier | File and function | Catches |
|:-|:-|:-|:-|
| static weight audit | 1 | `bin/lib/fontload.mjs`: `fontWeightProblems(dir, engineDir): string[]` scans scene sources and engine tsx for `fontWeight` / `font-weight` numeric values and compares to the weights actually registered (engine/fonts.ts registers Geist 400, 500, 600 from `Geist-*.woff2`, verified) | A 700 or `bold` request with no 700 face, which the browser fakes with synthetic bold and changes widths. Existing `fonts` item only checks that referenced files exist (verified `checkFonts`). |
| runtime load assert | 2 | `fontLoadProblems(page, families): Promise<string[]>`: `document.fonts.check("16px Family")` for every family named in the brand json, plus a width probe of a fixed string against a fallback face; equal width means fallback | A face file present but never added, or `FontFace.load()` rejected. Note `engine/fonts.ts` holds the render with delayRender so a fallback frame should not render at all; `brandSlot.tsx` loads its signature face the same way (both verified by header). Residual risk is therefore smaller than the collector row claims; keep this S and last. |

The brand json shape (which key lists font families) is unverified: fixtures/taste-swoosh/brands/fx.json is `{}`. Read a real brand file in the consumer repo before writing `families`.

### E. Row 17: area-proportional honesty test

No new source file. Add to `engine/chartStoryMath.test.mjs` (verified: it already imports `STAGE_WINDOWS, buildStory, stageTimes`, `maxPointDistance, polyArea`, and builds `story = buildStory(CFG)` with values `[820,1240,1610,2050,2480]`).

Helper inside the test file: `settledBars(story, cfg): { area:number, height:number }[]` reads `story.at(cfg.tl.baselineIn[1]).wedges[i].poly` (settled between `toBars` end 7.6 and `toLine` start 9.4; wedges and `.visible` verified in the test head). Bars are `roundedRectPoly(cx, cy, width, h, radius)` (verified in `buildStory`), so exact area is `width * h - (4 - PI) * radius^2` for equal widths, which means a naive area ratio is off by the corner term. The test compares corrected areas, not raw ratios.

## Interface sketch

```js
// bin/lib/figures.mjs
export const NON_SCREEN_KEYS: string[];
export function onScreenStrings(beat): string[];
export function numbersIn(text: string): string[];
export function figuresProblems(scene, opts?: { strict?: boolean }): string[];

// bin/lib/figsync.mjs
export function spokenNumbers(narration: string): { numbers: string[], unparsedWords: string[] };
export function figsyncProblems(scene, opts?: { strict?: boolean }): string[];

// bin/lib/narrationfit.mjs
export function narrationFitProblems(beats, opts?: { wps?: number, tolerance?: number }): { problems: string[], warnings: string[] };

// bin/lib/deadspan.mjs
export function motionWindows(beat): Array<[number, number]> | null;      // null = kind not linted
export function deadSpanProblems(scene, opts?: { maxHold?: number }): { problems: string[], warnings: string[] };

// engine/chartStoryMath.js and engine/dualTimelineMath.js (one new pure export each, added in step 4)
export function motionWindows(cfg): Array<[number, number]>;

// bin/lib/checkframes.mjs
export function probeTimes(scene): Array<{ t: number, why: "first" | "beat" | "last" }>;
export function scoreProbeStills(greyFrames: Buffer[], times): { pass: boolean, blank: Array<{ t: number, why: string, std: number }> };

// bin/lib/probe.mjs (async, Tier 2)
export async function probeStills(dir, loaded, bundle): Promise<{ pass: boolean, detail: string }>;
export async function probeAll(dir, loaded, bundle): Promise<Array<{ id: string, label: string, pass: boolean, detail: string }>>;

// bin/lib/textfit.mjs
export function textFitProblems(frames: Array<{ t: number, texts: Array<{ text, x, y, px, weight, anchor, box }>, bounds: Rect }>, opts?: { margin?: number }): string[];

// bin/lib/fontload.mjs
export function fontWeightProblems(dir, engineDir): string[];
export async function fontLoadProblems(page, families: string[]): Promise<string[]>;

// bin/video
// new command: `probe <scene>`; `render` and `stills` call probeAll after bundleScene; exit 2 on any FAIL, same message shape as gate().
```

## Test cases

All node:test, named so the failing behaviour is readable in the report. Files: `bin/lib/figures.test.mjs`, `figsync.test.mjs`, `narrationfit.test.mjs`, `deadspan.test.mjs`, `textfit.test.mjs`, `fontload.test.mjs`, additions to `checkframes.test.mjs`, `checklist.test.mjs`, `cli.test.mjs`, `engine/chartStoryMath.test.mjs`, `engine/dualTimelineMath.test.mjs`. Every new test file must be appended to the explicit list in the package.json `test` script (verified: it is a hand-listed a hand-listed `node` test-runner call with every file named, not a glob).

### figures and figsync

| Test name | Assertion |
|:-|:-|
| `figures: a number typed straight into copy fails` | beat text "Up 12% in 2023" with no placeholder returns a problem naming beat n and "12%" |
| `figures: a placeholder var with value, asOf and conf passes` | `{gdp.value}` with full var returns `[]` |
| `figures: missing asOf fails and names the var` | problem contains "gdp" and "asOf" |
| `figures: conf outside high, medium, low fails` | problem contains the bad value |
| `figures: an unknown placeholder is collected, not thrown` | returns a problem; does not throw (unlike `fillVars`) |
| `figures: figuresOk lets a derived number through` | "4 yrs" listed in `figuresOk` returns `[]` |
| `figures: narration, why and storyboard text are not scanned` | numbers only in those keys return `[]` |
| `figures: off by default, no problems without scene.figures` | `runChecklist` has no `figures` item for the base scene |
| `figsync: narration number absent on screen fails` | spoken "forty two" vs on-screen "41" returns a problem naming both |
| `figsync: commas, percent and the word percent normalise equal` | "1,240", "1240" match; "12%" matches "12 percent" |
| `figsync: strict flags an unspoken on-screen number, loose only warns` | same input: strict problem, non-strict empty problems plus a warning |
| `figsync: words outside the map are listed, never guessed` | "twenty-seven" or "a dozen" yields `unparsedWords`, no false FAIL |

### narration-fit

| Test name | Assertion |
|:-|:-|
| `narrationFit: measured voice longer than the beat fails` | `voice: 9`, beat 6 s long, problem names beat |
| `narrationFit: voiceAt is counted` | `voiceAt: 2, voice: 5` in a 6 s beat fails |
| `narrationFit: within tolerance passes` | 6.1 s voice in 6 s beat passes at 0.15 |
| `narrationFit: no measured voice only warns` | word-count estimate over length gives warning, empty problems |
| `narrationFit: untimed narrated beats are skipped` | beat with narration and no start or end produces nothing |
| `checklist: narration-fit item appears only when a beat has narration` | base fixture item ids unchanged |

### dead-span

| Test name | Assertion |
|:-|:-|
| `deadSpan: a gap longer than maxHold inside a beat fails` | windows [0,1] and [5,6] in a 0..6 beat, maxHold 2, problem with the 1..5 span |
| `deadSpan: overlapping windows leave no gap` | union covers the beat, `[]` |
| `deadSpan: camera key movement counts as motion` | chartStory camera keys closing a stage gap clear the problem |
| `deadSpan: an unregistered kind warns and does not fail` | warning names the kind |
| `chartStory motionWindows: matches stageTimes plus extra windows` | equals `stageTimes(CFG)` spans plus `labelsIn`, `baselineIn`, `bentoIn` |
| `dualTimeline motionWindows: every window sits inside the cfg duration` | no window starts below 0 or ends past the beat |

### blank probes

| Test name | Assertion |
|:-|:-|
| `probeTimes: first probe is after the blank grace, never t=0` | first `t` is at least `BLANK_MAX_RUN_S` |
| `probeTimes: one probe per beat at settle and one at end minus one second` | counts and values match the `settle` formula |
| `scoreProbeStills: a flat grey frame fails with its time` | uniform buffer returns `pass: false` and `std < BLANK_STD` |
| `scoreProbeStills: a frame with a drawn block passes` | buffer with a 40x40 white square on paper grey passes |
| `scoreProbeStills: reports every blank probe, not just the first` | two flat frames give two entries |
| `probeStills: calls the injected renderer once per probe time` | stub renderer count equals `probeTimes` length (no Chrome in unit test) |

### text-fit and font-load

| Test name | Assertion |
|:-|:-|
| `textFit: a rect wider than its container fails with the text` | width from `textRect` exceeds container, problem quotes the text |
| `textFit: wrapped lines taller than the container fail` | line count times line height over container height |
| `textFit: a rect inside the safe margin passes; one inside margin fails` | boundary at exactly the margin passes |
| `textFit: semibold uses the wider EM_BOLD constant` | same string fits at weight 400 and fails at 600 near the limit |
| `textFit: dualTimeline frames at keyed times fit for the golden config` | `frameAt` over the existing dualTimeline test config returns `[]` |
| `fontWeight: a 700 request with only 400, 500, 600 registered fails` | problem names file and weight |
| `fontWeight: bold keyword maps to 700` | same result for `fontWeight: "bold"` |
| `fontLoad: equal width to fallback means not loaded` | injected page stub returns equal widths, problem names family |
| `fontLoad: document.fonts.check false fails` | stub returns false, problem names family |

### area honesty (engine/chartStoryMath.test.mjs)

| Test name | Assertion |
|:-|:-|
| `honesty: settled bar areas are proportional to values within 1 percent` | corrected area `a + (4 - PI) * radius^2` over `width` ratio equals `values[i] / values[0]` within 1 percent, for all i |
| `honesty: settled bar heights are proportional to values and share one baseline` | `bounds(poly).y1` equal for every bar within 0.01 px; heights ratio equals value ratio within 0.5 percent |
| `honesty: the line stage end point sits at the last fact's height` | after `toLine` settles, last dot centre y equals `line.baseY - (last / max) * line.height` within 0.5 px |
| `honesty: ring wedge areas are proportional to value shares at the settled ring` | at a time between `toRing` end and `unroll` start, wedge area over total wedge area equals share within 2 percent (gap trim widens the tolerance; compute and pin the real tolerance when written) |
| `honesty: card shares sum to one and match shareSegments` | sum within 1e-9 |
| `honesty helper rejects a lying chart` | feed the helper a doctored poly set (one bar scaled 1.3x in height) and assert it throws; guards against the test passing vacuously |
| `honesty: mid-morph frames are out of scope` | documented skip: assertions run only at `baselineIn` end, `toLine` settled, never inside a window |

## Golden or fixture frames needed

| Need | Source | Committed? |
|:-|:-|:-|
| Grey buffers for blank and non-blank | built in the test (`Buffer.alloc`, fill, draw a rect) | No files |
| Real PNG stills for the decode path | generated in the test with `ffmpeg -f lavfi -i color=c=0xfaf7f1:s=160x160 -frames:v 1` (ffmpeg is already a prerequisite, per README) plus one with `drawbox` | No binaries committed |
| dualTimeline `frameAt` golden config | reuse the config already in `engine/dualTimelineMath.test.mjs` (unverified: not opened; confirm before relying on it) | Existing |
| CLI fixture scenes for `bin/video check` | new `fixtures/gates/` mirroring `fixtures/taste-swoosh` layout (verified: `brands/`, `scenes/promo/<name>/{scene.json,kinds.tsx}`): scenes `figs-good`, `figs-bad`, `fit-bad` (narration 9 s in a 4 s beat, with a `timing.json`), `dead-bad` (chartStory beat with a 6 s gap), `blank-last` (last-second beat that draws nothing, for the manual probe run) | Yes, small json and a one-line kinds.tsx each |
| Real Chrome probe on `blank-last` | needs Chrome, so it is a manual acceptance step, not in `npm test` | n/a |

## Acceptance command

Run from `/private/tmp/claude-501/vg-r3` (the scratch worktree):

```
npm test
node bin/video check fixtures/gates/scenes/promo/figs-good ; echo $?     # expect exit 0, "checklist PASS"
node bin/video check fixtures/gates/scenes/promo/figs-bad  ; echo $?     # expect exit 2, FAIL on figures and figsync, stderr "failed on 2 items: figures, figsync"
node bin/video check fixtures/gates/scenes/promo/fit-bad   ; echo $?     # expect exit 2, FAIL narration-fit naming beat 0
node bin/video check fixtures/gates/scenes/promo/dead-bad  ; echo $?     # expect exit 2, FAIL dead-span with the 1..5 s span
node bin/video probe fixtures/gates/scenes/promo/blank-last ; echo $?    # needs Chrome; expect exit 2, FAIL blank-last-still at 0.4 or end minus 1 s
```

Pass line: `npm test` exit 0 including the 6 to 8 new test files and the unchanged `checklist PASS: 9/9` assertion in cli.test.mjs; the four `check` commands exit as stated; `probe` exit 2 on `blank-last` and 0 on a good scene. Also confirm `bin/video check` still writes nothing (existing cli.test.mjs case).

## Order

| Step | Work | Depends on | Effort |
|:-|:-|:-|:-|
| 1 | Row 17 area honesty tests (only a test file edit, zero risk to the pipeline, proves the helper style) | none | S |
| 2 | Plumbing: `warn` field, `loadTiming`, `formatChecklist` WARN lines, `gates.mjs` barrel, package.json test list | none | S |
| 3 | narration-fit (pure, high value, no engine change) | 2 | S |
| 4 | figures and figsync, pilot on one real scene to confirm `NON_SCREEN_KEYS` | 2 | M |
| 5 | dead-span: `motionWindows` in chartStoryMath then dualTimelineMath (each with test), then the registry | 2 | M |
| 6 | `probeTimes`, `scoreProbeStills` (pure), then `probe.mjs` and the `probe` command, wired into `render` and `stills` after `bundleScene` | 2 | M |
| 7 | font weight audit (static) | 2 | S |
| 8 | text-fit option A for dualTimeline, ledgerRows, flowNetwork; spike option B in parallel | 2, 5 | M |
| 9 | Runtime font assert, and option B text-fit if the spike works | 6, 8 spike | S to M |

Rows 4 and 5 are independent and can go to two builders after step 2. Steps 6 and 9 share `probe.mjs`, so one builder owns both.

## Risk

| Risk | Likelihood | Mitigation |
|:-|:-|:-|
| `figures` false FAILs on years, axis labels, "3 steps" copy | High | Opt-in per scene, warn-only default, `figuresOk` escape, pilot on one scene before any scene is switched to strict |
| `NON_SCREEN_KEYS` wrong for some kind, so a hidden field is scanned or a visible one skipped | Medium | Pilot; a unit test per kind used in the pilot; unknown kinds scan all strings except the list |
| Narration-fit estimate (2.5 words per second) wrong for the chosen voice | Medium | Estimate only warns; FAIL needs the measured `voice` from timing.json |
| First-frame probe contradicts the documented clean-start grace | Medium | Probe at 0.4 s, not 0; override via `scene.probe` |
| Last-second probe lands inside a long fade and reads blank | Medium | Same override; default fade is 0.5 s (verified in `settle`) |
| Model-based text-fit disagrees with real glyph widths | Medium | Treat as a coarse gate with a 3 percent margin note; B closes the gap if the spike works |
| `openBrowser` route does not expose a seekable composition | Unknown | Spike first; if it fails, fall back to `renderStill` plus the pixel `inkGaps` already in inkgap.mjs for edge clipping, and keep A only |
| Rounded-rect corner term makes a naive area ratio fail at 1 percent | Certain | Test corrects for it explicitly; a helper-rejects-lie test stops the correction from hiding a real defect |
| Adding `motionWindows` to math modules touches existing engine files | Low | Pure additive exports, each with its own test; no change to `.tsx`; seekPurity coverage test (every `.tsx` needs a case) is not triggered because no `.tsx` is added |
| `checklist.mjs` size creep | Low | New logic lives in separate files; checklist.mjs only gains spread lines and `warn` handling |
| Repo rule: new visual parts go in engine/ with a node:test | n/a | No new visual part is added; the only engine edits are pure math exports with tests |

Effort total: row 17 S, row 5 S to M, row 4 M, row 6 M plus S.

## What a model writes vs what runs deterministically

| Piece | Model writes | Runs deterministically |
|:-|:-|:-|
| `vars` blocks (value, asOf, conf, source) | Yes, from the facts file; a light model drafts, EV or the lead confirms conf | No |
| `figuresOk` entries | Yes, judgment on what is derived | No |
| Soft review "do the stills match the fact file" | Optional light model over contact sheets, advisory only | Contact sheet generation |
| `figures`, `figsync`, `narration-fit`, `dead-span`, `text-fit`, font audit | Source and tests written once by a build model | Always, no model call |
| Blank still probe | Source written once | Rendering stills and scoring; no model |
| Area honesty test | Written once by the build model | `npm test` |
| Pass or fail decision on every item above | Never a model | Exit code 0 or 2 |

## Not verified

- No test, check or render was run; nothing in the worktree was edited except this file.
- Not read: `engine/dualTimelineMath.test.mjs`, `engine/ledgerRowsMath.js` text list shape, any `.tsx` part, `bin/video` `bundleOnce` and `selectFor`, `voice/timing.test.mjs`. Claims about their shapes are marked unverified above.
- Whether `@remotion/renderer` `openBrowser` can drive a bundle at a chosen frame (text-fit option B, runtime font assert).
- The brand json key that lists font families (fixture brand is `{}`).
- Exact `DEFAULT_LAYOUT.bars` values (width, radius, maxH); the area test reads them from the built story, so it does not depend on the numbers.
- The 1 percent area tolerance and the 2 percent ring tolerance are targets; pin real values when the tests are written and record why.
- Source rows came from runtime-upgrades.md and the two collectors; collector evidence is described there as inferred from prompts, so effort labels S, M are theirs and mine, not measured.
