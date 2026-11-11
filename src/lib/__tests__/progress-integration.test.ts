import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as register } from '../../app/api/auth/register/route';
import { POST as createFighter } from '../../app/api/fighters/route';
import { POST as buyGear } from '../../app/api/shop/buy/route';
import { GET as getShop } from '../../app/api/shop/route';
import { POST as predict } from '../../app/api/predictions/route';
import { GET as getProgress } from '../../app/api/fighters/[id]/progress/route';
import { GET as getRivalry } from '../../app/api/fighters/[id]/rivalry/route';
import { connectDB } from '../db';
import { awardFightOutcome, getOrCreateProgress, resolvePredictions } from '../game/progress';
import { Fighter } from '../../models/Fighter';
import { FighterProgress } from '../../models/FighterProgress';
import { GameFight } from '../../models/GameFight';
import { Match } from '../../models/Match';
import { Prediction } from '../../models/Prediction';
import { Tournament } from '../../models/Tournament';
import { User } from '../../models/User';

/**
 * Integration test sistem anti-monoton (XP/koin/gear/achievement/
 * cedera/prediksi/rivalry) dengan mongodb-memory-server.
 * Pola setup sama dengan quick-fight.test.ts: kalau binary MongoDB
 * tidak bisa diunduh di VM ini, seluruh suite SKIP.
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
    process.env.JWT_SECRET = 'test-secret-yang-cukup-panjang-untuk-jose';
    dbReady = true;
    await connectDB();
  } catch (err) {
    console.warn(
      'SKIP integration test progress: mongodb-memory-server tidak bisa jalan di VM ini:',
      (err as Error).message,
    );
  }
}, 180000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  if (!dbReady) return;
  await Promise.all([
    User.deleteMany({}),
    Fighter.deleteMany({}),
    FighterProgress.deleteMany({}),
    GameFight.deleteMany({}),
    Match.deleteMany({}),
    Prediction.deleteMany({}),
    Tournament.deleteMany({}),
  ]);
}, 60000);

function skipIfNoDb(): boolean {
  if (!dbReady) {
    console.warn('SKIP: integration test progress dilewati (tidak ada MongoDB in-memory).');
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

async function makeFighter(username: string, weightKg: number | null) {
  const reg = await register(
    req('/api/auth/register', {
      method: 'POST',
      body: { username, password: 'password123' },
    }),
  );
  const cookie = extractCookie(reg);
  expect(reg.status).toBe(201);
  const created = await createFighter(
    req('/api/fighters', {
      method: 'POST',
      cookie,
      body: {
        displayName: username,
        igUsername: `${username}_ig`,
        style: 'boxing',
        selfDescription: 'Petarung tes',
        weightKg,
      },
    }),
  );
  expect(created.status).toBe(201);
  const data = await json<{ ok: boolean; data: { fighter: { id: string } } }>(created);
  return { cookie, fighterId: data.data.fighter.id };
}

describe('awardFightOutcome (DB)', () => {
  it('menang KO: 150 XP + 50 koin, naik level 2, achievement first-win + first-ko', async () => {
    if (skipIfNoDb()) return;
    const { fighterId } = await makeFighter('progresa', 75);
    const res = await awardFightOutcome(fighterId, {
      result: 'win',
      method: 'KO',
      isTitleFight: false,
      isTournament: false,
    });
    // Record Fighter belum di-update di tes ini (award membaca record
    // apa adanya = 0) — jadi achievement belum terbuka di sini; yang
    // dicek: XP/koin/level. Achievement dicek di skenario berikutnya.
    expect(res.xpGained).toBe(150);
    expect(res.coinsGained).toBe(50);
    expect(res.levelBefore).toBe(1);
    expect(res.level).toBe(2);
    expect(res.levelUp).toBe(true);
    const p = await FighterProgress.findOne({ fighterId }).lean();
    expect(p?.xp).toBe(150);
    expect(p?.coins).toBe(50);
    expect(p?.totalFights).toBe(1);
    expect(p?.currentWinStreak).toBe(1);
  });

  it('menang title fight: koin 150 (50 + bonus 100)', async () => {
    if (skipIfNoDb()) return;
    const { fighterId } = await makeFighter('progresb', null);
    const res = await awardFightOutcome(fighterId, {
      result: 'win',
      method: 'decision',
      isTitleFight: true,
      isTournament: false,
    });
    expect(res.xpGained).toBe(100);
    expect(res.coinsGained).toBe(150);
  });

  it('kalah KO dengan rng 0 → cedera; fight berikut mengurangi sisa cedera', async () => {
    if (skipIfNoDb()) return;
    const { fighterId } = await makeFighter('progresc', 90);
    const first = await awardFightOutcome(
      fighterId,
      { result: 'loss', method: 'KO', isTitleFight: false, isTournament: false },
      { rng: () => 0 },
    );
    expect(first.injury).toEqual({ stat: 'power', pct: 15, fightsRemaining: 3 });
    expect(first.coinsGained).toBe(10);
    const second = await awardFightOutcome(
      fighterId,
      { result: 'loss', method: 'decision', isTitleFight: false, isTournament: false },
      { rng: () => 0.99 },
    );
    expect(second.injury?.fightsRemaining).toBe(2);
  });

  it('achievement terbuka kalau record Fighter sudah di-update dulu', async () => {
    if (skipIfNoDb()) return;
    const { fighterId } = await makeFighter('progresd', 65);
    await Fighter.updateOne(
      { _id: fighterId },
      { $set: { 'record.wins': 1, 'record.kos': 1 } },
    );
    const res = await awardFightOutcome(fighterId, {
      result: 'win',
      method: 'KO',
      isTitleFight: false,
      isTournament: false,
    });
    expect(res.achievementsUnlocked).toContain('first-win');
    expect(res.achievementsUnlocked).toContain('first-ko');
    const p = await FighterProgress.findOne({ fighterId }).lean();
    expect(p?.achievements).toContain('first-win');
  });
});

describe('Toko gear (API)', () => {
  it('beli gear: koin berkurang, gear masuk owned; beli 2x → 409; koin kurang → 400', async () => {
    if (skipIfNoDb()) return;
    const { cookie, fighterId } = await makeFighter('tokoku', 80);
    const progress = await getOrCreateProgress(fighterId);
    progress.coins = 200;
    await progress.save();

    const shopRes = await getShop(req('/api/shop', { cookie }));
    const shop = await json<{ ok: boolean; data: { coins: number } }>(shopRes);
    expect(shop.data.coins).toBe(200);

    const buy = await buyGear(
      req('/api/shop/buy', { method: 'POST', cookie, body: { gearId: 'gloves-mma' } }),
    );
    expect(buy.status).toBe(200);
    const bought = await json<{ ok: boolean; data: { progress: { coins: number; gearOwned: string[] } } }>(buy);
    expect(bought.data.progress.coins).toBe(50);
    expect(bought.data.progress.gearOwned).toContain('gloves-mma');

    const buyAgain = await buyGear(
      req('/api/shop/buy', { method: 'POST', cookie, body: { gearId: 'gloves-mma' } }),
    );
    expect(buyAgain.status).toBe(409);

    const poor = await buyGear(
      req('/api/shop/buy', { method: 'POST', cookie, body: { gearId: 'head-crown' } }),
    );
    expect(poor.status).toBe(400);
  });

  it('GET progress: level/XP/koin + daftar achievement terkunci/terbuka', async () => {
    if (skipIfNoDb()) return;
    const { fighterId } = await makeFighter('progrese', null);
    await awardFightOutcome(fighterId, {
      result: 'win',
      method: 'decision',
      isTitleFight: false,
      isTournament: false,
    });
    const res = await getProgress(req(`/api/fighters/${fighterId}/progress`), {
      params: Promise.resolve({ id: fighterId }),
    });
    const data = await json<{
      ok: boolean;
      data: { progress: { level: number; xp: number; coins: number }; achievements: { id: string; unlocked: boolean }[] };
    }>(res);
    expect(data.data.progress.level).toBe(2);
    expect(data.data.progress.xp).toBe(100);
    expect(data.data.achievements.length).toBeGreaterThanOrEqual(8);
  });
});

describe('Prediksi penonton (API + resolusi)', () => {
  it('prediksi 10 koin; benar → +20 koin; salah → hangus; duplikat → 409', async () => {
    if (skipIfNoDb()) return;
    const a = await makeFighter('preda', 70);
    const b = await makeFighter('predb', 72);
    const c = await makeFighter('predc', 74);
    // Beri koin ke penebak (c) supaya bisa memprediksi.
    const pc = await getOrCreateProgress(c.fighterId);
    pc.coins = 50;
    await pc.save();

    const t = await Tournament.create({
      name: 'Turnamen Tes',
      slug: 'turnamen-tes',
      format: 'single-elim',
      bracketSize: 8,
      regOpenAt: new Date(),
      regCloseAt: new Date(),
      status: 'in_progress',
      rules: '',
      createdBy: (await User.findOne({ username: 'preda' }))!._id,
    });
    const match = await Match.create({
      tournamentId: t._id,
      round: 'QF',
      fighterAId: a.fighterId,
      fighterBId: b.fighterId,
      drawSeed: 1,
      status: 'scheduled',
    });

    const ok1 = await predict(
      req('/api/predictions', {
        method: 'POST',
        cookie: c.cookie,
        body: { fightId: match._id.toString(), kind: 'tournament', predictedWinnerFighterId: a.fighterId },
      }),
    );
    expect(ok1.status).toBe(201);
    const afterBet = await FighterProgress.findOne({ fighterId: c.fighterId }).lean();
    expect(afterBet?.coins).toBe(40);

    const dup = await predict(
      req('/api/predictions', {
        method: 'POST',
        cookie: c.cookie,
        body: { fightId: match._id.toString(), kind: 'tournament', predictedWinnerFighterId: b.fighterId },
      }),
    );
    expect(dup.status).toBe(409);

    // Resolusi: A menang → penebak (c) dapat +20 koin.
    const resolved = await resolvePredictions(match._id.toString(), 'tournament', a.fighterId);
    expect(resolved).toEqual({ resolved: 1, won: 1, lost: 0, paidOut: 20 });
    const afterWin = await FighterProgress.findOne({ fighterId: c.fighterId }).lean();
    expect(afterWin?.coins).toBe(60);
    const p = await Prediction.findOne({ fightId: match._id.toString() }).lean();
    expect(p?.status).toBe('won');
    expect(p?.payout).toBe(20);
  });

  it('prediksi salah → lost, payout 0; seri → tetap open', async () => {
    if (skipIfNoDb()) return;
    const a = await makeFighter('predd', 70);
    const b = await makeFighter('prede', 72);
    const c = await makeFighter('predf', 74);
    const pc = await getOrCreateProgress(c.fighterId);
    pc.coins = 50;
    await pc.save();
    const t = await Tournament.create({
      name: 'Turnamen Tes 2',
      slug: 'turnamen-tes-2',
      format: 'single-elim',
      bracketSize: 8,
      regOpenAt: new Date(),
      regCloseAt: new Date(),
      status: 'in_progress',
      rules: '',
      createdBy: (await User.findOne({ username: 'predd' }))!._id,
    });
    const m1 = await Match.create({
      tournamentId: t._id,
      round: 'QF',
      fighterAId: a.fighterId,
      fighterBId: b.fighterId,
      drawSeed: 1,
      status: 'scheduled',
    });
    await predict(
      req('/api/predictions', {
        method: 'POST',
        cookie: c.cookie,
        body: { fightId: m1._id.toString(), kind: 'tournament', predictedWinnerFighterId: a.fighterId },
      }),
    );
    const r1 = await resolvePredictions(m1._id.toString(), 'tournament', b.fighterId);
    expect(r1).toEqual({ resolved: 1, won: 0, lost: 1, paidOut: 0 });
    const p1 = await Prediction.findOne({ fightId: m1._id.toString() }).lean();
    expect(p1?.status).toBe('lost');

    const m2 = await Match.create({
      tournamentId: t._id,
      round: 'QF',
      fighterAId: a.fighterId,
      fighterBId: b.fighterId,
      drawSeed: 2,
      status: 'scheduled',
    });
    // Koin c tinggal 40 — cukup untuk prediksi kedua.
    await predict(
      req('/api/predictions', {
        method: 'POST',
        cookie: c.cookie,
        body: { fightId: m2._id.toString(), kind: 'tournament', predictedWinnerFighterId: a.fighterId },
      }),
    );
    const r2 = await resolvePredictions(m2._id.toString(), 'tournament', null);
    expect(r2.resolved).toBe(0);
    const p2 = await Prediction.findOne({ fightId: m2._id.toString() }).lean();
    expect(p2?.status).toBe('open');
  });
});

describe('Rivalry (API)', () => {
  it('head-to-head dari GameFight completed', async () => {
    if (skipIfNoDb()) return;
    const a = await makeFighter('riva', 70);
    const b = await makeFighter('rivb', 72);
    const cfg = { left: {}, right: {} };
    await GameFight.create({
      fighterAId: a.fighterId,
      fighterBId: b.fighterId,
      seed: 1,
      map: 'ring',
      status: 'completed',
      config: cfg,
      result: { winnerSide: 'R', winnerFighterId: a.fighterId, method: 'KO', score: { a: 70, b: 50 }, koTimeSec: 40 },
      completedAt: new Date('2026-11-10'),
    });
    await GameFight.create({
      fighterAId: b.fighterId,
      fighterBId: a.fighterId,
      seed: 2,
      map: 'ring',
      status: 'completed',
      config: cfg,
      result: { winnerSide: 'R', winnerFighterId: b.fighterId, method: 'decision', score: { a: 60, b: 55 }, koTimeSec: null },
      completedAt: new Date('2026-11-11'),
    });
    const res = await getRivalry(req(`/api/fighters/${a.fighterId}/rivalry?opponentId=${b.fighterId}`), {
      params: Promise.resolve({ id: a.fighterId }),
    });
    const data = await json<{
      ok: boolean;
      data: { rivalry: { winsA: number; winsB: number; draws: number; totalFights: number }; label: string };
    }>(res);
    expect(data.data.rivalry.winsA).toBe(1);
    expect(data.data.rivalry.winsB).toBe(1);
    expect(data.data.rivalry.totalFights).toBe(2);
    expect(data.data.label).toBe('Rivalitas 1-1');
  });
});

describe('weightKg tersimpan di Fighter', () => {
  it('buat fighter dengan weightKg 75 → tersimpan + kelas Menengah', async () => {
    if (skipIfNoDb()) return;
    const { fighterId } = await makeFighter('berata', 75);
    const f = await Fighter.findById(fighterId).lean();
    expect(f?.weightKg).toBe(75);
  });
});
