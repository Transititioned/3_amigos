import test from 'node:test';
import assert from 'node:assert/strict';
import { initPlayerUI, formatTime, CHARACTER_AVATARS } from '../src/ui.js';
import { demoScript } from '../src/player-data.js';

/**
 * Minimal in-memory DOM simulation to test UI interactions without a headless browser.
 */
class MockClassList {
  constructor(el) {
    this.el = el;
    this.set = new Set();
  }
  add(cls) { this.set.add(cls); }
  remove(cls) { this.set.delete(cls); }
  contains(cls) { return this.set.has(cls); }
  toggle(cls, force) {
    if (force === true) this.add(cls);
    else if (force === false) this.remove(cls);
    else if (this.contains(cls)) this.remove(cls);
    else this.add(cls);
  }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.classList = new MockClassList(this);
    this.style = {};
    this.listeners = new Map();
    this.textContent = '';
    this.disabled = false;
    this.scrollIntoViewCalls = 0;
  }

  get className() {
    return Array.from(this.classList.set).join(' ');
  }

  set className(val) {
    this.classList.set = new Set(val.split(' ').filter(Boolean));
  }

  setAttribute(name, val) {
    this.attributes.set(name, String(val));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
  }

  removeEventListener(event, handler) {
    const list = this.listeners.get(event) || [];
    this.listeners.set(event, list.filter((h) => h !== handler));
  }

  dispatchEvent(event) {
    const handlers = this.listeners.get(event.type) || [];
    for (const h of handlers) h.call(this, event);
  }

  click() {
    if (this.disabled) return;
    this.dispatchEvent({ type: 'click' });
  }

  scrollIntoView() {
    this.scrollIntoViewCalls += 1;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    const walk = (node) => {
      if (nodeMatches(node, selector)) results.push(node);
      for (const child of node.children) walk(child);
    };
    for (const child of this.children) walk(child);
    return results;
  }
}

function nodeMatches(node, selector) {
  if (selector.startsWith('#')) {
    return node.getAttribute('id') === selector.slice(1);
  }
  if (selector.startsWith('.')) {
    return node.classList.contains(selector.slice(1));
  }
  if (selector.startsWith('[')) {
    const match = selector.match(/\[([a-zA-Z0-9_-]+)(?:="([^"]+)")?\]/);
    if (!match) return false;
    const [, attr, val] = match;
    if (val === undefined) return node.hasAttribute(attr);
    return node.getAttribute(attr) === val;
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

class MockContainer extends MockElement {
  constructor() {
    super('div');
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    this.buildFromTemplate(html);
  }

  get innerHTML() {
    return this._innerHTML || '';
  }

  buildFromTemplate() {
    const makeEl = (tag, id, classNames, attrs = {}) => {
      const el = new MockElement(tag);
      if (id) el.setAttribute('id', id);
      if (classNames) el.className = classNames;
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      return el;
    };

    // Header
    const header = makeEl('header', null, 'app-header');
    this.children.push(header);

    // Characters
    const charSection = makeEl('section', null, 'characters-section');
    for (const char of demoScript.characters) {
      const card = makeEl('div', `char-${char.id}`, 'character-card', {
        'data-speaker-id': char.id,
      });
      const status = makeEl('div', `char-status-${char.id}`, 'character-status');
      status.textContent = 'Ready';
      card.children.push(status);
      charSection.children.push(card);
    }
    this.children.push(charSection);

    // Controls
    const controls = makeEl('section', null, 'controls-panel');
    const stateBadge = makeEl('div', 'playback-state-badge', 'state-badge state-idle');
    const stateText = makeEl('span', 'playback-state-text', '');
    stateText.textContent = 'Ready';
    stateBadge.children.push(stateText);
    controls.children.push(stateBadge);

    const lineCounter = makeEl('div', 'line-counter', 'line-counter');
    lineCounter.textContent = `Line -- of ${demoScript.lines.length}`;
    controls.children.push(lineCounter);

    const progressBar = makeEl('div', 'progress-bar', 'progress-track');
    const progressFill = makeEl('div', 'progress-fill', 'progress-fill');
    progressBar.children.push(progressFill);
    controls.children.push(progressBar);

    const timeDisplay = makeEl('span', 'time-display', '');
    timeDisplay.textContent = '0:00 / 0:00';
    controls.children.push(timeDisplay);

    const playBtn = makeEl('button', 'btn-play', 'btn btn-primary');
    const playBtnLabel = makeEl('span', 'btn-play-label', '');
    playBtnLabel.textContent = 'Play';
    playBtn.children.push(playBtnLabel);
    controls.children.push(playBtn);

    const pauseBtn = makeEl('button', 'btn-pause', 'btn btn-secondary');
    pauseBtn.disabled = true;
    controls.children.push(pauseBtn);

    const restartBtn = makeEl('button', 'btn-restart', 'btn btn-secondary');
    const restartBtnLabel = makeEl('span', 'btn-restart-label', '');
    restartBtnLabel.textContent = 'Restart';
    restartBtn.children.push(restartBtnLabel);
    controls.children.push(restartBtn);

    const errorBanner = makeEl('div', 'error-banner', 'error-banner hidden');
    const errorMsg = makeEl('p', 'error-message', 'error-message');
    const dismissBtn = makeEl('button', 'btn-dismiss-error', 'error-dismiss-btn');
    errorBanner.children.push(errorMsg, dismissBtn);
    controls.children.push(errorBanner);

    this.children.push(controls);

    // Transcript
    const transcriptSection = makeEl('section', null, 'transcript-section');
    const transcriptList = makeEl('div', 'transcript-list', 'transcript-list');
    demoScript.lines.forEach((line, idx) => {
      const lineItem = makeEl('article', `line-item-${idx}`, 'transcript-line', {
        'data-line-id': line.id,
        'data-speaker-id': line.speakerId,
        'data-line-index': String(idx),
      });
      const text = makeEl('p', null, 'transcript-text');
      text.textContent = line.text;
      lineItem.children.push(text);
      transcriptList.children.push(lineItem);
    });
    transcriptSection.children.push(transcriptList);
    this.children.push(transcriptSection);

    // Announcer
    const announcer = makeEl('div', 'sr-announcer', 'sr-only');
    this.children.push(announcer);
  }
}

/**
 * Fake audio class for testing UI with simulated audio events.
 */
class FakeAudio {
  constructor(src) {
    this.src = src;
    this.currentTime = 0;
    this.duration = 10;
    this.events = new Map();
    this.paused = true;
  }
  addEventListener(name, handler) { this.events.set(name, handler); }
  removeEventListener(name) { this.events.delete(name); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  fire(name) { this.events.get(name)?.(); }
}

test('formatTime formats seconds into mm:ss accurately', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(5), '0:05');
  assert.equal(formatTime(59), '0:59');
  assert.equal(formatTime(60), '1:00');
  assert.equal(formatTime(75), '1:15');
  assert.equal(formatTime(605), '10:05');
  assert.equal(formatTime(-10), '0:00');
  assert.equal(formatTime(NaN), '0:00');
});

test('CHARACTER_AVATARS includes distinct SVGs for Mara, Leo, Bea', () => {
  assert.match(CHARACTER_AVATARS.mara, /#f59e0b/);
  assert.match(CHARACTER_AVATARS.leo, /#10b981/);
  assert.match(CHARACTER_AVATARS.bea, /#818cf8/);
});

test('initPlayerUI renders cards, controls and transcript', () => {
  const container = new MockContainer();
  const audios = [];
  const ui = initPlayerUI(container, {
    script: demoScript,
    audioFactory: (src) => {
      const a = new FakeAudio(src);
      audios.push(a);
      return a;
    },
  });

  assert.ok(ui.elements.playBtn);
  assert.ok(ui.elements.pauseBtn);
  assert.ok(ui.elements.restartBtn);
  assert.ok(ui.elements.progressBar);
  assert.ok(ui.elements.errorBanner);
  assert.ok(ui.elements.errorBanner.classList.contains('hidden'));

  const cards = container.querySelectorAll('.character-card');
  assert.equal(cards.length, 3);
  assert.equal(cards[0].getAttribute('data-speaker-id'), 'mara');
  assert.equal(cards[1].getAttribute('data-speaker-id'), 'leo');
  assert.equal(cards[2].getAttribute('data-speaker-id'), 'bea');

  const lines = container.querySelectorAll('.transcript-line');
  assert.equal(lines.length, demoScript.lines.length);
});

test('UI highlights active speaker card and active transcript line', async () => {
  const container = new MockContainer();
  const audios = [];
  const ui = initPlayerUI(container, {
    script: demoScript,
    audioFactory: (src) => {
      const a = new FakeAudio(src);
      audios.push(a);
      return a;
    },
  });

  const cards = container.querySelectorAll('.character-card');
  const lines = container.querySelectorAll('.transcript-line');

  // Trigger play (line 0: Mara)
  ui.elements.playBtn.click();
  await Promise.resolve();

  // Mara should be active speaker
  assert.ok(cards[0].classList.contains('is-speaking'), 'Mara should be speaking');
  assert.ok(cards[1].classList.contains('is-inactive'), 'Leo should be inactive');
  assert.ok(cards[2].classList.contains('is-inactive'), 'Bea should be inactive');

  // Line 0 should be active
  assert.ok(lines[0].classList.contains('is-active'));
  assert.equal(lines[0].scrollIntoViewCalls, 1);

  // Line 0 ends -> transitions to line 1 (Leo)
  audios[0].fire('ended');
  await Promise.resolve();

  assert.ok(!cards[0].classList.contains('is-speaking'), 'Mara should not be speaking');
  assert.ok(cards[1].classList.contains('is-speaking'), 'Leo should be speaking');
  assert.ok(lines[0].classList.contains('is-played'));
  assert.ok(lines[1].classList.contains('is-active'));
  assert.equal(lines[1].scrollIntoViewCalls, 1);
});

test('Controls update button states, progress bar, and pause/restart', async () => {
  const container = new MockContainer();
  const audios = [];
  const ui = initPlayerUI(container, {
    script: demoScript,
    audioFactory: (src) => {
      const a = new FakeAudio(src);
      audios.push(a);
      return a;
    },
  });

  // Start playback
  ui.elements.playBtn.click();
  await Promise.resolve();

  assert.equal(ui.getState(), 'playing');
  assert.equal(ui.elements.playBtn.disabled, true);
  assert.equal(ui.elements.pauseBtn.disabled, false);

  // Simulate progress
  audios[0].currentTime = 5;
  audios[0].duration = 10;
  audios[0].fire('timeupdate');

  assert.equal(ui.elements.progressFill.style.width, '50%');
  assert.equal(ui.elements.progressBar.getAttribute('aria-valuenow'), '50');
  assert.equal(ui.elements.timeDisplay.textContent, '0:05 / 0:10');

  // Pause playback
  ui.elements.pauseBtn.click();
  assert.equal(ui.getState(), 'paused');
  assert.equal(ui.elements.playBtn.disabled, false);
  assert.equal(ui.elements.pauseBtn.disabled, true);

  // Restart playback
  ui.elements.restartBtn.click();
  await Promise.resolve();
  assert.equal(ui.getState(), 'playing');
  assert.equal(ui.getCurrentIndex(), 0);
});

test('Completed playback enables replay using Play button or Restart', async () => {
  const container = new MockContainer();
  const audios = [];
  const ui = initPlayerUI(container, {
    script: demoScript,
    audioFactory: (src) => {
      const a = new FakeAudio(src);
      audios.push(a);
      return a;
    },
  });

  // Start playback
  ui.elements.playBtn.click();
  await Promise.resolve();

  // Play through all lines to reach completed state
  for (let i = 0; i < demoScript.lines.length; i++) {
    audios[i].fire('ended');
    await Promise.resolve();
  }

  // Verify completed state
  assert.equal(ui.getState(), 'ended');
  assert.equal(ui.elements.playBtn.disabled, false, 'Play/Replay button should be enabled');
  assert.equal(ui.elements.playBtnLabel.textContent, 'Replay', 'Play button should be labeled Replay');
  assert.equal(ui.elements.restartBtn.disabled, false, 'Restart button should be enabled');
  assert.equal(ui.elements.pauseBtn.disabled, true, 'Pause button should be disabled');
  assert.equal(ui.elements.progressFill.style.width, '100%');

  // Replay using the Play button
  ui.elements.playBtn.click();
  await Promise.resolve();
  assert.equal(ui.getState(), 'playing');
  assert.equal(ui.getCurrentIndex(), 0, 'Replay via Play button should return to line 0');

  // Play through to ended again
  for (let i = 6; i < 12; i++) {
    audios[i].fire('ended');
    await Promise.resolve();
  }
  assert.equal(ui.getState(), 'ended');

  // Replay using the Restart button
  ui.elements.restartBtn.click();
  await Promise.resolve();
  assert.equal(ui.getState(), 'playing');
  assert.equal(ui.getCurrentIndex(), 0, 'Replay via Restart button should return to line 0');
});

test('Error banner appears with error details when audio fails to load', async () => {
  const container = new MockContainer();
  const scriptMissing = {
    ...demoScript,
    lines: [{ ...demoScript.lines[0], audioSrc: null }],
  };

  const ui = initPlayerUI(container, {
    script: scriptMissing,
  });

  ui.elements.playBtn.click();
  await Promise.resolve();

  assert.equal(ui.getState(), 'error');
  assert.ok(!ui.elements.errorBanner.classList.contains('hidden'));
  assert.match(ui.elements.errorMessage.textContent, /No prerecorded audio/);
});
