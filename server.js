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
  return http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname === '/') {
      pathname = '/index.html';
    }

    const filePath = path.normalize(path.join(root, pathname));

    // Security check: ensure path is within root
    if (!filePath.startsWith(root)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`Not found: ${pathname}`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);

      const stream = fs.createReadStream(filePath);
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
