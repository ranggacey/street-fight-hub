import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { badRequest, conflict, forbidden, handleError, notFound, ok, serialize } from '@/lib/http';
import { Fighter } from '@/models/Fighter';
import { Tournament } from '@/models/Tournament';
import { TournamentEntry } from '@/models/TournamentEntry';

type Ctx = { params: Promise<{ slug: string }> };

/** POST /api/tournaments/[slug]/join — daftar ke turnamen (auth). */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const { slug } = await params;
    await connectDB();

    const tournament = await Tournament.findOne({ slug });
    if (!tournament) throw notFound('Turnamen tidak ditemukan');

    const fighter = await Fighter.findOne({ userId: session.userId, status: 'active' });
    if (!fighter) throw badRequest('Buat fighter dulu sebelum join turnamen');

    if (tournament.status !== 'upcoming') {
      throw badRequest('Turnamen sudah tidak menerima pendaftaran');
    }
    if (Date.now() >= new Date(tournament.regCloseAt).getTime()) {
      throw badRequest('Pendaftaran sudah ditutup');
    }

    const existing = await TournamentEntry.findOne({
      tournamentId: tournament._id,
      fighterId: fighter._id,
      status: 'active',
    });
    if (existing) throw conflict('Fighter kamu sudah terdaftar di turnamen ini');

    const participantCount = await TournamentEntry.countDocuments({
      tournamentId: tournament._id,
      status: 'active',
    });
    if (participantCount >= tournament.bracketSize) {
      throw conflict('Turnamen sudah penuh');
    }

    const entry = await TournamentEntry.create({
      tournamentId: tournament._id,
      fighterId: fighter._id,
      status: 'active',
    });
    return ok({ entry: serialize(entry.toObject()) });
  } catch (err) {
    return handleError(err);
  }
}
