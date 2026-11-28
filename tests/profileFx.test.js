import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function el() {
  const node = {
    className: '',
    children: [],
    classList: {
      _s: new Set(),
      add(name) { this._s.add(name); },
      remove(name) { this._s.delete(name); },
      contains(name) { return this._s.has(name); }
    },
    setAttribute() {},
    get offsetWidth() { return 10; },
    querySelector(sel) {
      if (sel === '.pf3-stage') return node.children.find(child => child.className === 'pf3-stage') || null;
      if (sel === '.pf3-ring') return null;
      return null;
    },
    querySelectorAll() { return []; },
    prepend(child) { node.children.unshift(child); },
    appendChild(child) { node.children.push(child); }
  };
  return node;
}

function boot(opts) {
  const timers = [];
  const hits = [];
  const context = {
    console,
    setTimeout(fn, ms) {
      const id = timers.length + 1;
      timers.push({ id, fn, ms });
      return id;
    },
    clearTimeout(id) {
      const at = timers.findIndex(item => item.id === id);
      if (at >= 0) timers.splice(at, 1);
    },
    document: { createElement() { return el(); } },
    window: { matchMedia() { return { matches: !!(opts && opts.reduce) }; } },
    navigator: { vibrate(ms) { hits.push(ms); return true; } },
    TelegramManager: { isTelegram: false }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/ui/profileFx.js', import.meta.url), 'utf8') + '\nthis.ProfileFx = ProfileFx;', context);
  context.timers = timers;
  context.hits = hits;
  return context;
}

describe('profile lights', () => {
  it('flashes the stadium in time with the haptics', () => {
    const ctx = boot();
    const root = el();
    const n = ctx.ProfileFx.play(root);
    assert.equal(n, 7);
    assert.equal(root.classList.contains('pf3-on'), true);
    assert.equal(root.children[0].className, 'pf3-stage');
    assert.equal(ctx.timers.map(item => item.ms).join(','), '0,150,300,560,820,1080,1280');
    ctx.timers[0].fn();
    ctx.timers[2].fn();
    ctx.timers[5].fn();
    assert.deepEqual(ctx.hits, [10, 18, 32]);
    ctx.ProfileFx.stop();
    assert.equal(ctx.ProfileFx._timers.length, 0);
  });

  it('keeps one tap when motion is reduced', () => {
    const ctx = boot({ reduce: true });
    const n = ctx.ProfileFx.play(el());
    assert.equal(n, 1);
    assert.equal(ctx.timers[0].ms, 0);
  });
});
