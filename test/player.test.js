import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../src/player.js';
import { demoScript, getSpokenText, validateScript } from '../src/player-data.js';

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

test('expands speech contractions for every speaker without changing transcript text', () => {
  const maraLine = demoScript.lines.find(({ id }) => id === 'line-4');
  const leoLine = demoScript.lines.find(({ id }) => id === 'line-5');
  const beaLine = demoScript.lines.find(({ id }) => id === 'line-6');
  assert.equal(maraLine.speakerId, 'mara');
  assert.equal(maraLine.text, 'Let’s make one small plan so tomorrow doesn’t become Monday three.');
  assert.equal(getSpokenText(maraLine), 'Let us make one small plan so tomorrow does not become Monday three.');
  assert.equal(leoLine.speakerId, 'leo');
  assert.equal(leoLine.text, 'I’ll send the three-line recap before lunch. Ambitious, but achievable.');
  assert.equal(getSpokenText(leoLine), 'I will send the three-line recap before lunch. Ambitious, but achievable.');
  assert.equal(beaLine.speakerId, 'bea');
  assert.equal(beaLine.text, 'Excellent. I’ll believe it when the recap has a timestamp.');
  assert.equal(getSpokenText(beaLine), 'Excellent. I will believe it when the recap has a timestamp.');
  assert.equal(getSpokenText({ text: "We'll finish; she can't wait." }), 'We will finish; she cannot wait.');
  assert.equal(getSpokenText({ text: 'We’ll finish; she can’t wait.' }), 'We will finish; she cannot wait.');
  assert.equal(getSpokenText({ text: "I'll go", spokenText: "I'll run" }), 'I will run');
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
