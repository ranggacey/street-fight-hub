/**
 * Aturan polling klien (chat global + daftar tantangan terbuka).
 *
 * Masalah lama: GlobalChat polling tiap 5 detik tanpa henti — tab yang
 * ditinggal terbuka ikut memborbardir server (200 tab × 12 req/menit =
 * 2400 req/menit hanya untuk chat). Aturan baru:
 * - interval dasar 10 detik (bukan 5) — chat tetap terasa live;
 * - saat tab tidak aktif (document.hidden) polling BERHENTI total, dan
 *   langsung refresh sekali saat tab kembali aktif (visibilitychange);
 * - kalau fetch gagal (server sibuk / offline), jeda membesar secara
 *   eksponensial sampai maks 60 detik, lalu reset saat sukses lagi.
 * Perilaku kirim/terima pesan TIDAK berubah.
 */

/** Interval dasar polling chat: 10 detik. */
export const CHAT_POLL_INTERVAL_MS = 10_000;
/** Jeda polling maksimal saat fetch berulang kali gagal. */
export const CHAT_POLL_MAX_DELAY_MS = 60_000;

/**
 * Jeda sebelum polling berikutnya setelah `failures` kegagalan
 * beruntun (0 = sukses terakhir): 10 dtk, 20 dtk, 40 dtk, lalu 60 dtk.
 */
export function nextPollDelayMs(
  failures: number,
  baseMs: number = CHAT_POLL_INTERVAL_MS,
  maxMs: number = CHAT_POLL_MAX_DELAY_MS,
): number {
  if (failures <= 0) return baseMs;
  return Math.min(maxMs, baseMs * 2 ** failures);
}
