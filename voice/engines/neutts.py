"""EV's own voice, cloned and run locally with NeuTTS Air (Neuphonic, Apache 2.0). No hosted service, no network after the first weight download.

Engine contract: synth(text, out_wav, voice, lang). `voice` is the name of a sample in the neutts repo's samples/ folder
(default "esteban": esteban.wav + esteban.txt, plus esteban.pt when the reference codes were pre-encoded).

Two voices from one engine (CMO-7402): a line that starts with "[agent] " is spoken by a stock local Kokoro voice instead,
so a single scene can carry a host (the clone) and an agent (stock) without touching voice/narrate.py.

Runs NeuTTS inside its own venv (py/neutts/.venv) as a long-lived worker, so the 0.5B model loads once per narration pass.
Run as a script (`python neutts.py --worker`) it IS that worker; nothing here imports torch at module level.
"""
# REUSE_CHECKED: 4_agents/py/neutts/examples/basic_example.py   same NeuTTSAir(...).infer(...) calls, wrapped as a pluggable engine with a persistent worker
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

NEUTTS = Path("/Users/EVA/Desktop/eva/03_development/_dev/repos/4_agents/py/neutts")
PYTHON = NEUTTS / ".venv" / "bin" / "python"
BACKBONE = "neuphonic/neutts-air-q8-gguf"  # the full neuphonic/neutts-air repo is gated on Hugging Face (403); the open GGUF needs llama-cpp-python in the neutts venv
DEFAULT_VOICE = "esteban"
AGENT_TAG = "[agent] "
AGENT_VOICE = "af_heart"  # stock Kokoro, distinct from the host's male clone
_worker = None
_blocked = False  # set once NeuTTS cannot load, so the pass falls back to Kokoro without retrying per beat
HOST_FALLBACK = "am_michael"


def _worker_proc() -> subprocess.Popen:
    global _worker
    if _worker is None or _worker.poll() is not None:
        _worker = subprocess.Popen([str(PYTHON), str(Path(__file__).resolve()), "--worker"], cwd=NEUTTS, text=True,
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=sys.stderr)
    return _worker


def _neutts(text: str, out_wav: Path, voice: str) -> None:
    proc = _worker_proc()
    proc.stdin.write(json.dumps({"text": text, "out": str(out_wav), "voice": voice or DEFAULT_VOICE}) + "\n")
    proc.stdin.flush()
    while True:  # the worker prints only JSON replies on stdout
        line = proc.stdout.readline()
        if not line:
            raise SystemExit("error: the NeuTTS worker exited. See its stderr above; try BACKBONE = the q8 GGUF repo.")
        try:
            reply = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(reply, dict) and "ok" in reply:
            break
    if not reply.get("ok"):
        raise SystemExit(f"error: NeuTTS failed: {reply.get('error')}")


def _kokoro(text: str, out_wav: Path, voice: str = AGENT_VOICE) -> None:
    path = Path(__file__).with_name("kokoro.py")
    spec = importlib.util.spec_from_file_location("engine_kokoro", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.synth(text, out_wav, voice, "a")


def synth(text: str, out_wav: Path, voice: str, lang: str) -> None:
    if text.startswith(AGENT_TAG):
        _kokoro(text[len(AGENT_TAG):], out_wav)
        return
    global _blocked
    if not _blocked:
        try:
            _neutts(text, out_wav, voice)
            return
        except SystemExit as e:
            _blocked = True
            print(f"\n!!! NEUTTS BLOCKED, HOST FALLS BACK TO KOKORO {HOST_FALLBACK} (NOT EV's clone): {e}\n", file=sys.stderr)
    _kokoro(text, out_wav, HOST_FALLBACK)


def _serve() -> None:
    import soundfile as sf
    import torch
    sys.path.insert(0, str(NEUTTS))
    from neuttsair.neutts import NeuTTSAir

    tts = NeuTTSAir(backbone_repo=BACKBONE, backbone_device="cpu", codec_repo="neuphonic/neucodec", codec_device="cpu")
    refs = {}
    for line in sys.stdin:
        req = json.loads(line)
        try:
            name = req["voice"]
            if name not in refs:
                samples = NEUTTS / "samples"
                codes = torch.load(samples / f"{name}.pt") if (samples / f"{name}.pt").exists() else tts.encode_reference(str(samples / f"{name}.wav"))
                refs[name] = (codes, (samples / f"{name}.txt").read_text().strip())
            codes, ref_text = refs[name]
            sf.write(req["out"], tts.infer(req["text"], codes, ref_text), 24000)
            print(json.dumps({"ok": True}), flush=True)
        except Exception as e:  # report to the caller, keep serving
            print(json.dumps({"ok": False, "error": repr(e)}), flush=True)


if __name__ == "__main__":
    if "--worker" in sys.argv:
        _serve()
