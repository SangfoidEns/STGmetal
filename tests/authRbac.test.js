import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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
  it('unlisted → player with link', () => {
    const r = resolveRole({ id: 7, username: 'striker' }, {
      coaches: ['1'],
      playerLinks: { '7': 'p11' }
    });
    assert.equal(r.role, 'player');
    assert.equal(r.linkedPlayerId, 'p11');
  });
});
