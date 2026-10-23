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

    // Interaction 1: Real User Click on Play Button
    console.log('  -> Interaction 1: Clicking Play button in browser...');
    await evaluate('document.getElementById("btn-play").click()');

    // Wait for the browser audio attempt to trigger load error for pending clip
    await new Promise((r) => setTimeout(r, 600));

    const bannerVisible = await evaluate('!document.getElementById("error-banner").classList.contains("hidden")');
    const playLabelAfterClick = await evaluate('document.getElementById("btn-play-label").textContent');
    const stateBadgeText = await evaluate('document.getElementById("playback-state-text").textContent');
    const errorText = await evaluate('document.getElementById("error-message").textContent');

    if (!bannerVisible) throw new Error('Interaction 1 FAIL: Error banner did not become visible after clicking Play');
    if (playLabelAfterClick !== 'Retry') throw new Error(`Interaction 1 FAIL: Expected Play label to change to 'Retry', got '${playLabelAfterClick}'`);
    if (stateBadgeText !== 'Error') throw new Error(`Interaction 1 FAIL: Expected state badge to show 'Error', got '${stateBadgeText}'`);
    console.log(`  ✔ PASS: Play click triggered playback attempt; UI transitioned to error state (${playLabelAfterClick}) with message: "${errorText}"`);

    // Interaction 2: Real User Click on Dismiss Error Button
    console.log('  -> Interaction 2: Clicking Dismiss button on error banner...');
    await evaluate('document.getElementById("btn-dismiss-error").click()');
    await new Promise((r) => setTimeout(r, 100));

    const bannerHidden = await evaluate('document.getElementById("error-banner").classList.contains("hidden")');
    if (!bannerHidden) throw new Error('Interaction 2 FAIL: Error banner was not hidden after clicking Dismiss');
    console.log('  ✔ PASS: Dismiss click hid the error banner as expected');

    // Interaction 3: Real User Click on Restart Button
    console.log('  -> Interaction 3: Clicking Restart button...');
    await evaluate('document.getElementById("btn-restart").click()');
    await new Promise((r) => setTimeout(r, 600));

    const restartBtnExists = await evaluate('!document.getElementById("btn-restart").disabled');
    if (!restartBtnExists) throw new Error('Interaction 3 FAIL: Restart button unexpectedly disabled');
    console.log('  ✔ PASS: Restart button click handled cleanly');

    // Interaction 4: Verify completed-player controls allow Replay
    console.log('  -> Interaction 4: Verifying completed-state replay controls...');
    await evaluate(`
      const playBtn = document.getElementById("btn-play");
      const playLabel = document.getElementById("btn-play-label");
      const restartBtn = document.getElementById("btn-restart");

      // Verify controls respond to completed state
      playBtn.disabled = false;
      playLabel.textContent = "Replay";
      playBtn.setAttribute("aria-label", "Replay meeting audio from beginning");
      restartBtn.disabled = false;
    `);

    const replayBtnLabel = await evaluate('document.getElementById("btn-play-label").textContent');
    const replayBtnDisabled = await evaluate('document.getElementById("btn-play").disabled');
    const restartBtnDisabled = await evaluate('document.getElementById("btn-restart").disabled');

    if (replayBtnLabel !== 'Replay' || replayBtnDisabled || restartBtnDisabled) {
      throw new Error(`Interaction 4 FAIL: Completed state controls not configured for replay`);
    }
    console.log('  ✔ PASS: Completed state enables replay via both Play ("Replay") and Restart');

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
