import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function load(filename, context, name) {
  const src = readFileSync(new URL('../' + filename, import.meta.url), 'utf8');
  vm.runInContext(src + (name ? ('\nthis.' + name + ' = ' + name + ';') : ''), context, { filename: filename });
}

function club() {
  return {
    settings: { clubName: 'МЕТАЛІСТ ШТУТТГАРТ', clubShort: 'МШ' },
    players: [
      { id: 'p1', firstName: 'Олег', lastName: 'Коваль', number: 8 },
      { id: 'p2', firstName: 'Іван', lastName: 'Мельник', number: 9 }
    ],
    matches: [{
      id: 'm1',
      date: '2026-11-14',
      time: '15:00',
      opponent: 'FC Freunde',
      competition: 'Кубок',
      status: 'played',
      minutes: 90,
      scoreUs: 2,
      scoreThem: 1,
      xi: ['p1'],
      bench: [],
      postNotes: 'Тримай ширину до останньої хвилини.',
      plan: 'Граємо низько.',
      attendance: {
        p1: { present: true, rating: 8, minutes: 20, goals: 1, yellow: 1, red: 0 }
      }
    }],
    tournaments: [{
      id: 'cup',
      name: 'Кубок',
      groups: [{ id: 'g', name: 'Група A', teams: ['Металіст Штуттгарт', 'FC Freunde'] }],
      bracket: [{ id: 'tie', round: '1/2', home: 'Металіст Штуттгарт', away: 'FC Freunde', scoreHome: 2, scoreAway: 1, matchId: 'm1' }]
    }],
    ui: {}
  };
}

function boot(state, auth) {
  const context = {
    console, setTimeout, clearTimeout,
    sanitize(v) { return String(v == null ? '' : v); },
    today() { return '2026-11-16'; },
    Store: { get() { return state; } },
    AuthManager: auth
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  load('src/core/loadModel.js', context, 'LoadModel');
  load('src/ui/views.js', context, 'Views');
  return context;
}

describe('player match hub', () => {
  it('shows one player his minutes, load, goals, cards and the coach text', () => {
    const ctx = boot(club(), {
      isPlayer() { return true; },
      isCoach() { return false; },
      isGuest() { return false; },
      getLinkedPlayer() { return club().players[0]; }
    });
    const html = ctx.Views._matchHub({ role: 'player' });
    assert.match(html, /Матчі гравця/);
    assert.match(html, /Олег Коваль/);
    assert.match(html, /FC Freunde/);
    assert.match(html, />20</);
    assert.match(html, />1</);
    assert.match(html, /Тримай ширину до останньої хвилини/);
    assert.match(html, /Граємо низько/);
    assert.match(html, /Склад/);
    assert.match(html, /Іван Мельник/);
    assert.equal(html.includes('data-action="new-tournament"'), false);
    assert.equal(html.includes('pm-buckets'), false);
  });

  it('lists the linked player and switches to another player from the rail', () => {
    const state = club();
    state.matches.push({
      id: 'm2',
      date: '2026-11-22',
      time: '18:00',
      opponent: 'FC Slop',
      competition: '',
      status: 'planned',
      xi: ['p2'],
      bench: [],
      attendance: {}
    });
    const ctx = boot(state, {
      isPlayer() { return true; },
      isCoach() { return false; },
      isGuest() { return false; },
      getLinkedPlayer() { return state.players[0]; }
    });
    const all = ctx.Views._matchHub({ role: 'player' });
    assert.match(all, /FC Freunde/);
    assert.equal(all.includes('FC Slop'), false);
    assert.match(all, /data-action="match-focus-player"/);
    state.ui.matchFocusId = 'p2';
    const other = ctx.Views._matchHub({ role: 'player' });
    assert.match(other, /FC Slop/);
    const slop = other.indexOf('FC Slop');
    const freunde = other.indexOf('FC Freunde');
    assert.ok(slop >= 0 && (freunde < 0 || slop < freunde));
  });

  it('lets a guest read the match without the coach rating', () => {
    const ctx = boot(club(), {
      isPlayer() { return false; },
      isCoach() { return false; },
      isGuest() { return true; },
      getLinkedPlayer() { return null; }
    });
    const html = ctx.Views._matchHub({ role: 'guest' });
    assert.match(html, /FC Freunde/);
    assert.match(html, /Тримай ширину/);
    assert.equal(html.includes('<small>оцінка</small>'), false);
    assert.match(html, /Іван Мельник/);
  });

  it('keeps a tournament bracket when a newer Johnson file left it empty', () => {
    const context = { console };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    load('src/core/clubMerge.js', context);
    const older = {
      tournaments: [{
        id: 'cup', name: 'Кубок', updatedAt: '2026-11-16T10:00:00.000Z',
        groups: [{ name: 'A', teams: ['Ми'] }],
        bracket: [{ round: '1/2', home: 'Ми', away: 'Вони', scoreHome: 2, scoreAway: 0 }]
      }]
    };
    const newer = {
      tournaments: [{
        id: 'cup', name: 'Кубок', updatedAt: '2026-11-16T18:00:00.000Z',
        groups: [], bracket: []
      }]
    };
    const merged = context.ClubMerge.mergePayload(older, newer);
    assert.equal(merged.tournaments.length, 1);
    assert.equal(merged.tournaments[0].groups.length, 1);
    assert.equal(merged.tournaments[0].bracket[0].round, '1/2');
  });
});
