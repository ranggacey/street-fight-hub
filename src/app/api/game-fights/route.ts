import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { handleError, ok, serialize } from '@/lib/http';
import { validateObjectId } from '@/lib/validation';
import { GameFight } from '@/models/GameFight';

const FIGHT_STATUSES = ['pending', 'playing', 'completed', 'disputed'] as const;

/** GET /api/game-fights?fighter=<id>&status= — riwayat fight satu fighter (publik). */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const fighterId = searchParams.get('fighter');
    const status = searchParams.get('status');
    if (!fighterId) {
      return ok({ fights: [] });
    }
    validateObjectId(fighterId, 'fighter');

    const filter: Record<string, unknown> = {
      $or: [{ fighterAId: fighterId }, { fighterBId: fighterId }],
    };
    if (status && (FIGHT_STATUSES as readonly string[]).includes(status)) {
      filter.status = status;
    }

    const fights = await GameFight.find(filter)
      .populate('fighterAId', 'displayName igUsername style')
      .populate('fighterBId', 'displayName igUsername style')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return ok({ fights: serialize(fights) });
  } catch (err) {
    return handleError(err);
  }
}
