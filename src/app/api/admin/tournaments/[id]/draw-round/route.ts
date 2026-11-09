import type { NextRequest } from 'next/server';
import { checkOrigin, requireAdminApi } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { decideMatch } from '@/lib/draw';
import { badRequest, forbidden, handleError, notFound, ok, parseJson, serialize } from '@/lib/http';
import { MATCH_ROUNDS } from '@/lib/validation';
import { Match } from '@/models/Match';
import { Tournament } from '@/models/Tournament';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/tournaments/[id]/draw-round { round }
 * Putuskan semua match 'scheduled' di ronde itu (bye tidak di-draw),
 * buat videoTask per match yang diputuskan, majukan pemenang ke ronde berikut.
 * Jika ronde = F → set champion, status turnamen 'completed'.
 * 400 jika ronde belum siap / sudah diputuskan. Pesan "belum siap" menyebut
 * ronde mana yang sebenarnya bisa diundi (supaya admin tidak menebak-nebak
 * ronde dari ukuran bracket nominal).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAdminApi(req);
    const { id } = await params;
    const body = await parseJson(req);
    const round = body.round;
    if (typeof round !== 'string' || !(MATCH_ROUNDS as readonly string[]).includes(round)) {
      throw badRequest('round harus salah satu dari R32, R16, QF, SF, F');
    }
    await connectDB();

    const tournament = await Tournament.findById(id);
    if (!tournament) throw notFound('Turnamen tidak ditemukan');
    if (tournament.status !== 'in_progress') {
      throw badRequest('Turnamen belum berjalan');
    }

    const scheduled = await Match.find({
      tournamentId: tournament._id,
      round,
      status: 'scheduled',
    })
      .sort({ createdAt: 1 })
      .lean();
    if (scheduled.length === 0) {
      const decidedCount = await Match.countDocuments({
        tournamentId: tournament._id,
        round,
        status: { $in: ['decided', 'video_done'] },
      });
      if (decidedCount > 0) throw badRequest(`Ronde ${round} sudah diputuskan`);
      // Bantu admin: sebutkan ronde mana yang sebenarnya bisa diundi
      // (ukuran bracket efektif bisa lebih kecil dari ukuran nominal).
      const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'F'];
      const readyRounds = (
        await Match.distinct('round', {
          tournamentId: tournament._id,
          status: 'scheduled',
        })
      ).filter((r): r is string => typeof r === 'string');
      readyRounds.sort((a, b) => ROUND_ORDER.indexOf(a) - ROUND_ORDER.indexOf(b));
      if (readyRounds.length > 0) {
        throw badRequest(
          `Ronde ${round} belum siap — ronde yang bisa diundi sekarang: ${readyRounds.join(', ')}`,
        );
      }
      throw badRequest(
        `Ronde ${round} belum siap — bracket belum dibuat atau semua ronde sudah diputuskan`,
      );
    }

    const results = [];
    for (const match of scheduled) {
      const seed = Math.floor(Math.random() * 2 ** 31);
      const decided = await decideMatch(String(match._id), seed);
      results.push(decided);
    }

    const updatedTournament = await Tournament.findById(id).lean();
    await audit(
      session.userId,
      'tournament.draw-round',
      'Tournament',
      id,
      `Draw ronde ${round} ${tournament.name}: ${results.length} match diputuskan`,
    );

    return ok({
      round,
      decided: results.map((r) => ({
        matchId: r.matchId,
        winnerId: r.winnerId,
        method: r.simulation.method,
        scoreA: r.simulation.scoreA,
        scoreB: r.simulation.scoreB,
        koTimeSec: r.simulation.koTimeSec,
      })),
      tournament: serialize(updatedTournament),
    });
  } catch (err) {
    return handleError(err);
  }
}
