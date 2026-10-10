### Video Gen 

> Generating videos for different courses quickly with the help of AI.

## Video engine (Remotion, CMO-7526 round 1)

One engine, one `node_modules`, one command. A scene folder lives in the consumer repo (for example `content-thinking/video/scenes/promo/<name>`); this repo holds only the generic kit: `bin/video`, `engine/`, `voice/`, `brands/` (fallback brands). The legacy Python audio scripts below are untouched.

```bash
npm ci                                              # first time only; Node 20+, ffmpeg, uv (voice only), Chrome
bin/video render <path-to-scene-folder> --tokens N [--out DIR] [--draft]   # --tokens is required unless --draft; 0 is fine for a pure render
bin/video check <path-to-scene-folder>                                      # the checklist alone: PASS/FAIL per item, exit 0 or 2, writes nothing
```

Spec: `thinking/wiki/domains/dev/video-engine-separation-spec.md`. Exit 0 ok, 2 a fix you can make (message says which), 1 anything else.

What one `render` does, in order:
1. Pre-render checklist, PASS or FAIL per item, exit 2 on any FAIL and nothing renders: scene.json valid (fields, ordered beats), every beat kind in `kinds.tsx`, brand and font files resolve, no em or en dash in on-screen copy, banned-figure pair absent, output dir writable. The by-eye items from DEV-7364 (logos, titles, event facts) print as a reminder.
2. Narration step only if a beat has `narration` (local Kokoro through uv). No narration means no audio stream.
3. Bundle and render with Remotion 4.0.529: 60fps master with motion blur, 30fps LinkedIn cut, poster, one still per beat.
4. Post-render ffprobe line: size, fps, duration, audio, constant frame rate.
5. Appends a row to `cost-log.csv` and updates `registry.csv`, both next to the scene's `scenes/` folder. `--tokens N` is required on a non-draft render (exit 2 without it; `--draft` is exempt and logs nothing). The cost-log date column is an ISO UTC stamp with a Z suffix, for example `2026-10-03T15:36Z`; the header and 8 columns are unchanged and older rows are left as they are. With `--out`, renders go to `DIR/<area>/<name>/` and write nothing to `cost-log.csv` or `registry.csv` (the ledgers are for real deliverable renders only).

Other commands: `stills`, `voice`, `studio`, `list --root DIR`, `archive NAME --root DIR` (same as the old kit; `bin/video --help`).

Brands are looked up in the consumer's `brands/` first, then this repo's `brands/`. Scenes import the engine as `@video/engine/beat`; a scene still using the old relative `../../../../engine/beat` import keeps working through a webpack redirect, so no scene file had to change. The scene's `kinds.tsx` is wired by a webpack alias per job, so no generated file is written into `engine/`. One render at a time machine-wide (atomic lock at `.video/render.lock`).

Counting-up numbers: `import { Counter, CountedText } from "@video/engine/counter"`. `CountedText` takes the real copy plus the whole numbers in it to count; the pure value function is `engine/countValue.js` (closed form, lands exactly on the target and holds).

UI-demo parts (round 3), all pure functions of time, each with node:test cases:
- `@video/engine/motion`: named easing curves, `springStep`, `staggerProgress`, and `tween`, the no-teleport helper (a value moves between states only through an eased interval; zero-length changes throw). Maths in `motionMath.js`.
- `@video/engine/pointer`: `<Pointer waypoints=[{t,x,y,act?}] />`. The pointer arrives at each waypoint at rest, a `press` goes down 0.12s after arrival, ripple and squash, held before the start and after the end. A path that would force a teleport throws. Maths in `pointerPath.js`.
- `@video/engine/typing`: `<Typing text start cps pauses focusAt />`, chars monotonic, lands exactly on the full string, caret solid while typing then blinking. Maths in `typingState.js`.
- `bin/video frames <mp4> [--sheet DIR] [--max-hold S]`: frame gate (blank frames, dead stretches, teleports) plus a contact sheet PNG. Runs automatically after `render`; a FAIL exits 2 and keeps the file. Thresholds are named constants in `bin/lib/checkframes.mjs`. Known limits (Reality Checker, round 3): it catches whole-frame cuts and blank or frozen footage. It does NOT reliably catch small-element jumps such as a pointer or caret teleporting or half a sentence appearing at once (it averages change over the whole downscaled frame), and it does not catch smooth ghosting or double images from motion blur. Review those by eye on the contact sheet. Scoring the largest change inside small tiles is the planned fix.

Morph and data-story parts (round 4), all pure functions of time, each with node:test cases:
- `@video/engine/morph`: equal-length point-list shapes (`morphPoly`, `roundedRectPoly`, `circlePoly`, `bentRectPoly`, `segmentQuad`), colour mixing (`mixRgb`) and the camera path (`cameraAt`, a monotone C1 spline, `viewBoxFor`). Every shape has one point layout, so a wedge can become a bar, a line segment, a circle and a card with no jump. Maths in `morphMath.js`, `colorMath.js`, `cameraMath.js`.
- `@video/engine/chartStory`: `<ChartStory config colors fontFamily />` draws the whole chain (dot, ring, unroll, bars, line, absorb into the end dot, number, split into cards) on one svg whose viewBox is the camera. The chain is `chartStoryMath.js` (`buildStory(cfg).at(t)`); a scene supplies only data, stage windows (`tl`) and camera keys in scene.json. Example: content-thinking `scenes/promo/data-story-morph`.
- Brand slot: add `"brandSlot": {"text": "Esteban V.", "corner": "bottom-right", "logo": null}` to scene.json and `Video.tsx` renders it as an overlay (absent field means nothing changes). Signature fades and wipes in left to right after the first second, low-key brand ink, safe margin, sizes scale with min(width, height) / 1440. `logo` set to a path inside the scene's `assets/` renders that image instead. `bin/video check` validates the field (a `brand slot valid` item appears only when the field is present). Signature font: Herr Von Muellerhoff (SIL Open Font License 1.1, Copyright 2011 Alejandro Paul), bundled in `engine/assets/fonts/` with `OFL-HerrVonMuellerhoff.txt`; the slot loads it itself.

Timing and captions from the real audio (CMO-7584), all local:
- A narrated beat needs no `start`/`end` in scene.json. The voice step (Kokoro, local) measures each beat's wav and writes `timing.json`: the beat lasts lead (0.4s) + the measured audio + a hold (1.2s, or 2.0s before a beat of a new kind) + its optional `tail`. A beat without narration keeps its own length and moves to follow a narrated beat before it. The maths is `retime()` in `voice/narrate.py`, tested against an ffmpeg-made wav of known length (`voice/timing.test.mjs`).
- `"captions": true` in scene.json (or an options object `{ "maxWords": 5, "maxGap": 0.8, "linger": 0.6 }`) turns on word-timed captions; absent means off, so existing scenes are unchanged. On render, each narrated beat's wav is transcribed by the local `whisper-cli` (whisper.cpp, Homebrew) with `~/.config/open-wispr/models/ggml-large-v3-turbo.bin`, one word per segment, cached as `audio/beat<n>.words.json` while the narration is unchanged, and written to `out/<area>/<name>/words.json` on the scene clock. Script spelling is used when whisper heard the same number of words; words whisper stacked on one start share the time so every word shows. Override the binary or model with `VIDEO_WHISPER_BIN` / `VIDEO_WHISPER_MODEL`.
- `engine/captions.tsx` draws a page of words on a plate near the bottom with the spoken word in a highlight box, on the crisp clock (no blur ghosting, one exact switch frame). Look comes from the brand file: a `captions` block in the brand JSON overrides any field (`font`, `size`, `weight`, `ink`, `highlight`, `highlightInk`, `plate`, `plateOpacity`, `bottom`); without one it is derived from the brand's font and `ink`/`accent`/`paper`/`card` colours. Maths in `engine/captionMath.js`.
- After a captioned render, a sync check reads frames of the delivered mp4 around three words: the highlight must arrive within 2 frames of the word's time and leave within 2 frames of the next word's time (or the page end). A FAIL exits 2 and keeps the file. Limits: it tracks highlight-coloured pixels in the bottom band, so a beat that paints the brand highlight colour behind the captions can confuse it; when a neighbouring word lasts only a frame or two, the arrival reading can land on the neighbour's switch, which is why the leave reading is required as well.
- Fixture: content-thinking `video/scenes/promo/captions-fixture` (narrated beats with no hand times, captions on).

Tests: `npm test` (timing maths, count maths, motion, pointer, typing, frame gate, checklist, ledger, `check` and tokens CLI cases, caption maths, whisper word parsing, caption sync, beat timing from a known audio fixture).

Licence: Remotion free tier applies only while clients receive rendered files and never this repo or a scene folder.

## Legacy audio workflow

### Original Inspiration  

Near the end of July, we were tasked with generating a bunch of videos for the upcoming BI cohort from August to November. So I wanted to make the most of it to put together videos to ensure the content was relevant and engaging similar to the lectures. Over the course of the video generation, I attempted a few different approaches to generate videos quickly as it was an ambitious goal to generate a bunch of content in a short amount of time.  

## Approaches

The following were a few approaches I had taken to generate the videos and finally land on the best approach for myself. Please note, YMMV and how you feel the approach works for you. Here they are:

1. [Transcribe, Edit and Regenerate Audio (Unchanged)](#1-transcribe-edit-and-regenerate-audio-unchanged)
2. [Transcribe, Edit with AI and Regenerate Audio](#2-transcribe-edit-with-ai-and-regenerate-audio)
3. [Dictate, Edit Text and Generate Audio - Final Approach, Most Useful](#3-dictate-edit-text-and-generate-audio)

Below i'll outline a bit of how each of the steps kind of worked and the corresponding files that helped me in the process.  

### 1. Transcribe, Edit and Regenerate Audio (Unchanged)

To begin, I first downloaded the videos from vimeo and specifically used a library from github called [Private Vimeo Downloader](https://github.com/Tusko/vimeo-private-downloader) to download the videos. There's an option to parse the videos from their audio file which I had enabled and would then get the videos in a separate `mov/` and `m4a/` folder.  

#### A. Parse Audio 

script: `1_parse_audio.py`  

Once the downloads were complete, I noticed `openai` can only permit 4 minute increments of transcribing at a time. So, I first parsed the audio files from the `parts/` folder and then used a python script to partition the audio files into 4 minute increments and export them into a `parts/audio_partitions/` folder.  

Then I used a python script to transcribe the audio files from the `parts/audio_partitions/` folder. This created a series of audio files that were approximately 3 - 4 minutes in length.

#### B. Transcribe

script: `2_transcribe.py` (Dormant script, do not use)

Before having access to the transcripts generated by vimeo, I then used the OpenAI api to be able to transcribe the different chunks of audio and then save the transcripts into text files for each of the corresponding partitions of audio and then stored them in the `parts/transcripts/` folder.

However, this approach was sort of futile because I would then need to go through each of the files and edit the text file by file. 

Some early issues with this:  
- The transcripts were not always in a consistent format and sometimes had some random characters in the middle of the text.
- Occasionally the text output was empty because there was no audio so openAI had no idea what to say.
- The separate files made it easy to get lost when trying to edit the text files.

#### C. Edit and Regenerate Audio (Test) 

script: `3_generate_audio.py` (Dormant script, do not use)

After having the text files, I then used the python script to edit the text files. This involved a few things:  
- Removing the random characters that were in the middle of the text.
- Removing the empty text files.

But as it would take a long time, I never really proceeded with this approach, especially without a clear naming convention and not being able to be certain the audio would be of quality


#### D. Other Issues  

The following are a few other issues with this approach:
- Because the videos were lectures, at times there were irrelevant topics that were not entirely relevant in the video.
- The transcription would sometimes write one thing that could be incorrect such as names or "said" acronyms. 


### 2. Transcribe, Edit with AI and Regenerate Audio

Now that I had the transcripts and ran into some challenges with editing and updating it, I thought about using the OpenAI Assistants API to possibly adjust the transcripts and then use it to generate the audio via API as well. The idea was simple, create an assistant that would traverse each bit of text at the current step and the next step to be able to update the text at each step relevant to the lecture material. $40 in API credits later and the attempt was still pretty... bad. This is the process and my findings as well.

#### A. Transcribe (but also collate)

script: `3_preprocess_transcripts.py`

I took the same text files and made the most of their existence by using a python script to collate them into excel to be a bit more manageable. So the script would process the subfolders and then create a csv file with the following columns:
- Folder Name
- Partition
- Transcript

This saved a CSV file that I could then use to edit the transcripts, but I quickly made a few additions to be able to add some features and context to then be able to pass it to open AI.

#### B. Manual Edits in Excel  

At this point, I would take the excel CSVs generated, and decided to make a single master sheet that contained all of the courses I was assigned.

I added a few columns to be able to update programmatically and see if there was any way I could make the most out of the previous content. Here are the columns and their description:

- Module + Class - A description of the module at the time and the class to provide context for the assistant
- Class Description - Description of what that lecture would be
- Original Text - The text from the partition being referenced
- Previous Text - Simply a reference to the previous partition's text to determine if there was something in there that could provide context
- Processed - A flag to indicate if the AI has processed the batch of text
- Length Original - The length of the original text
- New Text - The new text generated by the AI
- Thread ID - The ID of the thread created by the AI - kept most of the same class in a single thread to avoid hallucination
- Timestamp - Timestamp of the received message from the AI
- Final Script - Basically an update of the script from the AI by me
- Length Final Script - Count of the characters - Audio API only accepts 4096 characters
- Ready for Audio - A flag to indicate if the audio can be generated
- Final Audio - Path to the audio file

#### C. Update Transcripts

script: `4_update_transcripts.py`  

In between the manual steps of editing, I made a master excel that would record all of the new text where I set up an assistant to regenerate the transcript to be focused on the Module + Class and the Class Description to be the topics. I passed the original text and previous text also to the assistant as part of the user prompt and would update each transcript line by line.

The script would go class by class and ensure it only processed the class where text was available and changed the "Processed" flag to "Yes".

#### D. Regenerate Audio

script: `5_generate_audio.py`

This script was then used to generate the audio for the classes using OpenAI and my updates to the final script.

#### E. Other Issues

The following are a few other issues with this approach:
- The transcripts generated were not the best quality since they would include "10 minute breaks" and random sidebars in the class like looking at jobs.
- I played with temperature to avoid hallucination but it didn't really help.
- I played with top_p to avoid hallucination but it didn't really help.
- I realized I was spending more time adjusting the assistant than was worthwhile


### 3. Dictate, Edit Text and Generate Audio

This was my final attempt to make the most of the audio generated by the OpenAI API and my understanding of the classes since I reviewed them anyways. Instead of having the AI generate the speech, I would record my speech as dictation to finally generate the audio.

#### A. Dictate

This was a process of me recording my speech when I would cover a topic or record a video. I originally would read the transcript that I had from the original class, but it was still sometimes off topic. So I tested a few different ways until I finally decided on creating the teaching plan, understanding what I was going to talk about and then dictating what I wanted to say.

#### B. Edit Text

I would go line by line ensuring that the text recorded from my dictation was accurate and on topic as well as correct language. So, I would revise what I would dictate each time and ensure that the result was cohesive and made sense.

#### C. Generate Audio

I finally would batch out the transcript into 4096 character chunks and place it into the excel file. Then I would use the python script to generate the audio. This was a quick process and I was able to get the audio generated in a few minutes. As I would edit the video with the audio file, I would listen to the audio and correct any errors I had in the single audio file over and over until I could move onto the next audio file.

### Final Thoughts

The final approach through dictation and editing was probably the most efficient approach and made the most of the AI and my understanding of the classes. I would use the AI sparingly and only on generating the audio for the videos instead of the actual script.

### Considerations 

The following are a few things that I would like to consider in the future:
- Improve dictation with another method of recording (ie quality microphone or different dictation from the defaults on MacOS) 
- Improve the dictation script using the assistant instead of the original transcript from the lectures  
