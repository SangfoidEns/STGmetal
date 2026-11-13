import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function boot() {
  const context = {};
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/core/playerUpdate.js', import.meta.url), 'utf8') + '\nthis.PlayerUpdate = PlayerUpdate;', context);
  return context.PlayerUpdate;
}

describe('player questionnaire for the coach', () => {
  it('packs the profile and leaves attendance to the coach', () => {
    const PlayerUpdate = boot();
    const state = {
      players: [{ id: 'p1', firstName: 'Іван', lastName: 'Коваль', number: 7, position: 'CM', profile: { bio: 'лівий' }, telegramUsername: 'koval' }],
      trainings: [
        { id: 't1', name: 'Вечір', date: '2026-11-06', attendance: { p1: { claimed: true, claimedAt: '2026-11-06T18:00:00.000Z' } } },
        { id: 't2', name: 'Ранок', date: '2026-11-05', attendance: { p1: { present: true } } }
      ],
      gifts: [{ id: 'g1', playerId: 'p1', featured: true, giftId: 'ball' }]
    };
    const packet = PlayerUpdate.build(state, state.players[0]);
    assert.equal(packet.type, 'metalist_player_update');
    assert.equal(packet.player.profile.bio, 'лівий');
    assert.equal(packet.player.number, undefined);
    assert.equal(packet.stamps.length, 0);
    assert.equal(packet.featuredGiftKey, 'g1');
    assert.equal(packet.wornGift.by, 'player');
    assert.equal(packet.gifts.length, 1);
  });

  it('updates the questionnaire and leaves attendance alone', () => {
    const PlayerUpdate = boot();
    const state = {
      players: [
        { id: 'p1', firstName: 'Іван', lastName: 'Коваль', number: 7, position: 'CM', profile: {} },
        { id: 'p2', firstName: 'Олег', lastName: 'Інший', number: 9, position: 'ST' }
      ],
      trainings: [
        { id: 'old', name: '05/11 вечір (копія)', date: '2026-11-06', attendance: { p2: { present: true } } }
      ],
      gifts: [
        { id: 'g1', playerId: 'p1', featured: false },
        { id: 'g2', playerId: 'p2', featured: true }
      ]
    };
    const res = PlayerUpdate.apply(state, {
      type: 'metalist_player_update',
      player: {
        id: 'missing',
        telegramUsername: '@Koval',
        firstName: 'Іван',
        lastName: 'Коваль',
        profile: { bio: 'оновив анкету', phone: '+49123' }
      },
      featuredGiftKey: 'g1',
      stamps: [{ trainingId: 'gone', name: '5/11 вечір', date: '2026-11-06', claimedAt: '2026-11-06T19:00:00.000Z' }]
    });
    // The player in this fixture has no telegram username, so the packet cannot land.
    assert.equal(res.ok, false);
    state.players[0].telegramUsername = 'koval';
    const landed = PlayerUpdate.apply(state, {
      type: 'metalist_player_update',
      player: {
        id: 'other-phone',
        telegramUsername: '@Koval',
        firstName: 'Іванко',
        profile: { bio: 'оновив анкету', phone: '+49123' }
      },
      featuredGiftKey: 'g1',
      stamps: [{ trainingId: 'gone', name: '5/11 вечір', date: '2026-11-06', claimedAt: '2026-11-06T19:00:00.000Z' }]
    });
    assert.equal(landed.ok, true);
    assert.equal(landed.stamps, 0);
    assert.equal(state.players.length, 2);
    assert.equal(state.players[0].number, 7);
    assert.equal(state.players[0].position, 'CM');
    assert.equal(state.players[0].firstName, 'Іванко');
    assert.equal(state.players[0].profile.bio, 'оновив анкету');
    assert.equal(state.trainings[0].attendance.p1, undefined);
    assert.equal(state.trainings[0].attendance.p2.present, true);
    assert.equal(state.gifts[0].featured, true);
    assert.equal(state.gifts[1].featured, true);
    state.trainings[0].attendance.p1 = { present: true };
    PlayerUpdate.apply(state, {
      type: 'metalist_player_update',
      player: { id: 'p1', profile: { bio: 'ще раз' } },
      stamps: [{ trainingId: 'old', name: '5/11 вечір', date: '2026-11-06', claimedAt: '2026-11-06T19:10:00.000Z' }]
    });
    assert.equal(state.trainings[0].attendance.p1.present, true);
    assert.equal(state.trainings[0].attendance.p1.claimed, undefined);
  });

  it('keeps the gift the player chose even when the coach copy has another id', () => {
    const PlayerUpdate = boot();
    const state = {
      settings: { removedGiftIds: ['gone'] },
      players: [{ id: 'johnson', firstName: 'Джонсон', lastName: 'Джонсон', telegramUsername: 'johnson', wornGift: { key: 'old', giftId: 'crest', at: '2026-11-01T00:00:00.000Z', by: 'coach' } }],
      gifts: [
        { id: 'coach-ball', uid: 'coach-ball', playerId: 'johnson', giftId: 'ball', featured: false, label: 'М’яч' },
        { id: 'coach-crest', uid: 'coach-crest', playerId: 'johnson', giftId: 'crest', featured: true, label: 'Герб' },
        { id: 'other', uid: 'other', playerId: 'p2', giftId: 'ball', featured: true }
      ]
    };
    const res = PlayerUpdate.apply(state, {
      type: 'metalist_player_update',
      exportedAt: '2026-11-13T18:00:00.000Z',
      player: { id: 'phone-johnson', telegramUsername: 'johnson', firstName: 'Джонсон', featuredGiftId: 'ball' },
      featuredGiftKey: 'phone-ball',
      wornGift: { key: 'phone-ball', giftId: 'ball', at: '2026-11-13T18:00:00.000Z', by: 'player' },
      gifts: [
        { id: 'phone-ball', uid: 'phone-ball', playerId: 'phone-johnson', giftId: 'ball', label: 'М’яч' },
        { id: 'gone', uid: 'gone', playerId: 'phone-johnson', giftId: 'boot', label: 'Бутси' },
        { id: 'phone-new', uid: 'phone-new', playerId: 'phone-johnson', giftId: 'scarf', label: 'Шарф' }
      ]
    });
    assert.equal(res.ok, true);
    assert.equal(state.players[0].wornGift.by, 'player');
    assert.equal(state.players[0].wornGift.giftId, 'ball');
    assert.equal(state.gifts.find(g => g.id === 'coach-ball').featured, true);
    assert.equal(state.gifts.find(g => g.id === 'coach-crest').featured, false);
    assert.equal(state.gifts.find(g => g.id === 'other').featured, true);
    assert.equal(state.gifts.some(g => g.id === 'phone-ball'), false);
    assert.equal(state.gifts.some(g => g.id === 'gone'), false);
    assert.equal(state.gifts.some(g => g.giftId === 'scarf' && g.playerId === 'johnson'), true);
  });
});
