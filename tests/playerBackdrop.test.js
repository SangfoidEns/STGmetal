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
  it('paints the card field with the featured gift backdrop', () => {
    const ctx = boot();
    ctx.Store.get = () => ({
      players: [],
      trainings: [],
      settings: {},
      gifts: [{ uid: 'g_card', id: 'g_card', playerId: 'id_player_1', featured: true, hue: 200, seed: 7 }]
    });
    const gift = { uid: 'g_card', id: 'g_card', playerId: 'id_player_1', featured: true, hue: 200, seed: 7 };
    const bg = ctx.CoachTools.playerBackdrop({ id: 'id_player_1' });
    const drawn = ctx.CoachTools.giftPatternSvg(gift);
    assert.match(bg.className, /player-collectible/);
    assert.equal(bg.id, drawn.patternId);
    assert.equal(bg.hue, 200);
    assert.match(bg.style, /--acc-bg:linear-gradient\(165deg, hsl\(200 /);
    assert.match(bg.style, /--pb-pat:/);
    const raw = decodeURIComponent(bg.style.split('data:image/svg+xml,')[1].replace(/'\)$/, '').replace(/;$/, ''));
    assert.equal(raw.includes('<text'), false);
    assert.equal(raw.includes('rotate('), false);
    assert.match(bg.className, /gift-field/);
    const plain = ctx.CoachTools.playerBackdrop({ id: 'nobody' });
    const plainSvg = decodeURIComponent(plain.style.split('data:image/svg+xml,')[1].replace(/'\)$/, '').replace(/;$/, ''));
    assert.match(plainSvg, /rotate\(-7\)/);
    assert.match(plainSvg, /M-5\.4,-5\.6/);
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

  it('adds the first saved penalty as a club gift with a night pattern', () => {
    const ctx = boot();
    const def = ctx.CoachTools.giftById('first_saved_penalty');
    assert.equal(def.label, 'Перший витягнутий пенальті');
    assert.equal(def.exclusive, 'club');
    assert.equal(def.series, 'Команда');
    const drawn = ctx.CoachTools.giftPatternSvg({ giftId: 'first_saved_penalty', special: 'penalty-save', seed: 3, hue: 74 });
    assert.equal(drawn.patternId, 'penalty');
    assert.equal(drawn.svg.includes('<text'), false);
    assert.equal(drawn.svg.includes('rotate('), false);
    assert.match(drawn.svg, /<path/);
    assert.match(drawn.svg, /rgba\(255,255,255,0\./);
    assert.equal(drawn.svg.includes('255,186,74'), false);
    assert.equal(drawn.svg.includes('viewBox="0 0 168 168"'), false);
    assert.ok(ctx.CoachTools._kitPatterns.length >= 8);
    const other = ctx.CoachTools.giftPatternSvg({ uid: 'other-gift', seed: 88, hue: 200 });
    assert.notEqual(other.svg, drawn.svg);
    assert.notEqual(other.patternId, 'penalty');
  });
});
