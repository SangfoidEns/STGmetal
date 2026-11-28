import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function el(className) {
  const node = {
    className: className || '',
    parentNode: null,
    children: [],
    innerHTML: '',
    classList: {
      _s: new Set(),
      add(name) { this._s.add(name); },
      remove(name) { this._s.delete(name); },
      contains(name) { return this._s.has(name); }
    },
    setAttribute() {},
    get offsetWidth() { return 10; },
    appendChild(child) {
      if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(item => item !== child);
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    insertBefore(child, before) {
      if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(item => item !== child);
      child.parentNode = node;
      const at = node.children.indexOf(before);
      if (at < 0) node.children.push(child);
      else node.children.splice(at, 0, child);
      return child;
    },
    removeChild(child) {
      node.children = node.children.filter(item => item !== child);
      child.parentNode = null;
    },
    querySelector(sel) {
      return walk(node, sel);
    },
    querySelectorAll(sel) {
      const found = [];
      collect(node, sel, found);
      return found;
    }
  };
  return node;
}

function matches(node, sel) {
  if (sel === '.pf3-stage') return node.className === 'pf3-stage';
  if (sel === '.pf3-orbit') return node.className === 'pf3-orbit';
  if (sel === '.pf3-ring') return node.className === 'pf3-ring';
  if (sel === '.cc-photo, .cpc-photo') return node.className === 'cc-photo' || node.className === 'cpc-photo';
  if (sel === '.pf3-pitch') return node.className === 'pf3-pitch';
  if (sel === '#modal > .pf3-stage, .coach-card-overlay > .pf3-stage, .pf3-pitch') return node.className === 'pf3-pitch';
  return false;
}

function walk(node, sel) {
  for (const child of node.children) {
    if (matches(child, sel)) return child;
    const nested = walk(child, sel);
    if (nested) return nested;
  }
  return null;
}

function collect(node, sel, found) {
  for (const child of node.children) {
    if (matches(child, sel)) found.push(child);
    collect(child, sel, found);
  }
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
    document: {
      createElement() { return el(); },
      querySelectorAll() { return []; }
    },
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
  it('keeps the ball on the photo and drops the stray pitch', () => {
    const ctx = boot();
    const card = el('cc-frame');
    card.appendChild(el('cc-photo'));
    const n = ctx.ProfileFx.play(card);
    assert.equal(n, 4);
    assert.equal(ctx.timers.map(item => item.ms).join(','), '0,160,420,700');
    const stage = card.querySelector('.pf3-stage');
    assert.equal(stage.innerHTML.includes('pf3-pitch'), false);
    assert.equal(stage.innerHTML.includes('pf3-lamp'), true);
    const orbit = card.querySelector('.pf3-orbit');
    assert.ok(orbit);
    assert.equal(orbit.children.some(child => child.className === 'pf3-ball'), true);
    assert.equal(orbit.children.some(child => child.className === 'cc-photo'), true);
    assert.match(orbit.children.find(child => child.className === 'pf3-ball').innerHTML, /<svg/);
    ctx.timers[2].fn();
    assert.deepEqual(ctx.hits, [16]);
    ctx.ProfileFx.stop();
    assert.equal(card.querySelector('.pf3-stage'), null);
    assert.equal(card.querySelector('.pf3-orbit'), null);
    assert.equal(card.querySelector('.cc-photo, .cpc-photo').className, 'cc-photo');
    assert.equal(ctx.ProfileFx._timers.length, 0);
  });

  it('keeps one tap when motion is reduced', () => {
    const ctx = boot({ reduce: true });
    const n = ctx.ProfileFx.play(el('fifa-card'));
    assert.equal(n, 1);
    assert.equal(ctx.timers[0].ms, 0);
  });
});
