import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as register } from '../auth/register/route';
import { POST as createFighter } from '../fighters/route';
import { POST as createChallenge } from '../challenges/route';
import { POST as acceptChallenge } from '../challenges/[id]/accept/route';
import { POST as declineChallenge } from '../challenges/[id]/decline/route';
import { POST as submitResult } from './[id]/result/route';
import { GET as getTitle } from '../title/route';
import { expectedResult } from '../../../lib/fight-engine/verify';
import { Fighter } from '../../../models/Fighter';
import { GameFight } from '../../../models/GameFight';
import { Challenge } from '../../../models/Challenge';
import { Title } from '../../../models/Title';
import { TitleHistory } from '../../../models/TitleHistory';

/**
 * Integration test alur game Fase 1 dengan mongodb-memory-server.
 * Pola setup sama dengan api.integration.test.ts: kalau binary MongoDB
 * tidak bisa diunduh di VM ini, seluruh suite SKIP (tidak memblokir
 * unit test lain).
 *
 * Alur: register 2 user → fighter (duplikat 409) → challenge (duplikat
 * 409) → accept salah 403 → accept 200 + config → submit cocok →
 * completed + Elo/record berubah → submit lagi 409 → submit
 * hasil diubah → disputed (ranking tidak berubah) → limit 5/hari →
 * race 10 kemenangan → holder + event race_10_win → lastFightAt
 * dimundurkan 7 hari → GET /api/title → gelar kosong +
 * event vacated_inactivity.
 */

let mongod: MongoMemoryServer | null = null;
let dbReady = false;

beforeAll(async () => {
  try {
    mongod = await Promise.race([
      MongoMemoryServer.create(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout download binary mongodb-memory-server')), 120000),
      ),
    ]);
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = 'test-secret-yang-cukup-panjang-1234567890';
    dbReady = true;
  } catch (err) {
    console.warn(
      'SKIP integration test game-flow: mongodb-memory-server tidak bisa jalan di VM ini:',
      (err as Error).message,
    );
  }
}, 180000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

function skipIfNoDb(): boolean {
  if (!dbReady) {
    console.warn('SKIP: integration test game-flow dilewati (tidak ada MongoDB in-memory).');
    return true;
  }
  return false;
}

function req(
  path: string,
  opts: { method?: string; body?: unknown; cookie?: string | null } = {},
): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.cookie) headers.cookie = opts.cookie;
  return new NextRequest(`http://localhost${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function extractCookie(res: Response): string | null {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  const raw = cookies[0] ?? headers.get('set-cookie');
  if (!raw) return null;
  return raw.split(';')[0];
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

type ApiData<T> = { ok: boolean; data: T; error?: { code: string; message: string } };

const SELF_DESC =
  'Petarung game test dari Semarang yang sudah latihan bertahun-tahun di sasana kecil dekat rumah.';

interface ChallengeOut {
  challenge: { id: string };
}
interface AcceptOut {
  gameFight: { id: string };
  config: {
    fightId: string;
    fighters: { left: never; right: never };
    seed: number;
    map: string;
    duration: number;
  };
}
interface ResultOut {
  verified: boolean;
  fight?: { status: string };
  disputeReason?: string;
}
interface TitleOut {
  title: {
    holder: { id: string; displayName: string } | null;
    raceTarget: number;
    raceStandings: { fighterId: string; wins: number }[];
  };
}

/** Satu fight penuh: challenge → accept → submit hasil yang cocok. */
async function playOneFight(
  cookieA: string,
  cookieB: string,
  fighterAId: string,
  fighterBId: string,
  tamperWinner = false,
): Promise<{ fightId: string; verified: boolean; expected: ReturnType<typeof expectedResult> }> {
  const chRes = await createChallenge(
    req('/api/challenges', {
      method: 'POST',
      body: { challengedFighterId: fighterBId, map: 'ring' },
      cookie: cookieA,
    }),
  );
  expect(chRes.status).toBe(201);
  const chBody = await json<ApiData<ChallengeOut>>(chRes);
  const challengeId = chBody.data.challenge.id;

  const accRes = await acceptChallenge(
    req(`/api/challenges/${challengeId}/accept`, { method: 'POST', cookie: cookieB }),
    { params: Promise.resolve({ id: challengeId }) },
  );
  expect(accRes.status).toBe(200);
  const accBody = await json<ApiData<AcceptOut>>(accRes);
  const { gameFight, config } = accBody.data;

  const expected = expectedResult(config.fighters.left, config.fighters.right, config.duration, config.seed);
  const payload = {
    winner: tamperWinner
      ? expected.winner === 'R'
        ? 'B'
        : expected.winner === 'B'
          ? 'R'
          : 'R'
      : expected.winner,
    method: expected.method,
    score: expected.score,
    koTimeSec: expected.koTimeSec,
    stats: expected.stats,
    keyMoments: expected.keyMoments,
    seed: config.seed,
  };
  const subRes = await submitResult(
    req(`/api/game-fights/${gameFight.id}/result`, {
      method: 'POST',
      body: payload,
      cookie: cookieA,
    }),
    { params: Promise.resolve({ id: gameFight.id }) },
  );
  expect(subRes.status).toBe(200);
  const subBody = await json<ApiData<ResultOut>>(subRes);
  return { fightId: gameFight.id, verified: subBody.data.verified, expected };
}

describe('Game flow integration (challenge → fight → result → gelar)', () => {
  it('alur penuh + race 10 + kekosongan 6 hari', async () => {
    if (skipIfNoDb()) return;

    // 1. Register 2 user.
    const regA = await register(
      req('/api/auth/register', { method: 'POST', body: { username: 'game_a', password: 'passwordkuat123' } }),
    );
    expect(regA.status).toBe(201);
    const cookieA = extractCookie(regA);
    expect(cookieA).toContain('sfh_token=');
    const regB = await register(
      req('/api/auth/register', { method: 'POST', body: { username: 'game_b', password: 'passwordkuat123' } }),
    );
    expect(regB.status).toBe(201);
    const cookieB = extractCookie(regB);
    expect(cookieB).toContain('sfh_token=');

    // 2. Fighter A + duplikat 409 (satu fighter per akun).
    const fighterARes = await createFighter(
      req('/api/fighters', {
        method: 'POST',
        body: { displayName: 'Game A', igUsername: 'game_a', style: 'boxing', selfDescription: SELF_DESC },
        cookie: cookieA,
      }),
    );
    expect(fighterARes.status).toBe(201);
    const fighterABody = await json<ApiData<{ fighter: { id: string } }>>(fighterARes);
    const fighterAId = fighterABody.data.fighter.id;

    const dupFighter = await createFighter(
      req('/api/fighters', {
        method: 'POST',
        body: { displayName: 'Game A Kedua', igUsername: 'game_a2', style: 'karate', selfDescription: SELF_DESC },
        cookie: cookieA,
      }),
    );
    expect(dupFighter.status).toBe(409);

    const fighterBRes = await createFighter(
      req('/api/fighters', {
        method: 'POST',
        body: { displayName: 'Game B', igUsername: 'game_b', style: 'muay-thai', selfDescription: SELF_DESC },
        cookie: cookieB,
      }),
    );
    expect(fighterBRes.status).toBe(201);
    const fighterBBody = await json<ApiData<{ fighter: { id: string } }>>(fighterBRes);
    const fighterBId = fighterBBody.data.fighter.id;

    // 3. Challenge A→B + duplikat 409.
    const chRes = await createChallenge(
      req('/api/challenges', {
        method: 'POST',
        body: { challengedFighterId: fighterBId, map: 'ring' },
        cookie: cookieA,
      }),
    );
    expect(chRes.status).toBe(201);
    const chBody = await json<ApiData<ChallengeOut>>(chRes);
    const challengeId = chBody.data.challenge.id;

    const dupCh = await createChallenge(
      req('/api/challenges', {
        method: 'POST',
        body: { challengedFighterId: fighterBId, map: 'dojo' },
        cookie: cookieA,
      }),
    );
    expect(dupCh.status).toBe(409);

    // 4. Accept oleh user salah → 403.
    const wrongAccept = await acceptChallenge(
      req(`/api/challenges/${challengeId}/accept`, { method: 'POST', cookie: cookieA }),
      { params: Promise.resolve({ id: challengeId }) },
    );
    expect(wrongAccept.status).toBe(403);

    // 5. Accept oleh B → 200 + config sfa-config.
    const accRes = await acceptChallenge(
      req(`/api/challenges/${challengeId}/accept`, { method: 'POST', cookie: cookieB }),
      { params: Promise.resolve({ id: challengeId }) },
    );
    expect(accRes.status).toBe(200);
    const accBody = await json<ApiData<AcceptOut>>(accRes);
    const fight1Id = accBody.data.gameFight.id;
    const config = accBody.data.config;
    expect(config.fightId).toBe(fight1Id);
    expect(config.seed).toBeGreaterThanOrEqual(100000);
    expect(config.duration).toBe(60);
    expect(config.fighters.left).toBeDefined();
    expect(config.fighters.right).toBeDefined();

    // 6. Submit hasil yang cocok → verified, completed, Elo/casual berubah.
    const expected1 = expectedResult(config.fighters.left, config.fighters.right, config.duration, config.seed);
    const ratingBefore = (await Fighter.findById(fighterAId).lean())?.rating;
    const subRes = await submitResult(
      req(`/api/game-fights/${fight1Id}/result`, {
        method: 'POST',
        body: {
          winner: expected1.winner,
          method: expected1.method,
          score: expected1.score,
          koTimeSec: expected1.koTimeSec,
          stats: expected1.stats,
          keyMoments: expected1.keyMoments,
          seed: config.seed,
        },
        cookie: cookieA,
      }),
      { params: Promise.resolve({ id: fight1Id }) },
    );
    expect(subRes.status).toBe(200);
    const subBody = await json<ApiData<ResultOut>>(subRes);
    expect(subBody.data.verified).toBe(true);
    const fight1 = await GameFight.findById(fight1Id).lean();
    expect(fight1?.status).toBe('completed');
    expect(fight1?.result?.winnerSide).toBe(expected1.winner);
    const fighterAAfter = await Fighter.findById(fighterAId).lean();
    const recordTotal =
      (fighterAAfter?.record?.wins ?? 0) +
      (fighterAAfter?.record?.losses ?? 0) +
      (fighterAAfter?.record?.draws ?? 0);
    expect(recordTotal).toBe(1);
    // Elo berubah kecuali draw.
    if (expected1.method !== 'draw') {
      expect(fighterAAfter?.rating).not.toBe(ratingBefore);
    }

    // 7. Submit kedua → 409.
    const subAgain = await submitResult(
      req(`/api/game-fights/${fight1Id}/result`, {
        method: 'POST',
        body: {
          winner: expected1.winner,
          method: expected1.method,
          score: expected1.score,
          koTimeSec: expected1.koTimeSec,
          stats: expected1.stats,
          seed: config.seed,
        },
        cookie: cookieA,
      }),
      { params: Promise.resolve({ id: fight1Id }) },
    );
    expect(subAgain.status).toBe(409);

    // 8. Fight ke-2: hasil diubah (winner dibalik) → disputed, ranking tidak berubah.
    const ratingA2 = (await Fighter.findById(fighterAId).lean())?.rating;
    const ratingB2 = (await Fighter.findById(fighterBId).lean())?.rating;
    const fight2 = await playOneFight(cookieA!, cookieB!, fighterAId, fighterBId, true);
    expect(fight2.verified).toBe(false);
    const fight2Doc = await GameFight.findById(fight2.fightId).lean();
    expect(fight2Doc?.status).toBe('disputed');
    expect((await Fighter.findById(fighterAId).lean())?.rating).toBe(ratingA2);
    expect((await Fighter.findById(fighterBId).lean())?.rating).toBe(ratingB2);

    // 9. Fight ke-3, ke-4, ke-5 (benar) → sudah 5 fight hari ini;
    // accept ke-6 → 409 DAILY_LIMIT_REACHED.
    await playOneFight(cookieA!, cookieB!, fighterAId, fighterBId, false);
    await playOneFight(cookieA!, cookieB!, fighterAId, fighterBId, false);
    await playOneFight(cookieA!, cookieB!, fighterAId, fighterBId, false);
    const ch6Res = await createChallenge(
      req('/api/challenges', {
        method: 'POST',
        body: { challengedFighterId: fighterBId, map: 'gudang' },
        cookie: cookieA,
      }),
    );
    expect(ch6Res.status).toBe(201);
    const ch6Body = await json<ApiData<ChallengeOut>>(ch6Res);
    const ch6Id = ch6Body.data.challenge.id;
    const acc6 = await acceptChallenge(
      req(`/api/challenges/${ch6Id}/accept`, { method: 'POST', cookie: cookieB }),
      { params: Promise.resolve({ id: ch6Id }) },
    );
    expect(acc6.status).toBe(409);
    const acc6Body = await json<ApiData<unknown>>(acc6);
    expect(acc6Body.error?.code).toBe('DAILY_LIMIT_REACHED');
    // Bersihkan: tolak challenge ke-6.
    const dec6 = await declineChallenge(
      req(`/api/challenges/${ch6Id}/decline`, { method: 'POST', cookie: cookieB }),
      { params: Promise.resolve({ id: ch6Id }) },
    );
    expect(dec6.status).toBe(200);

    // 10. Race: mundurkan createdAt semua fight 2 hari (reset limit harian;
    // completedAt tetap — kemenangan race tetap dihitung), lalu main
    // sampai A jadi holder. Siapa pun yang mencapai 10 kemenangan duluan
    // jadi holder via race; kalau B yang duluan, A merebutnya lewat
    // takeover begitu menang lawan holder (aturan gelar).
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    // CATATAN: backdate HARUS lewat collection driver mentah — Mongoose
    // mengabaikan $set createdAt pada update (timestamps: true).
    await GameFight.collection.updateMany({}, { $set: { createdAt: twoDaysAgo } });
    let holderIsA = false;
    for (let i = 0; i < 40 && !holderIsA; i++) {
      // Reset juga limit tantangan 5/hari (backdate semua challenge).
      await Challenge.collection.updateMany({}, { $set: { createdAt: twoDaysAgo } });
      const f = await playOneFight(cookieA!, cookieB!, fighterAId, fighterBId, false);
      expect(f.verified).toBe(true);
      await GameFight.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(f.fightId) },
        { $set: { createdAt: twoDaysAgo } },
      );
      const titleRes = await getTitle();
      const titleBody = await json<ApiData<TitleOut>>(titleRes);
      holderIsA = titleBody.data.title.holder?.id === fighterAId;
    }
    expect(holderIsA).toBe(true);
    const raceEvent = await TitleHistory.findOne({ type: 'race_10_win' }).lean();
    expect(raceEvent).not.toBeNull();
    expect(raceEvent?.score).toBe(10);
    expect([fighterAId, fighterBId]).toContain(raceEvent?.newHolderFighterId?.toString());
    // Kalau B yang menang race duluan, harus ada takeover ke A sesudahnya.
    if (raceEvent?.newHolderFighterId?.toString() === fighterBId) {
      const takeover = await TitleHistory.findOne({ type: 'takeover' }).lean();
      expect(takeover).not.toBeNull();
      expect(takeover?.newHolderFighterId?.toString()).toBe(fighterAId);
    }

    // 11. Kekosongan 6 hari: mundurkan lastFightAt holder 7 hari, lalu
    // GET /api/title (lazy check) → gelar kosong + event vacated_inactivity.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await Title.updateOne({}, { $set: { lastFightAt: sevenDaysAgo } });
    const titleAfter = await getTitle();
    const titleAfterBody = await json<ApiData<TitleOut>>(titleAfter);
    expect(titleAfterBody.data.title.holder).toBeNull();
    const vacateEvent = await TitleHistory.findOne({ type: 'vacated_inactivity' }).lean();
    expect(vacateEvent).not.toBeNull();
    expect(vacateEvent?.previousHolderFighterId?.toString()).toBe(fighterAId);
    expect(vacateEvent?.newHolderFighterId).toBeNull();
  }, 180000);
});
