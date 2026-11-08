/**
 * Helper murni halaman Profil — diringkas dari satu GameFight mentah
 * (GET /api/fights/mine) menjadi satu baris riwayat milik saya.
 * Dipisah dari komponen supaya bisa dites tanpa render / tanpa DB.
 */
import type { GameFight } from "@/components/types";
import { getId } from "@/components/api";

export interface MyFightSummary {
  fightId: string;
  opponentName: string;
  /** null = fight belum selesai / belum ada hasil. */
  result: "win" | "loss" | "draw" | null;
  method: "KO" | "decision" | "draw" | null;
  score: { a: number; b: number } | null;
  koTimeSec: number | null;
  isTitleFight: boolean;
  playedAt: string | null;
}

function fighterName(
  v: string | { displayName?: string } | null | undefined,
): string {
  if (!v) return "—";
  if (typeof v === "string") return v;
  return v.displayName ?? "—";
}

/**
 * Satu fight -> ringkasan dari sudut pandang fighter saya.
 * Skor selalu ditampilkan dari sisi saya (skorSaya - skorLawan) supaya
 * tidak tertukar saat saya ada di sisi B.
 */
export function summarizeMyFight(
  fight: GameFight,
  myFighterId: string,
): MyFightSummary {
  const aId = getId(fight.fighterAId);
  const iAmA = aId === myFighterId;
  const opponent = iAmA ? fight.fighterBId : fight.fighterAId;
  const winnerId = fight.result?.winnerFighterId ?? null;
  const result =
    fight.status !== "completed" || !fight.result
      ? null
      : fight.result.method === "draw" || winnerId === null
        ? "draw"
        : winnerId === myFighterId
          ? "win"
          : "loss";
  const rawScore = fight.result?.score ?? null;
  const score =
    rawScore && !iAmA
      ? { a: rawScore.b, b: rawScore.a }
      : rawScore;
  return {
    fightId: getId(fight) ?? "",
    opponentName: fighterName(
      opponent as string | { displayName?: string } | null,
    ),
    result,
    method: fight.result?.method ?? null,
    score,
    koTimeSec: fight.result?.koTimeSec ?? null,
    isTitleFight: fight.isTitleFight ?? false,
    playedAt: fight.completedAt ?? fight.createdAt ?? null,
  };
}
