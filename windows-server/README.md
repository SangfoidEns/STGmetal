# STGmetal — Windows desktop server

Local **Windows app** (Electron window) that runs the HTTP companion for
[`SangfoidEns/STGmetal`](https://github.com/SangfoidEns/STGmetal).

Light Ukrainian UI: **Старт / Стоп**, статус, URL, порт, завантаження/збереження JSON клубу.

## Why Electron (not a browser panel)

STGmetal already speaks Node HTTP (`/api/club-data` on port **8787**). This app wraps that API in a real desktop window so the coach can start/stop the server and manage the club JSON without opening a browser tab.

## Requirements

- Windows 10/11
- [Node.js 18+](https://nodejs.org/)

## Run

```bat
cd windows-server
npm install
start.bat
```

Or:

```powershell
cd windows-server
npm install
npm start
```

Headless API only (no window):

```bat
npm run server-only
```

- **Default URL:** http://127.0.0.1:8787  
- **Default bind:** `127.0.0.1` (loopback only)

## Connect STGmetal

In the STGmetal Mini App / browser session:

```js
window.METALIST_API = 'http://127.0.0.1:8787'
```

Then reload. Club sync uses `GET/POST /api/club-data` (coach full write, player chat/self profile).

## Club JSON transfer

| Path | Who |
|------|-----|
| App buttons **Завантажити / Зберегти JSON** | Local desktop (file dialogs via Electron) |
| `GET /api/club-data` | Any STGmetal client with `METALIST_API` |
| `POST /api/club-data` | Coach (full) / player (chat + own profile) per STGmetal rules |

Stored file: `windows-server/data/club-data.json`.

## Security defaults

| Setting | Default | Notes |
|---------|---------|--------|
| `HOST` | `127.0.0.1` | Not `0.0.0.0` |
| `CORS_ORIGIN` | loopback Origin only | Never defaults to `*` |
| LAN bind (`0.0.0.0`) | **blocked** unless `CLUB_WRITE_SECRET` or `TELEGRAM_BOT_TOKEN` | Bot on LAN also needs `BOT_API_SECRET` |
| Club POST | STGmetal `clubWriteAllowed` | `X-Club-Key` / Telegram `initData` / open only on loopback without secrets |

Optional `.env` (same names as STGmetal):

```
PORT=8787
HOST=127.0.0.1
CLUB_WRITE_SECRET=
TELEGRAM_BOT_TOKEN=
BOT_API_SECRET=
CORS_ORIGIN=http://127.0.0.1:43127
```

## Protocol (STGmetal)

| Method | Path |
|--------|------|
| GET | `/health` |
| GET/POST | `/api/club-data` |
| POST | `/api/telegram/validate` |
| GET/POST | `/api/bot/*` |

## Layout

```
windows-server/
  electron-main.cjs   # desktop window
  preload.cjs
  server.mjs          # STGmetal-compatible HTTP API
  lib/                # clubData, telegramBot, validateInitData (from STGmetal)
  ui/                 # light window UI
  start.bat
  data/               # club-data.json
```
