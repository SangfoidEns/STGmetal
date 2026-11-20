import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function boot() {
  const context = { localStorage: { getItem() { return ''; }, setItem() {} } };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(
    readFileSync(new URL('../src/core/supabaseClub.js', import.meta.url), 'utf8') + '\nthis.SupabaseClub = SupabaseClub;',
    context,
    { filename: 'supabaseClub.js' }
  );
  return context.SupabaseClub;
}

describe('supabase club conflict', () => {
  it('reads the remote snapshot from a PostgREST 409 body', () => {
    const SupabaseClub = boot();
    const payload = { players: [{ id: 'p1' }], chat: [{ id: 'm1', text: 'є' }] };
    const direct = SupabaseClub.conflictRecord({
      ok: false,
      error: 'stale',
      updatedAt: '2026-02-01T00:00:00.000Z',
      payload
    });
    assert.equal(direct.payload.players[0].id, 'p1');
    const wrapped = SupabaseClub.conflictRecord({
      code: 'PT409',
      message: 'stale',
      details: JSON.stringify({
        error: 'stale',
        updatedAt: '2026-02-01T00:00:00.000Z',
        payload
      })
    });
    assert.equal(wrapped.updatedAt, '2026-02-01T00:00:00.000Z');
    assert.equal(wrapped.payload.chat[0].text, 'є');
    assert.equal(SupabaseClub.conflictRecord({ message: 'stale' }), null);
  });

  it('keeps the SQL gate aligned with the Mini App', () => {
    const sql = readFileSync(new URL('../supabase/club_state.sql', import.meta.url), 'utf8');
    assert.doesNotMatch(sql, /errcode\s*=\s*'40001'/);
    assert.match(sql, /errcode = 'PT409'/);
    assert.match(sql, /private\.norm_nick\(player->>'telegramUsername'\)/);
    assert.match(sql, /nick = 'serdiuk_artem'/);
    assert.match(sql, /actor->>'id' = coach_id/);
    assert.doesNotMatch(sql, /rbac/);
    assert.match(sql, /private\.merge_chat\(row\.payload->'chat', payload->'chat', null\)/);
    assert.match(sql, /private\.merge_self_profile\(next_payload, payload, actor\)/);
  });
});
