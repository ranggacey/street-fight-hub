import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { dateWIB } from '@/lib/game/training-rules';
import { handleError, notFound, ok } from '@/lib/http';
import { Fighter } from '@/models/Fighter';
import { FighterDeck } from '@/models/FighterDeck';
import { FighterStats } from '@/models/FighterStats';
import { TrainingLog } from '@/models/TrainingLog';

/**
 * GET /api/training/status — stat + poin + progres latihan hari ini (WIB).
 * Fighter tanpa dokumen stat/deck/log = default (stat 10 semua, deck
 * kosong, hitungan hari ini 0) — tidak membuat dokumen di GET.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await connectDB();

    const fighter = await Fighter.findOne({ userId: session.userId, status: 'active' });
    if (!fighter) throw notFound('Buat fighter dulu sebelum latihan');

    const today = dateWIB();
    const [statsDoc, deckDoc, log] = await Promise.all([
      FighterStats.findOne({ fighterId: fighter._id }).lean(),
      FighterDeck.findOne({ fighterId: fighter._id }).lean(),
      TrainingLog.findOne({ fighterId: fighter._id, dateWIB: today }).lean(),
    ]);

    return ok({
      fighter: { id: fighter._id.toString(), displayName: fighter.displayName, style: fighter.style },
      stats: statsDoc?.stats ?? { power: 10, speed: 10, stamina: 10, defense: 10, accuracy: 10 },
      pointsAvailable: statsDoc?.pointsAvailable ?? 0,
      lifetime: statsDoc?.lifetime ?? { pushups: 0, squats: 0 },
      today: {
        date: today,
        pushups: log?.pushups ?? 0,
        squats: log?.squats ?? 0,
        pointsEarned: log?.pointsEarned ?? 0,
      },
      deck: {
        cards: deckDoc?.cards ?? [],
        signature: deckDoc?.signature ?? fighter.signatureMove ?? null,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
