/**
 * Rate limit in-memory sederhana (fixed window per kunci) — perlindungan
 * dasar untuk endpoint ramai, pola yang sama dengan throttling login di
 * lib/auth.ts dan chat-rate di lib/game/chat-rate.ts. Reset saat instance
 * restart; cukup untuk MVP, bukan pembatas keras antar-instance.
 * Batas harus LONGGAR (ratusan/menit) supaya pengguna normal di belakang
 * satu IP bersama (mis. Wi-Fi kampus) tidak ikut terblokir.
 */

interface WindowRecord {
  count: number;
  windowStart: number;
}

const windows = new Map<string, WindowRecord>();

export interface RateLimitCheck {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * Cek + catat satu hit untuk `key` (mis. `chat-get:<ip>`). `now` bisa
 * di-inject untuk tes.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitCheck {
  const rec = windows.get(key);
  if (!rec || now - rec.windowStart >= windowMs) {
    windows.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (rec.count >= limit) {
    return { allowed: false, retryAfterMs: windowMs - (now - rec.windowStart) };
  }
  rec.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Hanya untuk tes. */
export function __resetRateLimits(): void {
  windows.clear();
}
