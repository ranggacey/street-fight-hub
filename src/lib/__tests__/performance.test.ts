/**
 * Tes performa Hub (100–200 pengguna bersamaan) — tanpa DB live:
 * - definisi index ada di skema Mongoose yang benar (index ikut terbentuk
 *   saat model dipakai; kalau definisi hilang, query kembali COLLSCAN);
 * - cache leaderboard TTL 15 detik (TtlCache + konstanta);
 * - backoff polling chat (10 → 20 → 40 → 60 detik);
 * - rate limit dasar endpoint ramai (fixed window per kunci).
 */
import { describe, expect, it } from 'vitest';
import { TtlCache } from '../cache';
import { LEADERBOARD_TTL_MS } from '../game/leaderboard';
import { CHAT_POLL_INTERVAL_MS, CHAT_POLL_MAX_DELAY_MS, nextPollDelayMs } from '../polling';
import { checkRateLimit, __resetRateLimits } from '../rate-limit';
import { Announcement } from '../../models/Announcement';
import { Challenge } from '../../models/Challenge';
import { Fighter } from '../../models/Fighter';
import { GameFight } from '../../models/GameFight';
import { Tournament } from '../../models/Tournament';

type IndexSpec = Record<string, number>;

function hasIndex(
  indexes: Array<[IndexSpec, Record<string, unknown>]>,
  expected: IndexSpec,
): boolean {
  return indexes.some(([spec]) =>
    Object.entries(expected).every(([k, v]) => spec[k] === v),
  );
}

describe('index MongoDB (definisi di skema)', () => {
  it('Fighter: klasemen kasual (rating) + klasemen turnamen (wins)', () => {
    const idx = Fighter.schema.indexes() as Array<[IndexSpec, Record<string, unknown>]>;
    expect(
      hasIndex(idx, { status: 1, rating: -1, 'casualRecord.wins': -1, createdAt: 1 }),
    ).toBe(true);
    expect(
      hasIndex(idx, {
        status: 1,
        'record.wins': -1,
        'record.kos': -1,
        'record.losses': 1,
        createdAt: 1,
      }),
    ).toBe(true);
  });

  it('GameFight: riwayat per fighter + hitungan jatah harian (rentang hari)', () => {
    const idx = GameFight.schema.indexes() as Array<[IndexSpec, Record<string, unknown>]>;
    expect(hasIndex(idx, { createdAt: 1, fighterAId: 1 })).toBe(true);
    expect(hasIndex(idx, { createdAt: 1, fighterBId: 1 })).toBe(true);
  });

  it('Challenge: kedaluwarsa lazy + hitungan tantangan/hari', () => {
    const idx = Challenge.schema.indexes() as Array<[IndexSpec, Record<string, unknown>]>;
    expect(hasIndex(idx, { status: 1, expiresAt: 1 })).toBe(true);
    expect(hasIndex(idx, { challengerFighterId: 1, createdAt: -1 })).toBe(true);
  });

  it('Announcement + Tournament: saringan aktif/status + terbaru dulu', () => {
    const aIdx = Announcement.schema.indexes() as Array<[IndexSpec, Record<string, unknown>]>;
    expect(hasIndex(aIdx, { active: 1, createdAt: -1 })).toBe(true);
    const tIdx = Tournament.schema.indexes() as Array<[IndexSpec, Record<string, unknown>]>;
    expect(hasIndex(tIdx, { status: 1, createdAt: -1 })).toBe(true);
  });
});

describe('TtlCache (cache singkat leaderboard)', () => {
  it('TTL leaderboard 15 detik — segar dalam TTL, kedaluwarsa setelahnya', () => {
    expect(LEADERBOARD_TTL_MS).toBe(15_000);
    const cache = new TtlCache<string>(15_000);
    cache.set('a', 1_000);
    expect(cache.get(1_000)).toBe('a');
    expect(cache.get(15_999)).toBe('a');
    expect(cache.get(16_000)).toBeUndefined();
  });

  it('clear() mengosongkan cache', () => {
    const cache = new TtlCache<string>(15_000);
    cache.set('a', 1_000);
    cache.clear();
    expect(cache.get(1_000)).toBeUndefined();
  });
});

describe('backoff polling chat', () => {
  it('interval dasar 10 detik, maks 60 detik', () => {
    expect(CHAT_POLL_INTERVAL_MS).toBe(10_000);
    expect(CHAT_POLL_MAX_DELAY_MS).toBe(60_000);
  });

  it('jeda membesar eksponensial saat gagal, lalu mentok di 60 detik', () => {
    expect(nextPollDelayMs(0)).toBe(10_000);
    expect(nextPollDelayMs(1)).toBe(20_000);
    expect(nextPollDelayMs(2)).toBe(40_000);
    expect(nextPollDelayMs(3)).toBe(60_000);
    expect(nextPollDelayMs(10)).toBe(60_000);
  });
});

describe('rate limit dasar (fixed window)', () => {
  it('mengizinkan sampai batas, lalu menolak sampai window berganti', () => {
    __resetRateLimits();
    const t0 = 1_000_000;
    expect(checkRateLimit('chat-get:1.2.3.4', 3, 60_000, t0).allowed).toBe(true);
    expect(checkRateLimit('chat-get:1.2.3.4', 3, 60_000, t0 + 1).allowed).toBe(true);
    expect(checkRateLimit('chat-get:1.2.3.4', 3, 60_000, t0 + 2).allowed).toBe(true);
    const blocked = checkRateLimit('chat-get:1.2.3.4', 3, 60_000, t0 + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    // Window baru: boleh lagi.
    expect(checkRateLimit('chat-get:1.2.3.4', 3, 60_000, t0 + 60_000).allowed).toBe(true);
    // Kunci lain tidak ikut terblokir.
    expect(checkRateLimit('chat-get:5.6.7.8', 3, 60_000, t0 + 3).allowed).toBe(true);
    __resetRateLimits();
  });
});
