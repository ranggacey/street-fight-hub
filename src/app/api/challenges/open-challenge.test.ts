import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as register } from '../auth/register/route';
import { POST as createFighter } from '../fighters/route';
import { POST as createOpen, GET as listOpen } from './open/route';
import { POST as acceptOpen } from './[id]/accept-open/route';
import { POST as acceptDirect } from './[id]/accept/route';
import { Challenge } from '../../../models/Challenge';
import { GameFight } from '../../../models/GameFight';

/**
 * Integration test tantangan TERBUKA (Agen D) dengan mongodb-memory-server.
 * Pola setup sama dengan game-flow.test.ts: kalau binary MongoDB tidak
 * bisa diunduh di VM ini, seluruh suite SKIP (tidak memblokir unit lain).
 *
 * Alur: register 3 user → fighter → A buat open (201, kind 'open',
 * challengedFighterId null) → A buat open kedua 409 (satu open aktif)
 * → GET /api/challenges/open publik menampilkan 1 → terima sendiri 400
 * → terima langsung (endpoint direct) 409 CHALLENGE_NOT_DIRECT →
 * B terima 200 + config + GameFight → C terima lagi 409 (sudah diterima)
 * → tantangan UNLIMITED (perintah user 9 Nov 2026): buat +
 * kedaluwarsakan 5x, yang ke-6 tetap 201 (bukan 409) →
 * limit 5 fight/hari si penerima (5 fight disisipkan langsung, terima 409).
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
      'SKIP integration test open-challenge: mongodb-memory-server tidak bisa jalan di VM ini:',
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
    console.warn('SKIP: integration test open-challenge dilewati (tidak ada MongoDB in-memory).');
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

interface OpenOut {
  challenge: { id: string; kind: string; challengedFighterId: string | null };
}
interface OpenListOut {
  challenges: { id: string; kind: string }[];
}
interface AcceptOpenOut {
  gameFight: { id: string };
  config: { fightId: string; seed: number; duration: number };
}

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

describe('Tantangan terbuka (open challenge)', () => {
  it('buat → daftar publik → terima pertama menang, terima kedua 409', async () => {
    if (skipIfNoDb()) return;

    const a = await makeUserFighter('open_a', 'Open A', 'open_a', 'boxing');
    const b = await makeUserFighter('open_b', 'Open B', 'open_b', 'muay-thai');
    const c = await makeUserFighter('open_c', 'Open C', 'open_c', 'karate');

    // 1. A buat tantangan terbuka → 201, kind 'open', target null.
    const createRes = await createOpen(
      req('/api/challenges/open', {
        method: 'POST',
        body: { map: 'gudang', message: 'Siapa berani?' },
        cookie: a.cookie,
      }),
    );
    expect(createRes.status).toBe(201);
    const createBody = await json<ApiData<OpenOut>>(createRes);
    expect(createBody.data.challenge.kind).toBe('open');
    expect(createBody.data.challenge.challengedFighterId).toBeNull();
    const openId = createBody.data.challenge.id;
    const stored = await Challenge.findById(openId).lean();
    expect(stored?.kind).toBe('open');
    expect(stored?.challengedFighterId).toBeNull();

    // 2. A buat open kedua selagi yang pertama aktif → 409.
    const dupOpen = await createOpen(
      req('/api/challenges/open', {
        method: 'POST',
        body: { map: 'ring' },
        cookie: a.cookie,
      }),
    );
    expect(dupOpen.status).toBe(409);
    const dupBody = await json<ApiData<unknown>>(dupOpen);
    expect(dupBody.error?.code).toBe('OPEN_CHALLENGE_ACTIVE_EXISTS');

    // 3. GET publik (tanpa login) menampilkan 1 tantangan terbuka.
    const listRes = await listOpen();
    expect(listRes.status).toBe(200);
    const listBody = await json<ApiData<OpenListOut>>(listRes);
    expect(listBody.data.challenges.length).toBe(1);
    expect(listBody.data.challenges[0].id).toBe(openId);

    // 4. A menerima tantangannya sendiri → 400.
    const selfAccept = await acceptOpen(
      req(`/api/challenges/${openId}/accept-open`, { method: 'POST', cookie: a.cookie }),
      { params: Promise.resolve({ id: openId }) },
    );
    expect(selfAccept.status).toBe(400);

    // 5. Endpoint terima LANGSUNG menolak tantangan terbuka → 409.
    const directAccept = await acceptDirect(
      req(`/api/challenges/${openId}/accept`, { method: 'POST', cookie: b.cookie }),
      { params: Promise.resolve({ id: openId }) },
    );
    expect(directAccept.status).toBe(409);
    const directBody = await json<ApiData<unknown>>(directAccept);
    expect(directBody.error?.code).toBe('CHALLENGE_NOT_DIRECT');

    // 6. B menerima (pertama) → 200 + GameFight A vs B + config.
    const accRes = await acceptOpen(
      req(`/api/challenges/${openId}/accept-open`, { method: 'POST', cookie: b.cookie }),
      { params: Promise.resolve({ id: openId }) },
    );
    expect(accRes.status).toBe(200);
    const accBody = await json<ApiData<AcceptOpenOut>>(accRes);
    expect(accBody.data.config.fightId).toBe(accBody.data.gameFight.id);
    expect(accBody.data.config.duration).toBe(60);
    expect(accBody.data.config.seed).toBeGreaterThanOrEqual(100000);
    const fight = await GameFight.findById(accBody.data.gameFight.id).lean();
    expect(fight?.fighterAId.toString()).toBe(a.fighterId);
    expect(fight?.fighterBId.toString()).toBe(b.fighterId);
    expect(fight?.challengeId?.toString()).toBe(openId);
    const accepted = await Challenge.findById(openId).lean();
    expect(accepted?.status).toBe('accepted');
    expect(accepted?.challengedFighterId?.toString()).toBe(b.fighterId);

    // 7. C menerima tantangan yang sama → 409 (sudah diterima B).
    const lateAccept = await acceptOpen(
      req(`/api/challenges/${openId}/accept-open`, { method: 'POST', cookie: c.cookie }),
      { params: Promise.resolve({ id: openId }) },
    );
    expect(lateAccept.status).toBe(409);
    const lateBody = await json<ApiData<unknown>>(lateAccept);
    expect(lateBody.error?.code).toBe('CHALLENGE_NOT_PENDING');

    // 8. Tantangan UNLIMITED (perintah user 9 Nov 2026): buat +
    // kedaluwarsakan 5x (D sudah kirim 5 hari ini), lalu yang ke-6
    // tetap dibuat (201) — dulu 409 CHALLENGE_LIMIT_REACHED.
    // Pakai user baru supaya hitungan bersih.
    const d = await makeUserFighter('open_d', 'Open D', 'open_d', 'boxing');
    for (let i = 0; i < 5; i++) {
      const r = await createOpen(
        req('/api/challenges/open', {
          method: 'POST',
          body: { map: 'ring' },
          cookie: d.cookie,
        }),
      );
      expect(r.status).toBe(201);
      const rb = await json<ApiData<OpenOut>>(r);
      // Kedaluwarsakan manual supaya bisa buat lagi (tanpa fight).
      await Challenge.updateOne(
        { _id: rb.data.challenge.id },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      );
      // GET memicu expireStaleChallenges → status jadi 'expired'.
      await listOpen();
      const expired = await Challenge.findById(rb.data.challenge.id).lean();
      expect(expired?.status).toBe('expired');
    }
    const sixth = await createOpen(
      req('/api/challenges/open', {
        method: 'POST',
        body: { map: 'ring' },
        cookie: d.cookie,
      }),
    );
    expect(sixth.status).toBe(201);
    const sixthBody = await json<ApiData<OpenOut>>(sixth);
    expect(sixthBody.data.challenge.kind).toBe('open');

    // 9. Limit 5 fight/hari si penerima: sisipkan 5 fight hari ini
    // untuk C, lalu C menerima open baru dari A → 409 DAILY_LIMIT_REACHED.
    const open2Res = await createOpen(
      req('/api/challenges/open', {
        method: 'POST',
        body: { map: 'dojo' },
        cookie: a.cookie,
      }),
    );
    expect(open2Res.status).toBe(201);
    const open2Body = await json<ApiData<OpenOut>>(open2Res);
    const open2Id = open2Body.data.challenge.id;
    const fightDocs = [0, 1, 2, 3, 4].map(() => ({
      fighterAId: new mongoose.Types.ObjectId(c.fighterId),
      fighterBId: new mongoose.Types.ObjectId(b.fighterId),
      challengeId: null,
      tournamentId: null,
      seed: 123456,
      map: 'ring',
      durationSec: 60,
      status: 'pending',
      config: { left: {}, right: {} },
      isTitleFight: false,
    }));
    await GameFight.insertMany(fightDocs);
    const blocked = await acceptOpen(
      req(`/api/challenges/${open2Id}/accept-open`, { method: 'POST', cookie: c.cookie }),
      { params: Promise.resolve({ id: open2Id }) },
    );
    expect(blocked.status).toBe(409);
    const blockedBody = await json<ApiData<unknown>>(blocked);
    expect(blockedBody.error?.code).toBe('DAILY_LIMIT_REACHED');
    // Tantangan tetap pending — belum diklaim siapa pun.
    const stillOpen = await Challenge.findById(open2Id).lean();
    expect(stillOpen?.status).toBe('pending');
  }, 180000);
});
