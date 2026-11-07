import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { handleError, notFound, ok, serialize } from '@/lib/http';
import { Match } from '@/models/Match';
import { Tournament } from '@/models/Tournament';

type Ctx = { params: Promise<{ slug: string }> };

const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'F'];

/** GET /api/tournaments/[slug]/bracket — matches per ronde + byes. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { slug } = await params;
    await connectDB();
    const tournament = await Tournament.findOne({ slug }).lean();
    if (!tournament) throw notFound('Turnamen tidak ditemukan');

    const matches = await Match.find({ tournamentId: tournament._id })
      .populate('fighterAId', 'displayName igUsername style record aiPersona')
      .populate('fighterBId', 'displayName igUsername style record aiPersona')
      .populate('winnerId', 'displayName')
      .sort({ createdAt: 1 })
      .lean();

    const serialized = serialize(matches) as Array<Record<string, unknown>>;
    const rounds = ROUND_ORDER.map((round) => ({
      round,
      matches: serialized.filter((m) => m.round === round),
    })).filter((r) => r.matches.length > 0);
    const byes = serialized.filter((m) => m.isBye);

    return ok({
      tournament: serialize(tournament),
      rounds,
      byes,
    });
  } catch (err) {
    return handleError(err);
  }
}
