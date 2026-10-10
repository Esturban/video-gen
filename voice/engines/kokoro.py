"""Default narrator: Kokoro-82M (Apache 2.0), run locally on Apple Silicon through mlx-audio. No network after the first model download.

Voices: am_michael, af_heart (English, lang "a"); ef_dora, em_alex (Spanish, lang "e"). Full list: the Kokoro-82M model card.

Word times (CMO-7584): Kokoro predicts a duration for every phoneme and builds the audio from those durations, so it knows when
each word is spoken. mlx-audio's KokoroPipeline puts them on each token (start_ts, end_ts); model.generate() drops them, so this
engine calls the pipeline itself and returns the words. voice/narrate.py moves any word that starts inside a pause to where the
voice comes back, measured from the wav.
"""
# REUSE_CHECKED: none   no local Kokoro wrapper in the repos; API per ctx7 /blaizzy/mlx-audio docs and mlx_audio/tts/models/kokoro/pipeline.py
from pathlib import Path

MODEL = "mlx-community/Kokoro-82M-bf16"
TIMED = True  # synth() returns [{text, start, end}] in seconds from the start of the wav
_model = None


def synth(text: str, out_wav: Path, voice: str, lang: str) -> list:
    global _model
    import mlx.core as mx
    from mlx_audio.audio_io import write
    from mlx_audio.tts.utils import load_model

    from onsets import tts_words

    if _model is None:
        _model = load_model(MODEL)
    pipeline = _model._get_pipeline(lang)  # what model.generate() runs, minus dropping the tokens
    pipeline.voices = {}
    parts, segments = [], []
    for result in pipeline(text, voice=voice, speed=1.0, split_pattern=r"\n+"):
        audio = result.audio.reshape(-1)
        parts.append(audio)
        segments.append({"seconds": audio.shape[0] / _model.sample_rate,
                         "tokens": [[t.text, t.start_ts, t.end_ts] for t in (result.tokens or [])]})
    write(str(out_wav), mx.concatenate(parts), _model.sample_rate)
    return tts_words(segments)
