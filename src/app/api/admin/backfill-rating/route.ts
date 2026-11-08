import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { ELO_INITIAL_RATING, updateRatings } from '@/lib/game/elo';
import { badRequest, handleError, notFound, ok, parseJson } from '@/lib/http';
import { Fighter } from '@/models/Fighter';
import { GameFight } from '@/models/GameFight';

/**
 * ONE-TIME MIGRATION — backfill rating Elo yang hilang (2026-11-08).
 *
 * Latar: fighter yang dibuat sebelum field `rating` ada di schema
 * (Fase 1, 7 Nov 2026) tidak punya field rating di DB. Di klasemen
 * mereka tampil 1000 (fallback `?? 1000`) tapi terurut PALING BAWAH
 * karena Mongo mengurut nilai kosong di bawah angka — contoh: Sijagoan
 * Batak, Nope Boy, Glaciero tampil 1000 tapi di bawah Jamal (984).
 *
 * Logika: replay SEMUA GameFight completed secara kronologis dari
 * rating awal 1000 (K=32) memakai fungsi Elo yang sama dengan
 * result route (`updateRatings`). Fighter tanpa fight completed
 * mendapat 1000. Hanya fighter yang rating-nya kosong yang diubah;
 * rating fighter lain TIDAK disentuh, record fight/gelar tidak diubah.
 *
 * Keamanan: endpoint ini SEMENTARA. POST butuh header
 * `x-backfill-token` dengan token sekali pakai. Setelah backfill
 * terverifikasi, file ini WAJIB diganti stub 404 + push lagi.
 * GET (dry-run) terbuka karena datanya sudah publik via /api/leaderboard.
 */

const BACKFILL_TOKEN = '252a5df85e9dc35b7455ee1e20a1fe4b4f46baa0b0b45f8c';

function checkToken(req: NextRequest): void {
  if (req.headers.get('x-backfill-token') !== BACKFILL_TOKEN) {
    throw notFound('Tidak ditemukan');
  }
}

interface AffectedFighter {
  fighterId: string;
  displayName: string;
  igUsername: string;
  storedRating: null;
  replayedRating: number;
  completedFights: number;
  casualRecord: { wins: number; losses: number; draws: number; kos: number };
}

interface Mismatch {
  displayName: string;
  igUsername: string;
  stored: number;
  replayed: number;
}

/**
 * Replay Elo dari 1000 untuk semua fighter, dari seluruh GameFight
 * completed (urut completedAt). Mengembalikan fighter yang rating-nya
 * kosong + cek konsistensi: fighter yang SUDAH punya rating harus
 * cocok dengan hasil replay (kalau tidak cocok, riwayat Elo pernah
 * diubah di luar result route dan hasil replay perlu ditinjau manual).
 */
async function computeReplay(): Promise<{
  affected: AffectedFighter[];
  mismatches: Mismatch[];
  totalFighters: number;
  completedFights: number;
  skippedFights: number;
}> {
  const fighters = await Fighter.find({})
    .select('displayName igUsername rating casualRecord createdAt')
    .lean();
  const fights = await GameFight.find({ status: 'completed' })
    .sort({ completedAt: 1, createdAt: 1, _id: 1 })
    .select('fighterAId fighterBId result completedAt')
    .lean();

  const ratings = new Map<string, number>();
  const fightCount = new Map<string, number>();
  const get = (id: string): number => ratings.get(id) ?? ELO_INITIAL_RATING;
  let skippedFights = 0;

  for (const fight of fights) {
    const result = fight.result as {
      winnerSide?: 'R' | 'B' | null;
      method?: 'KO' | 'decision' | 'draw' | null;
    } | null;
    if (!result) {
      skippedFights += 1;
      continue;
    }
    const aId = fight.fighterAId.toString();
    const bId = fight.fighterBId.toString();
    const winnerSide = result.winnerSide ?? null;
    const scoreA = winnerSide === 'R' ? 1 : winnerSide === 'B' ? 0 : 0.5;
    const [newA, newB] = updateRatings(get(aId), get(bId), scoreA);
    ratings.set(aId, newA);
    ratings.set(bId, newB);
    fightCount.set(aId, (fightCount.get(aId) ?? 0) + 1);
    fightCount.set(bId, (fightCount.get(bId) ?? 0) + 1);
  }

  const mismatches: Mismatch[] = [];
  for (const f of fighters) {
    if (f.rating !== null && f.rating !== undefined) {
      const replayed = ratings.get(f._id.toString()) ?? ELO_INITIAL_RATING;
      if (replayed !== f.rating) {
        mismatches.push({
          displayName: f.displayName,
          igUsername: f.igUsername,
          stored: f.rating,
          replayed,
        });
      }
    }
  }

  const affected: AffectedFighter[] = fighters
    .filter((f) => f.rating === null || f.rating === undefined)
    .map((f) => {
      const id = f._id.toString();
      return {
        fighterId: id,
        displayName: f.displayName,
        igUsername: f.igUsername,
        storedRating: null,
        replayedRating: ratings.get(id) ?? ELO_INITIAL_RATING,
        completedFights: fightCount.get(id) ?? 0,
        casualRecord: f.casualRecord ?? { wins: 0, losses: 0, draws: 0, kos: 0 },
      };
    });

  return {
    affected,
    mismatches,
    totalFighters: fighters.length,
    completedFights: fights.length,
    skippedFights,
  };
}

/** GET — dry-run: daftar fighter yang akan di-backfill, TANPA menulis. */
export async function GET() {
  try {
    await connectDB();
    const data = await computeReplay();
    return ok({ dryRun: true, ...data });
  } catch (err) {
    return handleError(err);
  }
}

/** POST { confirm: true } — tulis rating hasil replay ke fighter yang kosong. */
export async function POST(req: NextRequest) {
  try {
    checkToken(req);
    let body: unknown = {};
    try {
      body = await parseJson(req);
    } catch {
      body = {};
    }
    if (
      !body ||
      typeof body !== 'object' ||
      (body as Record<string, unknown>).confirm !== true
    ) {
      throw badRequest('Kirim body { "confirm": true } untuk menjalankan backfill');
    }
    await connectDB();
    const data = await computeReplay();
    const updated = [];
    for (const a of data.affected) {
      await Fighter.updateOne(
        { _id: a.fighterId },
        { $set: { rating: a.replayedRating } },
      );
      updated.push({
        displayName: a.displayName,
        igUsername: a.igUsername,
        from: null,
        to: a.replayedRating,
        completedFights: a.completedFights,
      });
    }
    return ok({ dryRun: false, updated, mismatches: data.mismatches });
  } catch (err) {
    return handleError(err);
  }
}
