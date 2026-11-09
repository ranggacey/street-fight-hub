import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as register } from '../auth/register/route';
import { POST as createFighter } from '../fighters/route';
import { POST as createBulk } from './bulk/route';
import { GET as listChallenges } from './route';
import { POST as acceptDirect } from './[id]/accept/route';
import { Challenge } from '../../../models/Challenge';
import { GameFight } from '../../../models/GameFight';

/**
 * Integration test TANTANG BANYAK ORANG (bulk challenge, first-accept-wins)
 * dengan mongodb-memory-server. Pola setup sama dengan open-challenge.test.ts:
 * kalau binary MongoDB tidak bisa diunduh di VM ini, seluruh suite SKIP.
 *
 * Alur: register 8 user → fighter → A bulk ke [B, C, D] (201, created 3,
 * satu batchId sama, semua pending) → A bulk campuran [B (aktif), diri
 * sendiri, id tidak ada, E] (201, created 1, skipped 3 + alasan) → GET
 * /api/challenges?box=out menampilkan ringkasan batches (total/pending)
 * → B terima challenge batch pertama → sibling C, D otomatis 'cancelled'
 * + alasan, tepat 1 GameFight untuk batch itu → bulk TIDAK cek jatah
 * tarung saat pembuatan (A sudah 5 fight hari ini, bulk ke [F, G] tetap
 * 201) → H bulk ke [F, G], lalu F dan G accept BERSAMAAN (Promise.all):
 * maksimal satu 200, tepat 1 GameFight untuk batch itu, yang kalah
 * 'cancelled' (kalau keduanya 409 karena race, retry satu accept → 200).
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
    process.env.JWT_SECRET = 'test-secret-yang-cukup-panjang-untuk-hs256';
    dbReady = true;
  } catch (err) {
    console.warn(
      'SKIP integration test bulk-challenge: mongodb-memory-server tidak bisa jalan di VM ini:',
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
    console.warn('SKIP: integration test bulk-challenge dilewati (tidak ada MongoDB in-memory).');
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

interface BulkOut {
  batchId: string;
  created: number;
  skipped: number;
  results: { challengedFighterId: string; status: string; reason?: string; challengeId?: string }[];
}
interface ListOut {
  challenges: { id: string; status: string; batchId?: string | null }[];
  batches: Record<string, { total: number; pending: number; accepted: number; declined: number; expired: number; cancelled: number }>;
}
interface AcceptOut {
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

describe('Tantang banyak orang (bulk challenge, first-accept-wins)', () => {
  it('bulk create → terima pertama batalkan sibling → dua accept bersamaan = satu fight', async () => {
    if (skipIfNoDb()) return;

    const a = await makeUserFighter('bulk_a', 'Bulk A', 'bulk_a', 'boxing');
    const b = await makeUserFighter('bulk_b', 'Bulk B', 'bulk_b', 'muay-thai');
    const c = await makeUserFighter('bulk_c', 'Bulk C', 'bulk_c', 'karate');
    const d = await makeUserFighter('bulk_d', 'Bulk D', 'bulk_d', 'taekwondo');
    const e = await makeUserFighter('bulk_e', 'Bulk E', 'bulk_e', 'judo');
    const f = await makeUserFighter('bulk_f', 'Bulk F', 'bulk_f', 'kung-fu');
    const g = await makeUserFighter('bulk_g', 'Bulk G', 'bulk_g', 'wushu');
    const h = await makeUserFighter('bulk_h', 'Bulk H', 'bulk_h', 'capoeira');

    // 1. A bulk ke [B, C, D] → 201, created 3, skipped 0, satu batchId.
    const bulkRes = await createBulk(
      req('/api/challenges/bulk', {
        method: 'POST',
        body: { opponentIds: [b.fighterId, c.fighterId, d.fighterId], arenaId: 'ring', message: 'Ayo gelud!' },
        cookie: a.cookie,
      }),
    );
    expect(bulkRes.status).toBe(201);
    const bulkBody = await json<ApiData<BulkOut>>(bulkRes);
    expect(bulkBody.data.created).toBe(3);
    expect(bulkBody.data.skipped).toBe(0);
    expect(bulkBody.data.batchId).toBeTruthy();
    expect(bulkBody.data.results.every((r) => r.status === 'created')).toBe(true);
    const batchId = bulkBody.data.batchId;
    const batchDocs = await Challenge.find({ batchId: new mongoose.Types.ObjectId(batchId) }).lean();
    expect(batchDocs).toHaveLength(3);
    expect(batchDocs.every((ch) => ch.status === 'pending' && ch.kind === 'direct')).toBe(true);
    const chToB = batchDocs.find((ch) => String(ch.challengedFighterId) === b.fighterId)!;
    const chToC = batchDocs.find((ch) => String(ch.challengedFighterId) === c.fighterId)!;
    const chToD = batchDocs.find((ch) => String(ch.challengedFighterId) === d.fighterId)!;

    // 2. Bulk campuran: B (sudah ada tantangan aktif dari A) → skip,
    // diri sendiri → skip, id tidak ada → skip, E (baru) → created.
    const bogusId = new mongoose.Types.ObjectId().toString();
    const mixedRes = await createBulk(
      req('/api/challenges/bulk', {
        method: 'POST',
        body: { opponentIds: [b.fighterId, a.fighterId, bogusId, e.fighterId], arenaId: 'dojo' },
        cookie: a.cookie,
      }),
    );
    expect(mixedRes.status).toBe(201);
    const mixedBody = await json<ApiData<BulkOut>>(mixedRes);
    expect(mixedBody.data.created).toBe(1);
    expect(mixedBody.data.skipped).toBe(3);
    expect(mixedBody.data.batchId).not.toBe(batchId);
    const reasons = Object.fromEntries(
      mixedBody.data.results.map((r) => [r.challengedFighterId, r.reason]),
    );
    expect(reasons[b.fighterId]).toBe('CHALLENGE_ACTIVE_EXISTS');
    expect(reasons[a.fighterId]).toBe('CANNOT_CHALLENGE_SELF');
    expect(reasons[bogusId]).toBe('FIGHTER_NOT_FOUND');
    expect(mixedBody.data.results.find((r) => r.challengedFighterId === e.fighterId)?.status).toBe('created');

    // 3. GET /api/challenges?box=out menampilkan ringkasan batches.
    const listRes = await listChallenges(
      req('/api/challenges?box=out&status=pending', { cookie: a.cookie }),
    );
    expect(listRes.status).toBe(200);
    const listBody = await json<ApiData<ListOut>>(listRes);
    expect(listBody.data.batches[batchId]).toMatchObject({ total: 3, pending: 3, accepted: 0 });
    expect(listBody.data.batches[mixedBody.data.batchId]).toMatchObject({ total: 1, pending: 1 });

    // 4. B terima challenge batch pertama → 200 + GameFight; sibling
    // C dan D otomatis 'cancelled' + alasan; tepat 1 fight untuk batch.
    const acceptB = await acceptDirect(
      req(`/api/challenges/${chToB._id}/accept`, { method: 'POST', cookie: b.cookie }),
      { params: Promise.resolve({ id: String(chToB._id) }) },
    );
    expect(acceptB.status).toBe(200);
    const acceptBody = await json<ApiData<AcceptOut>>(acceptB);
    expect(acceptBody.data.gameFight.id).toBeTruthy();
    const afterC = await Challenge.findById(chToC._id).lean();
    const afterD = await Challenge.findById(chToD._id).lean();
    expect(afterC?.status).toBe('cancelled');
    expect(afterD?.status).toBe('cancelled');
    expect(afterC?.cancelReason).toContain('menerima duluan');
    const batchFights = await GameFight.find({ challengeId: { $in: batchDocs.map((ch) => ch._id) } }).lean();
    expect(batchFights).toHaveLength(1);

    // 5. Bulk TIDAK cek jatah tarung saat pembuatan: sisipkan 5 fight
    // hari ini untuk A, lalu A bulk ke [F, G] tetap 201 (created 2).
    // (Jatah dicek saat accept, bukan saat nantang — aturan lama.)
    const fightDocs = [0, 1, 2, 3, 4].map(() => ({
      fighterAId: new mongoose.Types.ObjectId(a.fighterId),
      // Lawan sisipan E (bukan F/G): F dan G harus tetap 0 fight supaya
      // accept mereka di step 6 tidak terblokir DAILY_LIMIT_REACHED.
      fighterBId: new mongoose.Types.ObjectId(e.fighterId),
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
    const bulkQuota = await createBulk(
      req('/api/challenges/bulk', {
        method: 'POST',
        body: { opponentIds: [f.fighterId, g.fighterId], arenaId: 'ring' },
        cookie: a.cookie,
      }),
    );
    expect(bulkQuota.status).toBe(201);
    const bulkQuotaBody = await json<ApiData<BulkOut>>(bulkQuota);
    expect(bulkQuotaBody.data.created).toBe(2);

    // 6. Dua accept BERSAMAAN dari batch yang sama (H → F, H → G):
    // maksimal satu 200, tepat 1 GameFight untuk batch itu, yang kalah
    // 'cancelled'. (A tidak dipakai di sini karena jatah tarung A sudah
    // habis — accept tetap dicek jatahnya untuk kedua fighter.)
    const bulkH = await createBulk(
      req('/api/challenges/bulk', {
        method: 'POST',
        body: { opponentIds: [f.fighterId, g.fighterId], arenaId: 'dojo' },
        cookie: h.cookie,
      }),
    );
    expect(bulkH.status).toBe(201);
    const bulkHBody = await json<ApiData<BulkOut>>(bulkH);
    const hBatchId = bulkHBody.data.batchId;
    const hDocs = await Challenge.find({ batchId: new mongoose.Types.ObjectId(hBatchId) }).lean();
    expect(hDocs).toHaveLength(2);
    const chToF = hDocs.find((ch) => String(ch.challengedFighterId) === f.fighterId)!;
    const chToG = hDocs.find((ch) => String(ch.challengedFighterId) === g.fighterId)!;

    const [resF, resG] = await Promise.all([
      acceptDirect(
        req(`/api/challenges/${chToF._id}/accept`, { method: 'POST', cookie: f.cookie }),
        { params: Promise.resolve({ id: String(chToF._id) }) },
      ),
      acceptDirect(
        req(`/api/challenges/${chToG._id}/accept`, { method: 'POST', cookie: g.cookie }),
        { params: Promise.resolve({ id: String(chToG._id) }) },
      ),
    ]);
    const okCount = [resF, resG].filter((r) => r.status === 200).length;
    // Maksimal satu pemenang. Kalau keduanya 409 (race guard — keduanya
    // melihat satu sama lain sudah accepted), retry satu accept: yang
    // kalah tadi rollback ke pending, jadi retry pasti menang.
    expect(okCount).toBeLessThanOrEqual(1);
    if (okCount === 0) {
      expect([resF, resG].every((r) => r.status === 409)).toBe(true);
      const retry = await acceptDirect(
        req(`/api/challenges/${chToF._id}/accept`, { method: 'POST', cookie: f.cookie }),
        { params: Promise.resolve({ id: String(chToF._id) }) },
      );
      expect(retry.status).toBe(200);
    } else {
      // Yang kalah 409 — entah karena guard batch (BATCH_ALREADY_ACCEPTED)
      // atau karena pemenang sudah membatalkan tantangannya duluan
      // (CHALLENGE_NOT_PENDING).
      const loser = resF.status === 200 ? resG : resF;
      expect(loser.status).toBe(409);
      const loserBody = await json<ApiData<unknown>>(loser);
      expect(['BATCH_ALREADY_ACCEPTED', 'CHALLENGE_NOT_PENDING']).toContain(loserBody.error?.code);
    }
    const hBatchFights = await GameFight.find({ challengeId: { $in: hDocs.map((ch) => ch._id) } }).lean();
    expect(hBatchFights).toHaveLength(1);
    const loserDoc = await Challenge.findOne({
      batchId: new mongoose.Types.ObjectId(hBatchId),
      status: 'cancelled',
    }).lean();
    expect(loserDoc).toBeTruthy();
  }, 180000);
});
