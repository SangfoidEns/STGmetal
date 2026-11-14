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
    const html = ctx.Views.tactics();
    assert.match(html, /Воротар віддає на крайнього центрального/);
    assert.match(html, /data-board-id="sch-1"/);
    assert.match(html, /data-action="edit-scheme"/);
    assert.match(html, /data-action="delete-scheme"/);
    assert.match(html, /ym-track/);
    assert.match(html, /ym-expand/);
    assert.match(html, /Альбоми/);
  });

  it('shows the description to a player and hides edit and delete', () => {
    const ctx = boot(false);
    const html = ctx.Views.tactics();
    assert.match(html, /Воротар віддає на крайнього центрального/);
    assert.equal(html.includes('data-action="edit-scheme"'), false);
    assert.equal(html.includes('data-action="delete-scheme"'), false);
  });
});
