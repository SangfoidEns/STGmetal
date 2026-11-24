import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function iso(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function boot(state) {
  const context = { console, Store: { get() { return state; } } };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/core/loadModel.js', import.meta.url), 'utf8'), context, { filename: 'loadModel.js' });
  return context.LoadModel;
}

describe('automatic load from ratings', () => {
  it('weights a match more than a training of the same length and rating', () => {
    const LM = boot({
      trainings: [{
        id: 't1', date: iso(-2), status: 'done', duration: 90, intensity: 8,
        attendance: { p1: { present: true, rpe: 8 } }
      }],
      matches: [{
        id: 'm1', date: iso(-1), status: 'played', opponent: 'Друзі', minutes: 90,
        attendance: { p1: { present: true, rating: 8 } }
      }]
    });
    const form = LM.formLoad('p1');
    assert.equal(form.trainN, 1);
    assert.equal(form.matchN, 1);
    assert.equal(form.trainUnits, 720);
    assert.equal(form.matchUnits, Math.round(720 * LM.MATCH_WEIGHT));
    assert.ok(form.matchUnits > form.trainUnits);
    assert.equal(form.quality, 8);
    assert.ok(form.score > 8);
    assert.ok(form.events[1].weight > form.events[0].weight);
  });

  it('lets the match pull the average above the plain middle', () => {
    const LM = boot({
      trainings: [{
        id: 't1', date: iso(-4), status: 'done', duration: 60, intensity: 4,
        attendance: { p1: { present: true, rpe: 4 } }
      }],
      matches: [{
        id: 'm1', date: iso(-1), status: 'played', minutes: 90,
        attendance: { p1: { present: true, rating: 9 } }
      }]
    });
    const form = LM.formLoad('p1');
    const plain = (4 + 9) / 2;
    assert.ok(form.quality > plain);
    assert.ok(form.quality > 7);
    assert.equal(form.quality, 7.6);
    assert.ok(form.score > 7);
  });

  it('ignores an absence, a cancelled match and a session outside the window', () => {
    const LM = boot({
      trainings: [
        { id: 'miss', date: iso(-1), status: 'done', duration: 80, attendance: { p1: { present: false, rpe: 9 } } },
        { id: 'old', date: iso(-40), status: 'done', duration: 80, attendance: { p1: { present: true, rpe: 10 } } },
        { id: 'ok', date: iso(-2), status: 'done', duration: 80, attendance: { p1: { present: true, rpe: 6 } } }
      ],
      matches: [
        { id: 'off', date: iso(-1), status: 'cancelled', attendance: { p1: { present: true, rating: 10 } } }
      ]
    });
    const form = LM.formLoad('p1');
    assert.equal(form.trainN, 1);
    assert.equal(form.matchN, 0);
    assert.equal(form.quality, 6);
    assert.ok(form.score < 6);
    assert.equal(form.trainUnits, 480);
  });

  it('adds the played match onto the warm-up day so the day stays taller than the warm-up', () => {
    const day = iso(-1);
    const trainings = [
      { id: 'long', date: iso(-3), status: 'done', duration: 75, intensity: 6 },
      { id: 'wu', date: day, status: 'done', duration: 20, intensity: 3, md: 'WU' }
    ];
    const matches = [{
      id: 'm1', date: day, status: 'played', minutes: 90,
      attendance: { p1: { present: true, rating: 8 } }
    }];
    const LM = boot({ trainings: trainings, matches: matches });
    const days = LM.dayActivity(trainings, matches);
    const matchDay = days.find(function (row) { return row.date === day; });
    const trainDay = days.find(function (row) { return row.date === iso(-3); });
    assert.ok(matchDay);
    assert.equal(matchDay.trainings, 1);
    assert.equal(matchDay.matches, 1);
    assert.ok(matchDay.minutes > 20);
    assert.ok(matchDay.load > 20 * 3);
    assert.ok(matchDay.minutes > trainDay.minutes);
    assert.ok(matchDay.load > trainDay.load);
  });

  it('uses the minutes the coach wrote for that player', () => {
    const LM = boot({
      matches: [{
        id: 'm1', date: iso(-1), status: 'played', minutes: 90,
        xi: ['p1'],
        attendance: { p1: { present: true, rating: 8, minutes: 20 } }
      }]
    });
    const match = LM._matches()[0];
    assert.equal(LM.playerMinutes(match, 'p1'), 20);
    assert.equal(LM.matchPlayerLoad(match, 'p1'), Math.round(20 * 8 * LM.MATCH_WEIGHT));
  });

  it('ranks a player who trains and plays above a player from one training', () => {
    const trainings = [];
    for (let i = 1; i <= 6; i++) {
      trainings.push({
        id: 't' + i,
        date: iso(-i),
        status: 'done',
        duration: 90,
        attendance: {
          rare: i === 1 ? { present: true, rpe: 9 } : { present: false },
          reg: { present: true, rpe: 6 }
        }
      });
    }
    const matches = [1, 2].map(function (i) {
      return {
        id: 'm' + i,
        date: iso(-i),
        status: 'played',
        minutes: 90,
        opponent: 'Суперник',
        attendance: {
          rare: { present: false, rating: 9 },
          reg: { present: true, rating: 7, goals: i === 1 ? 1 : 0 }
        }
      };
    });
    const LM = boot({ trainings: trainings, matches: matches });
    const rare = LM.formLoad('rare');
    const reg = LM.formLoad('reg');
    assert.equal(rare.trainN, 1);
    assert.equal(rare.matchN, 0);
    assert.equal(reg.trainN, 6);
    assert.equal(reg.matchN, 2);
    assert.equal(reg.goals, 1);
    assert.ok(rare.score < 4);
    assert.ok(reg.score > rare.score + 3);
  });

  it('averages only the player own mark, not the planned session intensity', () => {
    const LM = boot({
      trainings: [
        { id: 'a', date: iso(-2), status: 'done', duration: 80, intensity: 9, attendance: { yehor: { present: true }, other: { present: true, rpe: 4 } } },
        { id: 'b', date: iso(-1), status: 'done', duration: 80, intensity: 8, attendance: { yehor: { present: true, rpe: 5 }, other: { present: true, rpe: 5 } } }
      ]
    });
    assert.equal(LM.avgPlayerRpe(LM._trainings(), 'yehor'), 5);
    assert.equal(LM.avgPlayerRpe(LM._trainings(), 'other'), 4.5);
  });

  it('builds a personal number and does not copy the planned intensity', () => {
    const sessions = [0, 1, 2, 3].map(i => ({
      id: 't' + i,
      date: iso(-i - 1),
      status: 'done',
      duration: 80,
      intensity: 9,
      attendance: {
        yehor: { present: true },
        adult: { present: true, rpe: 5 },
        teen: { present: true, rpe: 5 }
      }
    }));
    const LM = boot({ trainings: sessions, matches: [] });
    const adult = { id: 'adult', age: 25, heightCm: 185, weightKg: 80, readiness: 90, status: 'available' };
    const teen = { id: 'teen', age: 14, heightCm: 165, weightKg: 55, readiness: 90, status: 'available' };
    const yehor = { id: 'yehor', age: 25, heightCm: 185, weightKg: 80, readiness: 90, status: 'available' };
    const adultScore = LM.personalRpe(adult);
    const teenScore = LM.personalRpe(teen);
    const yehorScore = LM.personalRpe(yehor);
    assert.ok(teenScore > adultScore + 0.4);
    assert.ok(Math.abs(yehorScore - adultScore) < 0.4);
    assert.ok(yehorScore < 8);
  });
});
