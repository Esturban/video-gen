"""Default narrator: Kokoro-82M (Apache 2.0), run locally on Apple Silicon through mlx-audio. No network after the first model download.

Voices: am_michael, af_heart (English, lang "a"); ef_dora, em_alex (Spanish, lang "e"). Full list: the Kokoro-82M model card.
"""
# REUSE_CHECKED: none   no local Kokoro wrapper in the repos; API per ctx7 /blaizzy/mlx-audio docs
from pathlib import Path

MODEL = "mlx-community/Kokoro-82M-bf16"
_model = None


def synth(text: str, out_wav: Path, voice: str, lang: str) -> None:
    global _model
    import mlx.core as mx
    from mlx_audio.audio_io import write
    from mlx_audio.tts.utils import load_model

    if _model is None:
        _model = load_model(MODEL)
    parts = [r.audio for r in _model.generate(text=text, voice=voice, speed=1.0, lang_code=lang)]
    write(str(out_wav), mx.concatenate(parts), _model.sample_rate)
