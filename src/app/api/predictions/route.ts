import type { NextRequest } from 'next/server';
import { checkOrigin, getSessionFromRequest, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { getOrCreateProgress, PREDICTION_STAKE } from '@/lib/game/progress';
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
import { Fighter } from '@/models/Fighter';
import { GameFight } from '@/models/GameFight';
import { Match } from '@/models/Match';
import { Prediction } from '@/models/Prediction';

/**
 * Prediksi penonton — taruhan 10 koin atas pemenang satu fight.
 * Benar → +20 koin (stake kembali + 10 untung); salah → stake hangus.
 * Resolusi di resolvePredictions() (progress.ts), dipanggil saat hasil
 * fight tercatat (result route GameFight + decideMatch turnamen).
 *
 * GET /api/predictions?fightId=&kind= → hitungan per fighter +
 *   prediksi saya (kalau login). kind: 'game' | 'tournament'.
 * POST /api/predictions { fightId, kind, predictedWinnerFighterId }
 *   → potong 10 koin, buat prediksi (satu per user per fight).
 */

async function fightParticipants(
  fightId: string,
  kind: 'game' | 'tournament',
): Promise<{ fighterAId: string; fighterBId: string | null; open: boolean } | null> {
  if (kind === 'game') {
    const f = await GameFight.findById(fightId).select('fighterAId fighterBId status').lean();
    if (!f) return null;
    return {
      fighterAId: f.fighterAId.toString(),
      fighterBId: f.fighterBId ? f.fighterBId.toString() : null,
      open: f.status === 'pending' || f.status === 'playing',
    };
  }
  const m = await Match.findById(fightId).select('fighterAId fighterBId status').lean();
  if (!m) return null;
  return {
    fighterAId: m.fighterAId.toString(),
    fighterBId: m.fighterBId ? m.fighterBId.toString() : null,
    open: m.status === 'scheduled',
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fightId = searchParams.get('fightId');
    const kind = searchParams.get('kind');
    if (!fightId || (kind !== 'game' && kind !== 'tournament')) {
      throw badRequest('fightId dan kind (game/tournament) wajib diisi');
    }
    await connectDB();
    const rows = await Prediction.find({ fightId, kind })
      .select('predictedWinnerFighterId status userId')
      .lean();
    const counts: Record<string, number> = {};
    for (const r of rows) {
      if (r.status !== 'open') continue;
      const key = r.predictedWinnerFighterId.toString();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    let myPrediction: unknown = null;
    const session = await getSessionFromRequest(req).catch(() => null);
    if (session) {
      const mine = rows.find((r) => r.userId.toString() === session.userId);
      myPrediction = mine ? serialize(mine) : null;
    }
    return ok({ fightId, kind, counts, total: rows.filter((r) => r.status === 'open').length, myPrediction });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const body = await parseJson(req);
    const fightId = body.fightId;
    const kind = body.kind;
    const predictedWinnerFighterId = body.predictedWinnerFighterId;
    if (typeof fightId !== 'string' || fightId.trim() === '') {
      throw badRequest('fightId wajib diisi');
    }
    if (kind !== 'game' && kind !== 'tournament') {
      throw badRequest('kind harus game atau tournament');
    }
    if (typeof predictedWinnerFighterId !== 'string' || predictedWinnerFighterId.trim() === '') {
      throw badRequest('predictedWinnerFighterId wajib diisi');
    }
    await connectDB();

    const fight = await fightParticipants(fightId, kind);
    if (!fight) throw notFound('Fight tidak ditemukan');
    if (!fight.open) {
      throw conflict('Fight ini sudah selesai — prediksi ditutup', 'PREDICTION_CLOSED');
    }
    if (
      predictedWinnerFighterId !== fight.fighterAId &&
      predictedWinnerFighterId !== fight.fighterBId
    ) {
      throw badRequest('Fighter yang diprediksi bukan peserta fight ini');
    }

    const mine = await Fighter.findOne({ userId: session.userId });
    if (!mine) throw badRequest('Buat fighter dulu sebelum memprediksi', 'NO_FIGHTER');

    const existing = await Prediction.findOne({ fightId, kind, userId: session.userId }).lean();
    if (existing) {
      throw conflict('Kamu sudah memprediksi fight ini', 'PREDICTION_EXISTS');
    }

    const progress = await getOrCreateProgress(mine._id.toString());
    if ((progress.coins ?? 0) < PREDICTION_STAKE) {
      throw badRequest(
        `Koin tidak cukup — prediksi butuh ${PREDICTION_STAKE} koin, kamu punya ${progress.coins ?? 0}`,
        'COINS_NOT_ENOUGH',
      );
    }
    progress.coins -= PREDICTION_STAKE;
    await progress.save();

    let prediction;
    try {
      prediction = await Prediction.create({
        fightId,
        kind,
        userId: session.userId,
        predictedWinnerFighterId,
        stake: PREDICTION_STAKE,
        status: 'open',
        payout: 0,
      });
    } catch (err) {
      // Race: prediksi ganda bersamaan — kembalikan koin.
      if ((err as { code?: unknown })?.code === 11000) {
        progress.coins += PREDICTION_STAKE;
        await progress.save();
        throw conflict('Kamu sudah memprediksi fight ini', 'PREDICTION_EXISTS');
      }
      throw err;
    }

    return ok({ prediction: serialize(prediction.toObject()), coins: progress.coins }, 201);
  } catch (err) {
    return handleError(err);
  }
}
