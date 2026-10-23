import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createStaticServer } from '../server.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TEST_PORT = 3891;

function request(urlPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: 'localhost',
        port: TEST_PORT,
        path: urlPath,
        method,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, text: body });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

test('Static server serves valid files and enforces robust directory boundaries', async (t) => {
  const server = createStaticServer(rootDir);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  // 1. Root serves index.html
  const rootRes = await request('/');
  assert.equal(rootRes.status, 200);
  assert.match(rootRes.headers['content-type'], /text\/html/);
  assert.match(rootRes.text, /Three Amigos/);

  // 2. Serves specific valid static files
  const cssRes = await request('/src/ui.css');
  assert.equal(cssRes.status, 200);
  assert.match(cssRes.headers['content-type'], /text\/css/);

  const jsRes = await request('/src/ui.js');
  assert.equal(jsRes.status, 200);
  assert.match(jsRes.headers['content-type'], /text\/javascript/);

  // 3. Handles HEAD method
  const headRes = await request('/index.html', 'HEAD');
  assert.equal(headRes.status, 200);
  assert.equal(headRes.text, '');

  // 4. Returns 405 Method Not Allowed for POST/PUT
  const postRes = await request('/index.html', 'POST');
  assert.equal(postRes.status, 405);

  // 5. Returns 404 for missing files
  const missingRes = await request('/non-existent-file-xyz.js');
  assert.equal(missingRes.status, 404);

  // 6. Returns 400 for malformed URI encoding
  const malformedRes1 = await request('/%c0%af');
  assert.equal(malformedRes1.status, 400);
  assert.match(malformedRes1.text, /Malformed URL/);

  const malformedRes2 = await request('/%FF');
  assert.equal(malformedRes2.status, 400);
  assert.match(malformedRes2.text, /Malformed URL/);

  // 7. Returns 403 Forbidden for directory traversal
  const traversalRes = await request('/../../package.json');
  assert.equal(traversalRes.status, 403);
  assert.match(traversalRes.text, /Forbidden/);

  const traversalEncoded = await request('/..%2F..%2Fpackage.json');
  assert.equal(traversalEncoded.status, 403);
  assert.match(traversalEncoded.text, /Forbidden/);

  const traversalDoubleDot = await request('/%2e%2e/%2e%2e/package.json');
  assert.equal(traversalDoubleDot.status, 403);
  assert.match(traversalDoubleDot.text, /Forbidden/);
});
