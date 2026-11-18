import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-win-'));
process.env.CLUB_DATA_FILE = path.join(dir, 'club-data.json');
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.CLUB_WRITE_SECRET = '';
process.env.BOT_API_SECRET = '';
process.env.CORS_ORIGIN = '';
process.env.HOST = '127.0.0.1';

const { startServer, stopServer, assertSafeListen, importClubFile } = await import('../server.mjs');

function req(port, method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: Object.assign(
          data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
          headers
        )
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch (_) {}
          resolve({ status: res.statusCode, json, headers: res.headers, text });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

describe('windows-server security', () => {
  afterEach(async () => {
    await stopServer();
    process.env.CLUB_WRITE_SECRET = '';
    process.env.TELEGRAM_BOT_TOKEN = '';
    process.env.BOT_API_SECRET = '';
    process.env.CORS_ORIGIN = '';
  });

  it('blocks open LAN bind without secret', () => {
    assert.throws(() => assertSafeListen('0.0.0.0'), /LAN bind/);
  });

  it('allows LAN bind when CLUB_WRITE_SECRET is set', () => {
    process.env.CLUB_WRITE_SECRET = 'test-secret';
    assert.equal(assertSafeListen('0.0.0.0'), true);
  });

  it('loopback club write works without secrets', async () => {
    const status = await startServer({ port: 18788, host: '127.0.0.1' });
    assert.equal(status.running, true);
    assert.equal(status.lanMode, false);

    const up = await req(18788, 'POST', '/api/club-data', {
      updatedAt: '2026-11-18T12:00:00.000Z',
      updatedBy: 'coach',
      payload: { players: [{ id: 'p1', firstName: 'Test' }], trainings: [] }
    });
    assert.equal(up.status, 200);
    assert.equal(up.json.ok, true);

    const down = await req(18788, 'GET', '/api/club-data');
    assert.equal(down.status, 200);
    assert.equal(down.json.payload.players[0].firstName, 'Test');
  });

  it('does not reflect arbitrary CORS origins', async () => {
    await startServer({ port: 18789, host: '127.0.0.1' });
    const r = await req(18789, 'GET', '/health', null, { Origin: 'https://evil.example' });
    assert.equal(r.status, 200);
    assert.notEqual(r.headers['access-control-allow-origin'], 'https://evil.example');
    assert.notEqual(r.headers['access-control-allow-origin'], '*');
  });

  it('desktop importClubFile stores payload', () => {
    const saved = importClubFile({
      updatedAt: '2026-11-18T13:00:00.000Z',
      payload: { players: [{ id: 'x' }], schemaVersion: 2 }
    });
    assert.equal(saved.updatedBy, 'windows-app');
    assert.ok(saved.payload.players.length === 1);
  });
});

after(async () => {
  await stopServer();
  fs.rmSync(dir, { recursive: true, force: true });
});
