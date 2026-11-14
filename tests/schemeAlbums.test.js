import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function boot(initial) {
  const store = new Map();
  let state = initial;
  const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); }
    },
    Toast: { show() {} },
    ErrorManager: { log() {} },
    Store: {
      get() { return state; },
      set(next) { state = next; },
      reset() {},
      _default() {
        return {
          settings: {},
          players: [],
          trainings: [],
          exercises: [],
          boards: [],
          schemeAlbums: [],
          calendar: [],
          matches: [],
          diary: [],
          myExercises: [],
          animations: [],
          gifts: [],
          moments: [],
          chat: [],
          feed: [],
          feedMeta: {},
          activeBoard: { objects: [], fieldView: 'full' }
        };
      }
    },
    window: {},
    document: { visibilityState: 'visible', addEventListener() {}, getElementById() { return null; } }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/core/utils.js', import.meta.url), 'utf8'), context, { filename: 'utils.js' });
  vm.runInContext(readFileSync(new URL('../src/core/storage.js', import.meta.url), 'utf8') + '\nthis.StorageManager = StorageManager;\nthis.STORAGE_KEY = STORAGE_KEY;', context, { filename: 'storage.js' });
  context.StorageManager._staticClubOnly = () => true;
  context._state = () => state;
  return context;
}

const album = { id: 'zones', name: 'Зони', boardIds: ['sch-1'], createdAt: '2026-11-14T12:00:00.000Z', updatedAt: '2026-11-14T12:00:00.000Z' };

describe('scheme albums in the club file', () => {
  it('writes albums into the saved session and the Johnson export', () => {
    const ctx = boot({
      updatedAt: '2026-11-14T12:00:00.000Z',
      settings: { clubName: 'МЕТАЛІСТ ШТУТТГАРТ' },
      players: [],
      trainings: [{ id: 't1', name: 'Тактика', schemeAlbumId: 'zones' }],
      exercises: [],
      boards: [{ id: 'sch-1', name: 'Всі зони відповідальності' }],
      schemeAlbums: [album],
      calendar: [],
      matches: [{ id: 'm1', opponent: 'Кастель', schemeAlbumId: 'zones' }],
      activeBoard: { objects: [], fieldView: 'full' }
    });
    ctx.StorageManager.save({ localOnly: true });
    const saved = JSON.parse(ctx.localStorage.getItem(ctx.STORAGE_KEY));
    assert.equal(saved.schemeAlbums[0].name, 'Зони');
    assert.deepEqual(saved.schemeAlbums[0].boardIds, ['sch-1']);
    const exported = ctx.StorageManager.buildExportPayload();
    assert.equal(exported.type, 'metalist_full_migration');
    assert.equal(exported.schemeAlbums[0].id, 'zones');
    assert.equal(exported.trainings[0].schemeAlbumId, 'zones');
    assert.equal(exported.matches[0].schemeAlbumId, 'zones');
  });

  it('restores albums when the session is opened again', () => {
    const ctx = boot({
      settings: {},
      players: [],
      trainings: [],
      schemeAlbums: []
    });
    ctx.localStorage.setItem(ctx.STORAGE_KEY, JSON.stringify({
      schemaVersion: 2,
      updatedAt: '2026-11-14T12:00:00.000Z',
      settings: {},
      players: [],
      trainings: [{ id: 't1', schemeAlbumId: 'zones' }],
      schemeAlbums: [album],
      matches: [{ id: 'm1', schemeAlbumId: 'zones' }]
    }));
    assert.equal(ctx.StorageManager.load(), true);
    const next = ctx._state();
    assert.equal(next.schemeAlbums[0].name, 'Зони');
    assert.equal(next.schemeAlbums[0].boardIds[0], 'sch-1');
    assert.equal(next.trainings[0].schemeAlbumId, 'zones');
  });
});
