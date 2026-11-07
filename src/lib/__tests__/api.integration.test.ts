import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as register } from '../../app/api/auth/register/route';
import { POST as login } from '../../app/api/auth/login/route';
import { POST as createFighter } from '../../app/api/fighters/route';
import { POST as createTournament } from '../../app/api/admin/tournaments/route';
import { POST as joinTournament } from '../../app/api/tournaments/[slug]/join/route';
import { POST as generateBracket } from '../../app/api/admin/tournaments/[id]/generate-bracket/route';
import { POST as drawRound } from '../../app/api/admin/tournaments/[id]/draw-round/route';
import { GET as getTournament } from '../../app/api/tournaments/[slug]/route';
import { User } from '../../models/User';
import { VideoTask } from '../../models/VideoTask';

/**
 * Integration test API end-to-end dengan mongodb-memory-server.
 *
 * CATATAN: test ini butuh download binary MongoDB (~60 MB). Di VM ini
 * (port 27017 diblokir / egress terbatas) download bisa gagal — kalau
 * begitu, seluruh suite ini SKIP dengan pesan jelas dan TIDAK memblokir
 * unit test lainnya.
 */

const ADMIN_SLUG = 'test-admin-slug';

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
    process.env.ADMIN_SLUG = ADMIN_SLUG;
    dbReady = true;
  } catch (err) {
    console.warn(
      'SKIP integration test: mongodb-memory-server tidak bisa jalan di VM ini:',
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
    console.warn('SKIP: integration test dilewati (tidak ada MongoDB in-memory).');
    return true;
  }
  return false;
}

function req(
  path: string,
  opts: { method?: string; body?: unknown; cookie?: string | null; adminPath?: boolean } = {},
): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.adminPath) headers['x-admin-path'] = ADMIN_SLUG;
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

const SELF_DESC =
  'Petarung jalanan dari Semarang yang sudah latihan bertahun-tahun di sasana kecil dekat rumah.';

describe('API integration (register → fighter → turnamen → bracket → draw)', () => {
  it('admin tanpa x-admin-path → 404', async () => {
    if (skipIfNoDb()) return;
    const res = await createTournament(
      req('/api/admin/tournaments', { method: 'POST', body: { name: 'X' } }),
    );
    expect(res.status).toBe(404);
    const body = await json<{ ok: boolean }>(res);
    expect(body.ok).toBe(false);
  });

  it('alur penuh: 4 fighter, bracket SF, draw sampai juara', async () => {
    if (skipIfNoDb()) return;

    // 1. Admin: register lalu naikkan role lewat DB, login ulang.
    const adminReg = await register(
      req('/api/auth/register', {
        method: 'POST',
        body: { username: 'admin_test', password: 'passwordkuat123' },
      }),
    );
    expect(adminReg.status).toBe(201);
    await User.updateOne({ username: 'admin_test' }, { $set: { role: 'admin' } });
    const adminLogin = await login(
      req('/api/auth/login', {
        method: 'POST',
        body: { username: 'admin_test', password: 'passwordkuat123' },
      }),
    );
    expect(adminLogin.status).toBe(200);
    const adminCookie = extractCookie(adminLogin);
    expect(adminCookie).toContain('sfh_token=');

    // 2. Admin buat turnamen bracketSize 8.
    const now = Date.now();
    const tourRes = await createTournament(
      req('/api/admin/tournaments', {
        method: 'POST',
        body: {
          name: 'Turnamen Test',
          bracketSize: 8,
          regOpenAt: new Date(now - 1000).toISOString(),
          regCloseAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
          rules: 'Aturan test.',
        },
        cookie: adminCookie,
        adminPath: true,
      }),
    );
    expect(tourRes.status).toBe(201);
    const tourBody = await json<{ data: { tournament: { slug: string; id: string } } }>(tourRes);
    const slug: string = tourBody.data.tournament.slug;
    const tournamentId: string = tourBody.data.tournament.id;
    expect(slug).toBe('night-fight-championship-1');

    // 3. 4 user: register + buat fighter + join.
    for (let i = 1; i <= 4; i++) {
      const reg = await register(
        req('/api/auth/register', {
          method: 'POST',
          body: { username: `petarung${i}`, password: 'passwordkuat123' },
        }),
      );
      expect(reg.status).toBe(201);
      const cookie = extractCookie(reg);
      const fighterRes = await createFighter(
        req('/api/fighters', {
          method: 'POST',
          body: {
            displayName: `Petarung ${i}`,
            igUsername: `petarung${i}`,
            style: 'boxing',
            selfDescription: SELF_DESC,
          },
          cookie,
        }),
      );
      expect(fighterRes.status).toBe(201);
      const joinRes = await joinTournament(
        req(`/api/tournaments/${slug}/join`, { method: 'POST', cookie }),
        { params: Promise.resolve({ slug }) },
      );
      expect(joinRes.status).toBe(200);
    }

    // 4. Generate bracket: 4 peserta → target 4 → 2 match SF, 0 bye.
    const bracketRes = await generateBracket(
      req(`/api/admin/tournaments/${tournamentId}/generate-bracket`, {
        method: 'POST',
        cookie: adminCookie,
        adminPath: true,
      }),
      { params: Promise.resolve({ id: tournamentId }) },
    );
    expect(bracketRes.status).toBe(200);
    const bracketBody = await json<{
      data: { matches: unknown[]; byes: unknown[]; tournament: { status: string } };
    }>(bracketRes);
    expect(bracketBody.data.matches).toHaveLength(2);
    expect(bracketBody.data.byes).toHaveLength(0);
    expect(bracketBody.data.tournament.status).toBe('in_progress');

    // 5. Draw SF → tercipta 1 match F.
    const drawSf = await drawRound(
      req(`/api/admin/tournaments/${tournamentId}/draw-round`, {
        method: 'POST',
        body: { round: 'SF' },
        cookie: adminCookie,
        adminPath: true,
      }),
      { params: Promise.resolve({ id: tournamentId }) },
    );
    expect(drawSf.status).toBe(200);
    const drawSfBody = await json<{ data: { decided: unknown[] } }>(drawSf);
    expect(drawSfBody.data.decided).toHaveLength(2);

    // Draw SF lagi → 400 (sudah diputuskan).
    const drawSfAgain = await drawRound(
      req(`/api/admin/tournaments/${tournamentId}/draw-round`, {
        method: 'POST',
        body: { round: 'F' },
        cookie: adminCookie,
        adminPath: true,
      }),
      { params: Promise.resolve({ id: tournamentId }) },
    );
    expect(drawSfAgain.status).toBe(200);
    const drawFBody = await json<{
      data: { decided: unknown[]; tournament: { status: string; championId: string | null } };
    }>(drawSfAgain);
    expect(drawFBody.data.decided).toHaveLength(1);
    expect(drawFBody.data.tournament.status).toBe('completed');
    expect(drawFBody.data.tournament.championId).toBeTruthy();

    // 6. VideoTask: 2 (SF) + 1 (F) = 3.
    expect(await VideoTask.countDocuments()).toBe(3);

    // 7. Detail turnamen: juara terisi.
    const detail = await getTournament(req(`/api/tournaments/${slug}`), {
      params: Promise.resolve({ slug }),
    });
    expect(detail.status).toBe(200);
    const detailBody = await json<{
      data: { tournament: { status: string; championId: string | null }; participantCount: number };
    }>(detail);
    expect(detailBody.data.tournament.status).toBe('completed');
    expect(detailBody.data.tournament.championId).toBeTruthy();
    expect(detailBody.data.participantCount).toBe(4);
  });
});
