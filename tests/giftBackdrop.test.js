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
      'night_pitch', 'navy_kit', 'gold_crest', 'goal_night', 'captain_band', 'trophy_night',
      'gold_boot', 'whistle_arc', 'tactics_board', 'medal_night', 'keeper_night', 'star_gold'
    ].join(','));
    const html = context.CoachTools.giftBackdropHtml({ uid: 'g1', id: 'g1', ico: '🎁', rarity: 'rare' }, 'lg');
    assert.equal(html.includes('club-bg'), false);
    assert.match(html, /--home-pat:/);
    const pitch = context.CoachTools._backdropSvg(context.CoachTools.GIFT_BACKDROPS[0]);
    assert.match(pitch, /viewBox="0 0 360 460"/);
    assert.match(pitch, /radialGradient/);
    assert.match(pitch, /<ellipse /);
    assert.equal(pitch.includes('scale(7'), false);
    const kit = context.CoachTools._backdropSvg(context.CoachTools.GIFT_BACKDROPS[1]);
    assert.match(kit, /#e8c547/);
    const gold = context.CoachTools.GIFT_BACKDROPS.find(d => d.id === 'gold_crest');
    assert.equal(gold.ink, 'light');
  });
});
