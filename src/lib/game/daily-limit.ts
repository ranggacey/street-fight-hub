/**
 * Limit harian game — dihitung per hari WIB (Asia/Jakarta, UTC+7, tanpa DST).
 * Reset tengah malam WIB, dihitung server-side dari `createdAt`.
 */
import { GameFight } from '../../models/GameFight';

export const DAILY_FIGHT_LIMIT = 5;

// Tantangan TIDAK ADA batas harian (perintah user 9 Nov 2026): berapa
// pun tantangan boleh dikirim per hari. Yang dibatasi hanya jatah
// tarung 5/hari (dicek saat accept, bukan saat kirim).

export interface DayWindow {
  start: Date;
  end: Date;
}

/** Awal/akhir hari WIB yang memuat `now` (00:00–24:00 Asia/Jakarta). */
export function wibDayWindow(now: Date = new Date()): DayWindow {
  const WIB_MS = 7 * 60 * 60 * 1000;
  const shifted = now.getTime() + WIB_MS;
  const dayStartShifted = Math.floor(shifted / 86_400_000) * 86_400_000;
  return {
    start: new Date(dayStartShifted - WIB_MS),
    end: new Date(dayStartShifted - WIB_MS + 86_400_000),
  };
}

/** Berapa fight game (status apa pun yang sudah dibuat) fighter ini hari ini (WIB)? */
export async function countFightsToday(
  fighterId: string,
  now: Date = new Date(),
): Promise<number> {
  const { start, end } = wibDayWindow(now);
  return GameFight.countDocuments({
    createdAt: { $gte: start, $lt: end },
    $or: [{ fighterAId: fighterId }, { fighterBId: fighterId }],
  });
}

/** Sisa jatah tarung hari ini (WIB) untuk satu fighter. */
export async function fightsRemainingToday(
  fighterId: string,
  now: Date = new Date(),
): Promise<number> {
  const used = await countFightsToday(fighterId, now);
  return Math.max(0, DAILY_FIGHT_LIMIT - used);
}

/**
 * Jumlah fight hari ini (WIB) per fighter — SATU agregasi untuk semua
 * fighter (dipakai daftar lawan: fightsLeftToday per kartu di
 * GET /api/fighters). Hitungannya SAMA PERSIS dengan countFightsToday
 * (semua GameFight yang dibuat hari ini, status apa pun — accept juga
 * memakai countFightsToday, jadi angka di kartu = angka yang dipakai
 * gate DAILY_LIMIT_REACHED saat accept; jangan difilter 'completed' saja,
 * nanti kartu bilang masih ada jatah padahal accept menolak).
 * Kunci map = id fighter (string hex ObjectId).
 */
export async function countFightsTodayByFighter(
  now: Date = new Date(),
): Promise<Map<string, number>> {
  const { start, end } = wibDayWindow(now);
  const rows = await GameFight.aggregate<{ _id: unknown; count: number }>([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $project: { sides: ['$fighterAId', '$fighterBId'] } },
    { $unwind: '$sides' },
    { $group: { _id: '$sides', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}
