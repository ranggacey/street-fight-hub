/**
 * Logika murni notifikasi tantangan (AMAN di-import dari client component
 * maupun server route — tanpa Mongoose, tanpa fetch).
 *
 * Latar: model Notification hanya menyimpan `type` + `relatedId`; judul
 * dan isi popup diturunkan di sini dari jenis notifikasi + detail
 * tantangan (nama fighter) yang dilampirkan GET /api/notifications.
 * Satu kejadian = satu notifikasi; dedup tampilan diurus
 * `pickUnseenNotifications` (id yang sudah pernah dilihat tidak
 * ditampilkan lagi, walau server masih mengembalikannya sebagai unread).
 */

export const CHALLENGE_POPUP_TYPES = [
  'challenge_received',
  'challenge_accepted',
  'challenge_declined',
] as const;

export type ChallengePopupType = (typeof CHALLENGE_POPUP_TYPES)[number];

/** Detail tantangan yang dilampirkan GET /api/notifications. */
export interface ChallengeNotificationDetail {
  challengerName?: string | null;
  challengedName?: string | null;
  /** 'direct' | 'open' — tantangan terbuka tidak punya yang ditantang. */
  kind?: string | null;
  map?: string | null;
}

export interface ChallengeNotificationText {
  title: string;
  body: string;
  /** Tujuan tombol "Lihat tantangan". */
  href: string;
}

/** Berapa lama (ms) satu popup tampil sebelum hilang sendiri. */
export const CHALLENGE_POPUP_DURATION_MS = 7000;

/** Interval polling notifikasi unread (ms) — cukup jarang agar tidak spam server. */
export const CHALLENGE_POLL_INTERVAL_MS = 15000;

export const CHALLENGE_NOTIF_SEEN_KEY = 'sfh-challenge-notif-seen-v1';
export const CHALLENGE_NOTIF_MUTED_KEY = 'sfh-challenge-notif-muted-v1';

function nameOrFallback(name?: string | null): string {
  const clean = (name ?? '').trim();
  return clean === '' ? 'Fighter' : clean;
}

/**
 * Judul + isi popup untuk satu notifikasi tantangan. Nama fighter
 * dipakai bila tersedia; tanpa nama, kalimat tetap lengkap dengan
 * fallback generik (tidak pernah menampilkan "undefined"/kosong).
 */
export function formatChallengeNotification(
  type: string,
  detail?: ChallengeNotificationDetail | null,
): ChallengeNotificationText {
  const href = '/tantangan';
  const challenger = nameOrFallback(detail?.challengerName);
  const challenged = nameOrFallback(detail?.challengedName);
  const open = detail?.kind === 'open';

  switch (type) {
    case 'challenge_received':
      return {
        title: 'Tantangan baru!',
        body: open
          ? `${challenger} menantangmu — terima tantangannya di arena.`
          : `${challenger} menantang ${challenged} untuk bertarung.`,
        href,
      };
    case 'challenge_accepted':
      return {
        title: 'Tantangan diterima!',
        body: open
          ? `${challenged} menerima tantangan terbukamu — bersiaplah bertarung.`
          : `${challenged} menerima tantanganmu — bersiaplah bertarung.`,
        href,
      };
    case 'challenge_declined':
      return {
        title: 'Tantangan ditolak',
        body: `${challenged} menolak tantanganmu. Cari lawan lain di arena.`,
        href,
      };
    default:
      return {
        title: 'Notifikasi tantangan',
        body: 'Ada kabar baru soal tantanganmu.',
        href,
      };
  }
}

export interface UnseenNotificationInput {
  id?: string;
  _id?: string;
  type?: string;
  read?: boolean;
}

/** Ambil id string dari item notifikasi (backend mengirim `id`, bukan `_id`). */
export function notificationId(item: UnseenNotificationInput): string {
  return item.id ?? item._id ?? '';
}

/**
 * Dari daftar notifikasi unread server, kembalikan hanya yang:
 * - bertipe tantangan yang memang dipopup-kan,
 * - belum dibaca, dan
 * - id-nya belum ada di `seenIds`.
 * Urutan dipertahankan (terbaru dulu, sesuai urutan server).
 */
export function pickUnseenNotifications<T extends UnseenNotificationInput>(
  items: T[],
  seenIds: ReadonlySet<string>,
): T[] {
  const popup = new Set<string>(CHALLENGE_POPUP_TYPES);
  return items.filter((item) => {
    if (!item.type || !popup.has(item.type)) return false;
    if (item.read) return false;
    const id = notificationId(item);
    if (id === '') return false;
    return !seenIds.has(id);
  });
}
