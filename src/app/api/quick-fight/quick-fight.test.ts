import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as register } from '../auth/register/route';
import { POST as createFighter } from '../fighters/route';
import { POST as quickFight } from './route';
import { connectDB } from '../../../lib/db';
import { Challenge } from '../../../models/Challenge';
import { Fighter } from '../../../models/Fighter';
import { GameFight } from '../../../models/GameFight';
import { Notification } from '../../../models/Notification';
import { Title } from '../../../models/Title';

/**
 * Integration test Gas Tarung (quick match) dengan mongodb-memory-server.
 * Pola setup sama dengan open-challenge.test.ts: kalau binary MongoDB
 * tidak bisa diunduh di VM ini, seluruh suite SKIP (tidak memblokir
 * unit lain).
 *
 * beforeEach membersihkan Fighter/Challenge/GameFight/Notification/
 * Title supaya tiap skenario mulai dari nol (user register tetap ada,
 * tapi fighter baru dibuat per skenario).
 *
 * Alur per skenario: register user → fighter (rating diatur manual
 * lewat updateOne) → POST /api/quick-fight.
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
    // Koneksi eksplisit di sini: beforeEach/afterEach menyentuh model
    // LANGSUNG (tanpa lewat route handler) — tanpa ini Mongoose
    // mem-buffer operasi selamanya karena connectDB() belum pernah
    // dipanggil dan hook keburu timeout 10 dtk.
    await connectDB();
  } catch (err) {
    console.warn(
      'SKIP integration test quick-fight: mongodb-memory-server tidak bisa jalan di VM ini:',
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
    Fighter.deleteMany({}),
    Challenge.deleteMany({}),
    GameFight.deleteMany({}),
    Notification.deleteMany({}),
    Title.deleteMany({}),
  ]);
}, 60000);

afterEach(async () => {
  if (!dbReady) return;
  // Pastikan tidak ada fighter yang tertinggal dengan > 1 fight aktif.
  const actives = await GameFight.find({ status: { $in: ['pending', 'playing'] } })
    .select('fighterAId fighterBId')
    .lean();
  const counts = new Map<string, number>();
  for (const f of actives) {
    counts.set(f.fighterAId.toString(), (counts.get(f.fighterAId.toString()) ?? 0) + 1);
    counts.set(f.fighterBId.toString(), (counts.get(f.fighterBId.toString()) ?? 0) + 1);
  }
  for (const [id, n] of counts) {
    expect(n, `fighter ${id} punya ${n} fight aktif`).toBeLessThanOrEqual(1);
  }
}, 60000);

function skipIfNoDb(): boolean {
  if (!dbReady) {
    console.warn('SKIP: integration test quick-fight dilewati (tidak ada MongoDB in-memory).');
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

interface QuickOut {
  status: 'matched' | 'active_fight' | 'no_opponent';
  gameFight?: { id: string };
  opponent?: { id: string; displayName: string; rating: number } | null;
  isTitleFight?: boolean;
  config?: { fightId: string; seed: number; duration: number };
}

async function makeUserFighter(
  username: string,
  displayName: string,
  ig: string,
  style: string,
  rating = 1000,
): Promise<{ cookie: string; fighterId: string }> {
  const reg = await register(
    req('/api/auth/register', { method: 'POST', body: { username, password: 'passwordkuat123' } }),
  );
  expect(reg.status).toBe(201);
  const cookie = extractCookie(reg);
  expect(cookie).toContain('sfh_token=');
  const fRes = await createFighter(
    req('/api/fighters', {
      method: 'POST',
      body: { displayName, igUsername: ig, style, selfDescription: SELF_DESC },
      cookie,
    }),
  );
  expect(fRes.status).toBe(201);
  const fBody = await json<ApiData<{ fighter: { id: string } }>>(fRes);
  if (rating !== 1000) {
    await Fighter.updateOne({ _id: fBody.data.fighter.id }, { $set: { rating } });
  }
  return { cookie: cookie!, fighterId: fBody.data.fighter.id };
}

/** Sisipkan fight langsung (tanpa lewat API) untuk skenario sibuk/kuota. */
async function insertFight(
  aId: string,
  bId: string,
  status: 'pending' | 'playing' | 'completed' = 'pending',
) {
  return GameFight.create({
    fighterAId: new mongoose.Types.ObjectId(aId),
    fighterBId: new mongoose.Types.ObjectId(bId),
    challengeId: null,
    tournamentId: null,
    seed: 123456,
    map: 'ring',
    durationSec: 60,
    status,
    config: { left: {}, right: {} },
    isTitleFight: false,
  });
}

async function callQuickFight(cookie: string) {
  return quickFight(req('/api/quick-fight', { method: 'POST', cookie }));
}

/**
 * Panggil quick-fight, retry sampai 3x kalau 409 QUICK_FIGHT_CONFLICT.
 * Mengembalikan status + body yang sudah dibaca (body Response hanya
 * bisa dibaca sekali — jangan baca lagi di pemanggil).
 */
async function callQuickFightSettled(
  cookie: string,
): Promise<{ status: number; body: ApiData<QuickOut> }> {
  let res = await callQuickFight(cookie);
  let body = await json<ApiData<QuickOut>>(res);
  for (let i = 0; i < 3 && res.status === 409; i++) {
    if (body.error?.code !== 'QUICK_FIGHT_CONFLICT') break;
    res = await callQuickFight(cookie);
    body = await json<ApiData<QuickOut>>(res);
  }
  return { status: res.status, body };
}

describe('Gas Tarung (quick match)', () => {
  it('matched: lawan terdekat ratingnya, challenge + fight dibuat', async () => {
    if (skipIfNoDb()) return;

    const a = await makeUserFighter('qf_a1', 'QF A', 'qf_a1', 'boxing', 1000);
    const b = await makeUserFighter('qf_b1', 'QF B', 'qf_b1', 'muay-thai', 1050);

    const res = await callQuickFight(a.cookie);
    expect(res.status).toBe(200);
    const body = await json<ApiData<QuickOut>>(res);
    expect(body.data.status).toBe('matched');
    expect(body.data.opponent?.id).toBe(b.fighterId);
    expect(body.data.gameFight?.id).toBeTruthy();
    expect(body.data.isTitleFight).toBe(false);
    expect(body.data.config?.fightId).toBe(body.data.gameFight?.id);
    expect(body.data.config?.duration).toBe(60);
    expect(body.data.config?.seed).toBeGreaterThanOrEqual(100000);

    const fight = await GameFight.findById(body.data.gameFight!.id).lean();
    expect(fight?.fighterAId.toString()).toBe(a.fighterId);
    expect(fight?.fighterBId.toString()).toBe(b.fighterId);
    expect(fight?.status).toBe('pending');
    expect(fight?.tournamentId).toBeNull();
    const challenge = await Challenge.findById(fight?.challengeId).lean();
    expect(challenge?.status).toBe('accepted');
    expect(challenge?.kind).toBe('direct');
    expect(challenge?.gameFightId?.toString()).toBe(fight?._id.toString());
    expect(challenge?.challengedFighterId?.toString()).toBe(b.fighterId);
  }, 180000);

  it('prefer rating ±100: pilih yang di dalam jendela, bukan yang jauh', async () => {
    if (skipIfNoDb()) return;

    const a = await makeUserFighter('qf_a2', 'QF A', 'qf_a2', 'boxing', 1000);
    const b = await makeUserFighter('qf_b2', 'QF B', 'qf_b2', 'muay-thai', 1040);
    await makeUserFighter('qf_c2', 'QF C', 'qf_c2', 'karate', 1300);

    const res = await callQuickFight(a.cookie);
    const body = await json<ApiData<QuickOut>>(res);
    expect(body.data.status).toBe('matched');
    expect(body.data.opponent?.id).toBe(b.fighterId);
  }, 180000);

  it('fallback: kalau tidak ada yang dalam ±100, ambil yang paling dekat', async () => {
    if (skipIfNoDb()) return;

    const a = await makeUserFighter('qf_a3', 'QF A', 'qf_a3', 'boxing', 1000);
    const b = await makeUserFighter('qf_b3', 'QF B', 'qf_b3', 'muay-thai', 1300);
    await makeUserFighter('qf_c3', 'QF C', 'qf_c3', 'karate', 1500);

    const res = await callQuickFight(a.cookie);
    const body = await json<ApiData<QuickOut>>(res);
    expect(body.data.status).toBe('matched');
    expect(body.data.opponent?.id).toBe(b.fighterId);
  }, 180000);

  it('lewati lawan sibuk & lawan yang jatahnya habis', async () => {
    if (skipIfNoDb()) return;

    const a = await makeUserFighter('qf_a4', 'QF A', 'qf_a4', 'boxing', 1000);
    const b = await makeUserFighter('qf_b4', 'QF B', 'qf_b4', 'muay-thai', 1010);
    const c = await makeUserFighter('qf_c4', 'QF C', 'qf_c4', 'karate', 1020);
    const d = await makeUserFighter('qf_d4', 'QF D', 'qf_d4', 'judo', 1030);

    // B sibuk (fight pending), C sudah 3 fight hari ini (lawan acak,
    // supaya tidak memakan jatah A).
    await insertFight(b.fighterId, new mongoose.Types.ObjectId().toString(), 'pending');
    await insertFight(c.fighterId, new mongoose.Types.ObjectId().toString(), 'pending');
    await insertFight(c.fighterId, new mongoose.Types.ObjectId().toString(), 'completed');
    await insertFight(c.fighterId, new mongoose.Types.ObjectId().toString(), 'completed');

    const res = await callQuickFight(a.cookie);
    const body = await json<ApiData<QuickOut>>(res);
    expect(body.data.status).toBe('matched');
    expect(body.data.opponent?.id).toBe(d.fighterId);
  }, 180000);

  it('no_opponent: sendirian → status no_opponent, tidak ada fight dibuat', async () => {
    if (skipIfNoDb()) return;

    const a = await makeUserFighter('qf_a5', 'QF A', 'qf_a5', 'boxing', 1000);

    const res = await callQuickFight(a.cookie);
    expect(res.status).toBe(200);
    const body = await json<ApiData<QuickOut>>(res);
    expect(body.data.status).toBe('no_opponent');
    expect(await GameFight.countDocuments()).toBe(0);
    expect(await Challenge.countDocuments()).toBe(0);
  }, 180000);

  it('jatah saya habis (3 fight hari ini) → 409 DAILY_LIMIT_REACHED', async () => {
    if (skipIfNoDb()) return;

    const a = await makeUserFighter('qf_a6', 'QF A', 'qf_a6', 'boxing', 1000);
    const b = await makeUserFighter('qf_b6', 'QF B', 'qf_b6', 'muay-thai', 1000);
    await insertFight(a.fighterId, b.fighterId, 'pending');
    await insertFight(a.fighterId, b.fighterId, 'completed');
    await insertFight(a.fighterId, b.fighterId, 'completed');

    const res = await callQuickFight(a.cookie);
    expect(res.status).toBe(409);
    const body = await json<ApiData<unknown>>(res);
    expect(body.error?.code).toBe('DAILY_LIMIT_REACHED');
  }, 180000);

  it('belum punya fighter → 400 NO_FIGHTER', async () => {
    if (skipIfNoDb()) return;

    const reg = await register(
      req('/api/auth/register', { method: 'POST', body: { username: 'qf_nof', password: 'passwordkuat123' } }),
    );
    expect(reg.status).toBe(201);
    const cookie = extractCookie(reg);

    const res = await callQuickFight(cookie!);
    expect(res.status).toBe(400);
    const body = await json<ApiData<unknown>>(res);
    expect(body.error?.code).toBe('NO_FIGHTER');
  }, 180000);

  it('sudah punya fight aktif → active_fight, fight lama dipakai lagi', async () => {
    if (skipIfNoDb()) return;

    const a = await makeUserFighter('qf_a8', 'QF A', 'qf_a8', 'boxing', 1000);
    await makeUserFighter('qf_b8', 'QF B', 'qf_b8', 'muay-thai', 1000);

    const first = await callQuickFight(a.cookie);
    const firstBody = await json<ApiData<QuickOut>>(first);
    expect(firstBody.data.status).toBe('matched');
    const fightId = firstBody.data.gameFight!.id;

    const second = await callQuickFight(a.cookie);
    expect(second.status).toBe(200);
    const secondBody = await json<ApiData<QuickOut>>(second);
    expect(secondBody.data.status).toBe('active_fight');
    expect(secondBody.data.gameFight?.id).toBe(fightId);
    // Tidak ada fight baru yang dibuat.
    expect(await GameFight.countDocuments()).toBe(1);
  }, 180000);

  it('race: dua quick-fight bersamaan ke lawan yang sama → tidak ada fight ganda', async () => {
    if (skipIfNoDb()) return;

    const a = await makeUserFighter('qf_a9', 'QF A', 'qf_a9', 'boxing', 1000);
    const d = await makeUserFighter('qf_d9', 'QF D', 'qf_d9', 'judo', 1200);
    const b = await makeUserFighter('qf_b9', 'QF B', 'qf_b9', 'muay-thai', 1050);

    // A dan D sama-sama paling dekat dengan B (selisih 50 vs 150;
    // D ke B 150, D ke A 200 — keduanya memilih B).
    const [settledA, settledD] = await Promise.all([
      callQuickFightSettled(a.cookie),
      callQuickFightSettled(d.cookie),
    ]);

    const bodyA = settledA.body;
    const bodyD = settledD.body;
    // Kalau salah satu masih error, tampilkan kodenya (bukan TypeError samar).
    for (const [name, body] of [
      ['A', bodyA],
      ['D', bodyD],
    ] as const) {
      expect(body.ok, `${name} gagal: ${JSON.stringify(body.error)}`).toBe(true);
    }
    // Keduanya selesai tanpa 409 yang menggantung.
    for (const body of [bodyA, bodyD]) {
      expect(['matched', 'active_fight', 'no_opponent']).toContain(body.data.status);
    }
    // Paling sedikit satu pihak dapat fight; tidak ada yang ganda
    // (afterEach juga menegaskan ≤ 1 fight aktif per fighter).
    const gotFight = [bodyA, bodyD].some(
      (b2) => b2.data.status === 'matched' || b2.data.status === 'active_fight',
    );
    expect(gotFight).toBe(true);
    expect(await GameFight.countDocuments()).toBeLessThanOrEqual(2);
    // Lawan B maksimal terlibat di 1 fight.
    const bFights = await GameFight.countDocuments({
      $or: [{ fighterAId: b.fighterId }, { fighterBId: b.fighterId }],
    });
    expect(bFights).toBeLessThanOrEqual(1);
  }, 180000);
});
