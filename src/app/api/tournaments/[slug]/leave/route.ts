import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { badRequest, forbidden, handleError, notFound, ok, serialize } from '@/lib/http';
import { Fighter } from '@/models/Fighter';
import { Tournament } from '@/models/Tournament';
import { TournamentEntry } from '@/models/TournamentEntry';

type Ctx = { params: Promise<{ slug: string }> };

/** POST /api/tournaments/[slug]/leave — mundur (hanya sebelum regCloseAt). */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const { slug } = await params;
    await connectDB();

    const tournament = await Tournament.findOne({ slug });
    if (!tournament) throw notFound('Turnamen tidak ditemukan');

    const fighter = await Fighter.findOne({ userId: session.userId, status: 'active' });
    if (!fighter) throw notFound('Fighter tidak ditemukan');

    const entry = await TournamentEntry.findOne({
      tournamentId: tournament._id,
      fighterId: fighter._id,
      status: 'active',
    });
    if (!entry) throw notFound('Kamu belum terdaftar di turnamen ini');

    if (Date.now() >= new Date(tournament.regCloseAt).getTime()) {
      throw badRequest('Pendaftaran sudah ditutup, tidak bisa mundur lagi');
    }

    entry.status = 'withdrawn';
    await entry.save();
    return ok({ entry: serialize(entry.toObject()) });
  } catch (err) {
    return handleError(err);
  }
}
