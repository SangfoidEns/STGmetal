import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const context = { window: {} };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(
  readFileSync(new URL('../src/data/schemes.js', import.meta.url), 'utf8') + '\n' +
  readFileSync(new URL('../src/core/coachTools.js', import.meta.url), 'utf8') +
  '\nthis.CoachTools = CoachTools;\nthis.SCHEMES = SCHEMES;',
  context
);

function player(id, number, position, status) {
  return { id, number, position, status: status || 'active', lastName: id };
}

describe('match planning', () => {
  it('keeps the 3-1-2-2-1-1 roles and seats the best eleven', () => {
    const roles = Array.from(context.CoachTools.schemeRoles('3-1-2-2-1-1'));
    assert.equal(roles.join(','), 'GK,DEF,DEF,DEF,MID,MID,MID,ATT,ATT,MID,ATT');
    const players = [player('gk', 1, 'GK')];
    for (let i = 2; i <= 13; i++) players.push(player('p' + i, i, i < 6 ? 'CB' : (i < 10 ? 'CM' : 'ST')));
    players.push(player('hurt', 99, 'ST', 'injured'));
    const att = { hurt: 100 };
    players.forEach((item, index) => { if (item.id !== 'hurt') att[item.id] = 90 - index; });
    const squad = context.CoachTools.buildMatchSquad(players, '3-1-2-2-1-1', (item) => att[item.id]);
    assert.equal(squad.xi[0], 'gk');
    assert.equal(squad.xi.filter(Boolean).length, 11);
    assert.equal(squad.bench.includes('p13'), true);
    assert.equal(squad.bench.includes('hurt'), true);
    assert.equal(squad.xi.includes('hurt'), false);
  });

  it('builds the match week once and does not duplicate it', () => {
    const days = Array.from(context.CoachTools.matchWeekDays('2026-11-15'));
    assert.equal(days.map(day => day.md).join(','), 'MD-3,MD-2,MD-1,MD,MD+1');
    assert.equal(days.find(day => day.md === 'MD').date, '2026-11-15');
    assert.equal(days.find(day => day.md === 'MD-1').date, '2026-11-14');
    const state = { trainings: [], calendar: [] };
    const match = { id: 'm1', date: '2026-11-15', time: '15:00', opponent: 'Кастель', stadium: 'База' };
    const first = context.CoachTools.applyMatchWeek(state, match);
    const second = context.CoachTools.applyMatchWeek(state, match);
    assert.equal(first.added, 5);
    assert.equal(second.added, 0);
    assert.equal(state.trainings.length, 4);
    assert.equal(state.trainings.filter(item => item.matchId === 'm1' && item.status === 'planned').length, 4);
    assert.equal(state.calendar.filter(item => item.type === 'MATCH').length, 1);
  });
});
