import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as register } from '../auth/register/route';
import { POST as createFighter } from '../fighters/route';
import { GET as listMessages, POST as sendMessage } from './messages/route';

/**
 * Integration test shaping API chat (obrolan): identitas fighter
 * terlampir per pesan — PP + nama fighter di client datang dari sini.
 * Pola setup sama dengan open-challenge.test.ts: kalau binary MongoDB
 * tidak bisa diunduh di VM ini, seluruh suite SKIP.
 *
 * Alur: register A + fighter (muay-thai, warna badan merah, mahkota) →
 * A kirim pesan → POST 201 lampirkan fighter → GET lampirkan fighter
 * yang sama; register B TANPA fighter → B kirim pesan → fighter null
 * (client fallback ke username).
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
      'SKIP integration test chat-messages: mongodb-memory-server tidak bisa jalan di VM ini:',
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
    console.warn('SKIP: integration test chat-messages dilewati (tidak ada MongoDB in-memory).');
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

interface ChatOut {
  messages: {
    id: string;
    userId: string;
    text: string;
    username: string;
    fighter: {
      displayName: string;
      style: string;
      colors: Record<string, string>;
      accessories: Record<string, string>;
    } | null;
  }[];
}

interface SendOut {
  message: ChatOut['messages'][number];
}

describe('API chat — identitas fighter per pesan', () => {
  it('GET + POST melampirkan fighter pengirim, null kalau belum punya fighter', async () => {
    if (skipIfNoDb()) return;

    // A: register + fighter (warna badan merah, mahkota, ikat kepala amber).
    const regA = await register(
      req('/api/auth/register', { method: 'POST', body: { username: 'chat_a', password: 'passwordkuat123' } }),
    );
    expect(regA.status).toBe(201);
    const cookieA = extractCookie(regA);
    expect(cookieA).toContain('sfh_token=');
    const fRes = await createFighter(
      req('/api/fighters', {
        method: 'POST',
        body: {
          displayName: 'NOPE BOY',
          igUsername: 'chat_a',
          style: 'muay-thai',
          selfDescription: SELF_DESC,
          colors: { body: '#E10600', headband: '#F5A623' },
          accessories: { head: 'crown' },
        },
        cookie: cookieA,
      }),
    );
    expect(fRes.status).toBe(201);

    // B: register saja, tanpa fighter.
    const regB = await register(
      req('/api/auth/register', { method: 'POST', body: { username: 'chat_b', password: 'passwordkuat123' } }),
    );
    expect(regB.status).toBe(201);
    const cookieB = extractCookie(regB);
    expect(cookieB).toContain('sfh_token=');

    // A kirim pesan → POST lampirkan fighter-nya langsung.
    const sendA = await sendMessage(
      req('/api/chat/messages', { method: 'POST', body: { text: 'Siapa berani lawan aku?' }, cookie: cookieA }),
    );
    expect(sendA.status).toBe(201);
    const sendABody = await json<ApiData<SendOut>>(sendA);
    expect(sendABody.data.message.fighter?.displayName).toBe('NOPE BOY');
    expect(sendABody.data.message.fighter?.style).toBe('muay-thai');
    expect(sendABody.data.message.fighter?.colors?.body).toBe('#E10600');
    expect(sendABody.data.message.fighter?.accessories?.head).toBe('crown');
    expect(sendABody.data.message.userId).toBeTruthy();

    // B kirim pesan → fighter null (fallback username di client).
    const sendB = await sendMessage(
      req('/api/chat/messages', { method: 'POST', body: { text: 'Halo semua!' }, cookie: cookieB }),
    );
    expect(sendB.status).toBe(201);
    const sendBBody = await json<ApiData<SendOut>>(sendB);
    expect(sendBBody.data.message.fighter).toBeNull();
    expect(sendBBody.data.message.username).toBe('chat_b');

    // GET: urut kronologis, fighter terlampir per pesan.
    const list = await listMessages(req('/api/chat/messages?limit=50'));
    expect(list.status).toBe(200);
    const listBody = await json<ApiData<ChatOut>>(list);
    expect(listBody.data.messages).toHaveLength(2);
    const [first, second] = listBody.data.messages;
    expect(first.text).toBe('Siapa berani lawan aku?');
    expect(first.username).toBe('chat_a');
    expect(first.fighter?.displayName).toBe('NOPE BOY');
    expect(second.text).toBe('Halo semua!');
    expect(second.username).toBe('chat_b');
    expect(second.fighter).toBeNull();
  });
});
