import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const context = {};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(readFileSync(new URL('../src/core/clubMerge.js', import.meta.url), 'utf8'), context);
const { mergePayload } = context.ClubMerge;

describe('club snapshot merge', () => {
  it('keeps the newer attendance mark and does not duplicate the player', () => {
    const file = {
      settings: { clubName: 'МЕТАЛІСТ ШТУТТГАРТ', coachStats: { appMs: 1000, boardMs: 100, updatedAt: '2026-10-30T21:00:00.000Z' } },
      players: [{ id: 'p1', firstName: 'Artem' }],
      trainings: [{
        id: 't1',
        name: 'Тактика',
        createdAt: '2026-10-22T10:00:00.000Z',
        attendance: {
          p1: { present: false, intensity: 6, updatedAt: '2026-10-22T14:19:21.587Z' }
        }
      }]
    };
    const local = {
      settings: { coachName: 'Artem Serdiuk', coachStats: { appMs: 9000, boardMs: 4000, updatedAt: '2026-11-06T12:00:00.000Z' } },
      players: [{ id: 'p1', firstName: 'Artem' }],
      trainings: [{
        id: 't1',
        name: 'Тактика',
        updatedAt: '2026-11-06T12:00:00.000Z',
        coachPresent: true,
        attendance: {
          p1: { present: true, intensity: 8, updatedAt: '2026-11-06T12:00:00.000Z' }
        }
      }]
    };
    const merged = mergePayload(file, local);
    assert.equal(merged.players.length, 1);
    assert.equal(merged.trainings.length, 1);
    assert.equal(merged.trainings[0].attendance.p1.present, true);
    assert.equal(merged.trainings[0].attendance.p1.intensity, 8);
    assert.equal(merged.trainings[0].coachPresent, true);
    assert.equal(merged.settings.coachStats.appMs, 9000);
    assert.equal(merged.settings.coachStats.boardMs, 4000);
    assert.equal(merged.settings.coachName, 'Artem Serdiuk');
    assert.equal(merged.settings.clubName, 'МЕТАЛІСТ ШТУТТГАРТ');
  });

  it('keeps an older cell and a file-only training without duplicating ids', () => {
    const file = {
      settings: { coachStats: { appMs: 50, boardMs: 10, updatedAt: '2026-11-01T00:00:00.000Z' } },
      trainings: [
        {
          id: 't1',
          attendance: {
            p1: { present: false, updatedAt: '2026-10-01T00:00:00.000Z' },
            p2: { present: true, updatedAt: '2026-11-02T00:00:00.000Z' }
          }
        },
        { id: 't2', name: 'Нове з файлу', createdAt: '2026-11-03T00:00:00.000Z' }
      ],
      chat: [{ id: 'm1', text: 'файл' }]
    };
    const local = {
      settings: { coachStats: { appMs: 20, boardMs: 80, updatedAt: '2026-10-01T00:00:00.000Z' } },
      trainings: [
        {
          id: 't1',
          attendance: {
            p1: { present: true, updatedAt: '2026-10-20T00:00:00.000Z' }
          }
        },
        { id: 't3', name: 'Лише на телефоні', createdAt: '2026-11-04T00:00:00.000Z' }
      ],
      chat: [{ id: 'm1', text: 'файл' }, { id: 'm2', text: 'телефон' }]
    };
    const merged = mergePayload(file, local);
    const t1 = merged.trainings.find(t => t.id === 't1');
    assert.equal(t1.attendance.p1.present, true);
    assert.equal(t1.attendance.p2.present, true);
    assert.equal(merged.trainings.length, 3);
    assert.equal(merged.chat.length, 2);
    assert.equal(merged.settings.coachStats.appMs, 50);
    assert.equal(merged.settings.coachStats.boardMs, 80);
  });

  it('folds training copies and zero-padded twins into the real session', () => {
    const merged = mergePayload({
      trainings: [
        { id: 'real22', name: 'Тренування 22/10', date: '2026-10-22', status: 'cancelled', duration: 119, attendance: { p1: { present: false, updatedAt: '2026-10-22T12:00:00.000Z' } } },
        { id: 'copy22', name: 'Тренування 22/10 (копія)', date: '2026-10-23', status: 'planned', duration: 119 },
        { id: 'done5', name: 'Тренування 5/11', date: '2026-11-05', status: 'done', duration: 119, attendance: { p1: { present: true, updatedAt: '2026-11-05T18:00:00.000Z' } } },
        { id: 'plan5', name: 'Тренування 05/11', date: '2026-11-05', status: 'planned', duration: 90 },
        { id: 'other', name: 'Тренування 12', date: '2026-11-08', status: 'planned', duration: 100 }
      ],
      calendar: [
        { id: 'c1', trainingId: 'copy22', date: '2026-10-23', title: 'Тренування 22/10 (копія)' }
      ]
    }, { trainings: [] });
    const names = merged.trainings.map(t => String(t.name)).sort();
    assert.equal(names.join('|'), ['Тренування 12', 'Тренування 22/10', 'Тренування 5/11'].join('|'));
    const nov = merged.trainings.find(t => t.id === 'done5');
    assert.equal(nov.status, 'done');
    assert.equal(nov.attendance.p1.present, true);
    assert.equal(merged.calendar[0].trainingId, 'real22');
  });

  it('keeps a copy the coach made on purpose', () => {
    const merged = mergePayload({
      trainings: [
        { id: 'real', name: 'Тактика', date: '2026-11-20', status: 'planned' },
        { id: 'made', name: 'Тактика (копія)', date: '2026-11-20', status: 'planned', manualCopy: true }
      ]
    }, { trainings: [] });
    assert.equal(merged.trainings.length, 2);
    assert.equal(merged.trainings.some(t => t.id === 'made' && t.manualCopy), true);
    assert.equal(merged.trainings.some(t => t.id === 'real'), true);
  });

  it('does not restore a gift the coach already deleted', () => {
    const file = {
      settings: { coachStats: { updatedAt: '2026-11-01T00:00:00.000Z' } },
      gifts: [{ id: 'g_old', uid: 'g_old', playerId: 'p1', label: 'Кубок' }]
    };
    const local = {
      settings: { removedGiftIds: ['g_old'], coachStats: { updatedAt: '2026-11-07T00:00:00.000Z' } },
      gifts: []
    };
    const merged = mergePayload(local, file);
    assert.equal(merged.gifts.length, 0);
    assert.ok(merged.settings.removedGiftIds.indexOf('g_old') >= 0);
  });

  it('does not bring back a scheme the coach deleted', () => {
    const server = {
      settings: { removedBoardIds: ['old'], updatedAt: '2026-11-20T08:00:00.000Z' },
      boards: [],
      schemeAlbums: [{ id: 'a1', name: 'Зони', boardIds: [], updatedAt: '2026-11-20T08:00:00.000Z' }]
    };
    const phone = {
      settings: { updatedAt: '2026-11-19T08:00:00.000Z' },
      boards: [{ id: 'old', name: 'Стара', objects: [{ type: 'player' }], updatedAt: '2026-11-19T08:00:00.000Z' }],
      schemeAlbums: [{ id: 'a1', name: 'Зони', boardIds: ['old'], updatedAt: '2026-11-19T08:00:00.000Z' }]
    };
    const merged = mergePayload(server, phone);
    assert.equal(merged.boards.length, 0);
    assert.deepEqual(merged.schemeAlbums[0].boardIds, []);
    assert.ok(merged.settings.removedBoardIds.indexOf('old') >= 0);
  });

  it('does not bring back an album the coach deleted', () => {
    const server = {
      settings: { removedAlbumIds: ['a-old'], updatedAt: '2026-11-20T09:00:00.000Z' },
      schemeAlbums: [],
      schemeSections: [{ id: 'sec', name: 'Турнір', albumIds: [], updatedAt: '2026-11-20T09:00:00.000Z' }]
    };
    const phone = {
      settings: { updatedAt: '2026-11-20T10:00:00.000Z' },
      schemeAlbums: [{ id: 'a-old', name: 'Старий', boardIds: ['b1'], updatedAt: '2026-11-20T10:00:00.000Z' }],
      schemeSections: [{ id: 'sec', name: 'Турнір', albumIds: ['a-old'], updatedAt: '2026-11-20T10:00:00.000Z' }]
    };
    const merged = mergePayload(phone, server);
    assert.equal(merged.schemeAlbums.length, 0);
    assert.deepEqual(merged.schemeSections[0].albumIds, []);
    assert.ok(merged.settings.removedAlbumIds.indexOf('a-old') >= 0);
  });

  it('does not bring back a training the coach deleted', () => {
    const phone = {
      settings: { updatedAt: '2026-11-20T12:00:00.000Z' },
      trainings: [{ id: 't-old', name: 'Тренування 20/11', date: '2026-11-20', status: 'planned', updatedAt: '2026-11-20T12:00:00.000Z' }],
      calendar: [{ id: 'c-new', trainingId: 't-old', date: '2026-11-20', title: 'Тренування 20/11', updatedAt: '2026-11-20T12:00:00.000Z' }],
      matches: [{ id: 'm-old', opponent: 'Старий', date: '2026-11-21', updatedAt: '2026-11-20T12:00:00.000Z' }]
    };
    const server = {
      settings: { removedTrainingIds: ['t-old'], removedMatchIds: ['m-old'], updatedAt: '2026-11-20T11:00:00.000Z' },
      trainings: [],
      calendar: [],
      matches: []
    };
    const merged = mergePayload(phone, server);
    assert.equal(merged.trainings.length, 0);
    assert.equal(merged.calendar.length, 0);
    assert.equal(merged.matches.length, 0);
    assert.ok(merged.settings.removedTrainingIds.indexOf('t-old') >= 0);
  });

  it('keeps a draft a draft when the phone still has an old cancel stamp', () => {
    const phone = {
      trainings: [{
        id: 't10',
        name: 'Тренування 10/11',
        date: '2026-11-10',
        status: 'cancelled',
        cancelledAt: '2026-10-29T14:06:47.413Z',
        updatedAt: '2026-10-29T14:06:47.413Z'
      }]
    };
    const tablet = {
      trainings: [{
        id: 't10',
        name: 'Тренування 10/11',
        date: '2026-11-10',
        status: 'draft',
        cancelledAt: '2026-10-29T14:06:47.413Z',
        updatedAt: '2026-11-07T01:20:00.000Z'
      }]
    };
    const merged = mergePayload(phone, tablet);
    assert.equal(merged.trainings.length, 1);
    assert.equal(merged.trainings[0].status, 'draft');
    assert.equal(merged.trainings[0].cancelledAt, undefined);
  });

  it('keeps a birthday when the newer copy left the field blank', () => {
    const phone = {
      players: [{
        id: 'p-test',
        firstName: 'Тест',
        birthDate: '',
        phone: '',
        profile: { birthDate: '', phone: '' },
        updatedAt: '2026-11-07T03:00:00.000Z'
      }]
    };
    const tablet = {
      players: [{
        id: 'p-test',
        firstName: 'Тест',
        birthDate: '2004-03-12',
        phone: '+491700000',
        profile: { birthDate: '2004-03-12', phone: '+491700000', bio: 'проба' },
        updatedAt: '2026-11-06T12:00:00.000Z',
        structure: []
      }]
    };
    const merged = mergePayload(phone, tablet);
    const player = merged.players[0];
    assert.equal(player.birthDate, '2004-03-12');
    assert.equal(player.profile.birthDate, '2004-03-12');
    assert.equal(player.profile.phone, '+491700000');
    assert.equal(player.profile.bio, 'проба');
    const newerWins = mergePayload(tablet, {
      players: [{ id: 'p-test', firstName: 'Тест', birthDate: '2011-01-02', updatedAt: '2026-11-07T04:00:00.000Z' }]
    });
    assert.equal(newerWins.players[0].birthDate, '2011-01-02');
  });

  it('keeps a rescheduled 10/11 when the phone only updated attendance', () => {
    const phone = {
      trainings: [{
        id: 't10',
        name: 'Тренування 12',
        date: '2026-11-08',
        status: 'planned',
        createdAt: '2026-11-01T10:00:00.000Z',
        attendance: { p1: { present: true, updatedAt: '2026-11-08T18:00:00.000Z' } }
      }]
    };
    const tablet = {
      trainings: [{
        id: 't10',
        name: 'Тренування 10/11',
        date: '2026-11-10',
        time: '18:00',
        status: 'planned',
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-08T12:00:00.000Z',
        attendance: { p1: { present: false, updatedAt: '2026-11-01T10:00:00.000Z' } }
      }]
    };
    const merged = mergePayload(phone, tablet);
    assert.equal(merged.trainings.length, 1);
    assert.equal(merged.trainings[0].name, 'Тренування 10/11');
    assert.equal(merged.trainings[0].date, '2026-11-10');
    assert.equal(merged.trainings[0].status, 'planned');
    assert.equal(merged.trainings[0].attendance.p1.present, true);
  });

  it('keeps Johnson photo from last week when the phone card was edited later', () => {
    const phone = {
      players: [{
        id: 'johnson',
        firstName: 'Johnson',
        lastName: 'Mensah',
        number: 11,
        photoUrl: 'data:image/jpeg;base64,OLDPHOTO',
        updatedAt: '2026-11-13T10:00:00.000Z'
      }],
      trainings: [{
        id: 't-cancel',
        name: 'Тренування 12/11',
        date: '2026-11-12',
        status: 'done',
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-13T10:00:00.000Z',
        attendance: { johnson: { present: true, updatedAt: '2026-11-13T10:00:00.000Z' } }
      }]
    };
    const tablet = {
      players: [{
        id: 'johnson-tablet',
        firstName: 'Johnson',
        lastName: 'Mensah',
        number: 11,
        photoUrl: 'data:image/jpeg;base64,NEWPHOTO',
        birthDate: '2002-04-04',
        updatedAt: '2026-11-06T12:00:00.000Z',
        stamps: { photo: '2026-11-06T12:00:00.000Z', birthDate: '2026-11-06T12:00:00.000Z' }
      }],
      trainings: [{
        id: 't-cancel',
        name: 'Тренування 12/11',
        date: '2026-11-12',
        status: 'cancelled',
        cancelledAt: '2026-11-11T18:00:00.000Z',
        updatedAt: '2026-11-11T18:00:00.000Z',
        stamps: { status: '2026-11-11T18:00:00.000Z', schedule: '2026-11-11T18:00:00.000Z' },
        attendance: { johnson: { present: false, updatedAt: '2026-11-10T18:00:00.000Z' } }
      }],
      calendar: [{ id: 'bday-johnson-tablet', type: 'birthday', date: '2002-04-04', playerId: 'johnson-tablet' }]
    };
    const merged = mergePayload(phone, tablet);
    assert.equal(merged.players.length, 1);
    assert.equal(merged.players[0].id, 'johnson');
    assert.equal(merged.players[0].photoUrl, 'data:image/jpeg;base64,NEWPHOTO');
    assert.equal(merged.players[0].birthDate, '2002-04-04');
    assert.equal(merged.trainings.length, 1);
    assert.equal(merged.trainings[0].status, 'cancelled');
    assert.equal(merged.trainings[0].attendance.johnson.present, true);
    const again = mergePayload(merged, tablet);
    assert.equal(again.players.length, 1);
    assert.equal(again.players[0].photoUrl, 'data:image/jpeg;base64,NEWPHOTO');
    assert.equal(again.trainings.filter(t => t.status === 'cancelled').length, 1);
  });

  it('sums attendance from the phone and the tablet without a second session', () => {
    const merged = mergePayload({
      trainings: [{
        id: 'night',
        name: 'Вечір',
        date: '2026-11-09',
        status: 'planned',
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-01T10:00:00.000Z',
        attendance: { a: { present: true, updatedAt: '2026-11-09T20:00:00.000Z' } }
      }]
    }, {
      trainings: [{
        id: 'night',
        name: 'Вечір',
        date: '2026-11-09',
        status: 'planned',
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-01T10:00:00.000Z',
        attendance: {
          a: { present: false, updatedAt: '2026-11-09T18:00:00.000Z' },
          b: { present: true, updatedAt: '2026-11-09T21:00:00.000Z' }
        }
      }]
    });
    assert.equal(merged.trainings.length, 1);
    assert.equal(merged.trainings[0].attendance.a.present, true);
    assert.equal(merged.trainings[0].attendance.b.present, true);
  });

  it('keeps a saved match plan when a newer shell has empty text', () => {
    const merged = mergePayload({
      matches: [{
        id: 'm1',
        opponent: 'Кастель',
        date: '2026-11-15',
        status: 'planned',
        plan: 'Пресинг',
        plan1: 'Низький блок',
        warmup: 'Рондо',
        opponentLogo: 'data:image/png;base64,AAA',
        xi: ['gk'],
        updatedAt: '2026-11-13T10:00:00.000Z',
        stamps: { plan: '2026-11-13T10:00:00.000Z' }
      }]
    }, {
      matches: [{
        id: 'm1',
        opponent: 'Кастель',
        date: '2026-11-15',
        status: 'planned',
        plan: '',
        plan1: '',
        warmup: '',
        updatedAt: '2026-11-13T12:00:00.000Z'
      }]
    });
    assert.equal(merged.matches.length, 1);
    assert.equal(merged.matches[0].plan, 'Пресинг');
    assert.equal(merged.matches[0].plan1, 'Низький блок');
    assert.equal(merged.matches[0].warmup, 'Рондо');
    assert.equal(merged.matches[0].opponentLogo, 'data:image/png;base64,AAA');
    assert.deepEqual(merged.matches[0].xi, ['gk']);
  });

  it('keeps the squad the coach just changed over the older server copy', () => {
    const merged = mergePayload({
      matches: [{
        id: 'm1',
        opponent: 'Кастель',
        xi: ['old'],
        bench: [],
        updatedAt: '2026-11-20T09:00:00.000Z',
        stamps: { plan: '2026-11-20T08:00:00.000Z' }
      }],
      activeBoard: {
        updatedAt: '2026-11-20T09:00:00.000Z',
        objects: [{ id: 'a', x: 0.2 }, { id: 'b', x: 0.4 }]
      }
    }, {
      matches: [{
        id: 'm1',
        opponent: 'Кастель',
        xi: ['new'],
        bench: ['old'],
        updatedAt: '2026-11-20T10:00:00.000Z',
        stamps: { plan: '2026-11-20T10:00:00.000Z' }
      }],
      activeBoard: {
        updatedAt: '2026-11-20T10:00:00.000Z',
        objects: [{ id: 'a', x: 0.7 }, { id: 'b', x: 0.4 }]
      }
    });
    assert.deepEqual(merged.matches[0].xi, ['new']);
    assert.deepEqual(merged.matches[0].bench, ['old']);
    assert.equal(merged.activeBoard.objects[0].x, 0.7);
  });

  it('keeps the player gift choice and the newer coach load', () => {
    const merged = mergePayload({
      players: [{
        id: 'johnson',
        firstName: 'Джонсон',
        lastName: 'Джонсон',
        load: 2,
        loadLog: [{ at: '2026-11-10T10:00:00.000Z', value: 2, prev: 0 }],
        wornGift: { key: 'ball', giftId: 'ball', at: '2026-11-12T10:00:00.000Z', by: 'player' },
        stamps: { load: '2026-11-10T10:00:00.000Z', wornGift: '2026-11-12T10:00:00.000Z' }
      }],
      gifts: [
        { id: 'ball', uid: 'ball', playerId: 'johnson', giftId: 'ball', featured: true },
        { id: 'crest', uid: 'crest', playerId: 'johnson', giftId: 'crest', featured: false }
      ]
    }, {
      players: [{
        id: 'johnson',
        firstName: 'Джонсон',
        lastName: 'Джонсон',
        load: 7,
        loadLog: [{ at: '2026-11-13T10:00:00.000Z', value: 7, prev: 2 }],
        wornGift: { key: 'crest', giftId: 'crest', at: '2026-11-13T11:00:00.000Z', by: 'coach' },
        updatedAt: '2026-11-13T11:00:00.000Z',
        stamps: { load: '2026-11-13T10:00:00.000Z', wornGift: '2026-11-13T11:00:00.000Z' }
      }],
      gifts: [
        { id: 'ball', uid: 'ball', playerId: 'johnson', giftId: 'ball', featured: false },
        { id: 'crest', uid: 'crest', playerId: 'johnson', giftId: 'crest', featured: true }
      ]
    });
    assert.equal(merged.players.length, 1);
    assert.equal(merged.players[0].wornGift.by, 'player');
    assert.equal(merged.players[0].wornGift.giftId, 'ball');
    assert.equal(merged.players[0].load, 7);
    assert.equal(merged.players[0].loadLog.length, 2);
    assert.equal(merged.gifts.find(g => g.id === 'ball').featured, true);
    assert.equal(merged.gifts.find(g => g.id === 'crest').featured, false);
  });

  it('does not fold a future 10/11 into an older session with the same name', () => {
    const merged = mergePayload({
      trainings: [
        { id: 'old', name: 'Тренування 10/11', date: '2025-11-10', status: 'done' },
        { id: 'next', name: 'Тренування 10/11', date: '10.11.2026', status: 'planned', time: '18:00' }
      ]
    }, { trainings: [] });
    assert.equal(merged.trainings.length, 2);
    const next = merged.trainings.find(t => t.id === 'next');
    assert.equal(next.date, '2026-11-10');
    assert.equal(next.status, 'planned');
  });

  it('keeps scheme albums and their links when the newer copy left them blank', () => {
    const merged = mergePayload({
      schemeAlbums: [{ id: 'zones', name: 'Зони', boardIds: ['sch-1'], updatedAt: '2026-11-14T10:00:00.000Z' }],
      trainings: [{ id: 't1', name: 'Тактика', schemeAlbumId: 'zones', updatedAt: '2026-11-14T10:00:00.000Z' }],
      matches: [{ id: 'm1', opponent: 'Кастель', schemeAlbumId: 'zones', updatedAt: '2026-11-14T10:00:00.000Z' }]
    }, {
      schemeAlbums: [{ id: 'zones', name: 'Зони', boardIds: [], updatedAt: '2026-11-14T15:00:00.000Z' }, { id: 'standards', name: 'Стандарти', boardIds: ['sch-2'], updatedAt: '2026-11-14T15:00:00.000Z' }],
      trainings: [{ id: 't1', name: 'Тактика', updatedAt: '2026-11-14T15:00:00.000Z', attendance: { p1: { present: true, updatedAt: '2026-11-14T15:00:00.000Z' } } }],
      matches: [{ id: 'm1', opponent: 'Кастель', updatedAt: '2026-11-14T15:00:00.000Z' }]
    });
    assert.equal(merged.schemeAlbums.length, 2);
    const zones = merged.schemeAlbums.find(a => a.id === 'zones');
    assert.deepEqual(zones.boardIds, ['sch-1']);
    assert.equal(merged.trainings[0].schemeAlbumId, 'zones');
    assert.equal(merged.matches[0].schemeAlbumId, 'zones');
  });

  it('keeps the coach photo when a newer copy left it blank', () => {
    const merged = mergePayload({
      settings: {
        coachName: 'Artem Serdiuk',
        coachPhoto: 'data:image/jpeg;base64,abc',
        coachStats: { updatedAt: '2026-11-14T10:00:00.000Z' }
      }
    }, {
      settings: {
        coachName: 'Artem Serdiuk',
        coachPhoto: '',
        coachStats: { appMs: 20, updatedAt: '2026-11-14T16:00:00.000Z' }
      }
    });
    assert.equal(merged.settings.coachPhoto, 'data:image/jpeg;base64,abc');
    assert.equal(merged.settings.coachName, 'Artem Serdiuk');
  });

  it('merges a later empty Johnson with last week photos, load and the drawn board', () => {
    const older = {
      players: [{
        id: 'p1',
        firstName: 'Артем',
        lastName: 'Сердюк',
        photoUrl: 'data:image/jpeg;base64,OLD',
        updatedAt: '2026-11-14T10:00:00.000Z'
      }],
      trainings: [{ id: 't1', name: 'старе', date: '2026-11-14', updatedAt: '2026-11-14T10:00:00.000Z' }],
      matches: [{ id: 'm1', opponent: 'Старе', updatedAt: '2026-11-14T10:00:00.000Z' }],
      activeBoard: { objects: [{ id: 'o1' }, { id: 'o2' }] },
      settings: { logoData: 'LOGO', coachPhoto: 'COACH', updatedAt: '2026-11-14T10:00:00.000Z' },
      feedMeta: { load: { p1: 3 }, loadAt: { p1: '2026-11-14T10:00:00.000Z' } }
    };
    const newer = {
      players: [{
        id: 'p1',
        firstName: 'Артем',
        lastName: 'Сердюк',
        photoUrl: '',
        profilePhoto: '',
        updatedAt: '2026-11-16T10:00:00.000Z'
      }],
      trainings: [
        { id: 't1', name: 'старе', date: '2026-11-14', updatedAt: '2026-11-14T10:00:00.000Z' },
        { id: 't2', name: 'нове', date: '2026-11-16', updatedAt: '2026-11-16T10:00:00.000Z' }
      ],
      matches: [
        { id: 'm1', opponent: 'Старе', updatedAt: '2026-11-14T10:00:00.000Z' },
        { id: 'm2', opponent: 'Нове', updatedAt: '2026-11-16T10:00:00.000Z' }
      ],
      activeBoard: { objects: [] },
      settings: { logoData: '', coachPhoto: '', updatedAt: '2026-11-16T12:00:00.000Z' },
      feedMeta: { load: { p1: 5 }, loadAt: { p1: '2026-11-16T10:00:00.000Z' } }
    };
    const merged = mergePayload(newer, older);
    assert.equal(merged.players.length, 1);
    assert.equal(merged.players[0].photoUrl, 'data:image/jpeg;base64,OLD');
    assert.equal(merged.trainings.length, 2);
    assert.equal(merged.matches.length, 2);
    assert.equal(merged.activeBoard.objects.length, 2);
    assert.equal(merged.settings.logoData, 'LOGO');
    assert.equal(merged.settings.coachPhoto, 'COACH');
    assert.equal(merged.feedMeta.load.p1, 5);
    assert.equal(merged.feedMeta.loadAt.p1, '2026-11-16T10:00:00.000Z');
    const back = mergePayload(older, newer);
    assert.equal(back.players.length, 1);
    assert.equal(back.players[0].photoUrl, 'data:image/jpeg;base64,OLD');
    assert.equal(back.activeBoard.objects.length, 2);
    assert.equal(back.trainings.length, 2);
  });

  it('keeps the newer chip positions when both boards are drawn', () => {
    const phone = {
      activeBoard: {
        updatedAt: '2026-11-20T01:00:00.000Z',
        objects: [{ id: 'p1', x: 0.2, y: 0.4 }, { id: 'p2', x: 0.8, y: 0.6 }]
      }
    };
    const server = {
      activeBoard: {
        updatedAt: '2026-11-20T00:10:00.000Z',
        objects: [{ id: 'p1', x: 0.5, y: 0.5 }, { id: 'p2', x: 0.5, y: 0.7 }]
      }
    };
    const merged = mergePayload(server, phone);
    assert.equal(merged.activeBoard.objects[0].x, 0.2);
    const olderPhone = mergePayload(phone, server);
    assert.equal(olderPhone.activeBoard.objects[0].x, 0.2);
  });

  it('drops a demo squad once a real player is in the file and keeps a lone test card', () => {
    const mixed = mergePayload({
      players: [
        { id: 'p01', firstName: 'Олександр', lastName: 'Коваль' },
        { id: 'yehor', firstName: 'Єгор', lastName: 'Коваль', number: 8 }
      ]
    }, {
      players: [{ id: 'slop', firstName: 'Slop', lastName: 'Test' }]
    });
    assert.equal(mixed.players.length, 1);
    assert.equal(mixed.players[0].id, 'yehor');
    const only = mergePayload({
      players: [{ id: 'p-test', firstName: 'Тест', birthDate: '2001-01-01' }]
    }, {});
    assert.equal(only.players.length, 1);
    assert.equal(only.players[0].birthDate, '2001-01-01');
  });

  it('keeps the larger player time and the newer online stamp', () => {
    const now = Date.now();
    const iso = (ms) => new Date(now - ms).toISOString();
    const coachAt = iso(2 * 3600 * 1000);
    const older = iso(4 * 3600 * 1000);
    const newer = iso(30 * 60 * 1000);
    const merged = mergePayload({
      settings: {
        coachStats: { appMs: 10, updatedAt: older },
        playerUsage: { p9: { appMs: 60000, boardMs: 15000, updatedAt: older } },
        presence: {
          coach: { at: coachAt, name: 'Тренер', role: 'coach' },
          'p:p9': { at: older, name: 'Єгор', role: 'player', playerId: 'p9' }
        }
      }
    }, {
      settings: {
        coachStats: { appMs: 20, updatedAt: newer },
        playerUsage: { p9: { appMs: 30000, boardMs: 45000, updatedAt: newer } },
        presence: {
          'p:p9': { at: newer, name: 'Єгор', role: 'player', playerId: 'p9' }
        }
      }
    });
    assert.equal(merged.settings.playerUsage.p9.appMs, 60000);
    assert.equal(merged.settings.playerUsage.p9.boardMs, 45000);
    assert.equal(merged.settings.presence['p:p9'].at, newer);
    assert.equal(merged.settings.presence.coach.name, 'Тренер');
    assert.equal(merged.settings.coachStats.appMs, 20);
  });

  it('keeps the renamed album when the player phone is newer but still has the old name', () => {
    const merged = mergePayload({
      schemeAlbums: [{
        id: 'a1', name: 'Нове', updatedAt: '2026-11-20T12:00:00.000Z',
        stamps: { name: '2026-11-20T17:00:00.000Z' }, boardIds: ['b1']
      }]
    }, {
      schemeAlbums: [{
        id: 'a1', name: 'Старе', updatedAt: '2026-11-20T18:00:00.000Z', boardIds: ['b1']
      }]
    });
    assert.equal(merged.schemeAlbums[0].name, 'Нове');
  });

  it('keeps the scheme order from the newer order stamp', () => {
    const merged = mergePayload({
      schemeAlbums: [{
        id: 'a1', name: 'А', updatedAt: '2026-11-20T18:00:00.000Z',
        boardIds: ['b2', 'b1']
      }]
    }, {
      schemeAlbums: [{
        id: 'a1', name: 'А', updatedAt: '2026-11-20T12:00:00.000Z',
        boardIds: ['b1', 'b2'],
        stamps: { boardIds: '2026-11-20T17:00:00.000Z' }
      }]
    });
    assert.deepEqual(merged.schemeAlbums[0].boardIds, ['b1', 'b2']);
  });

  it('keeps a stamped club name when the other phone has a newer coach clock', () => {
    const merged = mergePayload({
      settings: {
        clubName: 'СТАРА',
        clubShort: 'СТ',
        coachStats: { updatedAt: '2026-11-20T18:00:00.000Z' },
        stamps: { clubName: '2026-11-01T00:00:00.000Z' }
      }
    }, {
      settings: {
        clubName: 'НОВА',
        clubShort: 'НВ',
        coachStats: { updatedAt: '2026-11-02T00:00:00.000Z' },
        stamps: { clubName: '2026-11-20T12:00:00.000Z', clubShort: '2026-11-20T12:00:00.000Z' }
      }
    });
    assert.equal(merged.settings.clubName, 'НОВА');
    assert.equal(merged.settings.clubShort, 'НВ');
  });

  it('keeps the opponent logo from the newer logo stamp', () => {
    const merged = mergePayload({
      matches: [{
        id: 'm1', opponent: 'FC', opponentLogo: 'data:image/png;base64,abc',
        stamps: { plan: '2026-11-20T10:00:00.000Z', opponentLogo: '2026-11-20T10:00:00.000Z' }
      }]
    }, {
      matches: [{
        id: 'm1', opponent: 'FC', opponentLogo: '', plan: 'text',
        stamps: { plan: '2026-11-20T12:00:00.000Z', opponentLogo: '2026-11-20T09:00:00.000Z' }
      }]
    });
    assert.equal(merged.matches[0].opponentLogo, 'data:image/png;base64,abc');
  });

  it('unions assistant approvals and drops a rejected one', () => {
    const merged = mergePayload({
      settings: {
        approvals: [{ id: 'a1', at: '2026-11-20T10:00:00.000Z', summary: 'назва', status: 'pending' }],
        coachStats: { updatedAt: '2026-11-20T18:00:00.000Z' }
      }
    }, {
      settings: {
        approvals: [{ id: 'a1', at: '2026-11-20T12:00:00.000Z', summary: 'назва', status: 'approved' }],
        removedApprovalIds: ['a1'],
        coachStats: { updatedAt: '2026-11-20T11:00:00.000Z' }
      }
    });
    assert.equal((merged.settings.approvals || []).length, 0);
    assert.equal(merged.settings.removedApprovalIds.length, 1);
    assert.equal(String(merged.settings.removedApprovalIds[0]), 'a1');
  });

  it('describes an assistant change without treating a clock tick as a club edit', () => {
    const { diffClub, describeChanges } = context.ClubMerge;
    const before = { settings: { clubName: 'СТАРА', presence: { coach: { at: 1 } } }, matches: [{ id: 'm1', opponent: 'A' }] };
    const after = { settings: { clubName: 'НОВА', presence: { coach: { at: 2 } } }, matches: [{ id: 'm1', opponent: 'A', opponentLogo: 'data:image/png;base64,qq' }] };
    const changes = diffClub(before, after);
    assert.equal(changes.length, 2);
    assert.match(describeChanges(changes), /назва клубу/);
    assert.match(describeChanges(changes), /матч/);
  });
});
