import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { handleError, notFound, ok, serialize } from '@/lib/http';
import { Match } from '@/models/Match';
import { Tournament } from '@/models/Tournament';
import { TournamentEntry } from '@/models/TournamentEntry';

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/tournaments/[slug] — detail + entries + bracket + participantCount. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { slug } = await params;
    await connectDB();
    const tournament = await Tournament.findOne({ slug }).lean();
    if (!tournament) throw notFound('Turnamen tidak ditemukan');

    const entries = await TournamentEntry.find({ tournamentId: tournament._id, status: 'active' })
      .populate('fighterId', 'displayName igUsername style record aiPersona status')
      .sort({ joinedAt: 1 })
      .lean();

    const matches = await Match.find({ tournamentId: tournament._id })
      .populate('fighterAId', 'displayName igUsername style record')
      .populate('fighterBId', 'displayName igUsername style record')
      .populate('winnerId', 'displayName')
      .sort({ createdAt: 1 })
      .lean();

    return ok({
      tournament: serialize(tournament),
      entries: serialize(entries),
      bracket: serialize(matches),
      participantCount: entries.length,
    });
  } catch (err) {
    return handleError(err);
  }
}
