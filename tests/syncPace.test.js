import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function loadClub() {
  const timers = [];
  const context = {
    console,
    fetch() { return Promise.resolve({ ok: false, status: 500, json() { return Promise.resolve({}); } }); },
    setTimeout(fn, ms) {
      const id = timers.length + 1;
      timers.push({ id, fn, ms });
      return id;
    },
    clearTimeout(id) {
      const at = timers.findIndex(item => item.id === id);
      if (at >= 0) timers.splice(at, 1);
    },
    setInterval(fn, ms) {
      context._interval = ms;
      return 1;
    },
    clearInterval() {},
    window: null,
    document: { visibilityState: 'visible', addEventListener() {} }
  };
  context.window = {
    addEventListener(name) { context._events.push(name); }
  };
  context._events = [];
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/core/supabaseClub.js', import.meta.url), 'utf8') + '\nthis.SupabaseClub = SupabaseClub;', context, { filename: 'supabaseClub.js' });
  context.timers = timers;
  return context;
}

describe('club sync stays quiet', () => {
  it('asks the server once a minute and also when the link comes or goes', () => {
    const ctx = loadClub();
    const club = ctx.SupabaseClub;
    assert.equal(club.POLL_MS, 60000);
    assert.equal(club.PUSH_MS, 60000);
    club._ready = true;
    club._sm = { _canSyncWrite() { return true; }, _clubDirty: true };
    club.enabled = () => true;
    club._canWrite = () => true;
    let pushed = 0;
    club.push = () => { pushed += 1; return Promise.resolve(true); };
    club.schedulePush(club._sm);
    club.schedulePush(club._sm);
    assert.equal(ctx.timers.length, 1);
    assert.equal(ctx.timers[0].ms, 60000);
    assert.equal(pushed, 0);
    ctx.timers[0].fn();
    assert.equal(pushed, 1);
    club._armPoll();
    assert.equal(ctx._interval, 60000);
    assert.equal(ctx._events.indexOf('online') >= 0, true);
    assert.equal(ctx._events.indexOf('offline') >= 0, true);
    assert.equal(ctx._events.indexOf('focus') >= 0, false);
  });

  it('does not send the whole club just to show who is online', () => {
    const app = readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8');
    assert.match(app, /StorageManager\.save\(\{ localOnly: true \}\)/);
    const actions = readFileSync(new URL('../src/ui/actions.js', import.meta.url), 'utf8');
    assert.equal(actions.includes('Actions.editTraining(tid)'), false);
  });

  it('keeps the training fields and only refreshes the block list', () => {
    const context = {
      console,
      sanitize(v) { return String(v == null ? '' : v); },
      document: {
        addEventListener() {},
        getElementById(id) {
          if (id === 'teName') return { value: 'Гра на флангах' };
          if (id === 'teDate') return { value: '2026-11-28' };
          if (id === 'totalDur') return context.total;
          if (id === 'structList') return context.list;
          return null;
        },
        querySelector() { return null; }
      }
    };
    context.total = { textContent: '' };
    context.list = { innerHTML: '' };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(readFileSync(new URL('../src/ui/actions.js', import.meta.url), 'utf8') + '\nthis.Actions = Actions;', context, { filename: 'actions.js' });
    const training = { id: 't1', name: 'Старе', date: '2026-11-01', structure: [{ title: 'Розминка', duration: 10 }] };
    context.Actions._readTrainingFields(training);
    training.structure.push({ title: 'Гра', duration: 15 });
    context.Actions._paintTrainingBlocks(training);
    assert.equal(training.name, 'Гра на флангах');
    assert.equal(training.date, '2026-11-28');
    assert.equal(training.duration, 25);
    assert.equal(context.total.textContent, '25');
    assert.match(context.list.innerHTML, /data-block-name="1"/);
    assert.equal(context.list.innerHTML.includes('teName'), false);
  });
});
