import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { winPercent } from '@/lib/game/elo';
import { fightsRemainingToday } from '@/lib/game/daily-limit';
import { handleError, notFound, ok, serialize } from '@/lib/http';
import { Fighter } from '@/models/Fighter';
import { GameFight } from '@/models/GameFight';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/game-fights/[id] — fight + sfa-config + kedua fighter + Win% Elo.
 * Publik untuk dilihat (seed bukan rahasia — replay butuh seed yang sama);
 * yang dibatasi adalah SUBMIT hasil (hanya peserta, di POST result).
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await connectDB();
    const fight = await GameFight.findById(id)
      .populate(
        'fighterAId',
        'displayName igUsername style styleOther rating casualRecord signatureMove tempo colors',
      )
      .populate(
        'fighterBId',
        'displayName igUsername style styleOther rating casualRecord signatureMove tempo colors',
      )
      .lean();
    if (!fight) throw notFound('Fight tidak ditemukan');

    const fighterA = fight.fighterAId as unknown as Record<string, unknown>;
    const fighterB = fight.fighterBId as unknown as Record<string, unknown>;
    const ratingA = (fighterA.rating as number) ?? 1000;
    const ratingB = (fighterB.rating as number) ?? 1000;

    // Sesi opsional (untuk mySide / canSubmit / sisa jatah).
    const session = await getSessionFromRequest(req).catch(() => null);
    let mySide: 'A' | 'B' | null = null;
    let fightsRemaining: number | null = null;
    if (session) {
      const mine = await Fighter.findOne({ userId: session.userId })
        .select('_id')
        .lean();
      if (mine) {
        const myId = mine._id.toString();
        const aId =
          typeof fight.fighterAId === 'object' && fight.fighterAId
            ? (fight.fighterAId as { _id: unknown })._id?.toString()
            : String(fight.fighterAId);
        const bId =
          typeof fight.fighterBId === 'object' && fight.fighterBId
            ? (fight.fighterBId as { _id: unknown })._id?.toString()
            : String(fight.fighterBId);
        if (aId === myId) mySide = 'A';
        else if (bId === myId) mySide = 'B';
        fightsRemaining = await fightsRemainingToday(myId);
      }
    }

    const config = fight.config as {
      left: Record<string, unknown>;
      right: Record<string, unknown>;
    };
    return ok({
      fight: serialize(fight),
      config: {
        type: 'sfa-config',
        fightId: fight._id.toString(),
        fighters: { left: config.left, right: config.right },
        seed: fight.seed,
        map: fight.map,
        duration: fight.durationSec,
      },
      fighterA: serialize(fighterA),
      fighterB: serialize(fighterB),
      winPercentA: winPercent(ratingA, ratingB),
      winPercentB: winPercent(ratingB, ratingA),
      mySide,
      canSubmit: mySide !== null && (fight.status === 'pending' || fight.status === 'playing'),
      fightsRemaining,
    });
  } catch (err) {
    return handleError(err);
  }
}
