import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import {
  dateWIB,
  pointsForDay,
  validateSessionCounts,
} from '@/lib/game/training-rules';
import { forbidden, handleError, notFound, ok, parseJson } from '@/lib/http';
import { Fighter } from '@/models/Fighter';
import { FighterStats } from '@/models/FighterStats';
import { TrainingLog } from '@/models/TrainingLog';

/**
 * POST /api/training/session — kirim hitungan satu sesi latihan kamera.
 * Body { pushups, squats } = TAMBAHAN sesi ini (bukan total hari itu).
 * Server yang menegakkan cap harian (50 push-up / 30 squat, WIB) dan
 * menghitung poin (25 push-up = 1, 15 squat = 1, maks 4/hari).
 * Poin baru = selisih pointsForDay sebelum vs sesudah sesi ini.
 */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const body = await parseJson(req);
    await connectDB();

    const fighter = await Fighter.findOne({ userId: session.userId, status: 'active' });
    if (!fighter) throw notFound('Buat fighter dulu sebelum latihan');

    const today = dateWIB();
    let log = await TrainingLog.findOne({ fighterId: fighter._id, dateWIB: today });
    const todayPushups = log?.pushups ?? 0;
    const todaySquats = log?.squats ?? 0;
    const counts = validateSessionCounts(body.pushups, body.squats, todayPushups, todaySquats);

    if (!log) {
      log = new TrainingLog({ fighterId: fighter._id, dateWIB: today });
    }
    const oldPoints = pointsForDay(todayPushups, todaySquats);
    log.pushups = todayPushups + counts.pushups;
    log.squats = todaySquats + counts.squats;
    log.pointsEarned = pointsForDay(log.pushups, log.squats);
    await log.save();

    const deltaPoints = log.pointsEarned - oldPoints;
    let statsDoc = await FighterStats.findOne({ fighterId: fighter._id });
    if (!statsDoc) {
      statsDoc = new FighterStats({ fighterId: fighter._id });
    }
    statsDoc.pointsAvailable += deltaPoints;
    statsDoc.lifetime.pushups += counts.pushups;
    statsDoc.lifetime.squats += counts.squats;
    await statsDoc.save();

    return ok({
      today: {
        date: today,
        pushups: log.pushups,
        squats: log.squats,
        pointsEarned: log.pointsEarned,
      },
      pointsEarnedThisSession: deltaPoints,
      pointsAvailable: statsDoc.pointsAvailable,
      stats: statsDoc.stats,
      lifetime: statsDoc.lifetime,
    });
  } catch (err) {
    return handleError(err);
  }
}
