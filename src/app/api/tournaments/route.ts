import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { handleError, ok, serializeRecord } from '@/lib/http';
import { Tournament } from '@/models/Tournament';
import { TournamentEntry } from '@/models/TournamentEntry';

const TOURNAMENT_STATUSES = ['upcoming', 'closed', 'in_progress', 'completed', 'cancelled'];

/** GET /api/tournaments?status= — list ringkas + participantCount. */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const filter: Record<string, unknown> = {};
    if (status && TOURNAMENT_STATUSES.includes(status)) filter.status = status;

    const tournaments = await Tournament.find(filter).sort({ createdAt: -1 }).lean();
    const list = await Promise.all(
      tournaments.map(async (t) => {
        const participantCount = await TournamentEntry.countDocuments({
          tournamentId: t._id,
          status: 'active',
        });
        return { ...serializeRecord(t), participantCount };
      }),
    );
    return ok({ tournaments: list });
  } catch (err) {
    return handleError(err);
  }
}
