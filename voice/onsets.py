"""Word onsets measured from the audio itself (CMO-7584 follow-up). numpy only, no model; every function here is checked against
synthetic signals with known landmarks in voice/onsets.test.mjs.

Two users:
- voice/narrate.py: the TTS engine's own word times (Kokoro's predicted durations) put a word that follows a pause inside the
  pause, because the pause is split between the words either side. snap_to_pauses() moves such a word to where the voice
  actually comes back, measured from the wav.
- voice/audioref.py: the caption sync check needs each checked word's onset from the delivered audio, independent of
  words.json. A local forced aligner gives a coarse time per word; onset() refines it to an acoustic landmark chosen by how the
  word's first sound starts: the end of a pause, a stop's burst (the first audible energy after its silent closure), or the start of frication. A word whose first
  sound is weak (a vowel, "th" as in "this", a nasal) takes the end of the word before's last sound when that sound is a hiss
  or a nasal murmur. A word with none of these keeps the aligner's time. narrate.py runs the same refinement on the TTS times.
"""
# REUSE_CHECKED: none   searched the repos for onset, silencedetect, pause and forced_align code; nothing does this
import re
import subprocess

import numpy as np

RULES = "burst"  # names the onset rules a cached words file was made with; change it when a rule moves
FLOOR_DB = -45.0  # below this (dBFS RMS) a stretch counts as silence
MIN_PAUSE_S = 0.1  # shorter silences are stop closures, not pauses
LEVEL_HOP_S = 0.0025  # level frames for pause and closure finding
PAUSE_BEFORE_S = 0.05  # an aligner start this far after a pause ends belongs to that pause's onset
PAUSE_AFTER_S = 0.04  # ...or this far before it
CLOSURE_SEARCH_S = 0.12  # how far before the aligner start a stop's closure is looked for
CLOSURE_DEPTH_DB = 20.0  # a closure is at least this far below the sound before it
CLOSURE_DROP_DB = 15.0  # the closure starts where the level first falls this far below that sound
BURST_RISE_DB = 15.0  # a stop is heard where the level first climbs this far above the closure's floor (its burst)
BURST_SEARCH_S = 0.15  # how far after the closure's floor the burst is looked for
SPEC_HOP_S, SPEC_WIN_S = 0.005, 0.02  # spectral frames for frication finding
LOW_BAND, HIGH_CUT = (80.0, 900.0), 3000.0  # voicing band and frication band, Hz
FRICATION_REACH_S = 0.12  # an aligner start this far after a frication run still belongs to it
FRICATION_MAX_S = 0.3
AHEAD_S = 0.05  # a TTS start can be early: look this far after the guess too
EDGE_REACH_S = 0.08  # a hiss or murmur edge this far either side of the guess belongs to the word
EDGE_STEP_DB = 6.0  # the high band moves at least this much over EDGE_SPAN frames at the edge
EDGE_SPAN = 2
HISS_MIN_DB = -10.0  # high minus low band before a hiss ends: at least this (voiced z still counts)
MURMUR_MAX_DB = -25.0  # high minus low band inside a nasal murmur: at most this


def read_mono(path, sr: int = 24000) -> np.ndarray:
    """Any audio or video file to mono float64 at `sr`, via ffmpeg (first audio stream)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def level_db(x: np.ndarray, sr: int, hop_s: float = LEVEL_HOP_S) -> np.ndarray:
    hop = max(1, int(round(sr * hop_s)))
    n = len(x) // hop
    frames = x[: n * hop].reshape(n, hop)
    return 20 * np.log10(np.sqrt(np.mean(frames ** 2, axis=1)) + 1e-9)


def pauses(x: np.ndarray, sr: int, floor_db: float = FLOOR_DB, min_s: float = MIN_PAUSE_S) -> list:
    """[[start, end], ...] in seconds of every silence at least `min_s` long."""
    quiet = level_db(x, sr) < floor_db
    runs, i = [], 0
    while i < len(quiet):
        if not quiet[i]:
            i += 1
            continue
        j = i
        while j < len(quiet) and quiet[j]:
            j += 1
        if (j - i) * LEVEL_HOP_S >= min_s - 1e-9:
            runs.append([round(i * LEVEL_HOP_S, 4), round(j * LEVEL_HOP_S, 4)])
        i = j
    return runs


def snap_to_pauses(words: list, runs: list) -> list:
    """A word that starts inside a pause starts where the pause ends; the word before it ends no later than the pause starts."""
    out = [dict(w) for w in words]
    for i, w in enumerate(out):
        run = next((r for r in runs if r[0] <= w["start"] < r[1]), None)
        if run is None:
            continue
        out[i] = {**w, "start": round(run[1], 3), "end": round(max(w["end"], run[1]), 3)}
        if i > 0 and out[i - 1]["end"] > run[0]:
            out[i - 1] = {**out[i - 1], "end": round(max(out[i - 1]["start"], run[0]), 3)}
    return out


def tts_words(segments: list) -> list:
    """TTS token times to words: [{seconds, tokens: [[text, start, end], ...]}, ...] -> [{text, start, end}] on one clock.

    Each segment's times are offset by the audio before it. A token with no letter or digit (punctuation) is folded into the word
    before it. A word token the engine gave no time keeps the previous word's end, so the word count still matches the script.
    """
    words, offset = [], 0.0
    for seg in segments:
        for text, start, end in seg["tokens"]:
            if not re.search(r"\w", text):
                if words:
                    words[-1] = {**words[-1], "text": words[-1]["text"] + text}
                continue
            if start is None or end is None:
                at = words[-1]["end"] if words else round(offset, 3)
                words.append({"text": text, "start": at, "end": at})
                continue
            words.append({"text": text, "start": round(offset + start, 3), "end": round(offset + end, 3)})
        offset += seg["seconds"]
    return words


def first_sound(word: str) -> str:
    """How the word's first sound shows in the audio: "stop" (a closure then a burst), "fricative" (voiceless hiss), or "other"."""
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w or w.startswith(("th", "wh", "kn", "wr", "gn", "ps")):
        return "other"
    if w.startswith("ch"):
        return "stop"
    if w.startswith(("sh", "ph")) or w[0] in "sfh":
        return "fricative"
    if w[0] == "c":
        return "fricative" if w[1:2] in ("e", "i", "y") else "stop"
    return "stop" if w[0] in "ptkbdgqj" else "other"


def last_sound(word: str) -> str:
    """How the word's last sound ends in the audio: "nasal" (m, n, ng murmur), "fricative" (s, z, sh hiss), or "other"."""
    w = re.sub(r"[^a-z]", "", word.lower())
    if w.endswith(("ce", "se", "ze")):
        return "fricative"
    if len(w) > 2 and w.endswith("e") and w[-2] not in "aeiou":
        w = w[:-1]
    if w.endswith(("m", "n", "ng")):
        return "nasal"
    return "fricative" if w.endswith(("s", "z", "x", "sh", "ch")) else "other"


def _pause_onset(runs: list, guess: float):
    ends = [r[1] for r in runs if guess - PAUSE_BEFORE_S <= r[1] <= guess + PAUSE_AFTER_S]
    return min(ends, key=lambda e: abs(e - guess)) if ends else None


def _burst_onset(x: np.ndarray, sr: int, guess: float):
    db = level_db(x, sr)
    lo, hi = max(0, int((guess - CLOSURE_SEARCH_S) / LEVEL_HOP_S)), min(len(db), int((guess + AHEAD_S) / LEVEL_HOP_S) + 1)
    if hi - lo < 2:
        return None
    m = lo + int(np.argmin(db[lo:hi]))
    before = db[max(0, m - int(0.1 / LEVEL_HOP_S)): m + 1]
    if len(before) < 2 or before.max() - db[m] < CLOSURE_DEPTH_DB:
        return None
    p = m - (len(before) - 1) + int(np.argmax(before))
    k = next((k for k in range(p, m + 1) if db[k] < db[p] - CLOSURE_DROP_DB), m)
    if k < lo:
        return None  # a closure that began before the window belongs to the word before
    # the word is heard at the burst, the first frame after the closure's floor that rises back BURST_RISE_DB above it
    floor, last = db[m], min(len(db), m + int(BURST_SEARCH_S / LEVEL_HOP_S) + 1)
    b = next((b for b in range(m + 1, last) if db[b] >= floor + BURST_RISE_DB), None)
    return b * LEVEL_HOP_S if b is not None else None


def _bands(x: np.ndarray, sr: int, t0: float, t1: float):
    """(times, high band dB, low band dB) for spectral frames whose centres fall in [t0, t1]."""
    hop, win = int(sr * SPEC_HOP_S), int(sr * SPEC_WIN_S)
    freqs = np.fft.rfftfreq(win, 1 / sr)
    low, high = (freqs > LOW_BAND[0]) & (freqs < LOW_BAND[1]), freqs > HIGH_CUT
    first, last = max(0, int((t0 - SPEC_WIN_S / 2) / SPEC_HOP_S)), int((t1 - SPEC_WIN_S / 2) / SPEC_HOP_S)
    times, his, los = [], [], []
    for i in range(first, last + 1):
        seg = x[i * hop: i * hop + win]
        if len(seg) < win:
            break
        s = np.abs(np.fft.rfft(seg * np.hanning(win))) ** 2
        times.append(i * SPEC_HOP_S + SPEC_WIN_S / 2)
        his.append(10 * np.log10(s[high].sum() + 1e-12))
        los.append(10 * np.log10(s[low].sum() + 1e-12))
    return times, his, los


def _frication_onset(x: np.ndarray, sr: int, guess: float):
    times, his, los = _bands(x, sr, guess - FRICATION_MAX_S - FRICATION_REACH_S, guess + AHEAD_S)
    diff = [h - l for h, l in zip(his, los)]
    near = [k for k, t in enumerate(times) if diff[k] > 0 and guess - FRICATION_REACH_S <= t <= guess + AHEAD_S]
    if not near:
        return None
    k = min(near, key=lambda i: abs(times[i] - guess))
    while k > 0 and diff[k - 1] > 0:
        k -= 1
    if k == 0:
        return times[0]
    a, b = diff[k - 1], diff[k]  # last voiced frame, first fricated frame: interpolate the zero crossing
    return times[k - 1] + SPEC_HOP_S * (-a / (b - a))


def _edge(x: np.ndarray, sr: int, guess: float, prev: str):
    """Where the word before's hiss ends (high band falls out of frication) or its nasal murmur ends (high band rises out of it)."""
    times, his, los = _bands(x, sr, guess - EDGE_REACH_S - SPEC_HOP_S * EDGE_SPAN, guess + EDGE_REACH_S)
    best, best_step = None, EDGE_STEP_DB
    for k in range(EDGE_SPAN, len(times)):
        j = k - EDGE_SPAN
        step, before = his[k] - his[j], his[j] - los[j]
        at = (times[j] + times[k]) / 2
        if abs(at - guess) > EDGE_REACH_S:
            continue
        if prev == "fricative" and before >= HISS_MIN_DB and -step >= best_step:
            best, best_step = at, -step
        if prev == "nasal" and before <= MURMUR_MAX_DB and step >= best_step:
            best, best_step = at, step
    return best


def onset(x: np.ndarray, sr: int, guess: float, sound: str, prev: str = None) -> dict:
    """The word's onset in the audio, refined from a `guess` (an aligner's, or the TTS engine's) by its first sound and, for a
    weak first sound, by how the word before (`prev`, from last_sound) ends. Returns {start, rule}."""
    at = _pause_onset(pauses(x, sr), guess)
    if at is not None:
        return {"start": round(at, 4), "rule": "pause"}
    finders = {"stop": [(_burst_onset, "burst")], "fricative": [(_frication_onset, "frication")]}.get(sound, [])
    if sound == "other" and prev in ("fricative", "nasal"):
        finders = [(lambda a, r, g: _edge(a, r, g, prev), f"{'frication' if prev == 'fricative' else 'nasal'} end")]
    for find, rule in finders:
        at = find(x, sr, guess)
        if at is not None:
            return {"start": round(at, 4), "rule": rule}
    return {"start": guess, "rule": "aligner"}
