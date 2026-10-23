# Player interface contract

This is the handoff between the player core (Codex) and presentation (Gemini).
It is intentionally framework-free so either side can integrate without taking
ownership of the other's files.

## Files and ownership

- `src/player-data.js`: characters and ordered dialogue lines; player-core owned.
- `src/player.js`: sequencing and playback state; player-core owned.
- `PLAYER_CONTRACT.md`: shared integration contract; change this before changing
  exported names or callback semantics.
- Presentation code can import the data and `createPlayer` from `src/player.js`.

## Data shape

```js
const script = {
  id: 'demo-meeting',
  title: 'The Missing Monday',
  characters: [{ id: 'mara', name: 'Mara', voice: 'warm, decisive' }],
  lines: [{ id: 'line-1', speakerId: 'mara', text: '...', audioSrc: '/audio/mara-01.mp3' }],
};
```

Each line has one prerecorded clip. The player never synthesizes speech or
calls a language model. `audioSrc` may be `null` while recordings are pending;
the engine reports a playback error if asked to play such a line.

## Player API

```js
const player = createPlayer(script, {
  onStateChange(state),
  onLineChange(line, index),
  onProgress({ currentTime, duration, fraction }),
  onError(error, line),
});
player.play();       // Starts at the current line, or resumes a paused line.
player.pause();      // Pauses without changing the current line.
player.restart();    // Starts at line zero.
player.dispose();    // Stops playback and removes media listeners.
```

States are `idle`, `playing`, `paused`, `ended`, and `error`. Line indices are
zero-based; `onLineChange(null, -1)` means no active line. Progress fraction is
clamped to [0, 1] and is 0 when duration is not known. Callbacks are optional.

The player owns audio sequencing and transcript timing. Presentation owns
controls, rendering, styling, and accessibility. It should derive active line,
speaker, and progress from callbacks rather than implementing a second timer.
