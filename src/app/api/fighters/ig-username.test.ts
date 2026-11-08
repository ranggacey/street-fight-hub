import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as register } from '../auth/register/route';
import { POST as createFighter } from './route';
import { Fighter } from '@/models/Fighter';

/**
 * Username IG unik (case-insensitive) — cegah duplikat seperti kasus
 * strivox_id (Glaciero Aurelio vs STRIVOX, 2026-11-08). Pola setup sama
 * dengan messages.test.ts: kalau binary MongoDB tidak bisa diunduh di
 * VM ini, suite integrasi SKIP.
 *
 * Kasus: duplikat persis → 409 IG_USERNAME_TAKEN; duplikat beda huruf
 * besar/kecil → 409; ig berbeda → 201; user yang sama buat fighter
 * kedua → 409 FIGHTER_EXISTS; index unik menolak insert langsung
 * (E11000) — penegak terakhir saat race.
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
      'SKIP integration test ig-username: mongodb-memory-server tidak bisa jalan di VM ini:',
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
    console.warn('SKIP: integration test ig-username dilewati (tidak ada MongoDB in-memory).');
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

function fighterBody(igUsername: string, displayName: string) {
  return {
    displayName,
    igUsername,
    style: 'muay-thai',
    selfDescription: SELF_DESC,
  };
}

async function registerUser(username: string): Promise<string> {
  const res = await register(
    req('/api/auth/register', {
      method: 'POST',
      body: { username, password: 'passwordkuat123' },
    }),
  );
  expect(res.status).toBe(201);
  const cookie = extractCookie(res);
  expect(cookie).toContain('sfh_token=');
  return cookie as string;
}

describe('POST /api/fighters — username IG unik', () => {
  it('skema: index unik igUsername case-insensitive terdaftar', () => {
    const found = Fighter.schema
      .indexes()
      .find(([index, options]) => (index as Record<string, unknown>).igUsername === 1);
    expect(found).toBeDefined();
    const [, options] = found as [unknown, { unique?: boolean; collation?: { strength?: number } }];
    expect(options.unique).toBe(true);
    expect(options.collation?.strength).toBe(2);
  });

  it('duplikat persis / beda kapital → 409, ig berbeda → 201, user sama → 409', async () => {
    if (skipIfNoDb()) return;

    // A buat fighter ig 'duplikat_id' → 201.
    const cookieA = await registerUser('ig_a');
    // Pastikan index unik sudah terbentuk di DB in-memory sebelum insert.
    // (init() butuh koneksi yang sudah terbuka — register di atas sudah
    // membuka koneksi lewat connectDB; dipanggil sebelum ada koneksi,
    // init() menunggu koneksi yang tidak pernah dibuka.)
    await Fighter.init();
    const first = await createFighter(
      req('/api/fighters', {
        method: 'POST',
        body: fighterBody('duplikat_id', 'PETARUNG A'),
        cookie: cookieA,
      }),
    );
    expect(first.status).toBe(201);

    // B (akun lain) dengan ig persis sama → 409 IG_USERNAME_TAKEN.
    const cookieB = await registerUser('ig_b');
    const dupExact = await createFighter(
      req('/api/fighters', {
        method: 'POST',
        body: fighterBody('duplikat_id', 'PETARUNG B'),
        cookie: cookieB,
      }),
    );
    expect(dupExact.status).toBe(409);
    const dupExactBody = await json<ApiData<unknown>>(dupExact);
    expect(dupExactBody.error?.code).toBe('IG_USERNAME_TAKEN');

    // C (akun lain) dengan ig beda kapital saja → 409 juga.
    const cookieC = await registerUser('ig_c');
    const dupCase = await createFighter(
      req('/api/fighters', {
        method: 'POST',
        body: fighterBody('Duplikat_ID', 'PETARUNG C'),
        cookie: cookieC,
      }),
    );
    expect(dupCase.status).toBe(409);
    const dupCaseBody = await json<ApiData<unknown>>(dupCase);
    expect(dupCaseBody.error?.code).toBe('IG_USERNAME_TAKEN');

    // D (akun lain) dengan ig berbeda → 201.
    const cookieD = await registerUser('ig_d');
    const other = await createFighter(
      req('/api/fighters', {
        method: 'POST',
        body: fighterBody('lain_id', 'PETARUNG D'),
        cookie: cookieD,
      }),
    );
    expect(other.status).toBe(201);

    // A buat fighter kedua (ig berbeda) → 409 FIGHTER_EXISTS (aturan lama).
    const second = await createFighter(
      req('/api/fighters', {
        method: 'POST',
        body: fighterBody('beda_lagi', 'PETARUNG A2'),
        cookie: cookieA,
      }),
    );
    expect(second.status).toBe(409);
    const secondBody = await json<ApiData<unknown>>(second);
    expect(secondBody.error?.code).toBe('FIGHTER_EXISTS');

    // Index menolak insert langsung (E11000) — penegak terakhir saat race.
    await expect(
      Fighter.create({
        userId: new mongoose.Types.ObjectId(),
        displayName: 'LANGSUNG',
        igUsername: 'DUPLIKAT_id',
        style: 'boxing',
        selfDescription: SELF_DESC,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});
