/**
 * Rivalry — DERIVED, tanpa model sendiri.
 *
 * Head-to-head dua fighter dihitung dari fight yang sudah selesai:
 * GameFight completed (+ disputed dihitung seri? TIDAK — disputed
 * tidak punya hasil sah, jadi diabaikan) dan Match turnamen
 * decided/video_done (bye diabaikan — bukan fight).
 *
 * Dipakai di:
 * - GET /api/fighters/[id]/rivalry?opponentId=
 * - Badge rivalitas di profil + pre-fight ("Rivalitas 2-1").
 */
import { GameFight } from '../../models/GameFight';
import { Match } from '../../models/Match';

export interface RivalryResult {
  fighterAId: string;
  fighterBId: string;
  /** Kemenangan fighter A atas B. */
  winsA: number;
  /** Kemenangan fighter B atas A. */
  winsB: number;
  draws: number;
  totalFights: number;
  lastFightAt: Date | null;
}

export interface RivalryEntry {
  winnerFighterId: string | null;
  method: string | null;
  decidedAt: Date | null;
}

/**
 * Hitung head-to-head dari daftar entri hasil (murni, tanpa DB).
 * Entri dengan winner null + method 'draw' = seri; winner null lainnya
 * (mis. bye) diabaikan oleh pemanggil — di sini dihitung seri hanya
 * kalau method === 'draw'.
 */
export function computeRivalry(
  fighterAId: string,
  fighterBId: string,
  entries: RivalryEntry[],
): RivalryResult {
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let lastFightAt: Date | null = null;
  for (const e of entries) {
    if (e.method === 'draw' || (e.winnerFighterId === null && e.method === 'draw')) {
      draws += 1;
    } else if (e.winnerFighterId === fighterAId) {
      winsA += 1;
    } else if (e.winnerFighterId === fighterBId) {
      winsB += 1;
    } else {
      continue;
    }
    if (e.decidedAt && (!lastFightAt || e.decidedAt > lastFightAt)) {
      lastFightAt = e.decidedAt;
    }
  }
  return {
    fighterAId,
    fighterBId,
    winsA,
    winsB,
    draws,
    totalFights: winsA + winsB + draws,
    lastFightAt,
  };
}

/** Head-to-head dua fighter dari DB (GameFight + Match turnamen). */
export async function getRivalry(
  fighterAId: string,
  fighterBId: string,
): Promise<RivalryResult> {
  const [gameFights, matches] = await Promise.all([
    GameFight.find({
      status: 'completed',
      $or: [
        { fighterAId, fighterBId },
        { fighterAId: fighterBId, fighterBId: fighterAId },
      ],
    })
      .select('result completedAt')
      .lean(),
    Match.find({
      status: { $in: ['decided', 'video_done'] },
      method: { $ne: 'bye' },
      $or: [
        { fighterAId, fighterBId },
        { fighterAId: fighterBId, fighterBId: fighterAId },
      ],
    })
      .select('winnerId method decidedAt')
      .lean(),
  ]);

  const entries: RivalryEntry[] = [
    ...gameFights.map((g) => ({
      winnerFighterId: g.result?.winnerFighterId
        ? g.result.winnerFighterId.toString()
        : null,
      method: g.result?.method ?? null,
      decidedAt: g.completedAt ?? null,
    })),
    ...matches.map((m) => ({
      winnerFighterId: m.winnerId ? m.winnerId.toString() : null,
      method: m.method ?? null,
      decidedAt: m.decidedAt ?? null,
    })),
  ];

  return computeRivalry(fighterAId, fighterBId, entries);
}

/** Label badge rivalitas, mis. "Rivalitas 2-1" (null kalau belum pernah bertemu). */
export function rivalryLabel(r: RivalryResult): string | null {
  if (r.totalFights === 0) return null;
  return `Rivalitas ${r.winsA}-${r.winsB}${r.draws > 0 ? ` (${r.draws} seri)` : ''}`;
}
