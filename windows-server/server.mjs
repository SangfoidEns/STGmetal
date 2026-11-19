/**
 * HTTP API compatible with SangfoidEns/STGmetal.
 * Primary club sync: GET/POST /api/club-data
 *
 * Security defaults (do not weaken without an explicit secret):
 * - Bind 127.0.0.1 by default (not 0.0.0.0)
 * - LAN bind requires TELEGRAM_BOT_TOKEN or CLUB_WRITE_SECRET
 * - CORS never defaults to *; only configured origin or loopback Origin
 * - Bot routes require BOT_API_SECRET whenever the listener is non-loopback
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateInitData } from './lib/validateInitData.mjs';
import * as Bot from './lib/telegramBot.mjs';
import {
  handleClubRequest,
  clubWriteAllowed,
  readClub,
  writeClub,
  resolveCorsOrigin
} from './lib/clubData.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let server = null;
let state = {
  running: false,
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || '127.0.0.1',
  url: '',
  startedAt: null,
  lastError: null,
  lanMode: false,
  hasClubSecret: false
};

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || '';
const MAX_AGE = () => Number(process.env.INITDATA_MAX_AGE_SEC || 86400);
const BOT_SECRET = () => process.env.BOT_API_SECRET || '';
const CLUB_SECRET = () => process.env.CLUB_WRITE_SECRET || '';
const pollSent = new Map();

function isLoopbackBind(host) {
  const h = String(host || '').toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '::1';
}

function send(res, status, body, req) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': resolveCorsOrigin(req),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bot-Secret, X-Club-Key',
    'Vary': 'Origin',
    'Cache-Control': 'no-store'
  });
  res.end(json);
}

function readBody(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseJson(raw) {
  if (!raw) return {};
  return JSON.parse(raw);
}

/** Bot routes: secret always required on LAN; optional on loopback. */
function requireBotSecret(req, res) {
  const secret = BOT_SECRET();
  if (state.lanMode && !secret) {
    send(res, 503, {
      ok: false,
      error: 'bot_secret_required',
      message: 'Set BOT_API_SECRET when the server listens on the LAN'
    }, req);
    return false;
  }
  if (!secret) return true;
  const h = req.headers['x-bot-secret'] || '';
  if (h !== secret) {
    send(res, 401, { ok: false, error: 'unauthorized', message: 'X-Bot-Secret required' }, req);
    return false;
  }
  return true;
}

/**
 * Club writes: STGmetal rules + never allow open writes on LAN without a secret/token.
 * clubWriteAllowed already covers X-Club-Key and Telegram initData.
 */
async function mayWriteClub(req, body) {
  if (state.lanMode && !CLUB_SECRET() && !BOT_TOKEN()) {
    return false;
  }
  return clubWriteAllowed(req, body);
}

function hoursUntil(dateStr, timeStr) {
  if (!dateStr) return null;
  const t = (timeStr || '12:00').slice(0, 5);
  const d = new Date(dateStr + 'T' + t + ':00');
  if (Number.isNaN(d.getTime())) return null;
  return (d.getTime() - Date.now()) / (1000 * 60 * 60);
}

function createHandler() {
  return async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': resolveCorsOrigin(req),
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bot-Secret, X-Club-Key',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin'
        });
        res.end();
        return;
      }

      const url = new URL(req.url || '/', 'http://localhost');

      if (req.method === 'GET' && url.pathname === '/health') {
        const club = readClub();
        send(res, 200, {
          ok: true,
          service: 'stgmetal-windows-server',
          client: 'SangfoidEns/STGmetal',
          hasToken: Bot.hasToken(),
          defaultChat: Bot.defaultChatId(),
          port: state.port,
          host: state.host,
          lanMode: state.lanMode,
          url: state.url,
          club: {
            updatedAt: club.updatedAt,
            updatedBy: club.updatedBy,
            hasPayload: !!club.payload
          },
          time: new Date().toISOString()
        }, req);
        return;
      }

      if (url.pathname === '/api/club-data') {
        const handled = await handleClubRequest(req, res, mayWriteClub);
        if (handled) return;
      }

      if (req.method === 'POST' && url.pathname === '/api/telegram/validate') {
        if (!BOT_TOKEN()) {
          send(res, 503, { ok: false, error: 'server_misconfigured', message: 'TELEGRAM_BOT_TOKEN not set' }, req);
          return;
        }
        let payload = {};
        try {
          payload = parseJson(await readBody(req));
        } catch (e) {
          send(res, e.message === 'body_too_large' ? 413 : 400, { ok: false, error: e.message || 'invalid_json' }, req);
          return;
        }
        const initData = payload.initData || payload.init_data || '';
        const result = validateInitData(initData, BOT_TOKEN(), { maxAgeSec: MAX_AGE() });
        if (!result.ok) {
          send(res, 401, result, req);
          return;
        }
        send(res, 200, {
          ok: true,
          user: result.user,
          authDate: result.authDate,
          validatedAt: Math.floor(Date.now() / 1000)
        }, req);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/bot/status') {
        if (!requireBotSecret(req, res)) return;
        try {
          const me = Bot.hasToken() ? await Bot.getMe() : null;
          send(res, 200, {
            ok: true,
            hasToken: Bot.hasToken(),
            bot: me,
            defaultChat: Bot.defaultChatId(),
            pollsSent: pollSent.size
          }, req);
        } catch (e) {
          send(res, 502, { ok: false, error: e.code || 'tg_error', message: e.message }, req);
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/bot/discover-chats') {
        if (!requireBotSecret(req, res)) return;
        try {
          const chats = await Bot.discoverChats();
          send(res, 200, { ok: true, chats }, req);
        } catch (e) {
          send(res, 502, { ok: false, error: e.code || 'tg_error', message: e.message }, req);
        }
        return;
      }

      const botPost = {
        '/api/bot/attendance-poll': async (body) => {
          const result = await Bot.sendAttendancePoll(body);
          if (body.training && body.training.id) {
            pollSent.set(String(body.training.id), new Date().toISOString());
          }
          return { ok: true, result };
        },
        '/api/bot/training-plan': async (body) => ({
          ok: true,
          result: await Bot.sendTrainingPlan(body)
        }),
        '/api/bot/match-lineup': async (body) => ({
          ok: true,
          result: await Bot.sendMatchLineup(body)
        }),
        '/api/bot/club-event': async (body) => ({
          ok: true,
          result: await Bot.sendClubEvent(body)
        }),
        '/api/bot/send-text': async (body) => ({
          ok: true,
          result: await Bot.sendText(body)
        }),
        '/api/bot/schedule-check': async (body) => {
          const hoursBefore = Number(body.hoursBefore != null ? body.hoursBefore : 36);
          const windowHours = Number(body.windowHours != null ? body.windowHours : 6);
          const trainings = Array.isArray(body.trainings) ? body.trainings : [];
          const sent = [];
          const skipped = [];
          for (const t of trainings) {
            if (!t || !t.id || t.status === 'cancelled' || t.status === 'draft') {
              skipped.push({ id: t && t.id, reason: 'invalid' });
              continue;
            }
            const h = hoursUntil(t.date, t.time);
            if (h == null) {
              skipped.push({ id: t.id, reason: 'bad_date' });
              continue;
            }
            const lo = hoursBefore - windowHours / 2;
            const hi = hoursBefore + windowHours / 2;
            if (h < lo || h > hi) {
              skipped.push({ id: t.id, reason: 'out_of_window', hoursUntil: Math.round(h * 10) / 10 });
              continue;
            }
            if (pollSent.has(String(t.id))) {
              skipped.push({ id: t.id, reason: 'already_sent', at: pollSent.get(String(t.id)) });
              continue;
            }
            const result = await Bot.sendAttendancePoll({
              chatId: body.chatId,
              training: t,
              hoursBefore
            });
            pollSent.set(String(t.id), new Date().toISOString());
            sent.push({ id: t.id, result });
          }
          return { ok: true, sent, skipped, hoursBefore };
        }
      };

      if (req.method === 'POST' && botPost[url.pathname]) {
        if (!requireBotSecret(req, res)) return;
        if (!Bot.hasToken()) {
          send(res, 503, { ok: false, error: 'server_misconfigured', message: 'TELEGRAM_BOT_TOKEN not set' }, req);
          return;
        }
        let body = {};
        try {
          body = parseJson(await readBody(req));
        } catch (e) {
          send(res, e.message === 'body_too_large' ? 413 : 400, { ok: false, error: e.message || 'invalid_json' }, req);
          return;
        }
        try {
          const out = await botPost[url.pathname](body);
          send(res, 200, out, req);
        } catch (e) {
          console.error('[bot]', url.pathname, e.message);
          send(res, 502, { ok: false, error: e.code || 'tg_error', message: e.message, detail: e.payload || null }, req);
        }
        return;
      }

      send(res, 404, { ok: false, error: 'not_found' }, req);
    } catch (e) {
      console.error('[server]', e);
      send(res, 500, { ok: false, error: 'internal' }, req);
    }
  };
}

export function getStatus() {
  const club = readClub();
  return {
    ...state,
    hasToken: Bot.hasToken(),
    hasClubSecret: !!CLUB_SECRET(),
    hasBotSecret: !!BOT_SECRET(),
    club: {
      updatedAt: club.updatedAt,
      updatedBy: club.updatedBy,
      hasPayload: !!club.payload,
      playerCount: club.payload && Array.isArray(club.payload.players) ? club.payload.players.length : 0
    },
    dataFile: process.env.CLUB_DATA_FILE || path.join(__dirname, 'data', 'club-data.json')
  };
}

export function importClubFile(raw) {
  let data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object') throw new Error('invalid_json');
  let updatedAt;
  let updatedBy = 'windows-app';
  let payload;
  if (data.payload && typeof data.payload === 'object') {
    payload = data.payload;
    updatedAt = data.updatedAt || payload.updatedAt || payload.exportedAt || new Date().toISOString();
    updatedBy = data.updatedBy || updatedBy;
  } else if (data.players || data.trainings || data.schemaVersion || data.settings) {
    payload = data;
    updatedAt = data.updatedAt || data.exportedAt || new Date().toISOString();
  } else {
    throw new Error('unrecognized_club_json');
  }
  return writeClub({ updatedAt, updatedBy, payload });
}

export function exportClubFile() {
  const club = readClub();
  if (!club.payload) return null;
  return {
    updatedAt: club.updatedAt,
    updatedBy: club.updatedBy,
    payload: club.payload
  };
}

export function assertSafeListen(host) {
  const lan = !isLoopbackBind(host);
  if (lan && !CLUB_SECRET() && !BOT_TOKEN()) {
    const err = new Error(
      'LAN bind (HOST=' + host + ') requires CLUB_WRITE_SECRET or TELEGRAM_BOT_TOKEN. Use HOST=127.0.0.1 for local-only.'
    );
    err.code = 'lan_secret_required';
    throw err;
  }
  if (lan && !BOT_SECRET() && Bot.hasToken()) {
    // Bot API on LAN without shared secret is the ASR issue pattern — block it.
    const err = new Error(
      'LAN bind with Telegram bot requires BOT_API_SECRET so /api/bot/* is not open.'
    );
    err.code = 'lan_bot_secret_required';
    throw err;
  }
  return lan;
}

export function startServer(opts = {}) {
  if (server) return Promise.resolve(getStatus());
  const port = Number(opts.port || process.env.PORT || 8787);
  const host = opts.host || process.env.HOST || '127.0.0.1';
  const lan = assertSafeListen(host);
  process.env.PORT = String(port);
  process.env.HOST = host;
  if (!process.env.CLUB_DATA_FILE) {
    process.env.CLUB_DATA_FILE = path.join(__dirname, 'data', 'club-data.json');
  }
  fs.mkdirSync(path.dirname(process.env.CLUB_DATA_FILE), { recursive: true });

  return new Promise((resolve, reject) => {
    server = http.createServer(createHandler());
    server.once('error', (err) => {
      state.lastError = err.message || String(err);
      state.running = false;
      server = null;
      reject(err);
    });
    server.listen(port, host, () => {
      state.running = true;
      state.port = port;
      state.host = host;
      state.lanMode = lan;
      state.hasClubSecret = !!CLUB_SECRET();
      state.url = `http://127.0.0.1:${port}`;
      state.startedAt = new Date().toISOString();
      state.lastError = null;
      console.info(
        `[stgmetal-windows] ${state.url} bind=${host} lan=${lan} club=${process.env.CLUB_DATA_FILE}`
      );
      resolve(getStatus());
    });
  });
}

export function stopServer() {
  return new Promise((resolve) => {
    if (!server) {
      state.running = false;
      resolve(getStatus());
      return;
    }
    server.close(() => {
      server = null;
      state.running = false;
      state.startedAt = null;
      resolve(getStatus());
    });
  });
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  startServer().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
