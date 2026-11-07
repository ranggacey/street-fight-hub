import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { handleError, notFound, ok, serialize } from '@/lib/http';
import { Match } from '@/models/Match';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/matches/[id] — detail match + kedua fighter + turnamen. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await connectDB();
    const match = await Match.findById(id)
      .populate('fighterAId', 'displayName igUsername style record')
      .populate('fighterBId', 'displayName igUsername style record')
      .populate('tournamentId', 'name slug status')
      .lean();
    if (!match) throw notFound('Pertandingan tidak ditemukan');
    return ok({ match: serialize(match) });
  } catch (err) {
    return handleError(err);
  }
}
