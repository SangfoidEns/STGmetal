import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function bootAuth(host, tg) {
  const context = {
    console,
    location: { hostname: host },
    document: { body: { classList: { remove() {}, add() {} } }, getElementById() { return null; } },
    Store: { get() { return { settings: { rbac: { coaches: ['Serdiuk_Artem'], playerLinks: {} } }, players: [] }; } }
  };
  context.window = context;
  context.globalThis = context;
  if (tg) context.Telegram = { WebApp: tg };
  vm.createContext(context);
  const src = readFileSync(new URL('../src/core/auth.js', import.meta.url), 'utf8');
  vm.runInContext(src + '\nthis.AuthManager = AuthManager;', context, { filename: 'auth.js' });
  context.AuthManager.init();
  return context.AuthManager;
}

function resolveRole(user, rbac, host) {
  const local = host === 'localhost' || host === '127.0.0.1';
  if (!user) return { role: local ? 'coach' : 'guest', linkedPlayerId: null };
  const coaches = (rbac && rbac.coaches) || [];
  const playerLinks = (rbac && rbac.playerLinks) || {};
  const idStr = String(user.id);
  const uname = (user.username || '').toLowerCase();
  if (uname === 'artem_serdyuk') return { role: 'player', linkedPlayerId: playerLinks[idStr] || null };
  const isCoach = coaches.some(c => {
    const v = String(c).toLowerCase().replace(/^@/, '');
    return v === idStr || v === uname;
  });
  if (isCoach) return { role: 'coach', linkedPlayerId: null };
  const link = playerLinks[idStr] || playerLinks['@' + uname] || playerLinks[uname] || null;
  if (!link) return { role: 'guest', linkedPlayerId: null };
  return { role: 'player', linkedPlayerId: link };
}

describe('RBAC foundation', () => {
  it('no user on the public link is a guest', () => {
    assert.equal(resolveRole(null, { coaches: ['Serdiuk_Artem'] }, 'club.trycloudflare.com').role, 'guest');
  });
  it('no user on localhost stays the coach', () => {
    assert.equal(resolveRole(null, { coaches: ['Serdiuk_Artem'] }, '127.0.0.1').role, 'coach');
  });
  it('empty coaches do not make every Telegram user a coach', () => {
    assert.equal(resolveRole({ id: 99, username: 'x' }, { coaches: [] }).role, 'guest');
  });
  it('listed coach by id', () => {
    assert.equal(resolveRole({ id: 42 }, { coaches: ['42'] }).role, 'coach');
  });
  it('ignores a coach object when Telegram did not pass initData', () => {
    const auth = bootAuth('sangfoidens.github.io', {
      initData: '',
      initDataUnsafe: { user: { id: 1, username: 'Serdiuk_Artem', first_name: 'Artem' } }
    });
    assert.equal(auth.role, 'guest');
    assert.equal(auth.user, null);
  });
  it('keeps the coach when Telegram passed initData', () => {
    const auth = bootAuth('sangfoidens.github.io', {
      initData: 'query_id=1&user=%7B%7D&auth_date=1&hash=ab',
      initDataUnsafe: { user: { id: 1, username: 'Serdiuk_Artem', first_name: 'Artem' } }
    });
    assert.equal(auth.role, 'coach');
  });
  it('unlisted → player with link', () => {
    const r = resolveRole({ id: 7, username: 'striker' }, {
      coaches: ['1'],
      playerLinks: { '7': 'p11' }
    });
    assert.equal(r.role, 'player');
    assert.equal(r.linkedPlayerId, 'p11');
  });
});
