import { spawn } from 'node:child_process';
import { createStaticServer } from '../server.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SERVER_PORT = 3456;
const CDP_PORT = 9229;
const BROWSER_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function getBrowserExecutable() {
  if (fs.existsSync(BROWSER_PATH)) return BROWSER_PATH;
  if (fs.existsSync(CHROME_PATH)) return CHROME_PATH;
  throw new Error('No supported browser found (Edge or Chrome required for smoke test)');
}

async function waitForCdpTarget(port, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const targets = await res.json();
        const page = targets.find(
          (t) =>
            t.type === 'page' &&
            (t.url.includes('index.html') || t.url.includes(String(SERVER_PORT)))
        );
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {
      // Browser still initializing
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for browser CDP target on port ${port}`);
}

export async function runSmokeTest() {
  console.log('--- Starting Three Amigos Browser Smoke Test ---');

  // 1. Start static server
  const server = createStaticServer(rootDir);
  await new Promise((resolve) => server.listen(SERVER_PORT, resolve));
  console.log(`[1/5] Static server listening at http://localhost:${SERVER_PORT}`);

  // 2. Launch headless browser with CDP
  const browserExe = getBrowserExecutable();
  console.log(`[2/5] Found browser executable: ${browserExe}`);

  const tempScreenshot = path.join(os.tmpdir(), `three-amigos-smoke-${Date.now()}.png`);
  const appUrl = `http://localhost:${SERVER_PORT}/index.html`;

  const browserProc = spawn(browserExe, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=390,844',
    appUrl,
  ]);

  browserProc.on('error', (err) => {
    console.error('Browser spawn error:', err);
  });

  let ws = null;

  try {
    const wsUrl = await waitForCdpTarget(CDP_PORT);
    console.log(`[3/5] Connected to browser CDP session via WebSocket`);

    ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let evalId = 1;
    const evaluate = (expression) =>
      new Promise((resolve, reject) => {
        const id = evalId++;
        const onMessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.id === id) {
              ws.removeEventListener('message', onMessage);
              if (data.error) reject(new Error(data.error.message));
              else resolve(data.result?.result?.value);
            }
          } catch (e) {
            reject(e);
          }
        };
        ws.addEventListener('message', onMessage);
        ws.send(
          JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: { expression, returnByValue: true, awaitPromise: true },
          })
        );
      });

    const snapshotExpression = `JSON.stringify({
      state: document.getElementById('playback-state-text')?.textContent,
      lineCounter: document.getElementById('line-counter')?.textContent,
      activeIndex: document.querySelector('.transcript-line.is-active')?.dataset.lineIndex ?? null,
      activeSpeaker: document.querySelector('.transcript-line.is-active')?.dataset.speakerId ?? null,
      speakingSpeaker: document.querySelector('.character-card.is-speaking')?.dataset.speakerId ?? null,
      progress: document.getElementById('progress-bar')?.getAttribute('aria-valuenow'),
      replayLabel: document.getElementById('btn-play-label')?.textContent,
      errorVisible: !document.getElementById('error-banner')?.classList.contains('hidden')
    })`;
    const snapshot = async () => JSON.parse(await evaluate(snapshotExpression));
    const waitFor = async (predicate, timeoutMs = 5000) => {
      const deadline = Date.now() + timeoutMs;
      let current;
      while (Date.now() < deadline) {
        current = await snapshot();
        if (predicate(current)) return current;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Timed out waiting for browser state: ${JSON.stringify(current)}`);
    };

    // Wait until document.readyState === 'complete' and #app is initialized
    for (let i = 0; i < 20; i++) {
      const initialized = await evaluate('Boolean(document.getElementById("app")?.dataset?.initialized)');
      if (initialized) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log('[4/5] Verifying rendered DOM structure and accessibility in browser...');

    const checks = [
      {
        name: 'Brand header rendered',
        val: await evaluate('document.querySelector(".brand-badge")?.textContent'),
        check: (v) => typeof v === 'string' && v.includes('workfriend.ai'),
      },
      {
        name: 'Script title rendered',
        val: await evaluate('document.querySelector(".app-title")?.textContent'),
        check: (v) => v === 'The Missing Monday',
      },
      {
        name: 'Three character cards present',
        val: await evaluate('document.querySelectorAll(".character-card").length'),
        check: (v) => v === 3,
      },
      {
        name: 'Initial play button ready',
        val: await evaluate('document.getElementById("btn-play-label")?.textContent'),
        check: (v) => v === 'Play',
      },
      {
        name: 'Initial pause button disabled',
        val: await evaluate('document.getElementById("btn-pause")?.disabled'),
        check: (v) => v === true,
      },
      {
        name: 'Initial restart button enabled',
        val: await evaluate('document.getElementById("btn-restart")?.disabled'),
        check: (v) => v === false,
      },
      {
        name: 'Read-only progress bar present',
        val: await evaluate('document.getElementById("progress-bar")?.getAttribute("role")'),
        check: (v) => v === 'progressbar',
      },
      {
        name: 'All 6 transcript lines rendered',
        val: await evaluate('document.querySelectorAll(".transcript-line").length'),
        check: (v) => v === 6,
      },
      {
        name: 'Initial error banner is hidden',
        val: await evaluate('document.getElementById("error-banner")?.classList.contains("hidden")'),
        check: (v) => v === true,
      },
    ];

    for (const c of checks) {
      if (c.check(c.val)) {
        console.log(`  ✔ PASS: ${c.name}`);
      } else {
        throw new Error(`FAIL: ${c.name} (got ${JSON.stringify(c.val)})`);
      }
    }

    console.log('[5/5] Executing real UI interactions in browser...');

    // Verify pause/resume/restart against an actual recorded clip.
    console.log('  -> Interaction 1: Play, pause, resume and restart recorded audio...');
    await evaluate('document.getElementById("btn-play").click()');
    await waitFor((view) => view.state === 'Playing' && view.activeIndex === '0');
    await evaluate('document.getElementById("btn-pause").click()');
    await waitFor((view) => view.state === 'Paused');
    await evaluate('document.getElementById("btn-play").click()');
    await waitFor((view) => view.state === 'Playing');
    await evaluate('document.getElementById("btn-restart").click()');
    await waitFor((view) => view.state === 'Playing' && view.activeIndex === '0');
    console.log('  ✔ PASS: Pause/resume preserved playback and Restart returned to line one');

    console.log('  -> Interaction 2: Listening through all six recorded lines...');
    const observedLines = new Set();
    const deadline = Date.now() + 90000;
    let finalView;
    while (Date.now() < deadline) {
      finalView = await snapshot();
      if (finalView.activeIndex !== null) {
        observedLines.add(Number(finalView.activeIndex));
        if (finalView.activeSpeaker !== finalView.speakingSpeaker) {
          throw new Error(`Speaker highlight mismatch on line ${finalView.activeIndex}: ${JSON.stringify(finalView)}`);
        }
      }
      if (finalView.state === 'Finished') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (finalView?.state !== 'Finished') throw new Error(`Playback did not complete: ${JSON.stringify(finalView)}`);
    if ([...observedLines].sort().join(',') !== '0,1,2,3,4,5') {
      throw new Error(`Did not observe all six active transcript lines: ${[...observedLines]}`);
    }
    if (finalView.progress !== '100' || finalView.replayLabel !== 'Replay' || finalView.errorVisible) {
      throw new Error(`Unexpected completed UI: ${JSON.stringify(finalView)}`);
    }
    console.log('  ✔ PASS: All six prerecorded clips played with matching speaker highlights; UI reached Finished');

    console.log('  -> Interaction 3: Replay from the completed state...');
    await evaluate('document.getElementById("btn-play").click()');
    await waitFor((view) => view.state === 'Playing' && view.activeIndex === '0');
    await evaluate('document.getElementById("btn-pause").click()');
    await waitFor((view) => view.state === 'Paused');
    console.log('  ✔ PASS: Replay started again from the first recorded line');

    console.log('--- Browser Smoke Test Passed Successfully! ---');
  } finally {
    if (ws) {
      try { ws.close(); } catch {}
    }
    browserProc.kill();
    await new Promise((resolve) => server.close(resolve));
    console.log('Static server shut down.');
  }
}

if (process.argv[1] === __filename) {
  runSmokeTest().catch((err) => {
    console.error('Smoke test error:', err);
    process.exit(1);
  });
}
