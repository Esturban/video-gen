# Plan: render cost controls and incremental changed-beat render

Repo: video-gen (worktree `/private/tmp/claude-501/vg-r3`, clean checkout of origin/dev). Plan only, no engine code. Covers rows 1 to 3 of `runtime-upgrades.md`: fps class per scene, mandatory logged draft pass, incremental changed-beat render.

Reading status: `bin/video` (all 496 lines), `bin/lib/ledger.mjs`, `range.mjs`, `variants.mjs`, `post.mjs`, `webpack-override.mjs`, `engine/Video.tsx`, `engine/time.js`, `engine/index.tsx`, `engine/beat.tsx` (lines 55 to 100), `engine/seekPurity.test.mjs` (head and test names), `bin/lib/ledger.test.mjs`, `cli.test.mjs`, `checklist.mjs` (`runChecklist` only), `package.json`, README (headline sections). No `AGENTS.md` exists in this checkout although `CLAUDE.md` says to read it; flagged under Not verified.

## Goal

| # | Outcome | Measured basis (consumer `video/cost-log.csv`) | Target |
| :- | :- | :- | :- |
| 1 | A scene declares a render class that sets fps and blur; a default exists | Same 565 s video: 75.6 min at 60 fps blur 2, 20.4 min at 30 fps blur 1 (3.7x) | Social-class final costs about 27 percent of the 60/2 final |
| 2 | A final cannot start without a passed draft of the same scene content; every draft and final writes a cost-log row with a `mode` column | One scene spent 71.9 min on five identical full renders; drafts leave no trace today (`costLog` runs only when not draft, `bin/video` line 258) | Waste (finals per video with no draft) readable from the log with one awk line |
| 3 | A final re-renders only beats whose content key changed, then stitches | One-beat change: about 14.4 min today vs about 1.6 min estimated (1/9 of beats) | Proven by the protocol below, not assumed |

Non-goals: no change to frame math, no change to what a beat draws, no change to intro, LinkedIn cut, poster, or frame gate behavior, no change to the consumer repo from the engine except appending to its `cost-log.csv` as today.

## Facts read from the code that shape the design

| Fact | Where | Consequence |
| :- | :- | :- |
| Composition runs at `fps * blur`; each output frame is `blur` subframes; `tmix=frames=blur,fps=fps` averages them in ffmpeg afterwards | `renderCut` and `renderRange` in `bin/video` | Stitch raw subframe chunks BEFORE the tmix pass; then no blur seam exists at chunk edges |
| `rangeFrames()` already maps seconds to an inclusive composition `frameRange`, snapping the first frame to `round(start*fps)*blur` | `bin/lib/range.mjs` | Reuse for chunk edges; same snapping rule |
| `renderRange` already calls `renderFrames` with `frameRange` on the same bundle and composition | `bin/video` lines 291 to 313 | Frame-range rendering of the real composition is proven in this repo; `renderMedia` with `frameRange` is not used here yet (unverified) |
| Each beat is a `Sequence` with its own `Fader`; fade in and out happen inside the beat window; first and last beat skip one side | `engine/Video.tsx` | No pixel of one beat blends with a neighbour. Position flags (first, last) must be in the key |
| Three overlays span beats: `Progress` (width of every beat), `BrandSlot`, `Captions` (all words) | `engine/Video.tsx` | They are shared state: fold into every chunk key when the scene enables them |
| Kinds read `useScene()` (`scene.data`, `scene.render`, others) | `engine/AppMock.tsx`, `CoachDemo.tsx`, `DualTimeline.tsx`, `beat.tsx` | Any non-beat scene field can change pixels; use a denylist of known non-rendering fields, so unknown fields invalidate (fail safe) |
| `scene.render = { fps, blur }` is injected by `selectFor` and spread over the scene | `selectFor` in `bin/video` line 155 | The new scene.json field must NOT be named `render` or it is overwritten; use `renderClass` |
| Narration is a separate muted-video-plus-wav mux; render uses `muted: true` | `renderCut` | Audio never enters a video chunk key. Narration edits matter only through `timing.json` changing beat `start` and `end` |
| `render.lock` allows one render at a time machine-wide; `concurrency` is `max(1, floor(cpus/2))` duplicated at two call sites | `bin/video` lines 305, 324, 477 to 489 | Concurrency experiment must hold the lock and record load |
| `bundleOnce` calls `bundle()` on every render and every range preview | `bin/video` line 145 | Bundle time is paid per run; never timed today (unmeasured) |
| Draft is 30 fps, blur 1, no LinkedIn cut, and the frame gate still runs on it | `render()` | A 30/1 final and a draft produce identical subframes, so draft chunks can serve a social-class final (big synergy, see Order) |

## Files and functions

Legend: V = verified by reading, U = unverified (not read or inferred).

### Part A: fps class per scene

| File | Function or symbol | Change | Status |
| :- | :- | :- | :- |
| `bin/lib/renderclass.mjs` (new) | `RENDER_CLASSES`, `DEFAULT_CLASS`, `resolveRender(scene, flags)` | Table `social` = 30/1, `master` = 60/2; precedence: `--fps` and `--blur` flags, then `scene.renderClass`, then `DEFAULT_CLASS`, then `--draft` forces 30/1 as today | new |
| `bin/lib/renderclass.mjs` | `renderClassProblems(scene)` | Unknown class name or a non-string gives one problem line naming the valid classes | new |
| `bin/video` | `render()` lines 235 to 237 and `renderRange()` same three lines | Replace the duplicated `fps`/`blur` lines and the validity check with one call to `resolveRender`; log `render class: social (30fps blur 1) from scene.json` or `from default` or `from flags` | V |
| `bin/lib/checklist.mjs` | `runChecklist` | Add an optional item `renderClass` only when `scene.renderClass` is present (same pattern as `slot`, `captions`, `plan`), so the existing `9/9` and `10/10` counts in `cli.test.mjs` do not move | V (pattern), item U |
| `bin/video` | `HELP` text and README flags section | Document `renderClass` and the precedence | V |

Default policy: ship with `DEFAULT_CLASS = "master"` (no behavior change). Flip to `social` in one line after EV approves two stills (blur 1 vs blur 2 on a fast chart draw, per the lens risk note). The flip is a taste call and is reversible by the same line.

### Part B: mandatory logged draft pass

| File | Function or symbol | Change | Status |
| :- | :- | :- | :- |
| `bin/lib/ledger.mjs` | `COSTLOG_HEAD` | Extend to `date,video,owner,tokens,render_minutes,video_seconds,fps,blur,mode,cpus,concurrency,beats_rendered,beats_total`. New columns are appended so old rows stay valid and short | V |
| `bin/lib/ledger.mjs` | `costLog(paths, scene, {tokens, minutes, fps, blur, mode, cpus, concurrency, beatsRendered, beatsTotal}, now)` | Write the new fields; `mode` is one of `draft`, `final`, `final-nodraft`; draft rows carry tokens 0 unless `--tokens` was passed | V |
| `bin/lib/ledger.mjs` | `upgradeCostlogHead(paths)` (new) | If the file exists and its first line equals the old 8-column head, rewrite ONLY line 1 to the new head; never touch data rows. Short old rows read as `mode = final` by every reader | new |
| `bin/lib/draftpass.mjs` (new) | `sceneFingerprint({dir, scene, brand, engineHash})`, `writeDraftPass(dest, fingerprint)`, `requireDraftPass(dest, fingerprint, flags)` | Fingerprint hashes the resolved scene (after `timing.json` merge), `kinds.tsx` and scene source files, brand JSON, fonts, engine hash, and EXCLUDES fps and blur (a draft is 30/1). Marker file `<dest>/.draft-pass.json` holds `{fingerprint, passedAt, gate: "pass"}`. `requireDraftPass` throws an Error whose message names the fix: `run bin/video render <scene> --draft first, or pass --skip-draft "reason"` | new |
| `bin/video` | `parseArgs` | Add value flag `skip-draft` | V |
| `bin/video` | `render()` | After `loadScene` (so the fingerprint sees the post-voice `timing.json`, line 237), before bundling: if not draft and not `paths.customOut` and no `--skip-draft`, call `requireDraftPass`. With `--skip-draft "reason"`, set `mode = final-nodraft` and print the reason | V |
| `bin/video` | `render()` failure block (lines 267 to 277) | Compute `failures` first; if `flags.draft && failures.length === 0` call `writeDraftPass`; then the existing `fail(...)` | V |
| `bin/video` | `render()` ledger block (lines 258 to 261) | Remove the `if (!flags.draft)` guard around `costLog`; keep `registryTouch` final-only (a draft must not update the registry's `last_rendered`) | V |
| `bin/video` | `render()` | A scratch render (`--out`) stays exempt from the gate and from the ledger, as today (`paths.customOut`) | V |

How the engine writes the log: the consumer's `cost-log.csv` path is `paths.costlog = <consumer root>/cost-log.csv` (`pathsFor`, line 110). `costLog` appends one line per render exactly as it does now; the engine adds no other writer. `upgradeCostlogHead` runs once at the start of `costLog`. The log is a record, not state, so the draft proof lives in `<dest>/.draft-pass.json`, not in the CSV.

### Part C: incremental changed-beat render

| File | Function or symbol | Change | Status |
| :- | :- | :- | :- |
| `bin/lib/beatkey.mjs` (new) | `globalKey(inputs)`, `chunkPlan(scene, fps, blur)`, `chunkKey(global, plan, chunk, scene)` | Pure. `chunkPlan` partitions `[0, total-1]` composition frames into one chunk per beat using the `rangeFrames` snapping; gap frames between beats join the preceding chunk. `chunkKey` hashes global key, chunk length, the full JSON of every beat whose Sequence intersects the chunk, first/last flags, and overlay keys | new |
| `bin/lib/beatcache.mjs` (new) | `loadManifest(dest, cutLabel)`, `planRender(plan, manifest)`, `commitChunk(dest, cutLabel, chunk, file)`, `gc(dest, cutLabel, keepKeys)` | Cache dir `<dest>/.beatcache/<cutLabel>/<chunkKey>.mp4` plus `manifest.json` `{globalKey, chunks:[{n, key, frames, sha256}]}`. `planRender` returns `{hit:[...], miss:[...]}`. A chunk file whose sha256 does not match the manifest is treated as a miss | new |
| `bin/lib/stitch.mjs` (new) | `concatListFile(files, listPath)`, `stitchArgs(listPath, out)`, `stitchChunks(files, out, run)` | ffmpeg concat demuxer with `-c copy` into the same `.raw.mp4` that `renderCut` already feeds to the tmix and encode pass | new |
| `bin/video` | `renderCut()` lines 322 to 326 | When incremental is on, replace the single `renderMedia` call with: build plan, `planRender`, `renderMedia({frameRange, outputLocation: chunkPath, ...})` per missing chunk, then `stitchChunks` to `raw`. All code after `raw` (tmix, encode, LinkedIn cut, poster) is unchanged | V (site), `renderMedia frameRange` U |
| `bin/video` | `parseArgs`, `HELP` | Flags `incremental` (boolean) and `no-cache` (boolean). Default OFF at first; flip default after the protocol passes | V |
| `bin/video` | `render()` | Pass `beatsRendered`/`beatsTotal` and per-phase timings (bundle, chunks, stitch, encode, linkedin) up to `costLog` and to `<dest>/render-timings.json` | V |
| `bin/lib/webpack-override.mjs` | none | `KIT` is exported and reused to locate `engine/` for hashing | V |
| `engine/seekPurity.test.mjs` | none required | Chunks come from the SAME composition via `frameRange`, so no isolation assumption beyond frame purity (already tested there). Do add the one case in test list below to document it | V |

### Invalidation rules (what folds into which key)

| Shared state | Where it lives | Folds into | Effect of a change |
| :- | :- | :- | :- |
| Engine source (`engine/**`, `bin/lib/webpack-override.mjs`), Remotion version pin (4.0.529), ffmpeg version string, node major | KIT | global key | Every chunk misses. Per-kind dependency tracking (esbuild metafile) is a later refinement, not v1 |
| Scene `kinds.tsx` and other scene source files | scene dir | global key | Every chunk misses |
| Brand tokens (`brands/<brand>.json`: colors, background, font) | `loadScene` brand | global key | Every chunk misses |
| Font files the brand resolves (`checkFonts` resolves them) | brand or scene dir | global key (content hash, not mtime) | Every chunk misses |
| Scene assets folder (`assets/`, the Remotion public dir) | scene dir | global key in v1 (content hash); per-beat referenced-file scan is phase 2 | Every chunk misses in v1. Over-invalidates on purpose |
| Scene-level fields other than beats | `scene.json` | global key, via a DENYLIST of non-rendering metadata: `owner`, `name`, `post`, `aha`, `history`, `intro`, `plan`, `brief`, `variants`, `poster`. Unknown fields invalidate | `data`, `fade`, `size`, `progress`, `brandSlot`, `captions`, `words`, `render`, `renderClass` invalidate everything |
| Output size, fps, blur, crf, cut label | cut | global key | A variant or class change misses all |
| Camera path | inside the beat JSON in the sources read (`STORY.camera` in the seek test); a camera held in `scene.data` is caught by the scene-level rule | chunk key (beat JSON) | Only chunks touching that beat miss |
| `Progress` overlay (width of every beat from `start`/`end`) | `Video.tsx` | chunk key, as hash of all `[n,start,end]`, only when `scene.progress` | Any duration change misses all chunks while progress is on |
| `Captions` overlay (all words, options) | `Video.tsx` | chunk key, as hash of all words, only when `scene.captions` | Any narration change misses all chunks while captions are on |
| Beat position (first or last) | `Fader` flags | chunk key | Inserting or removing the first or last beat misses its neighbour |
| Audio (voice wav, loudness) | muted render, mux later | none | Zero misses. The stitched raw and the final mux are separate |
| Beat `start` and `end` | beat JSON, including values written by `timing.json` | chunk key (absolute values) in v1 | A narration edit that changes beat k's duration misses beat k AND every later beat (they shift). Relocatable keys (relative offsets only) are phase 2 after auditing `.start` usage in `engine/*.tsx` (U) |

Honest scope: v1 saves most on same-duration edits (copy, number, color of one beat). Duration-changing edits recover only the beats before the change.

### What stays rerun on every incremental render

`gate`, `voiceStep`, bundle, the stitched-raw tmix and libx264 slow pass, the LinkedIn cut, poster, per-beat stills, frame gate, caption sync, intro join. Their cost is unmeasured here; the protocol records each so the ceiling on the saving is known (see Experiment 3).

## Interface sketch (signatures only)

```js
// bin/lib/renderclass.mjs
export const RENDER_CLASSES; // { social: {fps:30, blur:1}, master: {fps:60, blur:2} }
export const DEFAULT_CLASS;  // "master" until EV approves the stills, then "social"
/** @returns {{fps:number, blur:number, cls:string, source:"flags"|"scene"|"default"|"draft"}} throws Error naming the bad value */
export function resolveRender(scene, flags);
export function renderClassProblems(scene); // string[]

// bin/lib/ledger.mjs
export const COSTLOG_HEAD; // 13 columns
export function upgradeCostlogHead(paths); // "upgraded" | "current" | "absent"
export function costLog(paths, scene, { tokens, minutes, fps, blur, mode, cpus, concurrency, beatsRendered, beatsTotal }, now); // "written" | "skipped"

// bin/lib/draftpass.mjs
export function sceneFingerprint({ dir, scene, brand, engineHash }); // hex string, excludes fps and blur
export function writeDraftPass(dest, fingerprint, now);
export function requireDraftPass(dest, fingerprint, flags); // throws Error with the fix text

// bin/lib/beatkey.mjs
export function globalKey({ engineHash, sceneSrcHash, brand, fontHash, assetHash, sceneFields, cut, fps, blur, crf, remotion, ffmpeg });
export function chunkPlan(scene, fps, blur); // [{ n, first, last, frames, beats:[n...] }] partitions [0,total-1]
export function chunkKey(global, scene, chunk, { fps, blur }); // hex string
export const NON_RENDERING_SCENE_FIELDS; // denylist

// bin/lib/beatcache.mjs
export function loadManifest(dest, cutLabel); // {globalKey, chunks} | null
export function planRender(plan, keys, manifest, exists); // { hit:[chunk], miss:[chunk] }
export function commitChunk(dest, cutLabel, chunk, key, file); // writes sha256 into the manifest
export function gc(dest, cutLabel, keepKeys);

// bin/lib/stitch.mjs
export function concatListFile(files, listPath);
export function stitchArgs(listPath, out); // ffmpeg argv, -c copy
export function stitchChunks(files, out, run);
```

## Test cases

Runner: `node:test` like the rest of the repo. New files must be appended to the `test` script in `package.json` (the script lists files explicitly, V).

`bin/lib/renderclass.test.mjs`
- `resolveRender: scene with no renderClass returns DEFAULT_CLASS fps and blur and source "default"`
- `resolveRender: renderClass "social" returns 30 and 1`
- `resolveRender: renderClass "master" returns 60 and 2`
- `resolveRender: --fps 24 overrides the class fps only, blur stays from the class, source "flags"`
- `resolveRender: --draft forces 30 and 1 even when the scene says master`
- `resolveRender: unknown class "ultra" throws and the message lists social and master`
- `resolveRender: blur 1.5 or fps 0 throws the same whole-number message as today`
- `renderClassProblems: absent field gives []`

`bin/lib/ledger.test.mjs` (extend)
- `costLog writes 13 columns and mode "final" for a normal render`
- `costLog writes a draft row with mode "draft", tokens 0, and does not call registryTouch` (assert via `bin/lib/cli.test.mjs` fixture that registry.csv is unchanged after a draft)
- `upgradeCostlogHead rewrites only line 1 and leaves every data row byte for byte unchanged`
- `upgradeCostlogHead on an already current file returns "current" and the file bytes are identical`
- `an old 8-column row is still readable: parse yields mode undefined, treated as "final"`
- `a --out scratch render writes nothing to cost-log.csv for draft and final` (keeps the existing guarantee)

`bin/lib/draftpass.test.mjs`
- `sceneFingerprint is identical for the same scene at fps 30 blur 1 and fps 60 blur 2`
- `sceneFingerprint changes when one beat's text changes`
- `sceneFingerprint changes when timing.json changes a beat end`
- `sceneFingerprint changes when the brand JSON changes`
- `requireDraftPass throws when no marker exists and the message contains "--draft" and "--skip-draft"`
- `requireDraftPass throws when the marker fingerprint is stale`
- `requireDraftPass passes when the marker matches`
- `requireDraftPass is skipped when flags.skip-draft is a non-empty reason; an empty reason still throws`
- CLI black box (extend `cli.test.mjs` fixture pattern): `final render with no draft marker exits 2 and renders nothing` and `a final with --out is not gated`

`bin/lib/beatkey.test.mjs`
- `chunkPlan partitions frames: first chunk starts at 0, each chunk starts at the previous last + 1, the last ends at round(end*fps*blur)-1, no gaps, no overlap` (property check over blur 1, 2, 4 and fps 24, 30, 60)
- `chunkPlan assigns a gap between beats to the preceding chunk`
- `chunkKey is stable: same inputs twice give the same key`
- `chunkKey changes only for the edited beat when beat 3 copy changes (beats 0,1,2,4,5 keys equal)`
- `brand token change flips every chunk key`
- `font file content change flips every chunk key; touching mtime only does not`
- `engine source change flips every chunk key`
- `scene.data change flips every chunk key`
- `unknown scene field flips every chunk key (denylist fails safe)`
- `post, aha, history, owner change flips no key`
- `camera array change inside beat 2 flips only chunks touching beat 2`
- `progress on: changing beat 2 duration flips every key; progress off: only beat 2 and later keys flip (they shifted)`
- `captions on: changing one word flips every key; captions off: it flips none`
- `audio-only change (a wav path or loudness field outside the scene) flips no key`
- `fps or blur change flips every key`
- `first and last flags are in the key: dropping the last beat flips the new last beat's key`

`bin/lib/beatcache.test.mjs` (fake renderer writes deterministic bytes from the chunk key, so no browser needed)
- `cold run: planRender returns all chunks as miss`
- `warm run, nothing changed: planRender returns all hit and the fake renderer is called 0 times`
- `UNTOUCHED BEATS ARE BYTE IDENTICAL: render all, record sha256 of every chunk file, edit beat 3, render incremental, assert chunk files for beats 0,1,2,4,5 have identical sha256 and identical mtime (never rewritten), and only beat 3's chunk differs`
- `a chunk file whose bytes no longer match the manifest sha256 is a miss and is re-rendered`
- `a missing chunk file is a miss`
- `manifest globalKey mismatch (brand change) turns every chunk into a miss and gc removes the old files only after the new set commits`
- `gc keeps only keys in keepKeys and never deletes a file outside .beatcache`
- `a render that fails mid-way leaves the previous manifest intact (commit is per chunk after the file closes, manifest written by rename)`

`bin/lib/stitch.test.mjs`
- `concatListFile writes one escaped "file '<path>'" line per chunk in plan order`
- `stitchArgs uses the concat demuxer, -c copy, and -safe 0`
- `stitchChunks with a fake run passes chunks in ascending frame order`
- `sum of chunk frame counts equals total composition frames (assert on the plan, not the video)`

`engine/seekPurity.test.mjs` (extend, 1 case)
- `a frame drawn inside a frameRange render equals the same frame drawn in a full render` documented as: chunking relies on frame purity only (reuses the existing stub and `t=7, t=2, t=7` method)

`bin/lib/incremental.e2e.test.mjs` (opt in, `VIDEO_E2E=1`, needs Chrome and ffmpeg, U whether CI has them; skipped otherwise)
- `4-beat 8 s synthetic scene: full incremental render, then change beat 2 copy, incremental render: ffmpeg framemd5 of the stitched raw is identical on every frame of beats 0, 1, 3 and differs on beat 2`
- `stitched raw frame count equals the plain renderMedia raw frame count`
- `plain full render vs incremental full render of the same scene: framemd5 of decoded raw frames identical (the stitch changes nothing)`
- `determinism pre-check: the same chunk rendered twice has equal framemd5; record whether the sha256 of the mp4 file is also equal (decides whether the byte-identical assertion can use file hashes or must use decoded frame hashes)`

## Acceptance command

```bash
cd /private/tmp/claude-501/vg-r3 && npm ci && npm test
# expected exit: 0 (all existing and new node:test files pass; the e2e file is skipped)

cd /private/tmp/claude-501/vg-r3 && VIDEO_E2E=1 node --test bin/lib/incremental.e2e.test.mjs
# expected exit: 0 on a machine with Chrome and ffmpeg

cd /private/tmp/claude-501/vg-r3 && bin/video render <scene> --root <consumer root> --tokens 0
# before a draft exists: expected exit 2, stderr names "--draft" and "--skip-draft", nothing rendered

cd /private/tmp/claude-501/vg-r3 && bin/video render <scene> --root <consumer root> --draft && bin/video render <scene> --root <consumer root> --tokens 0 --incremental
# expected exit 0; <consumer root>/cost-log.csv gains one mode=draft row and one mode=final row

awk -F, 'NR>1 {n[$2" "$9]++} END {for (k in n) print k, n[k]}' <consumer root>/cost-log.csv
# expected: every video that has a final row also has a draft row after the cutover date
```

`<scene>` and `<consumer root>` are the content-thinking scene and `video/` folder; which small scene to use as the proof scene is left to the build (U).

## Measured-before and after protocol

Rules for every experiment: one machine, no other seat rendering (the render lock covers engine renders, not other CPU load), record `uptime` load average and `cpus` before each run, alternate A and B order, at least 3 runs per arm, discard none, report median and spread. A saving is claimed only when the spread of each arm is under 15 percent of its median and the medians differ by more than that spread; otherwise rerun or report "not proven". Minutes come from the new `render-timings.json` phases, with `cost-log.csv` render_minutes as the cross-check.

Step 0, instrumentation first (no behavior change): add phase timings (`bundle_s`, `chunks_s`, `stitch_s`, `encode_s`, `linkedin_s`, `gate_s`) to `render-timings.json`. Nothing below is run before this lands.

| Experiment | Question | Arms | Measure | Proves |
| :- | :- | :- | :- | :- |
| 1. fps class | Does social cost what the log says? | A `--fps 60 --blur 2`, B class `social` (30/1), same scene, 3 runs each | total minutes, chunk or renderMedia seconds, output file size | The 3.7x claim on a scene other than the 565 s one. EV compares two stills (a fast chart draw at blur 1 and blur 2) once before the default flips |
| 2. draft gate | Does it cut re-render waste? | Count finals per video in the log for 4 weeks before and after the cutover, excluding `final-nodraft` | finals per delivered video, draft minutes per final | Behavior change, not speed. Target: no scene repeats five identical finals; report `final-nodraft` count as the escape rate |
| 3. incremental | Real saving of a one-beat change | Arm A: full render, no cache (`--no-cache`). Arm B: prime the cache with a full incremental render, edit one beat's text without changing its duration, render incremental. Repeat editing beats at the start, middle, and end of an N-beat scene | `chunks_s`, `stitch_s`, `encode_s`, `linkedin_s`, `bundle_s`, total, `beats_rendered` | Ceiling and floor: the fixed phases (bundle, stitch, encode, linkedin, gate) set the lower bound; if they exceed about 50 percent of the A total, the 14.4 to 1.6 min estimate is false and the plan reports the real figure |
| 3b. correctness | Are untouched beats really untouched? | Arm B output vs a plain full render of the same edited scene | decoded raw framemd5 of every frame outside the edited beat; PSNR of the final mp4 on untouched ranges | Raw frames must match exactly. Final mp4 frames may differ slightly because the libx264 pass runs over a different stream (rate control lookahead); record the PSNR and ask EV whether a floor (for example 50 dB) is acceptable. Do not assert final-mp4 byte identity |
| 4. bundle reuse (unmeasured today) | How long is `bundle()` and is caching it worth a build? | Run 5 consecutive `render --range 0:1 --out <tmp>` previews on one scene, record `bundle_s` each; cold = after deleting the bundler cache, warm = repeat | `bundle_s` median, share of a range preview and of a draft | Value ceiling = bundle_s times runs per scene per day (use the cost-log row counts, 61 rows). Build the cache (key: hash of `engine/**` plus scene dir plus Remotion version) only if bundle_s exceeds about 20 seconds or about 10 percent of a draft; otherwise record "not worth it" |
| 5. concurrency (unmeasured today) | Is `floor(cpus/2)` the right worker count? | `render --range` on a 5 s window of a heavy scene (the 0.36 min per second one) and a typical scene at `--concurrency` 1, 2, 4, 6, `floor(cpus/2)`, `cpus`; 3 reps each, order randomised | frames per second of `renderFrames`, any frame timeout (the code sets 120 s), peak load, other seats' load | A new default only if one value is at least 10 percent faster than the current rule on both scenes with zero timeouts across all reps. Cap at physical cores. Needs a new `--concurrency N` flag or `VIDEO_CONCURRENCY` env read in one helper that replaces the two duplicated `Math.max(1, Math.floor(cpus().length / 2))` sites |

The synergy to measure inside Experiment 3: with `DEFAULT_CLASS = social`, a draft (30/1) and a final share a global key except `crf` and the cut; if the key excludes the crf-independent fields, draft chunks can serve the final. Record whether the chunk cache hit rate on the first final after a draft is 100 percent. If yes, the mandatory draft pass costs almost nothing and the final becomes stitch plus encode only.

## Order

| Step | Work | Depends on | Verify | Effort |
| :- | :- | :- | :- | :- |
| 0 | Phase timings into `render-timings.json`, `--concurrency` helper wired but defaulted to current rule | none | unit test of the helper; a run prints timings | S |
| 1 | `renderclass.mjs`, `resolveRender` in both call sites, checklist item, help text; `DEFAULT_CLASS = "master"` | 0 | renderclass tests, existing `cli.test.mjs` counts unchanged | S (0.5 day) |
| 2 | Ledger columns, `upgradeCostlogHead`, draft rows | 0 | ledger tests, `cli.test.mjs` | S (0.5 day) |
| 3 | `draftpass.mjs`, gate in `render()`, `--skip-draft` | 2 | draftpass tests, CLI black box | S (1 day) |
| 4 | Experiments 1, 4, 5 on real renders (machine time, no code) | 0, 1 | results written to the round ticket | S (1 day) |
| 5 | EV two-stills check, then flip `DEFAULT_CLASS` to `social` | 4 | EV approves | tiny |
| 6 | `beatkey.mjs`, `beatcache.mjs`, `stitch.mjs` with the fake-renderer tests, including the byte-identical test | 0 | all unit tests | M (2 days) |
| 7 | `renderCut` incremental branch behind `--incremental`; e2e test; determinism pre-check | 6 | e2e file, `renderMedia frameRange` confirmed in the pinned Remotion docs via `ctx7` first | M to L (2 to 3 days) |
| 8 | Experiments 3 and 3b; decide default on or off; flip only if protocol passes | 7 | measured table in the ticket | S (1 day) |
| 9 | Bundle cache only if Experiment 4 says so | 4 | its own tests | M, conditional |

Total about 7 to 9 working days for 1 to 3 plus 8; step 9 is conditional. Steps 1 to 3 are independent of step 6 onward and can ship first.

## Risk

| Risk | Likelihood | Impact | Mitigation |
| :- | :- | :- | :- |
| Fixed phases (bundle, tmix and slow libx264 encode, LinkedIn cut, gate) dominate, so the 14.4 to 1.6 min estimate is optimistic | Medium | The saving is smaller than claimed | Experiment 3 reports the real split before the default flips; the plan states the estimate is unproven |
| Final mp4 pixels near an edit differ from a plain render (rate control lookahead in the full-stream libx264 pass) | Medium | "Untouched beats identical" holds for raw chunks and decoded raw frames, not the final file | Assert on raw frames; measure final PSNR; do not claim final byte identity |
| Chunk mp4s from `renderMedia` are not byte deterministic (encoder threading) or concat copy needs matching SPS/PPS and keyframe at chunk start | Low to medium | Cache sha mismatches, or a stitch glitch | Determinism pre-check in e2e; compare decoded framemd5 instead of file hash; fallback is PNG sequence chunks through `renderFrames` (bigger disk, proven path in `renderRange`) |
| Stale cache from a missed dependency (symlinked asset, font by path, a scene import outside the scene dir) | Medium | A wrong frame ships silently | Fail-safe design: global key includes the whole engine, the whole scene source dir, all assets and fonts by content; scene fields denylist; frame gate still runs; `--no-cache` escape; EV spot check on the first three real incremental finals |
| Kinds that read absolute time or other beats' data break the per-beat key | Low | Wrong frames for those kinds | Absolute `start`/`end` in the key in v1; audit `.start` and `useScene().beats` usage in `engine/*.tsx` before the relocatable-key phase (U) |
| Mandatory draft annoys EV and gets bypassed with a lazy `--skip-draft` reason | Medium | Control degrades to noise | Escape is logged as `final-nodraft`; the escape rate is Experiment 2's metric |
| Fingerprint computed before vs after the voice step disagrees | Low | Draft never matches final | Fingerprint after `loadScene` post-voice in both draft and final paths; a test uses a scene with `timing.json` |
| Flipping `DEFAULT_CLASS` changes the look of every future re-render of an old scene | Medium | Taste regression, not a bug | Ship default `master`; flip after EV sees two stills; old scenes can pin `renderClass: master` |
| Disk growth in `.beatcache` (raw crf 16 chunks for a 565 s video) | Medium | Disk pressure | `gc` after each successful render; cache is under `out/`, not in git; size printed in the run |
| Concurrency or bundle gains turn out to be zero | Medium | Wasted build | Both are experiments first; no code beyond the helper and timings until a number justifies it |

## Not verified

- `AGENTS.md` for this repo: absent in the worktree although `CLAUDE.md` tells the reader to read it; house rules were taken from `README.md` and the code only.
- Whether `renderMedia` in Remotion 4.0.529 honours `frameRange` together with `codec: h264, crf: 16, muted: true` and returns exactly the frames requested; only `renderFrames` with `frameRange` is exercised in this repo. Check docs with `ctx7` before step 7.
- Whether chunk files concatenated with `-c copy` play without a glitch (keyframe at chunk start, matching SPS and PPS).
- Whether libx264 output is deterministic across two runs on this machine.
- Per-phase costs: bundle time, stitch plus tmix plus libx264 slow pass time, LinkedIn cut time, and frame gate time are not in any log.
- Whether any engine part reads `b.start`, `b.end` absolute, or other beats via `useScene().beats` (only the first 100 lines of `beat.tsx` and the grep of `useScene` call sites were read, not the parts).
- Camera path location: seen as a beat field in the seek test fixtures; not confirmed for every kind. `cameraMath.js` was not read.
- `checklist.mjs` internals beyond `runChecklist`, `checkFonts` resolution paths, and which font files exist to hash.
- Whether CI has Chrome and ffmpeg for the e2e test (the only workflow read is `dev-to-trunk.yml`, which opens a PR and runs no tests).
- The proof scene to use for real renders and its measured baseline; the 14.4 min and 1.6 min figures are from the lens table, not re-measured here.
- The consumer `cost-log.csv` was read only for its header and one `riyadh-day3` pair (20.4 min at 30/1, 75.6 min at 60/2); the 61-row figures are quoted from the lens file.
- Any consumer of `cost-log.csv` that assumes exactly 8 columns (none found in this repo; consumer repo scripts not searched).
