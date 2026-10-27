# Plan: hooks, closing and voice pacing (runtime-upgrades rows 7 to 11 and 21)

Worktree: `/private/tmp/claude-501/vg-r3` (clean origin/dev). Plan only, no engine code written. Every "verified" below means I read the file in this worktree.

## Goal

Six behaviours, each a deterministic gate or a pure function of time, so they run before the 14 minute render and never need a model:

| # | Behaviour | Row | Effort |
|:-|:-|:-:|:-:|
| A | Voice-first runtime gate: run the voice step alone, fail if narrated total is outside 60 to 120 s or the aha beat starts outside its window | 7 | S |
| B | Cue visuals to spoken words: a beat names a word, the engine gets that word's onset as data | 8 | M |
| C | Pause by story role: lead, hold and speed vary with a beat `role` (history, setup, aha, close) | 9 | S |
| D | `hook` field, hook-aha echo check, hook spoken in first 3 s, first-3-seconds frame gate on the body master | 10 | S |
| E | Backward-from-aha brief: the shipped lint and the `brief: true` gate become one module; brief is cross-checked against scene.json | 11 | S |
| F | Closing: gap line then answer line, 10 word cap, 3 s hold floor, timings derived from beat length | 21 | M |

## Findings that change the plan (read this first)

| Finding | Evidence | Effect |
|:-|:-|:-|
| Kokoro speed is already a parameter, hardcoded: `pipeline(text, voice=voice, speed=1.0, ...)`. `synth(text, out_wav, voice, lang)` takes no speed; `narrate.py main()` passes only voice and lang from `cfg`. Chatterbox and NeuTTS `synth` have the same 4 arguments and no speed. | `voice/engines/kokoro.py` line 31; `voice/narrate.py` main; `voice/engines/{chatterbox,neutts}.py` | Answer: speed is controllable per scene and per beat with a 3 line change, gated by an engine flag `SPEED = True` so the other engines are untouched. Whether the pipeline accepts a callable speed, and its valid range, are NOT verified (ctx7 `/blaizzy/mlx-audio` lookup is build step 0). |
| The cache key is `sha1([narration, cfg])`. Adding a per-beat speed to the key unconditionally would invalidate every cached wav in every scene. | `voice/narrate.py` main | Add speed to the key only when it differs from 1.0, so existing keys stay valid. |
| There is no beat kind that marks the aha. `kind` is a free string mapped to a component by each scene's `kinds.tsx` (checked by `checkKinds`); `retime()` only compares `kind` to the next beat to choose `SECTION_HOLD`. The shipped template's "Kind" column holds story roles (hook, history, aha), which are not component kinds. | `bin/lib/checklist.mjs` `checkKinds`; `voice/narrate.py` `retime`; `/private/tmp/claude-501/ct-r2/video/templates/aha-brief.md` Beats table | Answer: do not overload `kind`. Add an optional beat field `role` (`hook`, `history`, `setup`, `aha`, `close`), typed in `engine/beat.tsx` `Beat`. The brief's "Kind" column maps to `role` by a stated rule. Fallback for old scenes: the aha beat is the one whose narration words contain `scene.aha`'s words in order; if none, the aha gates skip with a printed notice, never a silent pass. |
| Row 11 names `checkPlan()` in `bin/lib/shotlist.mjs`. It is not there: `shotlist.mjs` only renders `shotlist.md`. `checkPlan` is in `bin/lib/checklist.mjs`. | `bin/lib/shotlist.mjs` (7 lines); `checklist.mjs` | Words-per-beat cap goes next to `checkPlan` in `checklist.mjs`, not in `shotlist.mjs`. |
| Row 9 names `bin/lib/retime.mjs`. It does not exist. `retime()` lives in `voice/narrate.py` and is tested by `voice/timing.test.mjs` (python called from node). `tail` exists as a beat field; `pad` does not. | `voice/narrate.py`; `voice/timing.test.mjs` | Pause work edits `narrate.py` only. `pad` is introduced as a new field, or avoided by using `role` defaults plus the existing `tail`. This plan picks `role` tables plus optional `pad`. |
| `/private/tmp/claude-501/vg-r3/AGENTS.md` is absent, although `CLAUDE.md` says to read it. `GEMINI.md` exists. | `ls` of worktree root | Not verified: any repo rule that lives only in AGENTS.md. A reviewer must check the original checkout's AGENTS.md before merge. |
| `npm test` lists test files explicitly. A new `*.test.mjs` that is not added to `package.json` scripts.test never runs. | `package.json` | Every new test file below is added to that list in the same change. |
| The template says the aha beat "is the last beat", but a closing beat (F) follows the aha in real scenes (`LoopHandoff` shows in `scenes/client/riyadh-day3` beat 17 per README). | template Direction; README line 74 | Rule becomes: exactly one `aha`, and only `close` beats may follow it. Template and lint wording change together (E). |
| The frame gate runs on the master mp4, and `prependIntro` writes a separate `<stem>-with-intro.mp4`, so the master is intro-free. | `bin/lib/intro.mjs` header and `prependIntro`; `bin/video` lines 246 to 266 | The first-3-seconds gate can read the body directly. Order of `checkFrames` vs `prependIntro` in `bin/video` render was not traced end to end (UNVERIFIED), so the build must assert it with a test on the call site. |
| `blankRuns` already tolerates a blank run up to 0.3 s (`BLANK_MAX_RUN_S`), and `deadRuns` takes a `maxHold` option. | `bin/lib/checkframes.mjs` | Gate D reuses both with window-sliced arrays and a smaller `maxHold`; no new decoding code. |

## Files and functions

Signatures only. New files marked NEW. Constants are proposals; each default is read from `<brand>.taste.json` when present, else the stated fallback. None is evidence-backed beyond the collector hypotheses, so each carries a listen or eyeball check in Acceptance.

### A. Voice-first runtime gate

| File | Change |
|:-|:-|
| NEW `bin/lib/voicegate.mjs` | `export const RUNTIME_S = [60, 120]`; `export const AHA_WINDOW = [0.6, 0.9]` (fraction of narrated total at which the aha voice begins). `export function runtimeProblems(timing, rules = {}): string[]`. `export function ahaWindowProblems(scene, timing, rules = {}): string[]`. `export function voiceGate({ scene, timing, rules }): { problems: string[], notes: string[] }`. |
| `bin/lib/shape.mjs` | add `export function ahaBeat(scene): Beat \| null` (role first, narration-match fallback); reused by A, C, D, E. |
| `bin/lib/checklist.mjs` | in `runChecklist`, new item `voice-fit` ("narrated runtime and aha window"), present only when the scene has narration AND `timing.json` exists; otherwise a PASS item carrying a note "no timing.json yet, run bin/video voice". Uses `voiceGate`. Rules from `loadTasteRules` keys `runtime_s`, `aha_window`. |
| `bin/video` | `voiceStep` prints the `voiceGate` result after `timing.json` is written and exits 2 on problems (so `bin/video voice <scene>` alone is the voice-first gate, no render). |
| `bin/lib/checklist.mjs` `formatChecklist` | print `note` text under PASS items too (needed for the "skipped, say why" rule). |

### B. Cue visuals to spoken words

| File | Change |
|:-|:-|
| NEW `bin/lib/cues.mjs` | `export function resolveCues(scene, words): Beat[]` returns beats with `cues: { [key]: secondsFromBeatStart }`. Beat input shape: `cue: { [key]: { word: string, nth?: number } }`. Matching uses the same `bare()` normalisation as `captionsync.mjs` (lowercase, strip non letters/digits). `export function cueProblems(scene, wordsByBeat): string[]` (word not in that beat's narration, nth too large, beat has cue but no narration). |
| `bin/lib/words.mjs` | no change to functions; `sceneWords` output is the input to `resolveCues`. |
| `bin/video` | where scene words are computed (near line 338, UNVERIFIED which branch runs when captions are off): compute words when any beat has `cue`, then `scene.beats = resolveCues(scene, words)` before the bundle gets props. |
| `engine/beat.tsx` | `Beat` type gains `cue?` and `cues?: Record<string, number>`; add `export const useCue = (key: string): number \| null` returning crisp seconds since the cue (negative before it, null when the key is unresolved), pace applied like `useCrispSeconds`. Pure: reads beat data and frame only. |
| NEW `engine/cueMath.js` | `export function sinceCue(cueAt: number, t: number, pace = 1): number`; `export function slam(sinceSeconds, { rise = 0.18 }): { scale: number, opacity: number }` (the year slam envelope). |
| first consumer | `engine/Counter`-style year slam: which engine part takes it first is UNVERIFIED (`counter.tsx`, `countValue.js`, `kinetic.tsx` not read). Build step B3 reads them and picks one; this plan commits only to `useCue` plus `cueMath`. |

### C. Pause by story role

| File | Change |
|:-|:-|
| `voice/narrate.py` | constants `ROLE_LEAD = {"aha": 0.9}` and `ROLE_HOLD = {"history": 0.8, "aha": 2.4, "close": 3.0}` (proposals; absent role keeps `LEAD` 0.4 and `HOLD` 1.2, so existing scenes retime identically). `retime(beats, durations)` signature unchanged; reads `b.get("role")`, optional `b["pad"]` (seconds, replaces the hold, takes precedence over role), existing `tail` still adds. `voiceAt` becomes the per-beat lead. `SECTION_HOLD` still applies when the next beat changes kind and no `pad`/role hold is set. |
| `voice/narrate.py` | `main()`: `speed = b.get("speed", cfg.get("speed", 1.0))`; call `engine.synth(text, wav, voice, lang, speed=speed)` only when `getattr(engine, "SPEED", False)`; key payload `[narration, cfg]` plus `[speed]` only when `speed != 1.0`. |
| `voice/engines/kokoro.py` | `SPEED = True`; `synth(text, out_wav, voice, lang, speed=1.0)`; pass `speed=speed` to the pipeline call. |
| `bin/lib/checklist.mjs` | role check: `role` must be one of the five names; at most one `aha`; only `close` after it. Item `roles`, only when any beat sets `role`. |
| `engine/beat.tsx` | `Beat.role?`, `Beat.pad?`, `Beat.speed?`. |

### D. Hook field, echo, first 3 seconds

| File | Change |
|:-|:-|
| `bin/lib/shape.mjs` | `export const HOOK_MAX_WORDS = 10`. `export function hookProblems(scene, rules): string[]`: `hook` is a string; at most 10 words; `echo` is an array of at least 2 words, each present in `hook` and in `aha` (bare-word match, same rule as the brief lint); `rules.require_hook === true` makes absence a problem. `shapeApplies` also returns true when `hook` or `echo` is set. `rules.hook_mode` is `"warn"` or `"fail"` (default `"warn"` per the collector's crude-noun-match caution); warn returns notes, not problems. |
| `bin/lib/shape.mjs` | `export function hookSpokenProblems(scene, words, { withinS = 3 }): string[]`: hook words must all occur among `words` with `start < withinS`, and the first narrated word must start by 1.0 s on the scene clock. |
| `bin/lib/checklist.mjs` | item `hook` next to the `aha` item. The hook-spoken check runs in `bin/video` after words exist, not in the pre-render list (words need audio). |
| `bin/lib/checkframes.mjs` | `export const HOOK_WINDOW_S = 3`, `HOOK_MAX_HOLD_S = 1.0`, `HOOK_FIRST_MARK_S = 1.0`. `export function hookWindowProblems(stds, diffs, fps = SAMPLE_FPS): { pass: boolean, detail: string }` : slice both arrays to the first `HOOK_WINDOW_S * fps` samples; fail if `stds[0] < BLANK_STD`, if the first sample with `stds[i] >= BLANK_STD` and `diffs` above `DEAD_DIFF` comes after `HOOK_FIRST_MARK_S`, or if `deadRuns(window, fps, { maxHold: HOOK_MAX_HOLD_S })` is non empty. `evaluate()` gains a `checks` entry `first 3 s` built from it. |
| `IntroSequence.tsx` / intro scene | no code change here. Shortening via the existing intro beat `pace` (verified: `dur = (end - start) / pace`) is a scene config change, listed under Not verified for legibility. A hook line inside the intro (collector row 1) is out of scope: series text is 30 px and needs one intro render per video. |

### E. Backward-from-aha brief, one gate

Decision: the lint logic moves into `bin/lib/brief.mjs`. Reasons: `brief.mjs` already owns `BRIEF_FIELDS`, field parsing and the media-listed-in-Assets rule; the lint's `GATE_FIELDS` are the same five fields as `BRIEF_FIELDS`; keeping two copies means a field rename passes one and fails the other.

| File | Change |
|:-|:-|
| `bin/lib/brief.mjs` | add `export function ahaBriefProblems(text, { mode = "filled" }): string[]`, ported from `check-brief-template.mjs` (`sectionsOf` as `headingSections`, `tableOf`, `keyed`, `structureProblems`, `filledProblems`, `templateProblems`). Its five-field presence check is dropped from the port because `fieldProblems` already does it. Unchanged rules: slots, `Status: template`, hook/echo, exactly one aha, aha text equals Aha line, Feeds aha, words per beat cap (default 8), Facts sourced with as-of, every number on screen has a Facts row. Changed rule: only `close` beats may follow the aha (see Findings). |
| `bin/lib/brief.mjs` | `briefProblems(dir, scene)`: unchanged for `scene.brief === true`. New: `scene.brief === "aha"` additionally runs `ahaBriefProblems(brief.md)` and `briefSceneProblems(briefText, scene)`. Existing scenes keep behaving as today. |
| `bin/lib/brief.mjs` | `export function briefSceneProblems(text, scene): string[]`: Aha line equals `scene.aha` (bare words); Hook line equals `scene.hook`; Echo words equal `scene.echo`; the Beats table row count equals `scene.beats.length`; Kind column maps to `role` by row order and equals `scene.beats[i].role` (the stated mapping rule); Words per beat cap read from Inputs. |
| `bin/lib/checklist.mjs` | automatic words-per-beat cap beside `checkPlan`: `checkWordCap(scene, cap)` counts words in each beat's string fields `caption` and `text` (numbers exempt, as in the lint). Other kinds' on-screen fields are UNVERIFIED, so beats using other fields are reported as "not counted" in a note, not passed silently. Cap source: brief Inputs when `brief` is `"aha"`, else `rules.words_per_beat_cap`, else skipped with a note. |
| `bin/video` | new subcommand `brief-lint [file ...]` calling `ahaBriefProblems`; with no files it checks `templates/aha-brief.md` (mode template) and `templates/fixtures/good-brief.md` (mode filled). Add to the usage text and the unknown command list. |
| NEW `templates/aha-brief.md`, `templates/fixtures/good-brief.md`, `templates/fixtures/bad-brief.md` | copies of the three files from `/private/tmp/claude-501/ct-r2/video/templates/`. Single source decision is EV's (see Risk). |
| `/private/tmp/claude-501/ct-r2/video/bin/check-brief-template.mjs` | after the port, becomes a 10 line wrapper that spawns `bin/video brief-lint` with its own args. Not touched by this plan (outside video-gen). |

### F. Closing: gap then answer, cap, hold floor, derived timings

| File | Change |
|:-|:-|
| NEW `engine/loopHandoffMath.js` | `export const HOLD_FLOOR_S = 3`; `export const LINES_WORD_CAP = 10`; `export const GAP_TO_ANSWER_S = 0.9` (proposal). `export const LEGACY = { eyebrow: [0.2, 1], ring: [0.3, 1.2], stepFrom: 1.2, stepStagger: 1.3, stepLen: 0.8, loopOut: [7.4, 8.2], hand: [8.2, 9.4], logos: [9.6, 10.6], strip: [10.2, 11.2] }` (copied from the hardcoded `t(...)` calls, verified in `LoopHandoff.tsx`). `export function closingTimeline(durSeconds, { steps, hasLogos, hasStrip }): { eyebrow, ring, stepWindows[], loopOut, gap, answer, logos, strip }` (each a `[a, b]` in beat seconds). Derivation: legacy windows scaled by `s = (durSeconds - HOLD_FLOOR_S) / legacyEnd`, where `legacyEnd` is the last used window end; `gap` is the legacy `hand` window, `answer` starts `GAP_TO_ANSWER_S` later (scaled). Invariant: every window ends at or before `durSeconds - HOLD_FLOOR_S`; the final state holds at least 3 s. `export function closingProblems({ lines, durSeconds, steps }): string[]`: `lines` total words at most 10; `durSeconds >= MIN_CLOSE_S` (computed so `s >= 0.5`, i.e. no window shrinks below half its legacy length). |
| `engine/LoopHandoff.tsx` | replace the literal `t(7.4, 8.2)` style calls with windows from `closingTimeline((beat.end - beat.start) / (beat.pace ?? 1), ...)`; show `lines[0]` (gap) on `gap`, `lines[1]` (answer, accent) on `answer`. Props unchanged (`lines: [string, string]` already is gap then answer), so no scene breaks. `useBeat` import added. |
| `bin/lib/checklist.mjs` | item `closing`, for beats whose `kind` is `LoopHandoff` or whose `role` is `close` and that carry `lines`: runs `closingProblems`. Kind-to-part mapping is per scene (`kinds.tsx`), so the primary trigger is `role: "close"`. |
| "one next step only" | NOT deterministically checkable from `lines`. Plan: it lives in the brief (an Inputs slot "Next step: {{one}}", one value, lint fails on a list) and the closing beat's `lines[1]` must contain that text. Template Inputs slot is UNVERIFIED as existing; the template needs the slot added (E). |

## Interface sketch

```js
// scene.json (additions are all optional; absent means today's behaviour)
{ "aha": "...", "hook": "Why do leases cost more?", "echo": ["lease", "cost"],
  "brief": "aha", "voice": { "speed": 1.0 },
  "beats": [ { "n": 1, "role": "hook", "kind": "timeline", "narration": "..." },
             { "n": 2, "role": "history", "speed": 1.1 },
             { "n": 5, "role": "aha", "narration": "...",
               "cue": { "figure": { "word": "2019", "nth": 1 } } },   // -> beat.cues.figure = seconds
             { "n": 6, "role": "close", "kind": "closing", "lines": ["Which one fits you?", "Ask before you sign."] } ] }
// taste.json additions: require_hook, hook_mode, runtime_s, aha_window, words_per_beat_cap
```

```text
bin/video voice <scene>        writes timing.json, runs voiceGate, exit 2 on problems
bin/video check <scene>        items: voice-fit, roles, hook, closing, brief (aha mode)
bin/video brief-lint [file..]  template and fixture when no file
```

Exit codes follow the existing convention: 2 on any FAIL, 0 on PASS.

## Test cases

Names with the assertion each makes. Files are node:test `.test.mjs` next to the module; all added to `package.json` scripts.test.

| File | Test name | Assertion |
|:-|:-|:-|
| `bin/lib/voicegate.test.mjs` NEW | runtime inside 60 to 120 passes | timing ending at 90 gives `[]` |
| | runtime 59.9 and 120.1 fail naming the bound | one problem each, text includes the number and `RUNTIME_S` |
| | aha beat starting at 0.5 of total fails, at 0.7 passes | window `[0.6, 0.9]` |
| | no aha beat found prints a note, not a pass | `notes.length === 1`, `problems` empty only when the scene opts out |
| | no timing.json skips with a reason | checklist item PASS with note "run bin/video voice" |
| `bin/lib/shape.test.mjs` | ahaBeat prefers role over narration match | two beats, role wins |
| | ahaBeat falls back to narration words in order | returns the matching beat |
| | hook over 10 words fails | message names 11 and 10 |
| | echo word missing from aha fails; in warn mode it is a note | problems vs notes by `hook_mode` |
| | hook spoken after 3 s fails | word start 3.4 gives a problem |
| | first narrated word at 1.4 s fails | problem names 1.0 |
| `bin/lib/checkframes.test.mjs` | blank first sample fails the hook window | `stds[0] = 0` gives fail |
| | first mark at 1.4 s fails, at 0.8 s passes | boundary at `HOOK_FIRST_MARK_S` |
| | a 1.2 s still stretch inside 0 to 3 s fails, same stretch at 4 s is ignored | window slicing |
| | existing global tests unchanged | whole prior suite green |
| `bin/lib/cues.test.mjs` NEW | cue resolves to the word's onset relative to beat start | `cues.figure === word.start - beat.start` within 1e-6 |
| | nth occurrence picks the second | two "2019" words |
| | punctuation and case ignored | "2019." matches "2019" |
| | unknown word or beat without narration is a problem | `cueProblems` names beat and word |
| `engine/cueMath.test.mjs` NEW | sinceCue applies pace | pace 2 halves elapsed |
| | slam is 0 before cue, 1 settled after `rise` | boundary values |
| | seekPurity case for any new part reading `useCue` | the two t=7 renders are equal |
| `voice/timing.test.mjs` | no role keeps lead 0.4 and hold 1.2 | existing assertions pass unmodified (golden for non regression) |
| | aha role uses lead 0.9 and hold 2.4 | `voiceAt === 0.9`, end = start + 0.9 + voice + 2.4 |
| | history hold 0.8 | end delta |
| | `pad` overrides role hold; `tail` still adds | both orders |
| | speed 1.0 leaves the cache key identical to today | key equals the old formula; speed 1.2 changes it |
| | engine without `SPEED` is called without a speed argument | stub engine records arguments |
| `voice/engines` smoke (manual, needs mlx-audio) | speed 1.2 shortens the wav and word times still end inside it | `wav_seconds(1.2) < wav_seconds(1.0)`, last word end <= wav length; this also answers whether Kokoro token times already include speed |
| `bin/lib/brief.test.mjs` | all existing 8 tests pass unchanged | regression |
| | `scene.brief === "aha"` runs the ported lint | good fixture passes, bad fixture fails with the same messages the shipped script gives |
| | template mode demands `Status: template` and four Inputs slots | ported assertion |
| | only `close` may follow the aha | role order |
| | brief Aha line differs from `scene.aha` | named mismatch |
| | brief row count differs from beats | named mismatch |
| | parity test: run the shipped `check-brief-template.mjs` and `ahaBriefProblems` on the same two fixtures | identical problem lists (one off, deleted when the wrapper lands) |
| `bin/lib/checklist.test.mjs` | word cap fails a 9 word caption at cap 8; numbers exempt | counts |
| | role check: two aha, or a non close beat after the aha, fails | problems |
| | formatChecklist prints a note under a PASS | text present |
| `engine/loopHandoffMath.test.mjs` NEW | at the legacy duration the windows equal the legacy constants | deep equal to `LEGACY` (golden by number) |
| | every window ends at or before `dur - 3` for dur 8, 10, 14, 20 | invariant |
| | gap precedes answer by `GAP_TO_ANSWER_S * s` | difference |
| | `lines` with 11 words fails, 10 passes | cap |
| | duration below minimum fails with the minimum named | `closingProblems` |
| `engine/seekPurity.test.mjs` | existing LoopHandoff case stays green | uses its existing case at line 206 |

Golden frames (taken BEFORE touching `LoopHandoff.tsx`, committed as the first step of F): render the existing `LoopHandoff` at its reference length (`legacyEnd + HOLD_FLOOR_S` = 14.2 s) at t = 0.5, 4.0, 7.8, 9.0, 11.0, 13.5 with the seekPurity fixture props, save PNG and sha256 per frame. After the refactor the same frames at 14.2 s must match byte for byte (legacy windows reproduced). Then add frames at 10 s total (compressed) and 20 s (stretched) and check the final frame equals the t = 13.5 composition in both. Extra goldens: the hook window (frames at 0, 1.0, 2.9 s of a fixture body) and a cue frame pair (onset frame minus one, onset frame).

## Acceptance command

```text
cd /private/tmp/claude-501/vg-r3 && npm test                       # expect exit 0, no skipped new tests
node bin/video brief-lint                                           # expect exit 0 (template and good fixture)
node bin/video brief-lint templates/fixtures/bad-brief.md           # expect exit 1 and named problems
node bin/video check <fixture scene with role, hook, close beats>   # expect exit 0; mutate one rule at a time, expect exit 2 each
node bin/video voice <fixture scene>                                # expect exit 0 inside 60 to 120 s, exit 2 outside (local, no tokens)
grep -rnP '\x{2014}|\x{2013}| \x2d\x2d ' plans/hooks-closing-voice.md  # expect no output (exit 1)
```

The fixture scene is new (`fixtures/voicegate/`), 3 narrated beats, plus a stub engine so `voice` runs without mlx-audio in CI; the Kokoro speed smoke is manual. A final human step stays: listen test for C (pause lengths) and an eyeball of the compressed closing at 10 s.

## Order

| Step | Content | Why here | Depends on |
|:-|:-|:-|:-|
| 0 | ctx7 lookup for mlx-audio Kokoro `speed` (range, callable) | answers an open question before code | none |
| 1 | `role` type in `Beat`, `ahaBeat`, roles checklist item | every later step reads it | none |
| 2 | C: `retime` roles and `pad`, speed plumbing, timing tests | config level, zero engine render cost | 1 |
| 3 | A: `voicegate.mjs`, `voice-fit`, `voiceStep` hook | needs timing with roles | 1, 2 |
| 4 | E: port lint into `brief.mjs`, `brief-lint`, parity test, templates copied | one gate before D reads brief fields | 1 |
| 5 | D: `hookProblems`, `hookSpokenProblems`, frame hook window | reads brief/scene `hook` and `echo` | 1, 4 |
| 6 | F golden frames first, then `loopHandoffMath`, then `LoopHandoff.tsx` | engine visual change, last of the cheap ones | 1 |
| 7 | B: `cues.mjs`, `cueMath.js`, `useCue`, first consumer | largest, needs a consumer chosen after reading the parts | 1, 3 |

Rows follow the runtime-upgrades order (config first, gates, then motion), with B last as the M build.

## Risk

| Risk | Likelihood | Mitigation |
|:-|:-:|:-|
| Two sources of truth for the brief (video-gen and the content repo template) drift | high if left | Decision for EV: single source in video-gen `templates/`, content repo points at it. Until decided, the parity test fails on drift. I did not move or delete any file. |
| `role` and `kind` confusion in briefs (the template calls the role column "Kind") | medium | `briefSceneProblems` states the mapping rule; the template column header should become "Role" in the same change as the lint (needs EV sign off because the shipped lint reads "Kind"). |
| Changing `retime` shifts timing for existing scenes and invalidates reviewed renders | low | role tables apply only when `role` is set; the first test pins unmodified behaviour. |
| Cache invalidation across all scenes by a key change | low | speed joins the key only when not 1.0. |
| Kokoro speed changes word times in a way `onsets.py` landmark snapping mis-handles | medium | the manual smoke test; caption sync checks already exist and will catch drift after render. |
| Word cap undercounts (only `caption` and `text` fields read) | medium | the note lists beats not counted; extend per kind later. |
| Hook echo by bare word is crude | medium | default `hook_mode` is warn; promote to fail after one scene proves it. |
| `LoopHandoff` consumers (riyadh-day3 beat 17) have an unknown beat length | medium | `closingProblems` fails short beats loudly; the golden at the legacy length proves no change where length already fits. |
| Constants (60 to 120 s, window 0.6 to 0.9, pauses 0.8 / 2.4 / 3.0, gap 0.9 s, hold floor 3 s) are hypotheses from the collectors, not measured on our cuts | high | all live in taste.json or one constants block; the acceptance includes a listen test and one eyeballed render. |

## Not verified

- Kokoro: callable or ranged `speed`, and whether `start_ts` and `end_ts` already reflect it (step 0 and the manual smoke).
- Where in `bin/video` the words are computed when captions are off, and the order of `checkFrames` against `prependIntro` in the render path.
- Which engine part should consume `useCue` first (`counter.tsx`, `countValue.js`, `kinetic.tsx` unread).
- Beat length used by existing `LoopHandoff` consumers; the existing seekPurity case props at line 206 were read, the scene files were not.
- Whether the template's Inputs block has a "Next step" slot (it does not appear in the lines I read: Topic, Span, Length seconds, Words per beat cap, Tone, Channel).
- Rules that exist only in the missing `AGENTS.md`.
- Intro `pace` around 1.6 legibility on the poster (collector row 2), and any light model still judging; both are out of this build.
- Effort figures are estimates by comparison with the sizes in `runtime-upgrades.md`: A S, C S, D S, E S, F M, B M; total roughly 5 to 7 working sessions for one engineer, not measured.
