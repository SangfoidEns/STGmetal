/**
 * STGmetal Windows desktop companion — Electron shell.
 * Simple window UI; HTTP API matches SangfoidEns/STGmetal.
 */
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let api = null;

async function loadApi() {
  if (api) return api;
  api = await import(path.join(__dirname, 'server.mjs'));
  return api;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 640,
    minWidth: 560,
    minHeight: 520,
    title: 'STGmetal — Локальний сервер',
    backgroundColor: '#f6f3ee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('server:status', async () => {
  const mod = await loadApi();
  return mod.getStatus();
});

ipcMain.handle('server:start', async (_e, opts) => {
  const mod = await loadApi();
  try {
    return { ok: true, status: await mod.startServer(opts || {}) };
  } catch (err) {
    return { ok: false, error: err.message || String(err), status: mod.getStatus() };
  }
});

ipcMain.handle('server:stop', async () => {
  const mod = await loadApi();
  return { ok: true, status: await mod.stopServer() };
});

ipcMain.handle('club:export', async () => {
  const mod = await loadApi();
  const data = mod.exportClubFile();
  if (!data) return { ok: false, error: 'empty' };
  const defaultPath = path.join(
    app.getPath('documents'),
    `metalist_stuttgart_club_${new Date().toISOString().slice(0, 10)}.json`
  );
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Зберегти JSON клубу',
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, error: 'cancelled' };
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8');
  return { ok: true, path: result.filePath, meta: { updatedAt: data.updatedAt, updatedBy: data.updatedBy } };
});

ipcMain.handle('club:import', async () => {
  const mod = await loadApi();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Завантажити JSON клубу',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return { ok: false, error: 'cancelled' };
  }
  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    const saved = mod.importClubFile(raw);
    return { ok: true, path: result.filePaths[0], meta: saved };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

app.whenReady().then(async () => {
  createWindow();
  // Auto-start on loopback so STGmetal can connect immediately
  try {
    const mod = await loadApi();
    await mod.startServer({
      port: Number(process.env.PORT || 8787),
      host: process.env.HOST || '127.0.0.1'
    });
  } catch (err) {
    console.error('[startup]', err.message || err);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  try {
    const mod = await loadApi();
    await mod.stopServer();
  } catch (_) {}
  if (process.platform !== 'darwin') app.quit();
});
