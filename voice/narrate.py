"""Narration for one scene: synthesise each narrated beat locally, then time the beats from the real audio.

Run through the kit: bin/video voice <scene> [--force]   (bin/video render calls it for you)
Writes <scene>/audio/beat<n>.wav and <scene>/timing.json (start, end, voiceAt, voice per beat).
A narrated beat needs no start/end in scene.json: it lasts LEAD + the measured audio + a hold (CMO-7584).
A beat without narration keeps its own length; once a narrated beat has come before it, it moves to follow it.

The voice engine is pluggable: scene.json "voice" (or the brand's "voice") names a module in
voice/engines/. Each engine is one file exposing synth(text, out_wav, voice, lang). Kokoro-82M
is the default. To add EV's own voice (CMO-7305), drop in voice/engines/<name>.py and set
"voice": {"engine": "<name>", ...} in the scene. Nothing else changes.
"""
# REUSE_CHECKED: 4_agents/sh/thinking/wiki/domains/clients/atomcamp/mashreq-agile-coaches/source/motion/video/tts.py   same per-beat synth plus retime-from-audio logic, generalised; edge-tts replaced by a local engine plug-in
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent
LEAD = 0.4  # silence before the voice in each beat, seconds
HOLD = 1.2  # silence after the voice, before the next beat
SECTION_HOLD = 2.0  # longer pause when the next beat changes kind (a new part starts)
FPS = 60  # beat edges snap to a frame at the highest rate we render
DEFAULT_VOICE = {"engine": "kokoro", "voice": "am_michael", "lang": "a"}


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def load_engine(name: str):
    path = KIT / "voice" / "engines" / f"{name}.py"
    if not path.exists():
        have = ", ".join(p.stem for p in (KIT / "voice" / "engines").glob("*.py"))
        raise SystemExit(f"error: voice engine '{name}' not found at {path}. Have: {have}")
    spec = importlib.util.spec_from_file_location(f"engine_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def find_brand(scene_dir: Path, name: str) -> Path:
    """The consumer's own brands dir (next to its scenes/ folder) first, then the engine's."""
    roots = [p.parent for p in scene_dir.resolve().parents if p.name == "scenes"]
    for root in [*roots, KIT]:
        path = root / "brands" / f"{name}.json"
        if path.exists():
            return path
    raise SystemExit(f'brand "{name}" not found in the consumer brands dir or {KIT / "brands"}')


def snap(t: float) -> float:
    """Snap a time to a frame edge at FPS, the highest rate we render."""
    return round(round(t * FPS) / FPS, 4)


def retime(beats: list, durations: dict) -> list:
    """Beat times from measured narration lengths, no hand-counted seconds.

    durations maps beat n to the measured length of its wav, in seconds. A narrated beat lasts
    LEAD + voice + hold (+ its optional "tail"); the hold is SECTION_HOLD when the next beat is a
    new kind. A beat without narration keeps its own length; before any narrated beat it keeps its
    hand times and is left out of the result, after one it is moved to follow. Returns the
    timing.json rows.
    """
    t, timing, moved = 0.0, [], False
    for i, b in enumerate(beats):
        if not b.get("narration"):
            if not moved:
                t = b["end"]
                continue
            start = snap(max(t, b["start"]))
            end = snap(start + b["end"] - b["start"])
            timing.append({"n": b["n"], "start": start, "end": end})
            t = end
            continue
        voice = durations[b["n"]]
        nxt = beats[i + 1]["kind"] if i + 1 < len(beats) else None
        hold = SECTION_HOLD if nxt is not None and nxt != b["kind"] else HOLD
        start = snap(t)
        end = snap(t + LEAD + voice + hold + b.get("tail", 0.0))
        timing.append({"n": b["n"], "start": start, "end": end, "voiceAt": LEAD, "voice": round(voice, 3)})
        t, moved = end, True
    return timing


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        raise SystemExit("usage: narrate.py <scene-dir> [--force]")
    force = "--force" in sys.argv
    scene_dir = Path(args[0])
    scene = json.loads((scene_dir / "scene.json").read_text())
    brand = json.loads(find_brand(scene_dir, scene["brand"]).read_text())
    cfg = {**DEFAULT_VOICE, **brand.get("voice", {}), **scene.get("voice", {})}
    engine = load_engine(cfg["engine"])
    audio = scene_dir / "audio"
    audio.mkdir(exist_ok=True)
    beats, durations = scene["beats"], {}
    for b in beats:
        if not b.get("narration"):
            continue
        wav, key_file = audio / f"beat{b['n']}.wav", audio / f"beat{b['n']}.key"
        key = hashlib.sha1(json.dumps([b["narration"], cfg], sort_keys=True).encode()).hexdigest()
        if force or not wav.exists() or not key_file.exists() or key_file.read_text() != key:
            print(f"voice: beat {b['n']} ({cfg['engine']}, {cfg['voice']})", file=sys.stderr)
            engine.synth(b["narration"], wav, cfg["voice"], cfg["lang"])
            key_file.write_text(key)
        durations[b["n"]] = duration(wav)
    timing = retime(beats, durations)
    (scene_dir / "timing.json").write_text(json.dumps(timing, indent=1) + "\n")
    total = timing[-1]["end"] if timing else 0.0
    print(f"voice: {len(durations)} narrated beats, {total:.1f}s total", file=sys.stderr)


if __name__ == "__main__":
    main()
