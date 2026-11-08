/**
 * Badge notifikasi tombol chat mengambang (FloatingChat).
 * Angka = pesan chat global belum dibaca + tantangan masuk pending.
 * Penanda dibaca (timestamp pesan terakhir yang sudah dilihat) disimpan
 * di localStorage; GlobalChat memperbaruinya saat pesan ditampilkan
 * (di pop-up maupun di /obrolan), FloatingChat membacanya saat polling.
 * Fungsi di sini MURNI (kecuali akses localStorage yang dibungkus try/catch)
 * supaya bisa dites unit tanpa DOM penuh.
 */

export const CHAT_LAST_READ_KEY = "sfh-chat-last-read";

/** Baca penanda terakhir dibaca; null kalau belum pernah ada. */
export function loadLastReadAt(): string | null {
  try {
    return localStorage.getItem(CHAT_LAST_READ_KEY);
  } catch {
    return null;
  }
}

/** Simpan penanda terakhir dibaca (ISO timestamp). */
export function saveLastReadAt(iso: string): void {
  try {
    localStorage.setItem(CHAT_LAST_READ_KEY, iso);
  } catch {
    // localStorage tidak tersedia — abaikan, badge tetap jalan (angka 0).
  }
}

/**
 * Hitung pesan yang belum dibaca: createdAt > lastReadAt.
 * lastReadAt null (belum pernah ada penanda) -> 0; penanda diinisialisasi
 * ke pesan terbaru saat load pertama supaya badge tidak langsung "9+"
 * hanya karena ada pesan lama yang belum pernah dibuka.
 */
export function countUnreadMessages(
  messages: { createdAt?: string }[],
  lastReadAt: string | null,
): number {
  if (!lastReadAt) return 0;
  const t = Date.parse(lastReadAt);
  if (Number.isNaN(t)) return 0;
  let n = 0;
  for (const m of messages) {
    if (!m.createdAt) continue;
    const mt = Date.parse(m.createdAt);
    if (!Number.isNaN(mt) && mt > t) n += 1;
  }
  return n;
}

/** Timestamp (ISO) pesan terbaru; null kalau tidak ada pesan bertimestamp. */
export function latestMessageAt(
  messages: { createdAt?: string }[],
): string | null {
  let latest: string | null = null;
  let latestMs = -Infinity;
  for (const m of messages) {
    if (!m.createdAt) continue;
    const ms = Date.parse(m.createdAt);
    if (!Number.isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      latest = m.createdAt;
    }
  }
  return latest;
}

/** Total badge = pesan belum dibaca + tantangan masuk pending. */
export function totalBadgeCount(unreadMessages: number, pendingChallenges: number): number {
  return Math.max(0, unreadMessages) + Math.max(0, pendingChallenges);
}

/**
 * Format angka badge: 0 -> null (badge disembunyikan), 1-9 -> angkanya,
 * >9 -> "9+".
 */
export function formatBadgeCount(n: number): string | null {
  if (n <= 0) return null;
  if (n > 9) return "9+";
  return String(n);
}
