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

  it('shows six latest albums in a sideways row and the rest after the section opens', () => {
    const ctx = boot(true);
    const store = ctx.Store.get();
    store.schemeAlbums = [1, 2, 3, 4, 5, 6, 7].map(n => ({
      id: 'a' + n,
      name: 'Альбом ' + n,
      boardIds: [],
      createdAt: '2026-11-' + String(10 + n).padStart(2, '0') + 'T10:00:00.000Z'
    }));
    store.schemeSections = [{ id: 'sec', name: 'Турнір', albumIds: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'] }];
    const html = ctx.Views.tactics();
    const all = html.slice(html.indexOf('Всі альбоми'), html.indexOf('Турнір'));
    assert.match(all, /data-album-id="a7"/);
    assert.equal(all.includes('data-album-id="a1"'), false);
    assert.match(all, /data-shelf="all"/);
    assert.match(all, /Ще 1/);
    const section = html.slice(html.indexOf('Турнір'), html.indexOf('Рекомендовані'));
    assert.equal(section.includes('data-album-id="a1"'), false);
    assert.match(section, /data-shelf="sec"/);
    store.ui.schemeShelves = { all: true, sec: true };
    const open = ctx.Views.tactics();
    assert.match(open, /data-album-id="a1"/);
    assert.match(open, /Згорнути/);
  });

  it('puts the most opened album into the first six', () => {
    const ctx = boot(true);
    const store = ctx.Store.get();
    store.schemeAlbums = [1, 2, 3, 4, 5, 6, 7].map(n => ({
      id: 'a' + n,
      name: 'Альбом ' + n,
      boardIds: [],
      createdAt: '2026-11-' + String(10 + n).padStart(2, '0') + 'T10:00:00.000Z'
    }));
    store.schemeSections = [{ id: 'sec', name: 'Турнір', albumIds: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'] }];
    store.schemeOpens = [1, 2, 3, 4].map(n => ({ id: 'o' + n, albumId: 'a1', at: n }));
    const html = ctx.Views.tactics();
    const all = html.slice(html.indexOf('Всі альбоми'), html.indexOf('Турнір'));
    assert.match(all, /data-album-id="a1"/);
    assert.equal(all.includes('data-album-id="a2"'), false);
    const section = html.slice(html.indexOf('Турнір'), html.indexOf('Рекомендовані'));
    assert.match(section, /data-album-id="a1"/);
  });

  it('lists the chosen player from the next match down and folds the squad', () => {
    const ctx = boot(false);
    const store = ctx.Store.get();
    store.players = [
      { id: 'p1', firstName: 'Єгор', lastName: 'Коваленко', status: 'injured' },
      { id: 'p2', firstName: 'Іван', lastName: 'Петренко' }
    ];
    store.matches = [
      { id: 'old', date: '2026-11-01', opponent: 'Старий', xi: ['p1'], bench: [], attendance: { p1: { present: true, yellow: 1 } }, subs: [{ minute: 60, offId: 'p1', onId: 'p2' }] },
      { id: 'soon', date: '2026-11-25', opponent: 'Найближчий', xi: ['p2'], bench: ['p1'] },
      { id: 'later', date: '2026-12-01', opponent: 'Далекий', xi: ['p1'] }
    ];
    store.ui.playerTrainTab = 'matches';
    const html = ctx.Views.trainings();
    assert.match(html, /data-action="match-focus-player"/);
    assert.equal(html.includes('pm-buckets'), false);
    const soon = html.indexOf('Найближчий');
    const later = html.indexOf('Далекий');
    const old = html.indexOf('Старий');
    assert.ok(soon >= 0 && soon < later && later < old);
    assert.match(html, /Склад/);
    assert.match(html, /Заміни/);
    assert.match(html, /Картки/);
    assert.match(html, /Травми/);
    assert.match(html, /pm-fold/);
  });

  it('hides a coach-only album from a player', () => {
    const ctx = boot(false);
    const store = ctx.Store.get();
    store.schemeAlbums = [
      { id: 'open', name: 'Відкритий', boardIds: [], createdAt: '2026-11-14T10:00:00.000Z' },
      { id: 'shut', name: 'Закритий альбом', coachOnly: true, boardIds: [], createdAt: '2026-11-14T11:00:00.000Z' }
    ];
    const html = ctx.Views.tactics();
    assert.match(html, /Відкритий/);
    assert.equal(html.includes('Закритий альбом'), false);
    store.ui.schemeAlbumId = 'shut';
    assert.equal(ctx.Views.tactics().includes('Закритий альбом'), false);
  });

  it('puts the club feed on the calendar and the public chat on the team', () => {
    const ctx = boot(true);
    const store = ctx.Store.get();
    store.players = [{ id: 'p9', firstName: 'Єгор', lastName: 'Коваленко', position: 'ST', profilePhoto: 'https://example.com/yehor.jpg' }];
    store.feed = [{ id: 'n1', kind: 'gift', title: 'Кубок', text: 'Єгору', playerId: 'p9', createdAt: '2026-11-20T10:00:00.000Z' }];
    store.chat = [
      { id: 'c1', text: 'Збір о 18:00', authorName: 'Тренер', authorRole: 'coach', createdAt: '2026-11-20T10:00:00.000Z' },
      { id: 'c2', text: 'Я буду', authorName: 'Єгор Коваленко', authorRole: 'player', playerId: 'p9', createdAt: '2026-11-20T10:01:00.000Z' }
    ];
    const cal = ctx.Views.calendar();
    assert.match(cal, /Стрічка клубу/);
    assert.match(cal, /Кубок/);
    assert.match(cal, /club-feed-face/);
    assert.match(cal, /Єгор Коваленко/);
    assert.match(cal, /yehor\.jpg/);
    assert.match(cal, /Зараз у клубі/);
    assert.equal(cal.includes('teamChatInput'), false);
    const chat = ctx.Views._teamChat();
    assert.match(chat, /Чат команди/);
    assert.match(chat, /Збір о 18:00/);
    assert.match(chat, /teamChatInput/);
    assert.match(chat, /team-chat-face/);
    assert.match(chat, /--acc-ring:#e74c3c/);
    assert.equal(chat.includes('Стрічка клубу'), false);
  });

  it('opens calendar and statistics inside the player training section', () => {
    const ctx = boot(false);
    const html = ctx.Views.trainings();
    assert.match(html, /data-tab="trainings"/);
    assert.match(html, /data-tab="matches"/);
    assert.match(html, /data-tab="schemes"/);
    assert.match(html, /data-tab="calendar"/);
    assert.match(html, /data-tab="stats"/);
    ctx.Store.get().ui.playerTrainTab = 'calendar';
    const cal = ctx.Views.trainings();
    assert.match(cal, /Стрічка клубу/);
    assert.match(cal, /class="pt-tab on"[^>]*data-tab="calendar"|data-tab="calendar"[^>]*class="pt-tab on"/);
    ctx.Store.get().ui.playerTrainTab = 'stats';
    const stats = ctx.Views.trainings();
    assert.match(stats, /Статистика/);
    assert.match(stats, /data-tab="stats"/);
  });
});
