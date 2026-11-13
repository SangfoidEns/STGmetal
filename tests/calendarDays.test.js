import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('calendar weekday letters', () => {
  it('keeps weekday names on the calendar and puts the alphabet letter on the version', () => {
    const context = {
      console,
      setTimeout,
      clearTimeout,
      sanitize(v) { return String(v == null ? '' : v); },
      today() { return '2026-11-06'; },
      Store: { get() { return { ui: { calDate: '2026-11-06' }, trainings: [], calendar: [], matches: [], players: [], gifts: [], settings: {} }; } },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      document: { documentElement: { setAttribute() {} }, querySelectorAll() { return []; }, getElementById() { return null; } }
    };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    const src = readFileSync(new URL('../src/ui/views.js', import.meta.url), 'utf8');
    vm.runInContext(src + '\nthis.Views = Views;', context, { filename: 'views.js' });
    const html = context.Views.calendar();
    assert.match(html, /title="Понеділок">Пн</);
    assert.match(html, /title="Вівторок">Вт</);
    assert.match(html, /title="Середа">Ср</);
    assert.match(html, /title="Четвер">Чт</);
    assert.match(html, /title="П'ятниця">Пт</);
    assert.match(html, /title="Субота">Сб</);
    assert.match(html, /title="Неділя">Нд</);
    assert.equal(html.includes('>А<'), false);
    assert.equal(context.Views.APP_BUILD, 'z83');
    assert.equal(context.Views.versionLetter('07.11.2026'), 'Д');
    assert.equal(context.Views.versionLetter('06.11.2026'), 'Ґ');
    assert.equal(context.Views.versionLetter('02.11.2026'), 'А');
  });

  it('puts a birthday on its day and shows a cancelled draft to a player', () => {
    const store = {
      ui: { calDate: '2026-07-01', selectedDay: '2026-07-25' },
      settings: {},
      players: [{ id: 'p1', firstName: 'Artem', lastName: 'Serdiuk', birthDate: '1989-07-25', number: 25 }],
      trainings: [
        { id: 'c3', name: 'Тренування 03/11', date: '2026-11-03', status: 'cancelled', cancelledAt: '2026-11-06T22:43:32.162Z' },
        { id: 'd10', name: 'Тренування 10/11', date: '2026-11-10', status: 'draft', cancelledAt: '2026-10-29T14:06:47.413Z' },
        { id: 'held', name: 'Тренування 5/11', date: '2026-11-05', status: 'done', cancelledAt: '2026-10-22T14:02:28.376Z' }
      ],
      gifts: [], boards: [], calendar: [], matches: [], chat: []
    };
    const context = {
      console, setTimeout, clearTimeout,
      sanitize(v) { return String(v == null ? '' : v); },
      today() { return '2026-11-07'; },
      Store: { get() { return store; } },
      AuthManager: {
        isCoach() { return false; },
        isPlayer() { return true; },
        isGuest() { return false; },
        getLinkedPlayer() { return store.players[0]; }
      },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      document: { documentElement: { setAttribute() {} }, querySelectorAll() { return []; }, getElementById() { return null; } }
    };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(readFileSync(new URL('../src/ui/views.js', import.meta.url), 'utf8') + '\nthis.Views = Views;', context, { filename: 'views.js' });
    const july = context.Views.calendar();
    assert.match(july, /Artem Serdiuk/);
    assert.match(july, /data-player-id="p1"/);
    assert.match(july, /cal-dot-bday/);
    assert.match(july, /37 р\./);
    store.ui.calDate = '2026-11-01';
    store.ui.selectedDay = '2026-11-03';
    const november = context.Views.calendar();
    assert.match(november, /Тренування 03\/11/);
    assert.match(november, /скасовано, не пропуск/);
    assert.equal(november.includes('Artem Serdiuk'), false);
    const list = context.Views.trainings();
    assert.match(list, /Тренування 03\/11/);
    assert.match(list, /Скасовано · не пропуск/);
    assert.equal(list.includes('Тренування 10/11'), false);
    assert.equal(context.Views._trainingCancelled(store.trainings[1]), false);
    const heldAt = list.indexOf('Тренування 5/11');
    const heldBadge = list.slice(heldAt, heldAt + 180);
    assert.match(heldBadge, /Проведено/);
    assert.equal(heldBadge.includes('Скасовано'), false);
    context.Views.syncBirthdays();
    assert.equal(store.calendar.length, 1);
    assert.equal(store.calendar[0].type, 'birthday');
    assert.equal(store.calendar[0].date, '1989-07-25');
  });
});
