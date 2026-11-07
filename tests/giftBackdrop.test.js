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
      'bg_dark_green_subtle_triangles',
      'bg_gold_subtle_horses',
      'bg_navy_subtle_stripes',
      'bg_olive_subtle_crowns',
      'bg_gold_subtle_m',
      'bg_dark_green_subtle_balls',
      'bg_gold_boots',
      'bg_navy_whistles',
      'bg_dark_green_trophies',
      'bg_gold_goals',
      'bg_olive_captain_armbands',
      'bg_navy_corner_flags',
      'bg_dark_green_pitch_lines',
      'bg_gold_jerseys',
      'bg_navy_medals',
      'bg_dark_green_gloves',
      'bg_gold_stars',
      'bg_olive_shields',
      'bg_navy_numbers',
      'bg_dark_green_whistles_mix',
      'bg_gold_trophies_mix',
      'bg_navy_balls_mix',
      'bg_olive_boots_mix',
      'bg_dark_green_stars_mix',
      'bg_gold_captain_mix',
      'bg_navy_gloves_mix'
    ].join(','));
    const html = context.CoachTools.giftBackdropHtml({ uid: 'g1', id: 'g1', ico: '🎁', rarity: 'rare' }, 'lg');
    assert.equal(html.includes('club-bg'), false);
    assert.match(html, /--home-pat:/);
    const horses = context.CoachTools._backdropSvg(context.CoachTools.GIFT_BACKDROPS[1]);
    assert.equal((horses.match(/translate\(/g) || []).length, 3);
    assert.equal(horses.includes('rotate('), false);
    assert.match(horses, /#8a6f1f/);
    const stripes = context.CoachTools._backdropSvg(context.CoachTools.GIFT_BACKDROPS[2]);
    assert.match(stripes, /#1a3a6e/);
    assert.match(stripes, /width="5"/);
    const crowns = context.CoachTools._backdropSvg(context.CoachTools.GIFT_BACKDROPS[3]);
    assert.equal((crowns.match(/translate\(/g) || []).length, 2);
    const pitch = context.CoachTools._backdropSvg(context.CoachTools.GIFT_BACKDROPS[12]);
    assert.match(pitch, /<circle /);
  });
});
