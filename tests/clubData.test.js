import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

const file = path.join(os.tmpdir(), 'metalist-club-' + process.pid + '.json');
process.env.CLUB_DATA_FILE = file;
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.CLUB_WRITE_SECRET = '';

const { readClub, writeClub, openClubWrites, clubWriteAllowed, mergeChat, classifyClubWrite, handleClubRequest } = await import('../server/clubData.mjs');
const { buildTestInitData } = await import('../server/validateInitData.mjs');

describe('club data file', () => {
  before(() => { try { fs.unlinkSync(file); } catch {} });
  after(() => { try { fs.unlinkSync(file); } catch {} });

  it('starts empty', () => {
    const club = readClub();
    assert.equal(club.payload, null);
    assert.equal(club.updatedAt, null);
  });

  it('round-trips a payload', () => {
    const saved = writeClub({
      updatedAt: '2026-10-30T12:00:00.000Z',
      updatedBy: 'coach',
      payload: { players: [{ id: 'p1', firstName: 'Юрій' }], trainings: [] }
    });
    assert.equal(saved.updatedBy, 'coach');
    const club = readClub();
    assert.equal(club.payload.players[0].firstName, 'Юрій');
    assert.equal(club.updatedAt, '2026-10-30T12:00:00.000Z');
  });

  it('local server allows writes when no bot token is set', () => {
    assert.equal(openClubWrites(), true);
  });

  it('merges team chat by id and keeps order', () => {
    const merged = mergeChat(
      [{ id: 'a', text: 'перше', authorName: 'Тренер', authorRole: 'coach', createdAt: '2026-10-30T10:00:00.000Z' }],
      [
        { id: 'b', text: 'друге', authorName: 'Гравець', authorRole: 'player', playerId: 'p1', createdAt: '2026-10-30T11:00:00.000Z' },
        { id: 'a', text: 'перше змінене', authorName: 'Тренер', authorRole: 'coach', createdAt: '2026-10-30T10:00:00.000Z' },
        { id: 'c', text: '   ', authorName: 'Гість', authorRole: 'guest', createdAt: '2026-10-30T12:00:00.000Z' }
      ]
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0].id, 'a');
    assert.equal(merged[0].text, 'перше змінене');
    assert.equal(merged[1].id, 'b');
    assert.equal(merged[1].playerId, 'p1');
  });

  it('public guest cannot replace the club', () => {
    const mode = classifyClubWrite(
      { headers: { host: 'club.trycloudflare.com' } },
      { updatedBy: 'Локальний режим (тренер)', payload: { players: [] } },
      { players: [{ id: 'p1' }] }
    );
    assert.equal(mode, 'deny');
  });

  it('coach username can replace the club', () => {
    const initData = 'user=' + encodeURIComponent(JSON.stringify({ id: 1, username: 'Serdiuk_Artem' }));
    assert.equal(classifyClubWrite({ headers: { host: 'club.trycloudflare.com' } }, { initData }, null), 'full');
  });

  it('linked player can only add chat', () => {
    const initData = 'user=' + encodeURIComponent(JSON.stringify({ id: 7, username: 'striker' }));
    const mode = classifyClubWrite(
      { headers: { host: 'club.trycloudflare.com' } },
      { initData },
      { players: [{ id: 'p7', telegramId: 7 }] }
    );
    assert.equal(mode, 'chat');
  });

  it('linked player saves own birthday, photo and featured gift', async () => {
    writeClub({
      updatedAt: '2026-10-30T12:00:00.000Z',
      updatedBy: 'coach',
      payload: {
        players: [
          { id: 'p7', firstName: 'Іван', number: 9, telegramId: 7, telegramUsername: 'striker', birthDate: '' },
          { id: 'p8', firstName: 'Петро', number: 4 }
        ],
        gifts: [
          { uid: 'g1', playerId: 'p7', giftId: 'a', ico: '🔥', featured: false, hue: 12 },
          { uid: 'g2', playerId: 'p7', giftId: 'b', ico: '⚽', featured: true, hue: 40 },
          { uid: 'g3', playerId: 'p8', giftId: 'c', ico: '🧤', featured: true, hue: 90 }
        ],
        trainings: [{ id: 't1', name: 'Тактика' }],
        chat: []
      }
    });
    const initData = 'user=' + encodeURIComponent(JSON.stringify({ id: 7, username: 'striker' }));
    const req = Readable.from([Buffer.from(JSON.stringify({
      updatedAt: '2026-10-30T13:00:00.000Z',
      updatedBy: 'striker',
      initData,
      payload: {
        players: [
          {
            id: 'p7', firstName: 'Іван', lastName: 'Коваль', number: 99, birthDate: '1998-05-02',
            telegramId: 7, profilePhoto: 'data:image/jpeg;base64,aaa', photoUrl: 'data:image/jpeg;base64,aaa',
            profile: { birthDate: '1998-05-02', phone: '123', bio: 'Нападник' }
          },
          { id: 'p8', firstName: 'Зламаний' }
        ],
        gifts: [
          { uid: 'g1', playerId: 'p7', featured: true, hue: 12 },
          { uid: 'g2', playerId: 'p7', featured: false },
          { uid: 'g3', playerId: 'p8', featured: false }
        ],
        trainings: [],
        chat: [{ id: 'm1', text: 'привіт', authorName: 'Іван', authorRole: 'player', playerId: 'p7', createdAt: '2026-10-30T13:00:00.000Z' }]
      }
    }))]);
    req.method = 'POST';
    req.url = '/api/club-data';
    req.headers = { host: 'club.trycloudflare.com' };
    const res = { status: 0, body: '', writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
    const handled = await handleClubRequest(req, res, async () => true);
    assert.equal(handled, true);
    assert.equal(res.status, 200);
    const club = readClub();
    const p7 = club.payload.players.find((p) => p.id === 'p7');
    const p8 = club.payload.players.find((p) => p.id === 'p8');
    assert.equal(p7.birthDate, '1998-05-02');
    assert.equal(p7.profile.birthDate, '1998-05-02');
    assert.equal(p7.lastName, 'Коваль');
    assert.equal(p7.number, 9);
    assert.equal(p7.profilePhoto, 'data:image/jpeg;base64,aaa');
    assert.equal(p7.profile.bio, 'Нападник');
    assert.equal(p8.firstName, 'Петро');
    assert.equal(club.payload.gifts.find((g) => g.uid === 'g1').featured, true);
    assert.equal(club.payload.gifts.find((g) => g.uid === 'g2').featured, false);
    assert.equal(club.payload.gifts.find((g) => g.uid === 'g3').featured, true);
    assert.equal(club.payload.trainings.length, 1);
    assert.equal(club.payload.trainings[0].name, 'Тактика');
    assert.equal(club.payload.chat[0].text, 'привіт');
  });

  it('signed telegram user may post; a forged initData may not', () => {
    const token = '123456:TEST-BOT-TOKEN-FOR-UNIT-TESTS-ONLY';
    const prevToken = process.env.TELEGRAM_BOT_TOKEN;
    const prevSecret = process.env.CLUB_WRITE_SECRET;
    process.env.TELEGRAM_BOT_TOKEN = token;
    process.env.CLUB_WRITE_SECRET = '';
    try {
      const initData = buildTestInitData(token, { id: 7, username: 'striker' });
      assert.equal(clubWriteAllowed({ headers: {} }, { initData }), true);
      assert.equal(clubWriteAllowed({ headers: {} }, { initData: 'user=%7B%7D&hash=00' }), false);
      assert.equal(clubWriteAllowed({ headers: {} }, {}), false);
      process.env.CLUB_WRITE_SECRET = 'club-secret';
      assert.equal(clubWriteAllowed({ headers: { 'x-club-key': 'club-secret' } }, {}), true);
    } finally {
      process.env.TELEGRAM_BOT_TOKEN = prevToken;
      process.env.CLUB_WRITE_SECRET = prevSecret;
    }
  });

  it('localhost browser can still write', () => {
    assert.equal(classifyClubWrite({ headers: { host: '127.0.0.1:43127' } }, {}, null), 'full');
  });

  it('denied post does not touch the file', async () => {
    writeClub({
      updatedAt: '2026-10-30T12:00:00.000Z',
      updatedBy: 'coach',
      payload: { players: [{ id: 'p1', firstName: 'Юрій' }], chat: [] }
    });
    const req = Readable.from([Buffer.from(JSON.stringify({
      updatedAt: '2099-01-01T00:00:00.000Z',
      updatedBy: 'Локальний режим (тренер)',
      payload: { players: [] }
    }))]);
    req.method = 'POST';
    req.url = '/api/club-data';
    req.headers = { host: 'club.trycloudflare.com' };
    const res = { status: 0, body: '', writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
    const handled = await handleClubRequest(req, res, async () => true);
    assert.equal(handled, true);
    assert.equal(res.status, 403);
    const club = readClub();
    assert.equal(club.payload.players[0].firstName, 'Юрій');
    assert.equal(club.updatedBy, 'coach');
  });
});
