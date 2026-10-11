"""EV's own voice, cloned and run locally with Chatterbox (Resemble AI, MIT). No hosted service, no network after the first weight download.

Engine contract: synth(text, out_wav, voice, lang). `voice` is the path to a reference wav of the speaker (default: the CMO-7305 reference,
52.5 s of EV's own recordings). `lang` is unused (Chatterbox here is English only). No TIMED flag, so word times come from the whisper-cli path.

Settings measured in CMO-7305: device mps (cpu if mps will not load), cfg_weight 0.3 (slower, steadier delivery than the 0.5 default).

Runs Chatterbox inside its own venv (py/chatterbox/.venv) as a long-lived worker, so the model loads once per narration pass.
Run as a script (`python chatterbox.py --worker`) it IS that worker; nothing here imports torch at module level. Stdout carries only JSON.
"""
# REUSE_CHECKED: 4_agents/sh/brains/content-thinking/video/voice/engines/neutts.py (this repo)   same persistent JSON-lines worker shape; Chatterbox calls per resemble-ai/chatterbox README (from_pretrained, generate with audio_prompt_path)
import json
import re
import subprocess
import sys
from pathlib import Path

CHATTERBOX = Path("/Users/EVA/Desktop/eva/03_development/_dev/repos/4_agents/py/chatterbox")
PYTHON = CHATTERBOX / ".venv" / "bin" / "python"
DEFAULT_VOICE = "/Users/EVA/Desktop/eva/03_development/_dev/repos/4_agents/sh/brains/content-thinking/video/private/cmo-7305/voice/ref/ref.wav"
CFG_WEIGHT = 0.3
_worker = None
_ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def _under_1000(n: int) -> str:
    words = []
    if n >= 100:
        words.append(f"{_ONES[n // 100]} hundred")
        n %= 100
    if n >= 20:
        words.append(_TENS[n // 10] + (f" {_ONES[n % 10]}" if n % 10 else ""))
    elif n or not words:
        words.append(_ONES[n])
    return " ".join(words)


def speakable(text: str) -> str:
    """Spell out comma-grouped integers under a million ("114,000"); Chatterbox reads them as "eleven four thousand" (CMO-8092). Other text is untouched."""
    def spell(m: re.Match) -> str:
        n = int(m.group(0).replace(",", ""))
        high, low = divmod(n, 1000)
        return " ".join(w for w in (f"{_under_1000(high)} thousand" if high else "", _under_1000(low) if low else "") if w)
    return re.sub(r"(?<![\d,])\d{1,3},\d{3}(?![\d,])", spell, text)


def _worker_proc() -> subprocess.Popen:
    global _worker
    if _worker is None or _worker.poll() is not None:
        _worker = subprocess.Popen([str(PYTHON), str(Path(__file__).resolve()), "--worker"], cwd=CHATTERBOX, text=True,
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=sys.stderr)
    return _worker


def synth(text: str, out_wav: Path, voice: str, lang: str) -> None:
    proc = _worker_proc()
    proc.stdin.write(json.dumps({"text": speakable(text), "out": str(out_wav), "voice": voice or DEFAULT_VOICE}) + "\n")
    proc.stdin.flush()
    while True:  # the worker prints only JSON replies on stdout; skip anything else a library leaks there
        line = proc.stdout.readline()
        if not line:
            raise SystemExit("error: the Chatterbox worker exited. See its stderr above.")
        try:
            reply = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(reply, dict) and "ok" in reply:
            break
    if not reply.get("ok"):
        raise SystemExit(f"error: Chatterbox failed: {reply.get('error')}")


def _serve() -> None:
    real_stdout = sys.stdout
    sys.stdout = sys.stderr  # library prints must not corrupt the JSON channel
    here = str(Path(__file__).resolve().parent)  # this file is named chatterbox.py and would shadow the real package
    sys.path[:] = [p for p in sys.path if p not in ("", here) and Path(p).resolve() != Path(here)]
    import torch
    import torchaudio
    from chatterbox.tts import ChatterboxTTS

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    try:
        model = ChatterboxTTS.from_pretrained(device=device)
    except Exception as e:  # mps load can fail on older torch builds; fall back once
        print(f"chatterbox: {device} load failed ({e!r}), using cpu", file=sys.stderr)
        model = ChatterboxTTS.from_pretrained(device="cpu")
    for line in sys.stdin:
        req = json.loads(line)
        try:
            wav = model.generate(req["text"], audio_prompt_path=req["voice"], cfg_weight=CFG_WEIGHT)
            torchaudio.save(req["out"], wav.cpu(), model.sr)
            reply = {"ok": True}
        except Exception as e:  # report to the caller, keep serving
            reply = {"ok": False, "error": repr(e)}
        real_stdout.write(json.dumps(reply) + "\n")
        real_stdout.flush()


if __name__ == "__main__":
    if "--worker" in sys.argv:
        _serve()
