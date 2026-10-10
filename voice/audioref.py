"""Word onsets from a media file's own audio, for the caption sync check (bin/lib/audiosync.mjs). Local only.

usage: audioref.py <media> <words.json>   (words.json: a JSON list of the words' text, in order; no times are read)
prints: [{text, aligner, start, rule}, ...], one per word, seconds on the media's clock.

1. The audio track is decoded with ffmpeg and force-aligned to the words' text with torchaudio's MMS_FA (wav2vec2, local
   weights, downloaded once). That gives a coarse start per word that owes nothing to the TTS engine or to words.json.
2. CTC aligners start a word late, most on hiss and stops, so voice/onsets.py moves each start to the acoustic landmark its
   first sound has: the end of a pause, the start of a stop's closure, the start of frication, or (for a weak first sound) the
   end of the word before's hiss or nasal murmur. A word with no landmark in reach keeps the aligner time ("aligner" rule). A word with no letters (a bare number) cannot be aligned and is null.
"""
# REUSE_CHECKED: none   searched the repos for forced_align and MMS_FA; the probe scripts this grew from were scratch
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import onsets  # noqa: E402

ALIGN_SR = 16000
ONSET_SR = 24000


def aligner_tokens(texts: list) -> list:
    """Each word's letters as the aligner spells them (lower case a-z and apostrophe); empty when it has none."""
    return [re.sub(r"[^a-z']", "", t.lower()) for t in texts]


def align(media: str, spelled: list) -> list:
    """Start in seconds per word from MMS_FA, None for words with no letters."""
    import numpy as np
    import torch
    import torchaudio

    bundle = torchaudio.pipelines.MMS_FA
    model, vocab = bundle.get_model(with_star=False), bundle.get_dict(star=None)
    wave = torch.from_numpy(onsets.read_mono(media, ALIGN_SR).astype(np.float32))[None]
    with torch.inference_mode():
        emission, _ = model(wave)
    real = [w for w in spelled if w]
    ids = [vocab[c] for w in real for c in w]
    path, scores = torchaudio.functional.forced_align(emission, torch.tensor([ids]), blank=0)
    spans = torchaudio.functional.merge_tokens(path[0], scores[0].exp())
    per_frame = wave.shape[1] / emission.shape[1] / ALIGN_SR
    starts, k = iter([]), 0
    found = []
    for w in real:
        found.append(round(spans[k].start * per_frame, 4))
        k += len(w)
    starts = iter(found)
    return [next(starts) if w else None for w in spelled]


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: audioref.py <media> <words.json>")
    media, texts = sys.argv[1], json.loads(Path(sys.argv[2]).read_text())
    coarse = align(media, aligner_tokens(texts))
    audio = onsets.read_mono(media, ONSET_SR)
    out = []
    for i, (text, guess) in enumerate(zip(texts, coarse)):
        if guess is None:
            out.append({"text": text, "aligner": None, "start": None, "rule": "unaligned"})
            continue
        prev = onsets.last_sound(texts[i - 1]) if i else None
        out.append({"text": text, "aligner": guess, **onsets.onset(audio, ONSET_SR, guess, onsets.first_sound(text), prev)})
    print(json.dumps(out))


if __name__ == "__main__":
    main()
