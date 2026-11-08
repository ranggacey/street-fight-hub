import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { fightsRemainingToday } from '@/lib/game/daily-limit';
import { handleError, ok, serialize } from '@/lib/http';
import { Fighter } from '@/models/Fighter';
import { GameFight } from '@/models/GameFight';

/** GET /api/fights/mine — riwayat fight saya + sisa jatah hari ini. */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await connectDB();
    const mine = await Fighter.findOne({ userId: session.userId }).select('_id');
    if (!mine) {
      return ok({ fights: [], fightsRemaining: 3, hasFighter: false });
    }
    const fights = await GameFight.find({
      $or: [{ fighterAId: mine._id }, { fighterBId: mine._id }],
    })
      .populate('fighterAId', 'displayName igUsername style')
      .populate('fighterBId', 'displayName igUsername style')
      // Riwayat profil hanya memakai hasil + lawan + status (lihat
      // lib/profile.ts summarizeMyFight) — config engine, poster base64,
      // dan keyMoments TIDAK dikirim: satu fight penuh ~9 KB, tanpa
      // ketiganya ~0,3 KB (diukur lokal, 29x lebih kecil).
      .select('-config -posterDataUrl -keyMoments')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const fightsRemaining = await fightsRemainingToday(mine._id.toString());
    return ok({ fights: serialize(fights), fightsRemaining, hasFighter: true });
  } catch (err) {
    return handleError(err);
  }
}
