import { validateScript } from './player-data.js';

/**
 * Create a sequential prerecorded-audio player.
 * `audioFactory(src)` must return an Audio-like object with play(), pause(),
 * currentTime, duration, and addEventListener/removeEventListener.
 */
export function createPlayer(script, callbacks = {}, audioFactory = (src) => new Audio(src)) {
  validateScript(script);
  const lines = script.lines;
  let index = -1;
  let audio = null;
  let state = 'idle';
  let disposed = false;
  let generation = 0;
  const listeners = [];

  const emitState = (next) => {
    state = next;
    callbacks.onStateChange?.(state);
  };
  const emitLine = (nextIndex) => {
    index = nextIndex;
    callbacks.onLineChange?.(lines[index] ?? null, index);
    emitProgress();
  };
  const emitProgress = () => {
    callbacks.onProgress?.({
      currentTime: Number.isFinite(audio?.currentTime) ? audio.currentTime : 0,
      duration: Number.isFinite(audio?.duration) ? audio.duration : 0,
      fraction: audio?.duration > 0 ? Math.min(1, Math.max(0, audio.currentTime / audio.duration)) : 0,
    });
  };
  const detachAudio = () => {
    if (!audio) return;
    for (const [event, handler] of listeners) audio.removeEventListener(event, handler);
    listeners.length = 0;
    audio.pause();
    audio = null;
  };

  const playLine = async (lineIndex) => {
    if (disposed) return;
    if (lineIndex >= lines.length) {
      detachAudio();
      emitLine(-1);
      emitState('ended');
      return;
    }
    const line = lines[lineIndex];
    if (!line.audioSrc) {
      const error = new Error(`No prerecorded audio is configured for line ${line.id}`);
      callbacks.onError?.(error, line);
      emitState('error');
      return;
    }
    detachAudio();
    const token = ++generation;
    try {
      audio = audioFactory(line.audioSrc);
      const current = audio;
      const onEnded = () => { if (!disposed && token === generation) void playLine(lineIndex + 1); };
      const onError = () => {
        if (!disposed && token === generation) {
          const error = new Error(`Unable to play audio for line ${line.id}`);
          callbacks.onError?.(error, line);
          emitState('error');
        }
      };
      const onTime = () => { if (token === generation) emitProgress(); };
      for (const [event, handler] of [['ended', onEnded], ['error', onError], ['timeupdate', onTime], ['loadedmetadata', onTime]]) {
        listeners.push([event, handler]);
        current.addEventListener(event, handler);
      }
      emitLine(lineIndex);
      emitState('playing');
      await current.play();
      if (token === generation && !disposed) emitProgress();
    } catch (error) {
      if (token === generation && !disposed) {
        callbacks.onError?.(error, line);
        emitState('error');
      }
    }
  };

  return {
    play() {
      if (disposed || state === 'playing') return;
      if (state === 'paused' && audio) {
        emitState('playing');
        Promise.resolve(audio.play()).catch((error) => {
          callbacks.onError?.(error, lines[index]);
          emitState('error');
        });
      } else {
        void playLine(index < 0 || state === 'ended' || state === 'error' ? 0 : index);
      }
    },
    pause() {
      if (disposed || state !== 'playing' || !audio) return;
      audio.pause();
      emitProgress();
      emitState('paused');
    },
    restart() {
      if (disposed) return;
      generation += 1;
      detachAudio();
      emitLine(-1);
      emitState('idle');
      void playLine(0);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      detachAudio();
      emitLine(-1);
      emitState('idle');
    },
    getState: () => state,
    getCurrentIndex: () => index,
  };
}
