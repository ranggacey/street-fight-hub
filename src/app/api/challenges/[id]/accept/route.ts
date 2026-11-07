import { randomInt } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { expireStaleChallenges } from '@/lib/game/challenges';
import { countFightsToday, DAILY_FIGHT_LIMIT } from '@/lib/game/daily-limit';
import { FIGHT_DURATION_SEC, toEngineFighter } from '@/lib/game/engine-config';
import { notifyFighterOwner } from '@/lib/game/notify';
import { ensureTitleCurrent } from '@/lib/game/title-service';
import {
  conflict,
  forbidden,
  handleError,
  notFound,
  ok,
  serialize,
} from '@/lib/http';
import { Challenge } from '@/models/Challenge';
import { Fighter } from '@/models/Fighter';
import { GameFight } from '@/models/GameFight';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/challenges/[id]/accept — yang ditantang menerima.
 * Membuat GameFight + seed server, mengembalikan payload sfa-config.
 * Cek limit 3 fight/hari (WIB) untuk KEDUA fighter + kekosongan gelar (lazy).
 */
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
      throw forbidden('Hanya fighter yang ditantang yang bisa menerima');
    }
    const challenger = await Fighter.findById(challenge.challengerFighterId);
    if (!challenger) throw notFound('Fighter penantang tidak ditemukan');

    // Limit 3 fight/hari (WIB) — kedua fighter.
    const [usedA, usedB] = await Promise.all([
      countFightsToday(challenger._id.toString()),
      countFightsToday(challenged._id.toString()),
    ]);
    if (usedA >= DAILY_FIGHT_LIMIT || usedB >= DAILY_FIGHT_LIMIT) {
      throw conflict(
        'Jatah tarung hari ini sudah habis (maks 3 fight/hari, reset tengah malam WIB)',
        'DAILY_LIMIT_REACHED',
      );
    }

    // Kekosongan gelar dicek lazy di sini (tanpa cron).
    const { title } = await ensureTitleCurrent();
    const holderId = title.holderFighterId ? title.holderFighterId.toString() : null;
    const isTitleFight =
      holderId === challenger._id.toString() || holderId === challenged._id.toString();

    // Seed server (acak, 6 digit seperti randomSeed arena).
    const seed = randomInt(100000, 1000000);
    const left = toEngineFighter(challenger.toObject());
    const right = toEngineFighter(challenged.toObject());

    const fight = await GameFight.create({
      fighterAId: challenger._id,
      fighterBId: challenged._id,
      challengeId: challenge._id,
      tournamentId: null,
      seed,
      map: challenge.map,
      durationSec: FIGHT_DURATION_SEC,
      status: 'pending',
      config: { left, right },
      isTitleFight,
    });

    challenge.status = 'accepted';
    challenge.gameFightId = fight._id;
    challenge.respondedAt = new Date();
    await challenge.save();

    await notifyFighterOwner(
      challenger._id.toString(),
      'challenge_accepted',
      challenge._id.toString(),
    );

    return ok({
      challenge: serialize(challenge.toObject()),
      gameFight: { id: fight._id.toString() },
      isTitleFight,
      config: {
        type: 'sfa-config',
        fightId: fight._id.toString(),
        fighters: { left, right },
        seed,
        map: challenge.map,
        duration: FIGHT_DURATION_SEC,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
