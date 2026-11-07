import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHAT_MAX_PER_HOUR,
  CHAT_MIN_INTERVAL_MS,
  __resetChatRateLimits,
  checkChatRateLimit,
} from '../game/chat-rate';

describe('Chat global: rate limit', () => {
  beforeEach(() => {
    __resetChatRateLimits();
  });

  it('pesan pertama diizinkan', () => {
    expect(checkChatRateLimit('user-1', 1_000_000).allowed).toBe(true);
  });

  it('pesan kedua < 3 detik → ditolak dengan retryAfterMs', () => {
    checkChatRateLimit('user-1', 1_000_000);
    const second = checkChatRateLimit('user-1', 1_000_000 + 1_000);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterMs).toBe(CHAT_MIN_INTERVAL_MS - 1_000);
  });

  it('pesan kedua tepat 3 detik setelahnya → diizinkan', () => {
    checkChatRateLimit('user-1', 1_000_000);
    expect(checkChatRateLimit('user-1', 1_000_000 + CHAT_MIN_INTERVAL_MS).allowed).toBe(true);
  });

  it('pesan yang ditolak TIDAK tercatat (tidak menggeser lastAt)', () => {
    checkChatRateLimit('user-1', 1_000_000);
    checkChatRateLimit('user-1', 1_000_000 + 1_000); // ditolak
    // 3 detik setelah pesan PERTAMA (bukan setelah yang ditolak) → boleh.
    expect(checkChatRateLimit('user-1', 1_000_000 + CHAT_MIN_INTERVAL_MS).allowed).toBe(true);
  });

  it('30 pesan/jam diizinkan, ke-31 ditolak', () => {
    const t0 = 2_000_000;
    for (let i = 0; i < CHAT_MAX_PER_HOUR; i++) {
      const res = checkChatRateLimit('user-1', t0 + i * (CHAT_MIN_INTERVAL_MS + 100));
      expect(res.allowed).toBe(true);
    }
    const over = checkChatRateLimit(
      'user-1',
      t0 + CHAT_MAX_PER_HOUR * (CHAT_MIN_INTERVAL_MS + 100),
    );
    expect(over.allowed).toBe(false);
    expect(over.retryAfterMs).toBeGreaterThan(0);
  });

  it('setelah 1 jam dari pesan pertama, jatah kembali', () => {
    const t0 = 3_000_000;
    for (let i = 0; i < CHAT_MAX_PER_HOUR; i++) {
      checkChatRateLimit('user-1', t0 + i * (CHAT_MIN_INTERVAL_MS + 100));
    }
    // 1 jam + 1 detik setelah pesan pertama.
    const res = checkChatRateLimit('user-1', t0 + 3_600_000 + 1_000);
    expect(res.allowed).toBe(true);
  });

  it('limit per user — user lain tidak terpengaruh', () => {
    checkChatRateLimit('user-1', 4_000_000);
    expect(checkChatRateLimit('user-2', 4_000_000).allowed).toBe(true);
    expect(checkChatRateLimit('user-1', 4_000_000 + 500).allowed).toBe(false);
  });
});
