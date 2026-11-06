/**
 * Zero-dependency static server for the coaching platform.
 * Serves the repo root (or DEV_ROOT) so index.html and src/ load as-is.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleClubRequest, clubWriteAllowed } from '../server/clubData.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.DEV_ROOT || path.join(HERE, '..'));
const PORT = Number(process.env.DEV_PORT || 43127);
const HOST = process.env.DEV_HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function resolveFile(urlPath) {
  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(urlPath, 'http://local').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;
  const abs = path.resolve(ROOT, '.' + pathname);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  const base = path.basename(abs);
  if (base === '.env' || base.startsWith('.env.') || base === '.git' || abs.includes(`${path.sep}.git${path.sep}`)) {
    return null;
  }
  return abs;
}

function send(req, res, status, body, headers = {}) {
  res.writeHead(status, headers);
  if (req.method === 'HEAD') res.end();
  else res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const handled = await handleClubRequest(req, res, clubWriteAllowed);
    if (handled) return;
  } catch (err) {
    send(req, res, 500, 'club sync failed', { 'Content-Type': 'text/plain; charset=utf-8' });
    console.error(err);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(req, res, 405, 'method not allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }
  const target = resolveFile(req.url || '/');
  if (!target) {
    send(req, res, 400, 'bad path', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }
  fs.stat(target, (err, stat) => {
    const file = !err && stat.isDirectory() ? path.join(target, 'index.html') : target;
    fs.readFile(file, (readErr, buf) => {
      if (readErr) {
        send(req, res, 404, 'not found', { 'Content-Type': 'text/plain; charset=utf-8' });
        return;
      }
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      send(req, res, 200, buf, {
        'Content-Type': type,
        'Cache-Control': 'no-cache',
      });
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`METALIST STUTTGART  http://127.0.0.1:${PORT}`);
});
