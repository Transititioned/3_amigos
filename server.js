import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
};

export function createStaticServer(root = ROOT) {
  const resolvedRoot = path.resolve(root);

  return http.createServer((req, res) => {
    // Only accept safe read methods
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET, HEAD');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Method Not Allowed');
      return;
    }

    // Safely decode raw URL; catch malformed percent-encoding
    let decodedUrl;
    try {
      decodedUrl = decodeURIComponent(req.url);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Bad Request: Malformed URL');
      return;
    }

    // Reject null byte injection or invalid control characters
    if (decodedUrl.includes('\0')) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Bad Request: Invalid Path');
      return;
    }

    // Reject traversal attempts (raw or decoded)
    if (
      decodedUrl.startsWith('/..') ||
      decodedUrl.includes('/../') ||
      decodedUrl.includes('\\..\\') ||
      decodedUrl.includes('/..\\') ||
      decodedUrl.includes('\\../')
    ) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Forbidden');
      return;
    }

    let pathname;
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      pathname = decodeURIComponent(parsedUrl.pathname);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Bad Request: Malformed URL');
      return;
    }

    // Default root path to index.html
    const relativeTarget =
      pathname === '/' || pathname === ''
        ? 'index.html'
        : pathname.replace(/^[/\\]+/, '');

    // Resolve target path against root
    const filePath = path.resolve(resolvedRoot, relativeTarget);

    // Robust directory boundary check:
    // path.relative(resolvedRoot, filePath) must not escape resolvedRoot
    const rel = path.relative(resolvedRoot, filePath);
    const isWithinBoundary = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));

    if (!isWithinBoundary) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(`Not found: ${pathname}`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Internal Server Error');
        } else {
          res.destroy();
        }
      });
      stream.pipe(res);
    });
  });
}

// Start standalone server when run directly
if (process.argv[1] === __filename) {
  const server = createStaticServer();
  server.listen(PORT, () => {
    console.log(`Three Amigos UI running at http://localhost:${PORT}`);
  });
}
