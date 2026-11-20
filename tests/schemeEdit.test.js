import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function boot(coach) {
  const store = {
    ui: {},
    players: [],
    trainings: [],
    boards: [{
      id: 'sch-1',
      name: 'Перший пас',
      type: 'тактика',
      description: 'Воротар віддає на крайнього центрального, той відкриває half-space.',
      objects: [{ type: 'player', x: 0.5, y: 0.8, number: 4 }],
      updatedAt: '2026-11-06T12:00:00.000Z'
    }],
    settings: {}
  };
  const context = {
    console,
    setTimeout,
    clearTimeout,
    sanitize(v) { return String(v == null ? '' : v); },
    today() { return '2026-11-06'; },
    Store: { get() { return store; } },
    AuthManager: {
      isCoach() { return coach; },
      isPlayer() { return !coach; }
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: { documentElement: { setAttribute() {} }, querySelectorAll() { return []; }, getElementById() { return null; } }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  const src = readFileSync(new URL('../src/ui/views.js', import.meta.url), 'utf8');
  vm.runInContext(src + '\nthis.Views = Views;', context, { filename: 'views.js' });
  return context;
}

describe('scheme cards', () => {
  it('keeps the full description and coach edit and delete on the ready list', () => {
    const ctx = boot(true);
    const shelf = ctx.Views.tactics();
    assert.match(shelf, /Архів/);
    assert.match(shelf, /Всі альбоми/);
    assert.equal(shelf.includes('data-action="edit-scheme"'), false);
    ctx.Store.get().ui.schemeArchive = true;
    const html = ctx.Views.tactics();
    assert.match(html, /Воротар віддає на крайнього центрального/);
    assert.match(html, /data-board-id="sch-1"/);
    assert.match(html, /data-action="edit-scheme"/);
    assert.match(html, /data-action="delete-scheme"/);
    assert.match(html, /ym-track/);
    assert.match(html, /ym-expand-title/);
    assert.match(html, /ym-dots/);
    assert.match(html, /ym-art/);
    assert.match(html, /Архів схем/);
    assert.equal(ctx.Views._richText('пас **в** зону'), 'пас <b>в</b> зону');
  });

  it('shows the description to a player and hides edit and delete', () => {
    const ctx = boot(false);
    ctx.Store.get().ui.schemeArchive = true;
    const html = ctx.Views.tactics();
    assert.match(html, /Воротар віддає на крайнього центрального/);
    assert.equal(html.includes('data-action="edit-scheme"'), false);
    assert.equal(html.includes('data-action="delete-scheme"'), false);
  });

  it('opens a player album inside trainings and returns to the album list', () => {
    const ctx = boot(false);
    const store = ctx.Store.get();
    store.schemeAlbums = [{ id: 'a1', name: 'Зони', boardIds: ['sch-1'], createdAt: '2026-11-14T10:00:00.000Z' }];
    store.ui.playerTrainTab = 'schemes';
    store.ui.view = 'trainings';
    const shelf = ctx.Views.trainings();
    assert.match(shelf, /data-action="player-train-tab"/);
    assert.match(shelf, /data-action="open-scheme-album"/);
    assert.match(shelf, /data-album-id="a1"/);
    assert.equal(shelf.includes('schemes-home'), false);
    store.ui.schemeAlbumId = 'a1';
    const album = ctx.Views.trainings();
    assert.match(album, /Зони/);
    assert.match(album, /Перший пас/);
    assert.match(album, /data-action="schemes-home"/);
    assert.match(album, /data-tab="trainings"/);
    assert.equal(album.includes('data-action="edit-scheme"'), false);
  });

  it('keeps albums inside a section and recommends the one this player has not opened', () => {
    const ctx = boot(false);
    ctx.AuthManager.getLinkedPlayer = () => ({ id: 'p9' });
    ctx.AuthManager.isPlayer = () => true;
    const store = ctx.Store.get();
    store.schemeAlbums = [
      { id: 'out', name: 'Аут', boardIds: ['sch-1'], createdAt: '2026-11-14T10:00:00.000Z' },
      { id: 'ball', name: 'Перший м’яч', boardIds: [], createdAt: '2026-11-14T11:00:00.000Z' }
    ];
    store.schemeSections = [{ id: 'sec', name: 'Перший товариський матч', albumIds: ['out', 'ball'] }];
    store.schemeOpens = [{ id: 'o1', who: 'p:p9', albumId: 'out', at: '2026-11-14T12:00:00.000Z' }];
    const html = ctx.Views.tactics();
    const headEnd = html.indexOf('Перший товариський матч');
    const head = html.slice(html.indexOf('Всі альбоми'), headEnd);
    assert.match(head, /Архів/);
    assert.match(head, /ym-tile-count">1</);
    assert.match(head, /data-album-id="out"/);
    assert.match(head, /data-album-id="ball"/);
    assert.ok(headEnd > html.indexOf('open-scheme-archive'));
    assert.match(html, /Аут/);
    const rec = html.split('Рекомендовані альбоми')[1] || '';
    assert.match(rec, /Перший м’яч/);
    assert.equal(rec.includes('data-album-id="out"'), false);
    store.schemeOpens = [{ id: 'o2', who: 'p:other', albumId: 'ball', at: '2026-11-14T12:00:00.000Z' }];
    const other = ctx.Views.tactics().split('Рекомендовані альбоми')[1] || '';
    assert.equal(other.includes('Перший м’яч'), false);
  });

  it('hides a coach-only scheme from a player and a guest', () => {
    const ctx = boot(false);
    const store = ctx.Store.get();
    store.boards.push({
      id: 'secret',
      name: 'Закрита пресинг',
      type: 'тактика',
      description: 'Лише для тренера',
      coachOnly: true,
      objects: []
    });
    store.schemeAlbums = [{ id: 'a1', name: 'Зони', boardIds: ['sch-1', 'secret'], createdAt: '2026-11-14T10:00:00.000Z' }];
    store.ui.schemeArchive = true;
    const archive = ctx.Views.tactics();
    assert.match(archive, /Перший пас/);
    assert.equal(archive.includes('Закрита пресинг'), false);
    store.ui.schemeArchive = false;
    store.ui.schemeAlbumId = 'a1';
    const album = ctx.Views.tactics();
    assert.match(album, /Перший пас/);
    assert.equal(album.includes('Закрита пресинг'), false);
    assert.match(album, />1 схем</);
  });
});
