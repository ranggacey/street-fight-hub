import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { expireStaleChallenges } from '@/lib/game/challenges';
import { notifyFighterOwner } from '@/lib/game/notify';
import { conflict, forbidden, handleError, notFound, ok, serialize } from '@/lib/http';
import { Challenge } from '@/models/Challenge';
import { Fighter } from '@/models/Fighter';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/challenges/[id]/decline — yang ditantang menolak. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const { id } = await params;
    await connectDB();
    await expireStaleChallenges();

    const challenge = await Challenge.findById(id);
    if (!challenge) throw notFound('Tantangan tidak ditemukan');
    if (challenge.status !== 'pending') {
      throw conflict('Tantangan ini sudah tidak aktif', 'CHALLENGE_NOT_PENDING');
    }

    const challenged = await Fighter.findById(challenge.challengedFighterId);
    if (!challenged) throw notFound('Fighter yang ditantang tidak ditemukan');
    if (challenged.userId.toString() !== session.userId) {
      throw forbidden('Hanya fighter yang ditantang yang bisa menolak');
    }

    challenge.status = 'declined';
    challenge.respondedAt = new Date();
    await challenge.save();

    await notifyFighterOwner(
      challenge.challengerFighterId.toString(),
      'challenge_declined',
      challenge._id.toString(),
    );

    return ok({ challenge: serialize(challenge.toObject()) });
  } catch (err) {
    return handleError(err);
  }
}
