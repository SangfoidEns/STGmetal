# METALIST STUTTGART — Full Project Audit (2026-10-29)

## 1. Short Answer
Локальна збірка **2026.10.28-m** валідна (syntax OK, 16/16 tests).  
**GitHub Pages частково розсинхронізований**: `index.html`/`sw.js` уже **m**, але `src/ui/views.js` на Pages досі **c** → Telegram показує старий build tag.

## 2. Architecture (as-is)
```
Telegram Mini App (GitHub Pages)
    ↓
Vanilla JS SPA (app.js + views + BoardEngine)
    ↓
Store + localStorage (+ optional TG CloudStorage)
    ↓
Optional API server (node server/index.mjs) → Telegram Bot API
```

Stack: no framework, module scripts, PWA sw.js, RBAC in auth.js.

## 3. Module health

| Module | Status | Notes |
|--------|--------|-------|
| BoardEngine | OK syntax | contextmenu = select only; delete via 🗑 |
| storage / import | OK | full migration pack; dead code removed |
| coachTools / ClubBot | OK | needs public API for phone |
| i18n uk/de | Partial | ~many hardcoded UA toasts remain |
| analytics | Restored | I18n.t not shadowed |
| server bot | OK | token env-only; localhost default |
| tests | 16/16 pass | math, board coords, initData, RBAC |

## 4. Critical findings

### P0 — Deploy split-brain (ROOT of "still version c")
- Live: https://sangfoidens.github.io/STGmetal/
- `index.html?v=20261028m`, `sw.js` CACHE m
- **`views.js` still contains `build 2026.10.28-c`**
- Cause: incomplete upload OR SW/browser cached old views.js
- Fix: re-upload **entire** `src/` + `index.html` + `sw.js` + `dist/` if used; force SW update

### P0 — ClubBot from Telegram phone
- API default `http://127.0.0.1:8787` unreachable from mobile WebView
- meta `ms-auth-api` points to localhost
- Fix: public HTTPS (ngrok/VPS) + set ms_auth_api

### P1 — i18n incomplete
- ~99 hardcoded Ukrainian Toast strings in app/coachTools/BoardEngine
- DE mode mixes languages on toasts/errors

### P2 — Large monolith files
- app.js ~145KB, BoardEngine ~121KB, views ~107KB
- Maintainable for team size, but high regression risk

### P2 — Dead code
- Removed `if (false && metalist_roster_migration)` in storage

## 5. Security
- Bot token must never be in client (currently OK — server env)
- Token previously exposed in chat → revoke recommended
- CORS * on local server — OK for dev, restrict in prod

## 6. Verification performed
- node --check on core modules: OK
- node --test: 16 pass, 0 fail
- Live site curl: partial m/c mismatch confirmed

## 7. Success criteria for "fully verified deploy"
1. Live views.js contains `build 2026.10.28-m`
2. Telegram shows same tag after hard reopen
3. ClubBot works only when API is public HTTPS
4. Import full migration JSON works on device
5. Board long-press does not delete chips

## 8. Recommended next actions (ordered)
1. Full re-deploy of local **m** build to GitHub
2. Confirm live views.js tag = m
3. Public bot API if needed from phone
4. Continue i18n pass for remaining toasts (part-by-part)
