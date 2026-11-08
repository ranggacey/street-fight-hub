/**
 * Klasemen + snapshot murah (Fase 1).
 * Snapshot diambil lazy saat /api/leaderboard dibuka kalau belum ada
 * snapshot 7 hari terakhir (reason 'periodic'). UI riwayat klasemen
 * (baca snapshot ini) = Fase 2.
 *
 * Rekor di sini SATU (record) untuk semua fight — kasual, turnamen,
 * gelar. Klasemen "kasual" vs "turnamen" hanya beda URUTAN (rating vs
 * kemenangan), bukan beda rekor.
 */
import { TtlCache } from '../cache';
import { Fighter } from '../../models/Fighter';
import { LeaderboardSnapshot } from '../../models/LeaderboardSnapshot';

export const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

// Cache singkat klasemen: dibaca di tiap render Beranda + /klasemen +
// tiap hit /api/leaderboard, tapi rating hanya berubah saat ada fight
// selesai. TTL 15 detik — pengguna paling lambat 15 detik melihat
// perubahan rating, dengan imbalan nyaris tanpa query ulang saat
// 100–200 orang membuka halaman yang sama bersamaan.
export const LEADERBOARD_TTL_MS = 15_000;
const leaderboardCache = new TtlCache<LeaderboardEntry[]>(LEADERBOARD_TTL_MS);

export interface LeaderboardEntry {
  rank: number;
  fighterId: string;
  displayName: string;
  igUsername: string;
  style: string;
  rating: number;
  record: { wins: number; losses: number; draws: number; kos: number };
}

export async function getCasualLeaderboard(): Promise<LeaderboardEntry[]> {
  const fighters = await Fighter.find({ status: 'active' })
    .sort({ rating: -1, 'record.wins': -1, createdAt: 1 })
    .select('displayName igUsername style rating record')
    .lean();
  return fighters.map((f, i) => ({
    rank: i + 1,
    fighterId: f._id.toString(),
    displayName: f.displayName,
    igUsername: f.igUsername,
    style: f.style,
    rating: f.rating ?? 1000,
    record: f.record ?? { wins: 0, losses: 0, draws: 0, kos: 0 },
  }));
}

/** Klasemen dengan cache TTL 15 detik (per instance serverless). */
export async function getCachedCasualLeaderboard(
  now: number = Date.now(),
): Promise<LeaderboardEntry[]> {
  const hit = leaderboardCache.get(now);
  if (hit) return hit;
  const entries = await getCasualLeaderboard();
  leaderboardCache.set(entries, now);
  return entries;
}

/** Hanya untuk tes. */
export function __resetLeaderboardCache(): void {
  leaderboardCache.clear();
}

export async function takeLeaderboardSnapshot(
  reason: 'tournament_end' | 'periodic',
): Promise<{ at: Date; reason: string; entries: LeaderboardEntry[] }> {
  const entries = await getCasualLeaderboard();
  const at = new Date();
  await LeaderboardSnapshot.create({
    at,
    reason,
    entries: entries.map((e) => ({
      fighterId: e.fighterId,
      rating: e.rating,
      wins: e.record.wins,
      rank: e.rank,
    })),
  });
  return { at, reason, entries };
}

/** Snapshot terbaru, atau ambil baru kalau sudah lebih dari 7 hari (lazy). */
export async function ensureRecentSnapshot(): Promise<{
  at: Date;
  reason: string;
  entries: LeaderboardEntry[];
  fresh: boolean;
}> {
  const latest = await LeaderboardSnapshot.findOne().sort({ at: -1 }).lean();
  const now = new Date();
  if (latest && now.getTime() - new Date(latest.at).getTime() < SNAPSHOT_MAX_AGE_MS) {
    // Dulu: snapshot segar pun tetap query ulang seluruh fighter — snapshot
    // jadi tidak menghemat apa-apa. Sekarang pakai klasemen ber-cache.
    const entries = await getCachedCasualLeaderboard(now.getTime());
    return { at: new Date(latest.at), reason: latest.reason, entries, fresh: false };
  }
  const snap = await takeLeaderboardSnapshot('periodic');
  return { ...snap, fresh: true };
}
