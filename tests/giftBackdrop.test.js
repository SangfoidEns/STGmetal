import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const context = { Store: { get() { return { gifts: [] }; } } };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(readFileSync(new URL('../src/core/coachTools.js', import.meta.url), 'utf8') + '\nthis.CoachTools = CoachTools;', context);

describe('telegram gift backdrops', () => {
  it('keeps the seven club backdrops and paints one onto the gift', () => {
    const ids = context.CoachTools.GIFT_BACKDROPS.map(d => String(d.id)).join(',');
    assert.equal(ids, [
      'bg_hourglass_dark_green',
      'bg_turtle_tactical_pine',
      'bg_crown_dark_green',
      'bg_gold_horse_ball',
      'bg_navy_gold_stripes',
      'bg_crown_burgundy',
      'bg_mixed_metalist_gold'
    ].join(','));
    const html = context.CoachTools.giftBackdropHtml({ uid: 'g1', id: 'g1', ico: '🎁', rarity: 'rare' }, 'lg');
    assert.match(html, /club-bg/);
    assert.match(html, /--gift-base:#(?:1e3a2f|2c4a42|1a3328|d4af37|0d1f4d|4a1c1c|e8b923)/);
    const stripe = context.CoachTools._backdropSvg(context.CoachTools.GIFT_BACKDROPS[4]);
    assert.match(stripe, /#0d1f4d/);
    assert.match(stripe, /#c9a227/);
    const mixed = context.CoachTools._backdropSvg(context.CoachTools.GIFT_BACKDROPS[6]);
    assert.match(mixed, /#e8b923/);
    assert.match(mixed, /#0d1f4d/);
  });
});
