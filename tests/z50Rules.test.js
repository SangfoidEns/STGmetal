import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function boot() {
  const store = {
    players: [
      { id: 'p1', readiness: 80, load: 2 },
      { id: 'p2', readiness: 60, load: 4 }
    ],
    trainings: [
      { id: 'c1', status: 'cancelled', date: '2026-10-22', name: 'Тренування 22/10', attendance: { p1: { present: false } } },
      { id: 'd1', status: 'done', date: '2026-11-01', name: 'Неділя', attendance: { p1: { present: false, rpe: 5 } } },
      { id: 'ok', status: 'done', date: '2026-11-05', name: 'Був', attendance: { p1: { present: true, rpe: 6 }, p2: { present: true } } }
    ],
    gifts: new Array(64).fill({ playerId: 'other' }),
    boards: [],
    settings: { lang: 'de' }
  };
  const local = {};
  const context = {
    console,
    setTimeout,
    clearTimeout,
    Store: { get() { return store; } },
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(local, k) ? local[k] : null; },
      setItem(k, v) { local[k] = String(v); },
      removeItem(k) { delete local[k]; }
    },
    document: {
      documentElement: { setAttribute() {} },
      querySelectorAll() { return []; },
      getElementById() { return null; }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  const load = (rel, names) => {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8');
    const expose = (names || []).map(n => 'this.' + n + '=' + n + ';').join('');
    vm.runInContext(src + '\n' + expose, context, { filename: rel });
  };
  load('../src/core/loadModel.js', ['LoadModel']);
  load('../src/core/i18n.js', ['I18n']);
  load('../src/core/coachTools.js', ['CoachTools', 'PlayerProgress']);
  load('../src/ui/views.js', ['Views']);
  context.__store = store;
  context.__local = local;
  return context;
}

describe('z50 club rules', () => {
  it('default language is Ukrainian even when the club file says German', () => {
    const ctx = boot();
    ctx.I18n.initFromStore();
    assert.equal(ctx.I18n.getLang(), 'uk');
    ctx.I18n.setLang('de');
    assert.equal(ctx.__local.metalist_lang_choice, 'de');
    assert.equal(ctx.__store.settings.lang, undefined);
    ctx.I18n.initFromStore();
    assert.equal(ctx.I18n.getLang(), 'de');
  });

  it('a cancelled session with present:false is not a miss', () => {
    const ctx = boot();
    assert.equal(ctx.LoadModel.isCancelled({ status: 'cancelled', attendance: { p1: { present: false } } }), true);
    const stats = ctx.Views._playerStats('p1');
    assert.equal(stats.absent, 1);
    assert.equal(stats.present, 1);
    assert.equal(stats.cancelled, 1);
    const rate = ctx.LoadModel.attendanceRate(ctx.__store.trainings, 'p1');
    assert.equal(rate, 50);
  });

  it('coach level follows the squad average, not gift count', () => {
    const ctx = boot();
    const a = ctx.PlayerProgress.compute('p1');
    const b = ctx.PlayerProgress.compute('p2');
    const coach = ctx.CoachTools.coachProgress();
    const avg = Math.round(((a.level || 1) + (b.level || 1)) / 2);
    assert.equal(coach.level, Math.max(1, avg));
    assert.ok(coach.level < 10, 'gifts must not push the coach to the old inflated level');
    assert.equal(coach.players, 2);
    ctx.__store.trainings.push({
      id: 'draft-last', status: 'draft', date: '2026-11-03', name: 'Тренування 03/11',
      attendance: { p1: { present: true, rpe: 7 } }
    });
    const again = ctx.PlayerProgress.compute('p1');
    assert.equal(again.present, 2);
    ctx.__store.trainings.push(
      { id: 's2', status: 'done', date: '2026-11-04', attendance: { p1: { present: true } } },
      { id: 's3', status: 'done', date: '2026-11-02', attendance: { p1: { present: true } } }
    );
    const streaked = ctx.PlayerProgress.compute('p1');
    assert.ok(streaked.streak >= 3);
    assert.equal(streaked.xpStreak, 30);
  });

  it('keeps a conducted session even when an old cancel stamp is still on it', () => {
    const ctx = boot();
    ctx.sanitize = (v) => String(v == null ? '' : v);
    assert.equal(ctx.LoadModel.isCancelled({ status: 'done', cancelledAt: '2026-11-05T10:00:00.000Z' }), false);
    assert.equal(ctx.LoadModel.isCancelled({ status: 'cancelled', cancelledAt: '2026-11-03T10:00:00.000Z' }), true);
    ctx.__store.players[0].firstName = 'Сергій';
    ctx.__store.players[0].lastName = 'Бобік';
    ctx.__store.players[0].number = 7;
    ctx.__store.players[0].position = 'DM';
    ctx.__store.trainings.push({
      id: 'held511', status: 'done', date: '2026-11-05', name: 'Тренування 5/11',
      cancelledAt: '2026-11-05T09:00:00.000Z',
      attendance: { p1: { present: true, rpe: 7 } }
    });
    const stats = ctx.PlayerProgress.compute('p1');
    assert.ok(stats.history.some(h => h.name === 'Тренування 5/11' && h.kind === 'present'));
    const card = ctx.Views._squadPlaque(ctx.__store.players[0], 72, 'Основа');
    assert.equal(card.includes('#7 Сергій'), false);
    assert.match(card, /Сергій Бобік/);
    assert.match(card, /#7 · DM · Основа/);
    assert.match(card, /Відвідуваність 72% · \d+ XP/);
    assert.match(card, /pl-card-marks|pl-card-name-txt/);
  });

  it('counts 5/11 when the coach was away and shows it ahead of gifts', () => {
    const ctx = boot();
    ctx.sanitize = (v) => String(v == null ? '' : v);
    ctx.__store.players[1].isCaptain = false;
    ctx.__store.settings.staff = { assistants: ['p2'], captainId: 'p1', presidentId: 'p1' };
    ctx.__store.gifts.push({ playerId: 'p2', label: 'Вогонь', createdAt: '2026-11-06' });
    ctx.__store.trainings.push({
      id: 'nov5b', status: 'done', date: '2026-11-05', name: 'Тренування 5/11',
      coachPresent: false,
      attendance: { p2: { rpe: 7 }, p1: { claimed: true } }
    });
    const stats = ctx.PlayerProgress.compute('p2');
    assert.equal(stats.present, 2);
    assert.equal(ctx.PlayerProgress.attendanceMark({ claimed: true }), null);
    assert.equal(ctx.PlayerProgress.attendanceMark({ present: false }), false);
    const html = ctx.Views._accountProgress('p2');
    const sessionAt = html.indexOf('Тренування 5/11');
    const giftAt = html.indexOf('Вогонь');
    assert.ok(sessionAt >= 0, '5/11 missing from the account');
    assert.ok(html.includes('без тренера'));
    assert.ok(giftAt < 0 || sessionAt < giftAt);
    const posts = ctx.Views.appointments(ctx.__store.players[1]).map(a => a.short).join(',');
    const captain = ctx.Views.appointments({ id: 'p1', isCaptain: true }).map(a => a.short).join(',');
    assert.equal(posts, 'П');
    assert.ok(captain.includes('C') && captain.includes('ПР'));
    assert.equal(ctx.Views.appointments({ id: 'p3' }).length, 0);
  });

  it('scheme thumbnail draws every arrow and every opponent', () => {
    const ctx = boot();
    const objects = [];
    for (let i = 0; i < 40; i++) objects.push({ id: 'pl' + i, type: 'player', x: 0.2, y: 0.2 + i * 0.01, number: i + 1, team: 'own' });
    for (let i = 0; i < 11; i++) objects.push({ id: 'op' + i, type: 'opponent', x: 0.2 + i * 0.05, y: 0.08 + (i % 2) * 0.7, number: i + 1, team: 'opp' });
    ['pass', 'run', 'dribble', 'shot', 'press', 'arrowDash'].forEach((type, i) => {
      objects.push({ id: 'ar' + i, type, x: 0.2, y: 0.4, x2: 0.7, y2: 0.55 + i * 0.02, color: '#3498db' });
    });
    const svg = ctx.Views._schemeThumbSvg({ objects });
    const lines = (svg.match(/<line /g) || []).length;
    const oppMarks = (svg.match(/#e74c3c/g) || []).length;
    assert.ok(lines >= 6, 'arrows missing from thumbnail');
    assert.ok(oppMarks >= 11, 'opponent chips missing from thumbnail');
    assert.ok(svg.includes('preserveAspectRatio'));
  });
});
