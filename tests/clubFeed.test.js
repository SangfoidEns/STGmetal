import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const context = {
  saved: 0,
  Store: {
    state: {
      players: [],
      gifts: [],
      trainings: [],
      settings: {},
      feed: []
    },
    get() { return this.state; }
  },
  StorageManager: {
    save() { context.saved += 1; }
  }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(readFileSync(new URL('../src/core/coachTools.js', import.meta.url), 'utf8') + '\nthis.ClubFeed = ClubFeed;\nthis.CoachTools = CoachTools;', context);

function berlinToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const pick = (type) => parts.find(p => p.type === type).value;
  return pick('year') + '-' + pick('month') + '-' + pick('day');
}

describe('club feed and gift delete', () => {
  it('builds a gift, a streak and a birthday, then a status change', () => {
    const today = berlinToday();
    const birth = '1998-' + today.slice(5);
    context.Store.state = {
      players: [{
        id: 'p1',
        firstName: 'Павло',
        lastName: 'Тест',
        birthDate: birth,
        profile: { status: 'у формі' }
      }],
      gifts: [{ uid: 'g1', id: 'g1', playerId: 'p1', label: 'Кубок', createdAt: '2026-11-06T12:00:00.000Z' }],
      trainings: [1, 2, 3].map(n => ({
        id: 't' + n,
        status: 'done',
        date: '2026-11-0' + n,
        attendance: { p1: { present: true } }
      })),
      settings: {},
      feed: []
    };
    context.ClubFeed.sync();
    const kinds = context.Store.state.feed.map(x => x.kind).sort();
    assert.ok(kinds.indexOf('gift') >= 0);
    assert.ok(kinds.indexOf('streak') >= 0);
    assert.ok(kinds.indexOf('birthday') >= 0);
    assert.equal(kinds.indexOf('status'), -1);
    const streak = context.Store.state.feed.find(x => x.kind === 'streak');
    assert.match(streak.text, /серію 3/);
    context.Store.state.players[0].profile.status = 'лідер';
    context.ClubFeed.sync();
    const status = context.Store.state.feed.find(x => x.kind === 'status');
    assert.ok(status);
    assert.match(status.text, /лідер/);
    context.ClubFeed.sync();
    assert.equal(context.Store.state.feed.filter(x => x.kind === 'status').length, 1);
  });

  it('does not announce the same photo again on the next import', () => {
    const oldPhoto = 'data:image/jpeg;base64,OLDPHOTOVALUE1234567890';
    const nextPhoto = 'data:image/jpeg;base64,NEWPHOTOVALUE1234567890';
    context.Store.state = {
      players: [{
        id: 'johnson',
        firstName: 'Johnson',
        photoUrl: nextPhoto,
        stamps: { photo: '2026-11-06T12:00:00.000Z' }
      }],
      gifts: [],
      trainings: [],
      settings: {},
      feed: [],
      feedMeta: { photo: { johnson: 'seed' }, photoAt: { johnson: '2026-11-06T12:00:00.000Z' } }
    };
    context.ClubFeed.sync();
    assert.equal(context.Store.state.feed.filter(x => x.kind === 'photo').length, 0);
    context.Store.state.players[0].photoUrl = oldPhoto;
    context.ClubFeed.sync();
    assert.equal(context.Store.state.feed.filter(x => x.kind === 'photo').length, 0);
    context.Store.state.players[0].photoUrl = nextPhoto;
    context.Store.state.players[0].stamps.photo = '2026-11-13T09:00:00.000Z';
    context.ClubFeed.sync();
    const photos = context.Store.state.feed.filter(x => x.kind === 'photo');
    assert.equal(photos.length, 1);
    assert.equal(photos[0].createdAt, '2026-11-13T09:00:00.000Z');
    context.ClubFeed.sync();
    assert.equal(context.Store.state.feed.filter(x => x.kind === 'photo').length, 1);
    assert.equal(context.Store.state.feed[0].createdAt, '2026-11-13T09:00:00.000Z');
  });

  it('keeps a deleted gift deleted and does not pin a gift taken off the profile', () => {
    context.Store.state = {
      players: [{ id: 'p1', profile: { featuredGiftId: 'g1' } }],
      gifts: [{ uid: 'g1', id: 'g1', playerId: 'p1', label: 'Кубок', attached: true, featured: true }],
      trainings: [],
      settings: {},
      feed: []
    };
    assert.equal(context.CoachTools.deleteGift('g1'), true);
    assert.equal(context.Store.state.gifts.length, 0);
    assert.ok(context.Store.state.settings.removedGiftIds.indexOf('g1') >= 0);
    context.Store.state.gifts.push({ uid: 'g2', id: 'g2', playerId: 'p1', label: 'М\'яч', attached: false, featured: true });
    assert.equal(context.CoachTools.ensureWornGift('p1'), null);
    assert.equal(context.Store.state.gifts[0].attached, false);
  });

  it('drops a deleted gift from the feed and keeps one photo a day', () => {
    context.Store.state = {
      players: [{ id: 'p1', firstName: 'Михайло', lastName: 'Копич', profilePhoto: 'a'.repeat(40) }],
      gifts: [{ uid: 'g9', id: 'g9', playerId: 'p1', label: 'Хет-трик', createdAt: '2026-11-08T17:00:00.000Z' }],
      trainings: [],
      settings: {},
      feed: [
        { id: 'gift:g9', kind: 'gift', playerId: 'p1', title: 'Подарунок', text: 'отримав', createdAt: '2026-11-08T17:00:00.000Z' },
        { id: 'photo:p1:old-a', kind: 'photo', playerId: 'p1', title: 'Нове фото', text: 'додав', createdAt: '2026-11-08T18:47:00.000Z' },
        { id: 'photo:p1:old-b', kind: 'photo', playerId: 'p1', title: 'Нове фото', text: 'додав', createdAt: '2026-11-08T19:42:00.000Z' }
      ]
    };
    context.ClubFeed.sync();
    assert.equal(context.Store.state.feed.filter(x => x.kind === 'photo').length, 1);
    assert.equal(context.Store.state.feed.find(x => x.kind === 'photo').id, 'photo:p1:old-b');
    assert.equal(context.CoachTools.deleteGift('g9'), true);
    assert.equal(context.Store.state.feed.some(x => x.kind === 'gift'), false);
    context.Store.state.players[0].profilePhoto = 'b'.repeat(40);
    context.ClubFeed.sync();
    const today = context.ClubFeed._day(new Date().toISOString());
    const photos = context.Store.state.feed.filter(x => x.kind === 'photo' && context.ClubFeed._day(x.createdAt) === today);
    assert.equal(photos.length, 1);
  });

  it('puts the eleven best attenders on the pitch and everyone else on the bench', () => {
    const players = [];
    for (let i = 1; i <= 12; i++) {
      players.push({ id: 'a' + i, number: i, position: i === 1 ? 'GK' : (i < 5 ? 'CB' : (i < 9 ? 'CM' : 'ST')), status: 'active' });
    }
    players.push({ id: 'hurt', number: 99, position: 'ST', status: 'injured' });
    const att = { hurt: 100 };
    players.forEach(function (p, i) { if (p.id !== 'hurt') att[p.id] = 100 - i; });
    const picked = context.CoachTools.pickLineup(players, function (p) { return att[p.id]; });
    assert.equal(picked.xi.length, 11);
    assert.equal(picked.xi.some(p => p.id === 'a12'), false);
    assert.equal(picked.bench.some(p => p.id === 'a12'), true);
    assert.equal(picked.bench.some(p => p.id === 'hurt'), true);
    const roles = ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'ATT', 'ATT', 'MID', 'ATT'];
    const slots = context.CoachTools.assignFormation(picked.xi, roles);
    assert.equal(slots[0].position, 'GK');
    assert.equal(slots.filter(Boolean).length, 11);
    assert.equal(new Set(slots.map(p => p.id)).size, 11);
  });
});
