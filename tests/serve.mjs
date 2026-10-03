// tests/serve.mjs: zero-dependency static server (SPEC §7.9).
// Usage: node tests/serve.mjs [port=8080] [--base /hayeled/]
// Serves the repo root under the base path, like GitHub Pages does at https://moshe0408.github.io/hayeled/.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function parseArgs(argv) {
  let port = 8080;
  let base = '/';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') base = argv[++i] || '/';
    else if (a.startsWith('--base=')) base = a.slice(7);
    else if (/^\d+$/.test(a)) port = Number(a);
  }
  // Git Bash (MSYS) rewrites '/hayeled/' into 'C:/Program Files/Git/hayeled/': undo that.
  if (/^[A-Za-z]:[\\/]/.test(base)) base = '/' + path.basename(base.replace(/[\\/]+$/, '')) + '/';
  base = base.replace(/\\/g, '/');
  if (!base.startsWith('/')) base = '/' + base;
  if (!base.endsWith('/')) base += '/';
  return { port, base };
}

const { port, base } = parseArgs(process.argv.slice(2));

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-cache', 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    return send(res, 400, 'Bad Request');
  }
  if (base !== '/' && (pathname === '/' || pathname === base.slice(0, -1))) {
    return send(res, 302, 'Found', { Location: base });
  }
  if (!pathname.startsWith(base)) return send(res, 404, 'Not Found');

  let rel;
  try {
    rel = decodeURIComponent(pathname.slice(base.length));
  } catch {
    return send(res, 400, 'Bad Request');
  }
  if (rel.includes('\0')) return send(res, 400, 'Bad Request');
  let file = path.resolve(ROOT, '.' + path.sep + rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');

  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      if (!pathname.endsWith('/')) return send(res, 301, 'Moved', { Location: pathname + '/' });
      file = path.join(file, 'index.html');
    }
    fs.stat(file, (err2, st2) => {
      if (err2 || !st2.isFile()) return send(res, 404, 'Not Found');
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st2.size, 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    });
  });
});

server.on('error', (e) => {
  console.error(`serve.mjs: ${e.code === 'EADDRINUSE' ? 'port ' + port + ' is already in use' : e.message}`);
  process.exit(1);
});

server.listen(port, () => {
  console.log(`Serving ${ROOT} at http://localhost:${port}${base}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
