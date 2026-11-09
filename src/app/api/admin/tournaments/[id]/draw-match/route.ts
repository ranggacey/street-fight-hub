import type { NextRequest } from 'next/server';
import { checkOrigin, requireAdminApi } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { decideMatch } from '@/lib/draw';
import { badRequest, forbidden, handleError, notFound, ok, parseJson, serialize } from '@/lib/http';
import { Match } from '@/models/Match';
import { Tournament } from '@/models/Tournament';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/tournaments/[id]/draw-match { matchId }
 * Putuskan SATU match 'scheduled' (bukan bye) dengan mekanisme undi seeded
 * yang sama seperti draw-round (reuse decideMatch dari lib/draw.ts — logika
 * undi tidak ditulis ulang): update rekor kedua fighter, buat videoTask,
 * majukan pemenang ke ronde berikut (atau tentukan juara bila ini final).
 * Match lain di ronde yang sama tetap 'scheduled' sampai admin memulainya.
 * 400 jika turnamen belum berjalan / match sudah diputuskan atau bye.
 * 404 jika turnamen atau match tidak ditemukan (termasuk match milik
 * turnamen lain).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAdminApi(req);
    const { id } = await params;
    const body = await parseJson(req);
    const matchId = body.matchId;
    if (typeof matchId !== 'string' || matchId.trim() === '') {
      throw badRequest('matchId wajib diisi');
    }
    await connectDB();

    const tournament = await Tournament.findById(id);
    if (!tournament) throw notFound('Turnamen tidak ditemukan');
    if (tournament.status !== 'in_progress') {
      throw badRequest('Turnamen belum berjalan');
    }

    const match = await Match.findById(matchId);
    if (!match || match.tournamentId.toString() !== tournament._id.toString()) {
      throw notFound('Pertandingan tidak ditemukan di turnamen ini');
    }
    if (match.isBye || match.status !== 'scheduled') {
      throw badRequest('Pertandingan sudah diputuskan atau bye');
    }

    const seed = Math.floor(Math.random() * 2 ** 31);
    const decided = await decideMatch(String(match._id), seed);

    const updatedTournament = await Tournament.findById(id).lean();
    await audit(
      session.userId,
      'tournament.draw-match',
      'Tournament',
      id,
      `Draw 1 match ${tournament.name} ronde ${match.round}: pemenang ${decided.winnerId} (${decided.simulation.method})`,
    );

    return ok({
      matchId: decided.matchId,
      round: match.round,
      winnerId: decided.winnerId,
      method: decided.simulation.method,
      scoreA: decided.simulation.scoreA,
      scoreB: decided.simulation.scoreB,
      koTimeSec: decided.simulation.koTimeSec,
      tournament: serialize(updatedTournament),
    });
  } catch (err) {
    return handleError(err);
  }
}
