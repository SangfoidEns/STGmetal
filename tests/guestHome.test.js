import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function loadViews(auth, store) {
  const context = {
    console, setTimeout, clearTimeout,
    sanitize(v) { return String(v == null ? '' : v); },
    today() { return '2026-11-24'; },
    Store: { get() { return store; } },
    AuthManager: auth,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: { documentElement: { setAttribute() {} }, querySelectorAll() { return []; }, getElementById() { return null; } }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/ui/views.js', import.meta.url), 'utf8') + '\nthis.Views = Views;', context, { filename: 'views.js' });
  return context.Views;
}

const store = {
  ui: {},
  settings: {
    clubName: 'Металіст Штуттгарт',
    moments: [{ id: 'mom1', kind: 'video', src: 'https://cdn.example/goal.mp4', title: 'Гол', duration: 8 }]
  },
  players: [{ id: 'p1', firstName: 'Mykyta', lastName: 'Shepetko', number: 4, position: 'AM' }],
  trainings: [], gifts: [], boards: [], calendar: [], matches: [], chat: []
};

describe('guest home', () => {
  it('shows moments and hides player editing from a guest', () => {
    const guest = {
      isCoach() { return false; },
      isPlayer() { return false; },
      isGuest() { return true; },
      isAssistant() { return false; },
      _canWriteClub() { return false; }
    };
    const views = loadViews(guest, store);
    const home = views.dashboard();
    assert.match(home, /Останні моменти/);
    assert.match(home, /club-public/);
    assert.match(home, /<video /);
    assert.match(home, /fitMoment/);
    assert.match(home, /Гол/);
    assert.equal(views.playerSheetButtons(store.players[0]), '');
    const player = loadViews({
      isCoach() { return false; },
      isPlayer() { return true; },
      isGuest() { return false; },
      isAssistant() { return false; },
      _canWriteClub() { return false; }
    }, store);
    assert.equal(player.playerSheetButtons(store.players[0]), '');
    const settings = views.settings();
    assert.match(settings, /Останні моменти/);
    assert.equal(settings.includes('id="momentFile"'), false);
    assert.equal(settings.includes('server-rebuild'), false);
  });

  it('lets the coach add a photo, gif or short video', () => {
    const coach = {
      isCoach() { return true; },
      isPlayer() { return false; },
      isGuest() { return false; },
      isAssistant() { return false; },
      _canWriteClub() { return true; }
    };
    const views = loadViews(coach, store);
    const buttons = views.playerSheetButtons(store.players[0]);
    assert.match(buttons, /Редагувати/);
    assert.match(buttons, /data-psheet="edit"/);
    const settings = views.settings();
    assert.match(settings, /id="momentFile"/);
    assert.match(settings, /data-action="server-rebuild"/);
    assert.match(settings, /відео до 20 секунд/i);
    assert.match(settings, /Прибрати/);
  });
});
