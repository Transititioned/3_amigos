# Three Amigos

A lightweight meeting demo with three characters and prerecorded audio. The
player core has no framework, runtime language model, text-to-speech, or paid
service dependency.

## Player core

- `src/player-data.js` contains the demo script, character definitions, and
  `validateScript`.
- `src/player.js` sequences one prerecorded clip per transcript line and emits
  state, active-line, progress, and error callbacks.
- `PLAYER_CONTRACT.md` describes the interface for presentation integration.

The six prerecorded clips are bundled under `/audio/` at the paths referenced
by `audioSrc`. Missing or unavailable audio is reported as a playback error;
the browser player does not generate speech.

The unchanged six-line first-test dialogue plays for about 32 seconds. It is a
short integration check and does not yet meet the 90-second to 3-minute product
target.

## Generate the demo recordings

The bundled MP3s are generated one clip per dialogue line by
`scripts/generate_audio.py`, which reads the canonical dialogue directly from
`src/player-data.js` and writes each line's existing `audioSrc` path.

Voice assignments:

- Mara: `en-AU-NatashaNeural` (Australian English, female)
- Leo: `en-AU-WilliamMultilingualNeural` (Australian English, male)
- Bea: `en-GB-SoniaNeural` (British English, female; selected because the
  current Edge voice list exposes only two Australian English neural voices)

Requires Python 3.10+, Node.js, and internet access. No API key is needed.

```sh
python -m pip install -r requirements-tts.txt
python scripts/generate_audio.py
```

Generation uses `edge-tts`, an unofficial Python client for Microsoft's online
Edge text-to-speech service. It sends the dialogue text and selected voice to
that online service. The clips are for this prototype; review the service's
terms and voice distribution rights before public or commercial release.

## Run the player tests

Requires Node.js 18 or newer. No package installation is needed:

```sh
node --test
```
