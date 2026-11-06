import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('calendar weekday letters', () => {
  it('labels Monday through Sunday from the start of the alphabet', () => {
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
    assert.match(html, /title="Понеділок">А</);
    assert.match(html, /title="Вівторок">Б</);
    assert.match(html, /title="Середа">В</);
    assert.match(html, /title="Четвер">Г</);
    assert.match(html, /title="П'ятниця">Ґ</);
    assert.match(html, /title="Субота">Д</);
    assert.match(html, /title="Неділя">Е</);
    assert.equal(html.includes('>Пн<'), false);
    assert.equal(context.Views.APP_BUILD, 'z52');
  });
});
