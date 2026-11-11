import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { validateAllocation } from '@/lib/game/training-rules';
import { forbidden, handleError, notFound, ok, parseJson } from '@/lib/http';
import { Fighter } from '@/models/Fighter';
import { FighterStats } from '@/models/FighterStats';

/**
 * POST /api/training/allocate — alokasikan poin latihan ke satu stat.
 * Body { stat: 'power'|'speed'|'stamina'|'defense'|'accuracy', points }.
 * 1 poin = +1 stat mentah (maks 100). Diminishing returns di atas 80
 * berlaku untuk EFEK (stat-effects.ts), bukan untuk alokasi.
 */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const body = await parseJson(req);
    await connectDB();

    const fighter = await Fighter.findOne({ userId: session.userId, status: 'active' });
    if (!fighter) throw notFound('Buat fighter dulu sebelum latihan');

    let statsDoc = await FighterStats.findOne({ fighterId: fighter._id });
    if (!statsDoc) {
      statsDoc = new FighterStats({ fighterId: fighter._id });
      await statsDoc.save();
    }
    const current = statsDoc.stats?.[body.stat as string] ?? 10;
    const { stat, points } = validateAllocation(
      body.stat,
      body.points,
      statsDoc.pointsAvailable ?? 0,
      current,
    );

    statsDoc.stats[stat] = current + points;
    statsDoc.pointsAvailable -= points;
    await statsDoc.save();

    return ok({
      stats: statsDoc.stats,
      pointsAvailable: statsDoc.pointsAvailable,
      allocated: { stat, points },
    });
  } catch (err) {
    return handleError(err);
  }
}
