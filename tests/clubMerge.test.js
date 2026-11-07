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
});
