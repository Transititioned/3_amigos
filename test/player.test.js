import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../src/player.js';
import { demoScript, validateScript } from '../src/player-data.js';

class FakeAudio {
  constructor(src) { this.src = src; this.currentTime = 0; this.duration = 10; this.events = new Map(); this.paused = true; }
  addEventListener(name, handler) { this.events.set(name, handler); }
  removeEventListener(name) { this.events.delete(name); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  fire(name) { this.events.get(name)?.(); }
}

function fixture() {
  const events = { states: [], lines: [], progress: [], errors: [] };
  const audios = [];
  const player = createPlayer(demoScript, {
    onStateChange: (value) => events.states.push(value),
    onLineChange: (line, index) => events.lines.push([line?.id ?? null, index]),
    onProgress: (value) => events.progress.push(value),
    onError: (error) => events.errors.push(error.message),
  }, (src) => { const item = new FakeAudio(src); audios.push(item); return item; });
  return { player, events, audios };
}

test('validates script and rejects unknown speakers', () => {
  assert.equal(validateScript(demoScript), demoScript);
  assert.throws(() => validateScript({ ...demoScript, lines: [{ ...demoScript.lines[0], speakerId: 'nobody' }] }), /Unknown speaker/);
});

test('sequences clips and emits the active transcript line', async () => {
  const { player, events, audios } = fixture();
  player.play();
  await Promise.resolve();
  assert.equal(player.getState(), 'playing');
  assert.equal(player.getCurrentIndex(), 0);
  audios[0].fire('ended');
  await Promise.resolve();
  assert.equal(player.getCurrentIndex(), 1);
  assert.deepEqual(events.lines.slice(0, 2), [['line-1', 0], ['line-2', 1]]);
  audios[1].fire('ended');
  audios[2].fire('ended');
  audios[3].fire('ended');
  audios[4].fire('ended');
  audios[5].fire('ended');
  await Promise.resolve();
  assert.equal(player.getState(), 'ended');
  assert.equal(player.getCurrentIndex(), -1);
});

test('pause resumes current clip, restart returns to first line', async () => {
  const { player, audios } = fixture();
  player.play();
  player.pause();
  assert.equal(player.getState(), 'paused');
  player.play();
  assert.equal(audios.length, 1);
  assert.equal(audios[0].paused, false);
  player.restart();
  await Promise.resolve();
  assert.equal(player.getCurrentIndex(), 0);
  assert.equal(audios.length, 2);
});

test('reports missing prerecorded audio instead of synthesizing it', async () => {
  const { player, events } = fixture();
  const script = { ...demoScript, lines: [{ ...demoScript.lines[0], audioSrc: null }] };
  const missing = createPlayer(script, { onError: (error) => events.errors.push(error.message) }, () => { throw new Error('must not create audio'); });
  missing.play();
  await Promise.resolve();
  assert.equal(missing.getState(), 'error');
  assert.match(events.errors.at(-1), /No prerecorded audio/);
});
