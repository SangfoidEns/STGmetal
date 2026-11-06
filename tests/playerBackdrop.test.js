import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function boot() {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    Store: { get() { return { players: [], trainings: [], gifts: [], settings: {} }; } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: {
      documentElement: { setAttribute() {} },
      querySelectorAll() { return []; },
      getElementById() { return null; }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  const src = readFileSync(new URL('../src/core/coachTools.js', import.meta.url), 'utf8');
  vm.runInContext(src + '\nthis.CoachTools = CoachTools;', context, { filename: 'coachTools.js' });
  const views = readFileSync(new URL('../src/ui/views.js', import.meta.url), 'utf8');
  vm.runInContext(views + '\nthis.Views = Views;', context, { filename: 'views.js' });
  return context;
}

describe('player collectible backgrounds', () => {
  it('uses a low-contrast radial field, small football marks and the club shield', () => {
    const ctx = boot();
    const bg = ctx.CoachTools.playerBackdrop({ id: 'id_player_1' });
    assert.match(bg.className, /player-collectible/);
    assert.match(bg.style, /--pb-center:#/);
    assert.match(bg.style, /--pb-edge:#/);
    const raw = decodeURIComponent(bg.style.split('data:image/svg+xml,')[1].replace(/'\)$/, '').replace(/;$/, ''));
    assert.equal(raw.includes('<text'), false);
    assert.match(raw, /opacity="0\.22"/);
    assert.match(raw, /rotate\(-7\)/);
    assert.match(raw, /rotate\(6\)/);
    assert.ok(raw.includes('M-5.4,-5.6'), 'club shield is part of the pattern');
  });

  it('keeps the pistachio reference and a Metalist Stuttgart palette', () => {
    const ctx = boot();
    const ids = ctx.CoachTools.PLAYER_BACKDROPS.map(d => d.id);
    assert.ok(ids.includes('pistachio'));
    assert.ok(ids.includes('metalist'));
    assert.ok(ids.includes('shtuttgart'));
    const pist = ctx.CoachTools.PLAYER_BACKDROPS.find(d => d.id === 'pistachio');
    assert.equal(pist.center, '#91AE7C');
    assert.equal(pist.edge, '#668653');
    assert.equal(pist.ink, '#58794D');
    assert.equal(pist.symbol, 'ball');
  });

  it('styles a footballer card and does not reuse the gift wallpaper', () => {
    const ctx = boot();
    const style = ctx.Views._playerPatternStyle({ id: 'id_mv5egaojcq30in' });
    assert.match(style, /--pb-pat:/);
    assert.equal(style.includes('--home-pat'), false);
    const gift = ctx.CoachTools._footballSymbol('ball', '#fff');
    assert.match(gift, /opacity="0\.26"/);
  });
});
