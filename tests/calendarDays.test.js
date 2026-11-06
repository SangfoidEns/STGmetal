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
    assert.equal(context.Views.APP_BUILD, 'z62');
    assert.equal(context.Views.versionLetter('06.11.2026'), 'Ґ');
    assert.equal(context.Views.versionLetter('02.11.2026'), 'А');
  });
});
