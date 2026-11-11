import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { ACHIEVEMENT_CATALOG, achievementById } from '@/lib/game/achievement-catalog';
import { GEAR_CATALOG, gearById } from '@/lib/game/gear-catalog';
import { getOrCreateProgress, serializeProgress } from '@/lib/game/progress';
import { handleError, notFound, ok } from '@/lib/http';
import { Fighter } from '@/models/Fighter';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/fighters/[id]/progress — progres publik satu fighter:
 * level/XP, koin, gear yang dimiliki, achievement (terbuka + terkunci),
 * cedera aktif, streak. Dipakai seksi progres di halaman profil.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await connectDB();
    const fighter = await Fighter.findById(id).select('_id').lean();
    if (!fighter) throw notFound('Fighter tidak ditemukan');

    const progress = await getOrCreateProgress(id);
    const owned: string[] = (progress.gearOwned as string[] | undefined) ?? [];
    const unlocked: string[] = (progress.achievements as string[] | undefined) ?? [];
    return ok({
      progress: serializeProgress(progress),
      gear: owned
        .map((gid: string) => gearById(gid))
        .filter((g): g is NonNullable<typeof g> => Boolean(g)),
      gearCatalogOwned: GEAR_CATALOG.filter((g) => owned.includes(g.id)).map((g) => g.id),
      achievements: ACHIEVEMENT_CATALOG.map((a) => ({
        ...a,
        unlocked: unlocked.includes(a.id),
      })),
      achievementDefinitions: ACHIEVEMENT_CATALOG,
      unlockedAchievementDetails: unlocked
        .map((aid: string) => achievementById(aid))
        .filter((a): a is NonNullable<typeof a> => Boolean(a)),
    });
  } catch (err) {
    return handleError(err);
  }
}
