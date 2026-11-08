import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { expireStaleChallenges } from '@/lib/game/challenges';
import {
  countChallengesSentToday,
  countFightsToday,
  DAILY_CHALLENGE_LIMIT,
  DAILY_FIGHT_LIMIT,
} from '@/lib/game/daily-limit';
import { notifyFighterOwner } from '@/lib/game/notify';
import {
  badRequest,
  conflict,
  forbidden,
  handleError,
  notFound,
  ok,
  parseJson,
  serialize,
} from '@/lib/http';
import { validateChallengeBody } from '@/lib/validation';
import { Challenge } from '@/models/Challenge';
import { Fighter } from '@/models/Fighter';

const CHALLENGEABLE_STATUSES = ['pending', 'accepted', 'declined', 'expired'] as const;

async function myFighter(sessionUserId: string) {
  return Fighter.findOne({ userId: sessionUserId, status: 'active' });
}

function serializeChallenge(c: unknown): Record<string, unknown> {
  return serialize(c) as Record<string, unknown>;
}

/** POST /api/challenges — buat tantangan (auth). */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const body = await parseJson(req);
    const input = validateChallengeBody(body);
    await connectDB();
    await expireStaleChallenges();

    const mine = await myFighter(session.userId);
    if (!mine) throw badRequest('Buat fighter dulu sebelum menantang');

    const target = await Fighter.findById(input.challengedFighterId);
    if (!target || target.status !== 'active') {
      throw notFound('Fighter yang ditantang tidak ditemukan');
    }
    if (target._id.toString() === mine._id.toString()) {
      throw badRequest('Tidak bisa menantang fighter sendiri');
    }

    const active = await Challenge.findOne({
      status: 'pending',
      $or: [
        { challengerFighterId: mine._id, challengedFighterId: target._id },
        { challengerFighterId: target._id, challengedFighterId: mine._id },
      ],
    });
    if (active) {
      throw conflict(
        'Sudah ada tantangan aktif antara kedua fighter ini',
        'CHALLENGE_ACTIVE_EXISTS',
      );
    }

    const sentToday = await countChallengesSentToday(mine._id.toString());
    if (sentToday >= DAILY_CHALLENGE_LIMIT) {
      throw conflict(
        'Maksimal 5 tantangan per hari — coba lagi besok',
        'CHALLENGE_LIMIT_REACHED',
      );
    }

    const now = new Date();
    const challenge = await Challenge.create({
      challengerFighterId: mine._id,
      challengedFighterId: target._id,
      status: 'pending',
      map: input.map,
      message: input.message,
      expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    });
    await notifyFighterOwner(target._id.toString(), 'challenge_received', challenge._id.toString());

    const populated = await Challenge.findById(challenge._id)
      .populate('challengerFighterId', 'displayName igUsername style rating')
      .populate('challengedFighterId', 'displayName igUsername style rating')
      .lean();
    return ok(
      {
        challenge: serializeChallenge(populated),
        sentToday: sentToday + 1,
        sentRemaining: DAILY_CHALLENGE_LIMIT - sentToday - 1,
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}

/** GET /api/challenges?box=in|out&status= — daftar tantangan saya. */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await connectDB();
    await expireStaleChallenges();

    const { searchParams } = new URL(req.url);
    const box = searchParams.get('box') ?? 'in';
    const status = searchParams.get('status');

    const mine = await myFighter(session.userId);
    if (!mine) {
      return ok({
        challenges: [],
        sentToday: 0,
        sentRemaining: DAILY_CHALLENGE_LIMIT,
        fightsRemaining: DAILY_FIGHT_LIMIT,
        hasFighter: false,
      });
    }

    const filter: Record<string, unknown> = {
      // Daftar ini khusus tantangan langsung; tantangan terbuka (kind
      // 'open') tinggal di /obrolan. $ne dipakai supaya dokumen lama
      // yang belum punya field kind tetap tampil.
      kind: { $ne: 'open' },
    };
    if (box === 'in') filter.challengedFighterId = mine._id;
    else if (box === 'out') filter.challengerFighterId = mine._id;
    else {
      filter.$or = [
        { challengedFighterId: mine._id },
        { challengerFighterId: mine._id },
      ];
    }
    if (status && (CHALLENGEABLE_STATUSES as readonly string[]).includes(status)) {
      filter.status = status;
    }

    const challenges = await Challenge.find(filter)
      .populate('challengerFighterId', 'displayName igUsername style rating')
      .populate('challengedFighterId', 'displayName igUsername style rating')
      .populate('gameFightId', 'status')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const sentToday = await countChallengesSentToday(mine._id.toString());
    const fightsToday = await countFightsToday(mine._id.toString());
    return ok({
      challenges: serialize(challenges),
      sentToday,
      sentRemaining: Math.max(0, DAILY_CHALLENGE_LIMIT - sentToday),
      fightsRemaining: Math.max(0, DAILY_FIGHT_LIMIT - fightsToday),
      hasFighter: true,
    });
  } catch (err) {
    return handleError(err);
  }
}
