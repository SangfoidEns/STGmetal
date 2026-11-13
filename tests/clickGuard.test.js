import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

function boot(nav) {
  const nodes = { mobileNav: nav || null };
  const document = {
    getElementById(id) { return nodes[id] || null; }
  };
  const context = { document, window: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/core/clickGuard.js', import.meta.url), 'utf8') + '\nthis.ClickGuard = ClickGuard;', context);
  return context.ClickGuard;
}

function node(spec, parent) {
  const el = {
    id: spec.id || '',
    tag: spec.tag || 'div',
    className: spec.className || '',
    attrs: spec.attrs || {},
    rect: spec.rect || { top: 200, left: 20, right: 180, bottom: 248, width: 160, height: 48 },
    parent: parent || null,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    getBoundingClientRect() { return this.rect; },
    closest(sel) {
      let cur = this;
      while (cur) {
        if (hit(cur, sel)) return cur;
        cur = cur.parent;
      }
      return null;
    }
  };
  return el;
}

function hit(el, sel) {
  return String(sel).split(',').some(function (part) {
    part = part.trim();
    if (!part) return false;
    if (part.charAt(0) === '#') return el.id === part.slice(1);
    if (part.charAt(0) === '.') return (' ' + el.className + ' ').indexOf(' ' + part.slice(1) + ' ') >= 0;
    if (part.charAt(0) === '[') {
      const body = part.slice(1, -1);
      const eq = body.indexOf('=');
      if (eq < 0) return el.getAttribute(body) != null;
      const key = body.slice(0, eq);
      const val = body.slice(eq + 1).replace(/^"|"$/g, '');
      return el.getAttribute(key) === val;
    }
    return el.tag === part;
  });
}

describe('click guard', () => {
  it('keeps Зберегти план when the button overlaps the tab bar', () => {
    const nav = node({
      id: 'mobileNav',
      className: 'mn',
      rect: { top: 700, left: 0, right: 390, bottom: 760, width: 390, height: 60 }
    });
    const guard = boot(nav);
    const save = node({
      tag: 'button',
      attrs: { 'data-action': 'match-save' },
      rect: { top: 680, left: 16, right: 190, bottom: 728, width: 174, height: 48 }
    });
    assert.equal(guard.stealNav(save, 90, 700), false);
    assert.equal(guard.trainingOpensSheet(save), false);
  });

  it('still routes an empty tap in the tab band to the tab bar', () => {
    const nav = node({
      id: 'mobileNav',
      className: 'mn',
      rect: { top: 700, left: 0, right: 390, bottom: 760, width: 390, height: 60 }
    });
    const guard = boot(nav);
    const empty = node({
      tag: 'div',
      rect: { top: 690, left: 0, right: 390, bottom: 760, width: 390, height: 70 }
    });
    assert.equal(guard.stealNav(empty, 200, 720), true);
  });

  it('does not open a training from the save button inside a training card', () => {
    const guard = boot(null);
    const card = node({
      tag: 'div',
      className: 'card-training',
      attrs: { 'data-action': 'open-training', 'data-training-id': 'tr-3' }
    });
    const save = node({
      tag: 'button',
      attrs: { 'data-action': 'match-save' }
    }, card);
    assert.equal(guard.trainingOpensSheet(save), false);
    assert.equal(guard.trainingOpensSheet(card), true);
  });
});
