import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function boot(head) {
  const store = {
    ui: {},
    settings: { clubName: 'МЕТАЛІСТ ШТУТТГАРТ', staff: { assistants: ['p2'], presidentName: 'Олег' } },
    players: [
      { id: 'p1', number: 6, firstName: 'Павло', lastName: 'Михайловський', position: 'RB', readiness: 84, load: 4, isCaptain: true, telegramUsername: 'misha' },
      { id: 'p2', number: 8, firstName: 'Тарас', lastName: 'Коновал', position: 'RB', readiness: 70, load: 3, telegramUsername: 'artem_serdyuk' },
      { id: 'p3', number: 11, firstName: 'Ігор', lastName: 'Запасний', position: 'ST', readiness: 60, load: 2 }
    ],
    trainings: [],
    gifts: [],
    boards: []
  };
  const context = {
    console,
    setTimeout,
    clearTimeout,
    sanitize(v) { return String(v == null ? '' : v); },
    today() { return '2026-11-06'; },
    Store: { get() { return store; } },
    AuthManager: {
      isCoach() { return true; },
      isPlayer() { return false; },
      _canWriteClub() { return head; }
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: { documentElement: { setAttribute() {} }, querySelectorAll() { return []; }, getElementById() { return null; } }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/ui/views.js', import.meta.url), 'utf8') + '\nthis.Views = Views;', context, { filename: 'views.js' });
  return { context, store };
}

describe('club staff and classic player card', () => {
  it('gives the FIFA card a classic club background instead of the gift pattern', () => {
    const { context } = boot(true);
    const html = context.Views._fifaCard(context.Store.get().players[0], { attPct: 100, avgRpe: 6.1, load28: 4548 });
    assert.match(html, /fifa-classic/);
    assert.equal(html.includes('player-collectible'), false);
    assert.match(html, /МЕТАЛІСТ/);
    assert.match(html, /assets\/coach-crest\.png/);
  });

  it('keeps the main crest for everyone except the head coach', () => {
    const { context } = boot(false);
    const html = context.Views._fifaCard(context.Store.get().players[0], { attPct: 80, avgRpe: 5, load28: 10 });
    assert.match(html, /assets\/metalist-crest\.png/);
    assert.equal(html.includes('coach-crest'), false);
    const squad = context.Views._coachSquadCard();
    assert.equal(squad.includes('coach-crest'), false);
    assert.match(squad, /pl-card-av coach-av/);
    const headSquad = boot(true).context.Views._coachSquadCard();
    assert.equal(headSquad.includes('coach-crest'), false);
  });

  it('lets the head coach assign assistants, the president and the captain', () => {
    const { context } = boot(true);
    const html = context.Views.settings();
    assert.match(html, /assets\/coach-crest\.png/);
    assert.match(html, /data-action="staff-add"/);
    assert.match(html, /Помічники/);
    assert.match(html, /Президент/);
    assert.match(html, /Капітан/);
    assert.match(html, /Коновал/);
    assert.match(html, /Михайловський/);
    assert.equal(html.includes('Запасний'), false);
    assert.equal(html.includes('data-assistant'), false);
    assert.match(html, /setPresidentName/);
  });

  it('shows the staff to everyone else without the appointment controls', () => {
    const { context } = boot(false);
    const html = context.Views.settings();
    assert.match(html, /Капітан:/);
    assert.equal(html.includes('data-assistant'), false);
    assert.equal(html.includes('coach-crest'), false);
  });

  it('puts the player stats on the coach sheet helper', () => {
    const { context } = boot(true);
    const html = context.Views.playerMiniStats(context.Store.get().players[0]);
    assert.match(html, /Готовність/);
    assert.match(html, /84%/);
    assert.match(html, /Відвідування/);
    assert.match(html, /Load/);
  });
});
