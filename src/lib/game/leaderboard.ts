/**
 * Klasemen kasual + snapshot murah (Fase 1).
 * Snapshot diambil lazy saat /api/leaderboard dibuka kalau belum ada
 * snapshot 7 hari terakhir (reason 'periodic'). UI riwayat klasemen
 * (baca snapshot ini) = Fase 2.
 */
import { Fighter } from '../../models/Fighter';
import { LeaderboardSnapshot } from '../../models/LeaderboardSnapshot';

export const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

export interface LeaderboardEntry {
  rank: number;
  fighterId: string;
  displayName: string;
  igUsername: string;
  style: string;
  rating: number;
  casualRecord: { wins: number; losses: number; draws: number; kos: number };
}

export async function getCasualLeaderboard(): Promise<LeaderboardEntry[]> {
  const fighters = await Fighter.find({ status: 'active' })
    .sort({ rating: -1, 'casualRecord.wins': -1, createdAt: 1 })
    .select('displayName igUsername style rating casualRecord')
    .lean();
  return fighters.map((f, i) => ({
    rank: i + 1,
    fighterId: f._id.toString(),
    displayName: f.displayName,
    igUsername: f.igUsername,
    style: f.style,
    rating: f.rating ?? 1000,
    casualRecord: f.casualRecord ?? { wins: 0, losses: 0, draws: 0, kos: 0 },
  }));
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
      casualWins: e.casualRecord.wins,
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
    const entries = await getCasualLeaderboard();
    return { at: new Date(latest.at), reason: latest.reason, entries, fresh: false };
  }
  const snap = await takeLeaderboardSnapshot('periodic');
  return { ...snap, fresh: true };
}
