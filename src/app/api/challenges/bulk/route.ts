import { Types } from 'mongoose';
import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { expireStaleChallenges } from '@/lib/game/challenges';
import { notifyFighterOwner } from '@/lib/game/notify';
import {
  badRequest,
  forbidden,
  handleError,
  ok,
  parseJson,
  serialize,
} from '@/lib/http';
import { validateBulkChallengeBody } from '@/lib/validation';
import { Challenge } from '@/models/Challenge';
import { Fighter } from '@/models/Fighter';

type BulkResult =
  | {
      challengedFighterId: string;
      status: 'created';
      challengeId: string;
    }
  | {
      challengedFighterId: string;
      status: 'skipped';
      reason: 'CANNOT_CHALLENGE_SELF' | 'FIGHTER_NOT_FOUND' | 'CHALLENGE_ACTIVE_EXISTS';
      message: string;
    };

/**
 * POST /api/challenges/bulk — tantang BANYAK orang sekaligus (auth).
 * Satu kirim ke N lawan = SATU Challenge direct per lawan, semuanya
 * dalam satu batch (batchId sama). Hasil dilaporkan per lawan
 * (created vs skipped + alasan) — satu lawan gagal tidak menggagalkan
 * yang lain.
 *
 * Aturan per lawan (sama seperti tantangan langsung): bukan diri
 * sendiri, fighter valid + aktif, tidak ada tantangan aktif antara
 * kedua fighter (1 aktif per pasangan). Jatah tarung TIDAK dicek saat
 * pembuatan — dicek saat accept untuk kedua fighter, seperti biasa.
 * Tantangan UNLIMITED: tidak ada batas jumlah tantangan/hari.
 *
 * First-accept-wins: saat SATU challenge batch di-accept, sibling
 * pending lain otomatis batal — lihat /api/challenges/[id]/accept.
 */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const body = await parseJson(req);
    const input = validateBulkChallengeBody(body);
    await connectDB();
    await expireStaleChallenges();

    const mine = await Fighter.findOne({ userId: session.userId, status: 'active' });
    if (!mine) throw badRequest('Buat fighter dulu sebelum menantang');

    const batchId = new Types.ObjectId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const results: BulkResult[] = [];
    for (const opponentId of input.opponentIds) {
      if (opponentId === mine._id.toString()) {
        results.push({
          challengedFighterId: opponentId,
          status: 'skipped',
          reason: 'CANNOT_CHALLENGE_SELF',
          message: 'Tidak bisa menantang fighter sendiri',
        });
        continue;
      }
      const target = await Fighter.findById(opponentId);
      if (!target || target.status !== 'active') {
        results.push({
          challengedFighterId: opponentId,
          status: 'skipped',
          reason: 'FIGHTER_NOT_FOUND',
          message: 'Fighter yang ditantang tidak ditemukan',
        });
        continue;
      }
      const active = await Challenge.findOne({
        status: 'pending',
        $or: [
          { challengerFighterId: mine._id, challengedFighterId: target._id },
          { challengerFighterId: target._id, challengedFighterId: mine._id },
        ],
      });
      if (active) {
        results.push({
          challengedFighterId: opponentId,
          status: 'skipped',
          reason: 'CHALLENGE_ACTIVE_EXISTS',
          message: 'Sudah ada tantangan aktif antara kedua fighter ini',
        });
        continue;
      }
      const challenge = await Challenge.create({
        challengerFighterId: mine._id,
        challengedFighterId: target._id,
        kind: 'direct',
        status: 'pending',
        batchId,
        map: input.map,
        message: input.message,
        expiresAt,
      });
      await notifyFighterOwner(
        target._id.toString(),
        'challenge_received',
        challenge._id.toString(),
      );
      results.push({
        challengedFighterId: opponentId,
        status: 'created',
        challengeId: challenge._id.toString(),
      });
    }

    const created = results.filter((r) => r.status === 'created').length;
    return ok(
      {
        batchId: batchId.toString(),
        results: serialize(results),
        created,
        skipped: results.length - created,
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
