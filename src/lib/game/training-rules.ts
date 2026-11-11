/**
 * Aturan latihan harian (skema yang disetujui 2026-11-10, modul MURNI).
 *
 * - Push-up maks 50/hari (WIB), squat maks 30/hari (WIB).
 * - 25 push-up = 1 poin, 15 squat = 1 poin, maks 4 poin/hari total.
 * - Poin bebas dialokasikan user ke stat apa pun (1 poin = +1 stat mentah).
 * - Stat mulai 10, maks 100. Diminishing returns di atas 80 ditangani
 *   di stat-effects.ts (efek, bukan alokasi).
 *
 * Sanity check server (anti-isi-ngawur): sesi hanya boleh menambah
 * hitungan sampai cap harian; angka harus bilangan bulat >= 0; satu
 * sesi tidak boleh mengklaim lebih dari cap harian sekaligus.
 */
import { badRequest } from '../http';
import { STAT_MAX, STAT_START, type StatKey } from './stat-effects';

export const PUSHUP_CAP = 50;
export const SQUAT_CAP = 30;
export const PUSHUP_PER_POINT = 25;
export const SQUAT_PER_POINT = 15;
export const MAX_POINTS_PER_DAY = 4;

export { STAT_START, STAT_MAX };

/** Tanggal WIB (Asia/Jakarta, UTC+7) dalam bentuk YYYY-MM-DD. */
export function dateWIB(now: Date = new Date()): string {
  const WIB_MS = 7 * 60 * 60 * 1000;
  const shifted = new Date(now.getTime() + WIB_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Poin yang dihasilkan dari hitungan hari itu (sebelum cap 4/hari). */
export function pointsForDay(pushups: number, squats: number): number {
  const p =
    Math.floor(Math.max(0, pushups) / PUSHUP_PER_POINT) +
    Math.floor(Math.max(0, squats) / SQUAT_PER_POINT);
  return Math.min(MAX_POINTS_PER_DAY, p);
}

/**
 * Validasi hitungan satu sesi terhadap log hari ini.
 * Throw HttpError 400 (pesan Indonesia) bila: bukan bilangan bulat >= 0,
 * melebihi cap harian, atau satu sesi mengklaim lebih dari cap.
 */
export function validateSessionCounts(
  pushups: unknown,
  squats: unknown,
  todayPushups: number,
  todaySquats: number,
): { pushups: number; squats: number } {
  const p = asNonNegativeInt(pushups, 'push-up');
  const s = asNonNegativeInt(squats, 'squat');
  if (p > PUSHUP_CAP || s > SQUAT_CAP) {
    throw badRequest(
      `Satu sesi maksimal ${PUSHUP_CAP} push-up dan ${SQUAT_CAP} squat`,
    );
  }
  if (todayPushups + p > PUSHUP_CAP) {
    throw badRequest(
      `Cap push-up hari ini ${PUSHUP_CAP} — sisa ${PUSHUP_CAP - todayPushups} lagi`,
    );
  }
  if (todaySquats + s > SQUAT_CAP) {
    throw badRequest(
      `Cap squat hari ini ${SQUAT_CAP} — sisa ${SQUAT_CAP - todaySquats} lagi`,
    );
  }
  return { pushups: p, squats: s };
}

function asNonNegativeInt(v: unknown, label: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw badRequest(`Jumlah ${label} harus bilangan bulat >= 0`);
  }
  return v;
}

/** Validasi alokasi poin ke stat. */
export function validateAllocation(
  stat: unknown,
  points: unknown,
  pointsAvailable: number,
  currentStat: number,
): { stat: StatKey; points: number } {
  if (
    typeof stat !== 'string' ||
    !(['power', 'speed', 'stamina', 'defense', 'accuracy'] as string[]).includes(stat)
  ) {
    throw badRequest('Stat tidak dikenal');
  }
  if (typeof points !== 'number' || !Number.isInteger(points) || points < 1) {
    throw badRequest('Jumlah poin harus bilangan bulat >= 1');
  }
  if (points > pointsAvailable) {
    throw badRequest(`Poin tersedia tinggal ${pointsAvailable}`);
  }
  if (currentStat + points > STAT_MAX) {
    throw badRequest(`Stat maksimal ${STAT_MAX} (saat ini ${currentStat})`);
  }
  return { stat: stat as StatKey, points };
}
