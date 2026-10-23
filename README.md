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

The sample audio paths under `/audio/` are placeholders until recordings are
provided. Missing audio is reported as a playback error; the player does not
generate speech.

## Run the player tests

Requires Node.js 18 or newer. No package installation is needed:

```sh
node --test
```
