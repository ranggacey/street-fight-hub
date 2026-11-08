/**
 * Query daftar fight per hari WIB untuk admin (dipakai API list + ZIP poster).
 * Satu query dipakai kedua route supaya "hari ini" dan isi ZIP selalu sama.
 */
import { GameFight } from "../../models/GameFight";
import { Fighter } from "../../models/Fighter";
import { posterFileName, wibDateWindow } from "./fights";

export interface AdminFightRow {
  fightId: string;
  fighterA: { displayName: string; igUsername: string };
  fighterB: { displayName: string; igUsername: string };
  score: { a: number | null; b: number | null };
  method: string | null;
  status: string;
  isTitleFight: boolean;
  createdAt: string;
  completedAt: string | null;
  hasPoster: boolean;
  posterDataUrl: string | null;
  posterFile: string;
}

/**
 * Semua GameFight yang DIBUAT pada hari WIB `dateStr` (YYYY-MM-DD),
 * terurut dari yang terbaru. Poster yang sudah tersimpan ikut dikembalikan
 * (posterDataUrl) — TIDAK render ulang.
 */
export async function listFightsForWibDate(
  dateStr: string,
): Promise<AdminFightRow[]> {
  const window = wibDateWindow(dateStr);
  if (!window) return [];
  const fights = await GameFight.find({
    createdAt: { $gte: window.start, $lt: window.end },
  })
    .sort({ createdAt: -1 })
    .lean();
  if (fights.length === 0) return [];
  const fighterIds = [
    ...new Set(
      fights.flatMap((f) => [
        String(f.fighterAId),
        String(f.fighterBId),
      ]),
    ),
  ];
  const fighters = await Fighter.find({ _id: { $in: fighterIds } })
    .select("displayName igUsername")
    .lean();
  const byId = new Map(
    fighters.map((f) => [
      String(f._id),
      {
        displayName: f.displayName ?? "Petarung",
        igUsername: f.igUsername ?? "",
      },
    ]),
  );
  const fallback = { displayName: "Petarung", igUsername: "" };
  return fights.map((f) => {
    const a = byId.get(String(f.fighterAId)) ?? fallback;
    const b = byId.get(String(f.fighterBId)) ?? fallback;
    const scoreA = f.result?.score?.a ?? null;
    const scoreB = f.result?.score?.b ?? null;
    return {
      fightId: String(f._id),
      fighterA: a,
      fighterB: b,
      score: { a: scoreA, b: scoreB },
      method: f.result?.method ?? null,
      status: f.status,
      isTitleFight: !!f.isTitleFight,
      createdAt: f.createdAt ? new Date(f.createdAt).toISOString() : "",
      completedAt: f.completedAt ? new Date(f.completedAt).toISOString() : null,
      hasPoster: !!f.posterDataUrl,
      posterDataUrl: f.posterDataUrl ?? null,
      posterFile: posterFileName(dateStr, a.displayName, b.displayName, scoreA, scoreB),
    };
  });
}
