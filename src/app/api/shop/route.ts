import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { GEAR_CATALOG } from '@/lib/game/gear-catalog';
import { getOrCreateProgress } from '@/lib/game/progress';
import { handleError, ok } from '@/lib/http';
import { Fighter } from '@/models/Fighter';

/**
 * GET /api/shop — katalog gear + (kalau login) koin & gear milikku.
 * Katalog publik; owned/coins hanya kalau ada sesi + fighter.
 * Gear KOSMETIK SAJA — tidak ada efek stat/damage.
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const session = await getSessionFromRequest(req).catch(() => null);
    let coins: number | null = null;
    let gearOwned: string[] = [];
    let myFighterId: string | null = null;
    if (session) {
      const mine = await Fighter.findOne({ userId: session.userId }).select('_id').lean();
      if (mine && mine._id) {
        const fighterId = mine._id.toString();
        myFighterId = fighterId;
        const progress = await getOrCreateProgress(fighterId);
        coins = progress.coins ?? 0;
        gearOwned = progress.gearOwned ?? [];
      }
    }
    return ok({ catalog: GEAR_CATALOG, coins, gearOwned, myFighterId });
  } catch (err) {
    return handleError(err);
  }
}
