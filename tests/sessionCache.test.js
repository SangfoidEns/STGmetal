import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function boot() {
  const store = new Map();
  const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) {
        if (context.localStorage.failOnce) {
          context.localStorage.failOnce = false;
          throw new Error('quota');
        }
        store.set(key, String(value));
      },
      removeItem(key) { store.delete(key); }
    },
    Toast: { show() {} },
    Store: {
      get() { return { settings: {}, players: [], trainings: [], updatedAt: '2026-11-06T12:00:00.000Z' }; },
      set() {},
      reset() {},
      _default() { return { settings: {}, players: [], trainings: [] }; }
    },
    window: {},
    document: {
      visibilityState: 'visible',
      addEventListener() {},
      getElementById() { return null; }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/core/utils.js', import.meta.url), 'utf8'), context, { filename: 'utils.js' });
  vm.runInContext(readFileSync(new URL('../src/core/storage.js', import.meta.url), 'utf8') + '\nthis.StorageManager = StorageManager;\nthis.STORAGE_KEY = STORAGE_KEY;', context, { filename: 'storage.js' });
  context.StorageManager._staticClubOnly = () => true;
  return context;
}

describe('telegram session cache', () => {
  it('keeps a saved session and does not reload club.json over it', async () => {
    const ctx = boot();
    ctx.localStorage.setItem(ctx.STORAGE_KEY, JSON.stringify({
      schemaVersion: 2,
      players: [{ id: 'local-player' }],
      trainings: [{ id: 'local-training', name: 'Тренування 12' }]
    }));
    let fetched = 0;
    ctx.StorageManager.fetchClub = async () => { fetched++; return { updatedAt: '2026-10-30T00:00:00.000Z', payload: { players: [] } }; };
    let applied = 0;
    ctx.StorageManager.applyClubPayload = () => { applied++; return true; };
    await ctx.StorageManager.bootstrapClubSync();
    await ctx.StorageManager.pullClub();
    assert.equal(ctx.StorageManager._sessionIsCached(), true);
    assert.equal(fetched, 0);
    assert.equal(applied, 0);
  });

  it('does not load a club file from the site when the phone has no session', async () => {
    const ctx = boot();
    let fetched = 0;
    let applied = 0;
    ctx.StorageManager.fetchClub = async () => { fetched++; return { updatedAt: '2026-10-30T21:34:29.990Z', payload: { players: [{ id: 'file-player' }] } }; };
    ctx.StorageManager.applyClubPayload = () => { applied++; return true; };
    await ctx.StorageManager.bootstrapClubSync();
    await ctx.StorageManager.pullClub();
    assert.equal(fetched, 0);
    assert.equal(applied, 0);
    assert.equal(ctx.StorageManager._clubSyncText.indexOf('JSON') >= 0, true);
  });

  it('still saves the session when embedded photos do not fit', () => {
    const ctx = boot();
    ctx.localStorage.failOnce = true;
    const ok = ctx.StorageManager._writeLocalPayload({
      schemaVersion: 2,
      players: [{ id: 'p1', photoUrl: 'data:image/jpeg;base64,AAAA', firstName: 'Ілля' }],
      trainings: [{ id: 't1', name: 'Тренування 9' }],
      settings: { coachPhoto: 'data:image/png;base64,BBBB' }
    });
    assert.equal(ok, true);
    const saved = JSON.parse(ctx.localStorage.getItem(ctx.STORAGE_KEY));
    assert.equal(saved.players[0].firstName, 'Ілля');
    assert.equal(saved.players[0].photoUrl, '');
    assert.equal(saved.trainings[0].name, 'Тренування 9');
    assert.equal(saved.settings.coachPhoto, '');
  });
});
