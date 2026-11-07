/**
 * Rate limit chat global (in-memory, pola yang sama dengan throttling
 * login di lib/auth.ts — reset saat VM restart, cukup untuk MVP).
 * Aturan (didokumentasikan, pilih angka wajar):
 * - maks 1 pesan / 3 detik per user (anti-spam ketik beruntun);
 * - maks 30 pesan / jam per user (sliding window 1 jam).
 */

export const CHAT_MIN_INTERVAL_MS = 3_000;
export const CHAT_MAX_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;

interface ChatRecord {
  lastAt: number;
  stamps: number[];
}

const records = new Map<string, ChatRecord>();

export interface ChatRateCheck {
  allowed: boolean;
  retryAfterMs: number;
}

/** Cek + catat (hanya catat kalau diizinkan). `now` bisa di-inject untuk tes. */
export function checkChatRateLimit(userId: string, now: number = Date.now()): ChatRateCheck {
  const rec = records.get(userId) ?? { lastAt: 0, stamps: [] };
  if (now - rec.lastAt < CHAT_MIN_INTERVAL_MS) {
    return { allowed: false, retryAfterMs: CHAT_MIN_INTERVAL_MS - (now - rec.lastAt) };
  }
  const recent = rec.stamps.filter((t) => now - t < HOUR_MS);
  if (recent.length >= CHAT_MAX_PER_HOUR) {
    const oldest = recent[0];
    return { allowed: false, retryAfterMs: HOUR_MS - (now - oldest) };
  }
  records.set(userId, { lastAt: now, stamps: [...recent, now] });
  return { allowed: true, retryAfterMs: 0 };
}

/** Hanya untuk tes. */
export function __resetChatRateLimits(): void {
  records.clear();
}
