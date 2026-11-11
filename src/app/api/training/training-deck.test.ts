import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as register } from '../auth/register/route';
import { POST as login } from '../auth/login/route';
import { POST as createFighter } from '../fighters/route';
import { GET as trainingStatus } from './status/route';
import { POST as trainingSession } from './session/route';
import { POST as trainingAllocate } from './allocate/route';
import { GET as getDeck, PUT as putDeck } from '../deck/route';

/**
 * Integration test API Training + Deck (mongodb-memory-server).
 * Pola setup sama dengan api.integration.test.ts (skip bila binary
 * MongoDB tidak bisa diunduh di VM ini).
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
    process.env.JWT_SECRET = 'test-jwt-secret-untuk-test-training-yang-cukup-panjang';
    dbReady = true;
  } catch (err) {
    console.warn(
      'SKIP integration test training: mongodb-memory-server tidak bisa jalan di VM ini:',
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
    console.warn('SKIP: integration test training dilewati (tidak ada MongoDB in-memory).');
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

interface ApiBody<T> {
  ok: boolean;
  data: T;
  error?: { code: string; message: string };
}

let cookie: string | null = null;

async function setupUserAndFighter() {
  const reg = await register(
    req('/api/auth/register', { method: 'POST', body: { username: 'latihan_test', password: 'passwordkuat123' } }),
  );
  expect(reg.status).toBe(201);
  const loginRes = await login(
    req('/api/auth/login', { method: 'POST', body: { username: 'latihan_test', password: 'passwordkuat123' } }),
  );
  expect(loginRes.status).toBe(200);
  cookie = extractCookie(loginRes);
  expect(cookie).toContain('sfh_token=');
  const fighterRes = await createFighter(
    req('/api/fighters', {
      method: 'POST',
      body: {
        displayName: 'Petarung Latihan',
        igUsername: 'latihan_test',
        style: 'boxing',
        selfDescription: 'Petarung test untuk latihan.',
      },
      cookie,
    }),
  );
  expect(fighterRes.status).toBe(201);
}

describe('API Training + Deck', () => {
  it('status awal: stat 10 semua, 0 poin, deck kosong', async () => {
    if (skipIfNoDb()) return;
    await setupUserAndFighter();
    const res = await trainingStatus(req('/api/training/status', { cookie }));
    expect(res.status).toBe(200);
    const body = await json<ApiBody<{
      stats: Record<string, number>;
      pointsAvailable: number;
      today: { pushups: number; squats: number; pointsEarned: number };
      deck: { cards: string[]; signature: string | null };
    }>>(res);
    expect(body.ok).toBe(true);
    expect(body.data.stats).toEqual({ power: 10, speed: 10, stamina: 10, defense: 10, accuracy: 10 });
    expect(body.data.pointsAvailable).toBe(0);
    expect(body.data.today.pushups).toBe(0);
    expect(body.data.deck.cards).toEqual([]);
  });

  it('sesi 25 push-up → 1 poin; alokasi ke Power → stat 11, poin 0', async () => {
    if (skipIfNoDb()) return;
    const s1 = await trainingSession(
      req('/api/training/session', { method: 'POST', body: { pushups: 25, squats: 0 }, cookie }),
    );
    expect(s1.status).toBe(200);
    const b1 = await json<ApiBody<{ pointsEarnedThisSession: number; pointsAvailable: number }>>(s1);
    expect(b1.data.pointsEarnedThisSession).toBe(1);
    expect(b1.data.pointsAvailable).toBe(1);

    const a1 = await trainingAllocate(
      req('/api/training/allocate', { method: 'POST', body: { stat: 'power', points: 1 }, cookie }),
    );
    expect(a1.status).toBe(200);
    const ba = await json<ApiBody<{ stats: Record<string, number>; pointsAvailable: number }>>(a1);
    expect(ba.data.stats.power).toBe(11);
    expect(ba.data.pointsAvailable).toBe(0);
  });

  it('alokasi tanpa poin → 400', async () => {
    if (skipIfNoDb()) return;
    const res = await trainingAllocate(
      req('/api/training/allocate', { method: 'POST', body: { stat: 'speed', points: 1 }, cookie }),
    );
    expect(res.status).toBe(400);
    const body = await json<ApiBody<unknown>>(res);
    expect(body.ok).toBe(false);
  });

  it('cap harian ditegakkan server: 25 push-up lagi (total 50) ok, +1 ditolak', async () => {
    if (skipIfNoDb()) return;
    const s2 = await trainingSession(
      req('/api/training/session', { method: 'POST', body: { pushups: 25, squats: 0 }, cookie }),
    );
    expect(s2.status).toBe(200);
    const b2 = await json<ApiBody<{ pointsEarnedThisSession: number; today: { pushups: number } }>>(s2);
    expect(b2.data.today.pushups).toBe(50);
    expect(b2.data.pointsEarnedThisSession).toBe(1);

    const s3 = await trainingSession(
      req('/api/training/session', { method: 'POST', body: { pushups: 1, squats: 0 }, cookie }),
    );
    expect(s3.status).toBe(400);
    const b3 = await json<ApiBody<unknown>>(s3);
    expect(b3.ok).toBe(false);
    expect(b3.error?.message).toMatch(/Cap push-up/);
  });

  it('squat 30 → 2 poin (total hari ini 4 = maks)', async () => {
    if (skipIfNoDb()) return;
    const s = await trainingSession(
      req('/api/training/session', { method: 'POST', body: { pushups: 0, squats: 30 }, cookie }),
    );
    expect(s.status).toBe(200);
    const b = await json<ApiBody<{ today: { pointsEarned: number } }>>(s);
    expect(b.data.today.pointsEarned).toBe(4);
  });

  it('deck: GET opsi, PUT 6 kartu + signature, PUT ulang dengan kartu ngawur → 400', async () => {
    if (skipIfNoDb()) return;
    const g = await getDeck(req('/api/deck', { cookie }));
    expect(g.status).toBe(200);
    const bg = await json<ApiBody<{ availableKinds: unknown[]; signatureOptions: unknown[] }>>(g);
    expect(bg.data.availableKinds.length).toBeGreaterThan(20);
    expect(bg.data.signatureOptions.length).toBeGreaterThan(0);

    const p1 = await putDeck(
      req('/api/deck', {
        method: 'PUT',
        body: { cards: ['jab', 'cross', 'hook', 'uppercut', 'bodyshot', 'lowkick'], signature: 'finisher' },
        cookie,
      }),
    );
    // 'finisher' bukan signature valid untuk tinju → 400.
    expect(p1.status).toBe(400);

    const p2 = await putDeck(
      req('/api/deck', {
        method: 'PUT',
        body: { cards: ['jab', 'cross', 'hook', 'uppercut', 'bodyshot'], signature: null },
        cookie,
      }),
    );
    expect(p2.status).toBe(200);
    const b2 = await json<ApiBody<{ cards: string[]; signature: string | null }>>(p2);
    expect(b2.data.cards).toHaveLength(5);
    expect(b2.data.signature).toBeNull();

    const p3 = await putDeck(
      req('/api/deck', {
        method: 'PUT',
        body: { cards: ['jab', 'jurus_ngawur'], signature: null },
        cookie,
      }),
    );
    expect(p3.status).toBe(400);

    const p4 = await putDeck(
      req('/api/deck', {
        method: 'PUT',
        body: { cards: ['jab', 'cross', 'hook', 'uppercut', 'bodyshot', 'lowkick', 'knee'], signature: null },
        cookie,
      }),
    );
    expect(p4.status).toBe(400);
  });

  it('training tanpa login → 401', async () => {
    if (skipIfNoDb()) return;
    const res = await trainingStatus(req('/api/training/status'));
    expect(res.status).toBe(401);
  });
});
