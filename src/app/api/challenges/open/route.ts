import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { expireStaleChallenges } from '@/lib/game/challenges';
import { DAILY_FIGHT_LIMIT } from '@/lib/game/daily-limit';
import {
  badRequest,
  conflict,
  forbidden,
  handleError,
  ok,
  parseJson,
  serialize,
} from '@/lib/http';
import { Challenge } from '@/models/Challenge';
import { Fighter } from '@/models/Fighter';

const ARENA_MAPS = ['ring', 'gudang', 'jalanan', 'dojo'] as const;
type ArenaMap = (typeof ARENA_MAPS)[number];

async function myFighter(sessionUserId: string) {
  return Fighter.findOne({ userId: sessionUserId, status: 'active' });
}

function serializeChallenge(c: unknown): Record<string, unknown> {
  return serialize(c) as Record<string, unknown>;
}

/**
 * Validasi body tantangan terbuka — inline di route ini (bukan
 * validateChallengeBody) karena validator itu mewajibkan
 * challengedFighterId, sementara tantangan terbuka memang tidak punya
 * target. Aturan map/pesan disamakan dengan tantangan langsung.
 */
function parseOpenChallengeBody(body: Record<string, unknown>): {
  map: ArenaMap;
  message: string | null;
} {
  let map: ArenaMap = 'ring';
  if (body.map !== undefined && body.map !== null) {
    if (typeof body.map !== 'string' || !(ARENA_MAPS as readonly string[]).includes(body.map)) {
      throw badRequest(`Map tidak valid: ${String(body.map)}`);
    }
    map = body.map as ArenaMap;
  }
  let message: string | null = null;
  if (body.message !== undefined && body.message !== null) {
    if (typeof body.message !== 'string') throw badRequest('Pesan tantangan harus berupa string');
    message = body.message.trim();
    if (message.length > 140) throw badRequest('Pesan tantangan maksimal 140 karakter');
    if (message === '') message = null;
  }
  return { map, message };
}

/**
 * POST /api/challenges/open — buat tantangan TERBUKA (auth).
 * Satu open aktif per fighter. Tantangan UNLIMITED (perintah user
 * 9 Nov 2026): tidak ada batas tantangan/hari; jatah tarung 3/hari
 * tetap dicek saat accept.
 */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const body = await parseJson(req);
    const input = parseOpenChallengeBody(body);
    await connectDB();
    await expireStaleChallenges();

    const mine = await myFighter(session.userId);
    if (!mine) throw badRequest('Buat fighter dulu sebelum menantang');

    const activeOpen = await Challenge.findOne({
      challengerFighterId: mine._id,
      kind: 'open',
      status: 'pending',
    });
    if (activeOpen) {
      throw conflict(
        'Kamu sudah punya tantangan terbuka yang masih aktif — tunggu ada yang menerima atau sampai kedaluwarsa',
        'OPEN_CHALLENGE_ACTIVE_EXISTS',
      );
    }

    const now = new Date();
    const challenge = await Challenge.create({
      challengerFighterId: mine._id,
      challengedFighterId: null,
      kind: 'open',
      status: 'pending',
      map: input.map,
      message: input.message,
      expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    });

    const populated = await Challenge.findById(challenge._id)
      .populate('challengerFighterId', 'displayName igUsername style rating')
      .lean();
    return ok(
      {
        challenge: serializeChallenge(populated),
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}

/**
 * GET /api/challenges/open — daftar tantangan terbuka yang masih bisa
 * diterima (kind 'open', status 'pending'). Publik: siapa pun boleh
 * melihat — yang butuh login hanya membuat & menerima.
 */
export async function GET() {
  try {
    await connectDB();
    await expireStaleChallenges();

    const challenges = await Challenge.find({ kind: 'open', status: 'pending' })
      .populate('challengerFighterId', 'displayName igUsername style rating')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return ok({
      challenges: serialize(challenges),
      fightsRemaining: DAILY_FIGHT_LIMIT,
    });
  } catch (err) {
    return handleError(err);
  }
}
