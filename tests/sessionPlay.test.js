import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function node(spec, parent) {
  const self = {
    spec,
    parent,
    closest(sel) {
      const parts = sel.split(',').map(s => s.trim());
      let n = self;
      while (n) {
        if (parts.some(p => hit(n, p))) return n;
        n = n.parent;
      }
      return null;
    },
    getAttribute(k) { return this.spec.attrs && this.spec.attrs[k] != null ? this.spec.attrs[k] : null; },
    getBoundingClientRect() { return this.spec.rect || { top: 100, bottom: 140, height: 40, left: 0, right: 80 }; }
  };
  return self;
}

function hit(n, sel) {
  if (sel.startsWith('#')) return n.spec.id === sel.slice(1);
  if (sel.startsWith('.')) return (n.spec.cls || []).indexOf(sel.slice(1)) >= 0;
  const m = sel.match(/^\[([^\]=]+)(?:="([^"]*)")?\]$/);
  if (m) {
    if (!n.spec.attrs || n.spec.attrs[m[1]] == null) return false;
    return m[2] == null ? true : n.spec.attrs[m[1]] === m[2];
  }
  return n.spec.tag === sel;
}

function boot() {
  const nav = { getBoundingClientRect() { return { top: 780, bottom: 844, left: 0, right: 390, height: 64, width: 390 }; } };
  const context = { document: { getElementById(id) { return id === 'mobileNav' ? nav : null; } } };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/core/clickGuard.js', import.meta.url), 'utf8') + '\nthis.ClickGuard = ClickGuard;', context);
  vm.runInContext(readFileSync(new URL('../src/core/sessionPlay.js', import.meta.url), 'utf8') + '\nthis.SessionPlay = SessionPlay;', context);
  return context;
}

describe('click targets stay on the control that was pressed', () => {
  it('does not give the bottom bar a button that sits in the menu', () => {
    const { ClickGuard } = boot();
    const side = node({ id: 'sidebar' });
    const btn = node({ tag: 'button', attrs: { 'data-action': 'export' }, rect: { top: 790, bottom: 834, height: 44, left: 12, right: 200 } }, side);
    assert.equal(ClickGuard.stealNav(btn, 40, 810), false);
  });

  it('gives the bar a tap that lands on content sliding underneath', () => {
    const { ClickGuard } = boot();
    const card = node({ tag: 'div', attrs: { 'data-action': 'open-training' }, rect: { top: 700, bottom: 830, height: 130, left: 0, right: 390 } });
    assert.equal(ClickGuard.stealNav(card, 200, 800), true);
  });

  it('keeps a claim button from opening the training sheet', () => {
    const { ClickGuard } = boot();
    const card = node({ tag: 'div', attrs: { 'data-action': 'open-training' } });
    const claim = node({ tag: 'button', attrs: { 'data-action': 'claim-session' } }, card);
    assert.equal(ClickGuard.trainingOpensSheet(claim), false);
    assert.equal(ClickGuard.trainingOpensSheet(card), true);
  });

  it('opens the coach card only when the tap is not another button', () => {
    const { ClickGuard } = boot();
    const card = node({ cls: ['coach-squad-card'], attrs: { 'data-action': 'open-coach-card' } });
    const photo = node({ tag: 'button', attrs: { 'data-action': 'open-photo' } }, card);
    assert.equal(ClickGuard.coachCardClick(card), true);
    assert.equal(ClickGuard.coachCardClick(photo), false);
  });
});

describe('session play', () => {
  it('does not let a player stamp attendance', () => {
    const { SessionPlay } = boot();
    const training = { id: 't1', status: 'planned', attendance: {} };
    const res = SessionPlay.claim(training, 'p1');
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'coach');
    assert.equal(training.attendance.p1, undefined);
    assert.equal(SessionPlay.claimHtml(training), '');
  });

  it('counts confirmed players and keeps stamps separate', () => {
    const { SessionPlay } = boot();
    const training = { attendance: { a: { present: true }, b: { claimed: true }, c: { present: false } } };
    const players = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd', status: 'injured' }];
    const m = SessionPlay.meter(training, players);
    assert.equal(m.here, 1);
    assert.equal(m.total, 3);
    assert.equal(m.stamps, 1);
    assert.equal(SessionPlay.seals(5).join(','), '3,5');
  });

  it('skips a cancelled session in the week strip', () => {
    const { SessionPlay } = boot();
    const marks = SessionPlay.weekMarks([
      { id: 'a', date: '2026-11-01', status: 'done', attendance: { p: { present: true } } },
      { id: 'b', date: '2026-11-02', status: 'cancelled', attendance: { p: { present: false } } },
      { id: 'c', date: '2026-11-03', status: 'done', attendance: { p: { present: false } } }
    ], 'p');
    assert.equal(marks.map(m => m.mark).join(','), 'in,out');
  });

  it('walks explanation frames in a loop', () => {
    const { SessionPlay } = boot();
    const training = { beats: [{ phrase: 'один' }, { phrase: 'два' }], beatIndex: 0 };
    assert.equal(SessionPlay.nextBeat(training), 1);
    assert.equal(SessionPlay.nextBeat(training), 0);
  });
});
