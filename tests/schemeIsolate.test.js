import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function boot() {
  const state = {
    players: [],
    matches: [],
    boards: [],
    activeBoard: { objects: [], history: [], historyIdx: -1, tool: 'select', fieldView: 'full', sourceBoardId: 'cover' }
  };
  const context = {
    console,
    SCHEMES: { '4-4-2': [[1, 0.5, 0.92], [2, 0.3, 0.7]] },
    clamp(n, a, b) { return Math.max(a, Math.min(b, Number(n) || 0)); },
    Store: { get() { return state; } },
    StorageManager: { saveDebounced() {} },
    Toast: { show() {} },
    Modal: { confirm(_msg, yes) { if (yes) yes(); } },
    AuthManager: { isCoach() { return true; } },
    sanitize(value) { return String(value == null ? '' : value); }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/board/BoardEngine.js', import.meta.url), 'utf8') + '\nthis.BoardEngine = BoardEngine;', context);
  context.BoardEngine.render = function () {};
  context.BoardEngine.renderToolbar = function () {};
  context.BoardEngine.renderTokens = function () {};
  context.BoardEngine.renderDrawings = function () {};
  context.state = state;
  return context;
}

describe('scheme drawings stay separate', () => {
  it('keeps the open scheme and does not redraw the other schemes in the album', () => {
    const ctx = boot();
    const shared = [
      { id: 'p1', type: 'player', team: 'own', x: 0.2, y: 0.2, onBench: false },
      { id: 'arrow', type: 'pass', x: 0.15, y: 0.3, x2: 0.4, y2: 0.5 }
    ];
    const cover = { id: 'cover', name: 'Основа', objects: shared };
    const other = { id: 'zones', name: 'зони', objects: shared };
    ctx.state.boards = [cover, other];
    ctx.state.activeBoard.objects = shared;
    ctx.state.activeBoard.sourceBoardId = 'cover';
    ctx.BoardEngine.applyScheme('4-4-2');
    assert.equal(ctx.state.activeBoard.sourceBoardId, 'cover');
    assert.equal(other.objects[0].x, 0.2);
    assert.equal(other.objects[1].x2, 0.4);
    assert.notEqual(cover.objects, other.objects);
    assert.ok(Math.abs(cover.objects[0].x - 0.5) < 0.02);
    assert.equal(cover.objects[1].type, 'pass');
  });

  it('clears the pitch but keeps the same scheme and its saved drawing', () => {
    const ctx = boot();
    const drawing = [
      { id: 'p1', type: 'player', team: 'own', x: 0.25, y: 0.4, onBench: false },
      { id: 'zone', type: 'zone', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }
    ];
    const cover = { id: 'cover', name: 'Основа', objects: drawing };
    ctx.state.boards = [cover];
    ctx.state.activeBoard.objects = drawing;
    ctx.state.activeBoard.sourceBoardId = 'cover';
    ctx.BoardEngine.clear();
    assert.equal(ctx.state.activeBoard.sourceBoardId, 'cover');
    assert.equal(ctx.state.activeBoard.objects.length, 0);
    assert.equal(cover.objects.length, 2);
    assert.equal(cover.objects[0].x, 0.25);
    assert.equal(ctx.BoardEngine._schemeEditBar().includes('Зберегти'), true);
  });

  it('opening the next scheme does not replace the one that was open', () => {
    const ctx = boot();
    const allZones = { id: 'all', name: 'всі зони', objects: [{ id: 'z', type: 'zone', x: 0.1 }] };
    const flanks = { id: 'flanks', name: 'зони фланги', objects: [{ id: 'f', type: 'zone', x: 0.8 }] };
    ctx.state.boards = [allZones, flanks];
    ctx.state.activeBoard.objects = [{ id: 'live', type: 'zone', x: 0.1 }];
    ctx.state.activeBoard.sourceBoardId = 'all';
    const opened = ctx.BoardEngine.loadBoard('flanks');
    assert.equal(opened, true);
    assert.equal(ctx.state.activeBoard.sourceBoardId, 'flanks');
    assert.equal(allZones.objects[0].id, 'z');
    assert.equal(allZones.objects[0].x, 0.1);
    assert.equal(ctx.state.activeBoard.objects[0].id, 'f');
    ctx.state.activeBoard.objects[0].x = 0.2;
    ctx.BoardEngine._syncLiveBoard();
    assert.equal(allZones.objects[0].x, 0.1);
    assert.equal(flanks.objects[0].x, 0.2);
    assert.equal(flanks.objects[0].id, 'f');
  });
});
