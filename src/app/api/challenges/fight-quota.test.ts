import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as register } from '../auth/register/route';
import { POST as createFighter, GET as listFighters } from '../fighters/route';
import { POST as createChallenge } from './route';
import { POST as acceptDirect } from './[id]/accept/route';
import { Challenge } from '../../../models/Challenge';
import { GameFight } from '../../../models/GameFight';
import { wibDayWindow } from '../../../lib/game/daily-limit';

/**
 * Integration test sisa jatah tarung + nantang tanpa jatah
 * (perintah user 8 Nov 15:13 WIB).
 *
 * - GET /api/fighters mengembalikan fightsLeftToday per fighter (5/hari,
 *   hari WIB, hitungan SAMA dengan gate accept: semua GameFight yang
 *   dibuat hari ini, status apa pun; fight kemarin WIB tidak dihitung).
 * - Kirim tantangan dengan sisa tarung 0/5 BERHASIL (201) — nantang
 *   tidak butuh jatah tarung.
 * - Accept dengan salah satu fighter 0/5 tetap DITOLAK 409
 *   DAILY_LIMIT_REACHED — gate di accept dipertahankan.
 *
 * Pola setup sama dengan open-challenge.test.ts: kalau binary MongoDB
 * tidak bisa jalan di VM ini, suite SKIP (tidak memblokir unit lain).
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
      'SKIP integration test fight-quota: mongodb-memory-server tidak bisa jalan di VM ini:',
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
    console.warn('SKIP: integration test fight-quota dilewati (tidak ada MongoDB in-memory).');
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

async function makeUserFighter(
  username: string,
  displayName: string,
  ig: string,
  style: string,
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
  return { cookie: cookie!, fighterId: fBody.data.fighter.id };
}

interface FightersOut {
  fighters: { id: string; displayName: string; fightsLeftToday: number }[];
}

describe('Sisa jatah tarung di kartu lawan + nantang tanpa jatah', () => {
  it('fightsLeftToday benar (batas hari WIB) → kirim tantangan 0/5 lolos → accept 0/5 ditolak', async () => {
    if (skipIfNoDb()) return;

    const a = await makeUserFighter('quota_a', 'Quota A', 'quota_a', 'boxing');
    const b = await makeUserFighter('quota_b', 'Quota B', 'quota_b', 'muay-thai');
    const c = await makeUserFighter('quota_c', 'Quota C', 'quota_c', 'karate');
    const d = await makeUserFighter('quota_d', 'Quota D', 'quota_d', 'judo');

    // Fight hari ini (WIB): A vs D x5 (A habis, D habis), B vs D x1 (B sisa 4).
    // Fight kemarin WIB: C vs D x1 (tidak dihitung — C tetap 5).
    const { start } = wibDayWindow(new Date());
    const yesterdayWib = new Date(start.getTime() - 60 * 60 * 1000);
    const oid = (id: string) => new mongoose.Types.ObjectId(id);
    const fightDoc = (x: string, y: string, createdAt?: Date) => ({
      fighterAId: oid(x),
      fighterBId: oid(y),
      challengeId: null,
      tournamentId: null,
      seed: 123456,
      map: 'ring',
      durationSec: 60,
      status: 'pending',
      config: { left: {}, right: {} },
      isTitleFight: false,
      ...(createdAt ? { createdAt } : {}),
    });
    await GameFight.insertMany([
      fightDoc(a.fighterId, d.fighterId),
      fightDoc(a.fighterId, d.fighterId),
      fightDoc(a.fighterId, d.fighterId),
      fightDoc(a.fighterId, d.fighterId),
      fightDoc(a.fighterId, d.fighterId),
      fightDoc(b.fighterId, d.fighterId),
      fightDoc(c.fighterId, d.fighterId, yesterdayWib),
    ]);

    // 1. GET /api/fighters → fightsLeftToday per fighter.
    const listRes = await listFighters(req('/api/fighters?sort=wins'));
    expect(listRes.status).toBe(200);
    const listBody = await json<ApiData<FightersOut>>(listRes);
    const left = new Map(listBody.data.fighters.map((f) => [f.displayName, f.fightsLeftToday]));
    expect(left.get('Quota A')).toBe(0);
    expect(left.get('Quota B')).toBe(4);
    expect(left.get('Quota C')).toBe(5);
    expect(left.get('Quota D')).toBe(0);

    // 2. A (0/5) menantang C → 201 (nantang tidak butuh jatah tarung).
    const chRes = await createChallenge(
      req('/api/challenges', {
        method: 'POST',
        body: { challengedFighterId: c.fighterId, map: 'ring', message: 'Berani?' },
        cookie: a.cookie,
      }),
    );
    expect(chRes.status).toBe(201);
    const chBody = await json<ApiData<{ challenge: { id: string } }>>(chRes);
    const challengeId = chBody.data.challenge.id;

    // 3. C menerima tantangan A (A 0/5) → 409 DAILY_LIMIT_REACHED;
    // tantangan tetap pending.
    const accRes = await acceptDirect(
      req(`/api/challenges/${challengeId}/accept`, { method: 'POST', cookie: c.cookie }),
      { params: Promise.resolve({ id: challengeId }) },
    );
    expect(accRes.status).toBe(409);
    const accBody = await json<ApiData<unknown>>(accRes);
    expect(accBody.error?.code).toBe('DAILY_LIMIT_REACHED');
    const stillPending = await Challenge.findById(challengeId).lean();
    expect(stillPending?.status).toBe('pending');
  }, 180000);
});
