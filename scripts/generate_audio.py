#!/usr/bin/env python3
"""Generate the demo's prerecorded clips from the canonical JS script data."""

from __future__ import annotations

import asyncio
import argparse
import json
import os
import subprocess
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
VOICE_BY_SPEAKER = {
    "mara": "en-AU-NatashaNeural",
    "leo": "en-AU-WilliamMultilingualNeural",
    "bea": "en-GB-SoniaNeural",
}


def load_script() -> dict:
    """Import the actual player script so the transcript is not duplicated."""
    source = (
        "import { demoScript, getSpokenText } from './src/player-data.js'; "
        "const ttsScript = {...demoScript, lines: demoScript.lines.map(line => "
        "({...line, ttsText: getSpokenText(line)}))}; "
        "console.log(JSON.stringify(ttsScript));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", source],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def has_mp3_frame(path: Path) -> bool:
    """Reject empty or non-MP3 outputs, including partial failed writes."""
    with path.open("rb") as audio:
        prefix = audio.read(4096)
    if prefix.startswith(b"ID3"):
        prefix = prefix[10:]
    return any(
        prefix[index] == 0xFF and prefix[index + 1] & 0xE0 == 0xE0
        for index in range(max(0, len(prefix) - 1))
    )


async def generate(line_ids: list[str] | None = None) -> None:
    script = load_script()
    lines = script["lines"]
    if line_ids:
        selected_ids = set(line_ids)
        lines = [line for line in lines if line["id"] in selected_ids]
        missing_ids = selected_ids - {line["id"] for line in lines}
        if missing_ids:
            raise ValueError(f"Unknown line IDs: {sorted(missing_ids)}")
    used_speakers = {line["speakerId"] for line in lines}
    missing_voices = used_speakers - VOICE_BY_SPEAKER.keys()
    if missing_voices:
        raise ValueError(f"No voice configured for speakers: {sorted(missing_voices)}")

    for line in lines:
        audio_src = line.get("audioSrc")
        if not audio_src or not audio_src.startswith("/audio/"):
            raise ValueError(f"Line {line['id']} has an invalid audioSrc: {audio_src!r}")
        output = (ROOT / audio_src.lstrip("/")).resolve()
        if not output.is_relative_to(ROOT / "audio"):
            raise ValueError(f"Line {line['id']} audioSrc escapes the audio directory")
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_name(f".{output.stem}.tmp{output.suffix}")
        voice = VOICE_BY_SPEAKER[line["speakerId"]]
        print(f"Generating {audio_src} ({line['speakerId']}, {voice})", flush=True)
        try:
            await edge_tts.Communicate(line["ttsText"], voice=voice).save(str(temporary))
            if temporary.stat().st_size == 0 or not has_mp3_frame(temporary):
                raise RuntimeError(f"Generated output is empty or not a valid MP3: {temporary}")
            temporary.replace(output)
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
        print(f"  wrote {output.stat().st_size} bytes", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--line-id",
        action="append",
        help="Generate only this line ID (repeat to select multiple lines; default: all)",
    )
    args = parser.parse_args()
    try:
        asyncio.run(generate(args.line_id))
    except Exception as error:
        print(f"Audio generation failed: {type(error).__name__}: {error}", file=os.sys.stderr)
        raise
