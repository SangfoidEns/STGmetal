import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function boot() {
  const store = new Map();
  const calls = [];
  const context = {
    console,
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); }
    },
    fetch(url, opts) {
      calls.push({ url: String(url), opts: opts || {} });
      const hit = context.fetch.next && context.fetch.next.shift();
      if (hit) return Promise.resolve(hit);
      return Promise.resolve({
        ok: true,
        status: 200,
        json() { return Promise.resolve([]); }
      });
    },
    Blob,
    atob(value) { return Buffer.from(value, 'base64').toString('binary'); },
    Store: { get() { return context.state; } },
    ClubMerge: { mergePayload(a, b) { return Object.assign({}, a, b, { players: (b && b.players) || (a && a.players) || [] }); } },
    AuthManager: { displayName() { return 'Artem'; }, _canWriteClub() { return true; } },
    state: { players: [], settings: {} }
  };
  context.fetch.next = [];
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/core/supabaseClub.js', import.meta.url), 'utf8') + '\nthis.SupabaseClub = SupabaseClub;', context);
  context.calls = calls;
  return context;
}

function jsonRes(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json() { return Promise.resolve(body); }
  };
}

describe('supabase club sync', () => {
  it('stays off until the public anon key is saved on the phone', () => {
    const ctx = boot();
    assert.equal(ctx.SupabaseClub.enabled(), false);
    ctx.SupabaseClub.rememberKey('anon-public');
    assert.equal(ctx.SupabaseClub.enabled(), true);
    assert.equal(ctx.localStorage.getItem('ms_sb_anon'), 'anon-public');
    assert.equal(ctx.SupabaseClub.cleanKey('код eyJaaa.bbb.ccc зайве'), 'eyJaaa.bbb.ccc');
    assert.equal(ctx.SupabaseClub.rememberKey('https://zloluzqzswdwaimlqlqx.supabase.co'), '');
  });

  it('says the key is wrong when the server rejects it', async () => {
    const ctx = boot();
    const lines = [];
    const sm = { _setClubSyncLine(text) { lines.push(text); }, _canSyncWrite() { return true; } };
    ctx.SupabaseClub.rememberKey('eyJaaa.bbb.ccc');
    ctx.fetch.next.push(jsonRes(401, { message: 'Invalid API key', code: '401' }));
    const ok = await ctx.SupabaseClub.start(sm);
    assert.equal(ok, false);
    assert.match(lines.join('\n'), /Ключ не підходить/);
  });

  it('uploads a photo outside the phone and writes the club once', async () => {
    const ctx = boot();
    ctx.SupabaseClub.KEY = 'anon-public';
    const photo = 'data:image/png;base64,' + Buffer.from('pixel-picture-bytes-'.repeat(12)).toString('base64');
    ctx.SupabaseClub._sm = {
      _canSyncWrite() { return true; },
      _setClubSyncLine() {},
      buildExportPayload() {
        return { players: [{ id: 'p1', photoUrl: photo }], trainings: [{ id: 't1' }] };
      },
      save() { ctx.saved = true; }
    };
    ctx.fetch.next.push(jsonRes(200, []));
    ctx.fetch.next.push(jsonRes(200, { Key: 'media' }));
    ctx.fetch.next.push(jsonRes(201, [{ id: 'metalist', rev: 1 }]));
    const ok = await ctx.SupabaseClub.push();
    assert.equal(ok, true);
    const posted = ctx.calls.map(call => call.url);
    assert.equal(posted.some(url => url.indexOf('/storage/v1/object/club-media/media/') >= 0), true);
    assert.equal(posted.some(url => url.indexOf('/storage/v1/object/club-media/state/') >= 0), false);
    const insert = ctx.calls.find(call => call.opts.method === 'POST' && call.url.indexOf('/rest/v1/club_state') >= 0);
    const body = JSON.parse(insert.opts.body);
    assert.equal(body.path, null);
    assert.equal(body.payload.players[0].photoUrl.indexOf('https://'), 0);
    assert.equal(body.payload.players[0].photoUrl.indexOf('data:'), -1);
  });

  it('keeps the newer phone when two writes meet', async () => {
    const ctx = boot();
    ctx.SupabaseClub.KEY = 'anon-public';
    let pulls = 0;
    ctx.SupabaseClub._sm = {
      _canSyncWrite() { return true; },
      _setClubSyncLine() {},
      buildExportPayload() {
        return { players: [{ id: 'yehor', firstName: 'Єгор' }], trainings: [] };
      },
      save() {}
    };
    ctx.fetch.next.push(jsonRes(200, [{ id: 'metalist', rev: 4, updated_at: '2026-11-20T00:00:00.000Z', path: '', payload: { players: [{ id: 'old' }] } }]));
    ctx.fetch.next.push(jsonRes(200, [{ id: 'metalist', rev: 5 }]));
    const ok = await ctx.SupabaseClub.push();
    assert.equal(ok, true);
    assert.equal(pulls, 0);
    const patch = ctx.calls.find(call => call.opts.method === 'PATCH');
    assert.match(patch.url, /rev=eq\.4/);
    const body = JSON.parse(patch.opts.body);
    assert.equal(body.rev, 5);
    assert.equal(body.path, null);
    assert.equal(body.payload.players[0].id, 'yehor');
  });

  it('keeps a photo address and drops a photo that never left the phone', () => {
    const ctx = boot();
    const slim = ctx.SupabaseClub.withoutInline({
      players: [{ photoUrl: 'data:image/png;base64,' + 'a'.repeat(300) }],
      settings: { clubName: 'Металіст' }
    });
    assert.equal(slim.players[0].photoUrl, '');
    assert.equal(slim.settings.clubName, 'Металіст');
    const keep = ctx.SupabaseClub.usedMedia({
      settings: { moments: [{ src: ctx.SupabaseClub.URL + '/storage/v1/object/public/club-media/media/goal.jpg?v=1' }] }
    });
    assert.equal(keep.has('media/goal.jpg'), true);
  });

  it('drops old club copies and photos the club no longer uses', async () => {
    const ctx = boot();
    ctx.SupabaseClub.KEY = 'anon-public';
    const payload = {
      players: [{ photoUrl: ctx.SupabaseClub.URL + '/storage/v1/object/public/club-media/media/keep.png' }]
    };
    ctx.fetch.next.push(jsonRes(200, [
      { name: 'state', id: null },
      { name: 'media', id: null },
      { name: 'loose.jpg', id: 'x', metadata: { size: 1048576 } }
    ]));
    ctx.fetch.next.push(jsonRes(200, [
      { name: 'current.json', id: 'a', metadata: { size: 100 } },
      { name: '1-old.json', id: 'b', metadata: { size: 2097152 } }
    ]));
    ctx.fetch.next.push(jsonRes(200, [
      { name: 'keep.png', id: 'c', metadata: { size: 1000 } },
      { name: 'gone.jpg', id: 'd', metadata: { size: 3145728 } }
    ]));
    ctx.fetch.next.push(jsonRes(200, []));
    await ctx.SupabaseClub.sweep('state/current.json', payload);
    const prefixes = ctx.calls
      .filter(call => call.opts.method === 'DELETE')
      .flatMap(call => JSON.parse(call.opts.body).prefixes)
      .sort();
    assert.deepEqual(prefixes, ['loose.jpg', 'media/gone.jpg', 'state/1-old.json']);
    const listed = ctx.calls.find(call => String(call.url).indexOf('/object/list/') >= 0);
    assert.match(listed.opts.body, /"column":"name"/);
  });

  it('does not download photos again when there is no page to shrink them', async () => {
    const ctx = boot();
    const payload = {
      players: [{ photoUrl: ctx.SupabaseClub.URL + '/storage/v1/object/public/club-media/media/big.jpg' }]
    };
    const n = await ctx.SupabaseClub.slimStored(payload);
    assert.equal(n, 0);
    assert.match(payload.players[0].photoUrl, /big\.jpg$/);
    assert.equal(ctx.calls.length, 0);
  });
});
