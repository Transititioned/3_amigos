import { spawn } from 'node:child_process';
import { createStaticServer } from '../server.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PORT = 3456;
const BROWSER_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function getBrowserExecutable() {
  if (fs.existsSync(BROWSER_PATH)) return BROWSER_PATH;
  if (fs.existsSync(CHROME_PATH)) return CHROME_PATH;
  throw new Error('No supported browser found (Edge or Chrome required for smoke test)');
}

export async function runSmokeTest() {
  console.log('--- Starting Three Amigos Browser Smoke Test ---');

  const server = createStaticServer(rootDir);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[1/4] Server listening at http://localhost:${PORT}`);

  const browserExe = getBrowserExecutable();
  console.log(`[2/4] Found browser executable: ${browserExe}`);

  const tempScreenshot = path.join(os.tmpdir(), `three-amigos-smoke-${Date.now()}.png`);

  // Launch headless browser to dump DOM and capture screenshot
  console.log('[3/4] Launching headless browser with mobile viewport (390x844)...');
  const domOutput = await new Promise((resolve, reject) => {
    const proc = spawn(browserExe, [
      '--headless=new',
      '--disable-gpu',
      '--window-size=390,844',
      `--screenshot=${tempScreenshot}`,
      '--dump-dom',
      `http://localhost:${PORT}/index.html`,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Browser exited with code ${code}: ${stderr}`));
    });

    proc.on('error', reject);
  });

  console.log('[4/4] Verifying rendered DOM elements...');

  const checks = [
    { name: 'App root container', check: domOutput.includes('id="app"') },
    { name: 'workfriend.ai branding', check: domOutput.includes('workfriend.ai') },
    { name: 'Script title (The Missing Monday)', check: domOutput.includes('The Missing Monday') },
    { name: 'Mara character card', check: domOutput.includes('data-speaker-id="mara"') },
    { name: 'Leo character card', check: domOutput.includes('data-speaker-id="leo"') },
    { name: 'Bea character card', check: domOutput.includes('data-speaker-id="bea"') },
    { name: 'Play button', check: domOutput.includes('id="btn-play"') },
    { name: 'Pause button', check: domOutput.includes('id="btn-pause"') },
    { name: 'Restart button', check: domOutput.includes('id="btn-restart"') },
    { name: 'Read-only progress bar', check: domOutput.includes('role="progressbar"') },
    { name: 'Transcript line 1', check: domOutput.includes('data-line-id="line-1"') },
    { name: 'Transcript line 6', check: domOutput.includes('data-line-id="line-6"') },
    { name: 'Mobile viewport rendered', check: fs.existsSync(tempScreenshot) },
  ];

  let passed = true;
  for (const item of checks) {
    if (item.check) {
      console.log(`  ✔ PASS: ${item.name}`);
    } else {
      console.error(`  ✖ FAIL: ${item.name}`);
      passed = false;
    }
  }

  // Clean up temp screenshot
  if (fs.existsSync(tempScreenshot)) {
    try { fs.unlinkSync(tempScreenshot); } catch {}
  }

  // Close server
  await new Promise((resolve) => server.close(resolve));
  console.log('Static server shut down.');

  if (!passed) {
    throw new Error('Browser smoke test failed one or more element checks.');
  }

  console.log('--- Browser Smoke Test Passed Successfully! ---');
}

if (process.argv[1] === __filename) {
  runSmokeTest().catch((err) => {
    console.error('Smoke test error:', err);
    process.exit(1);
  });
}
