import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { gearById } from '@/lib/game/gear-catalog';
import { getOrCreateProgress, serializeProgress } from '@/lib/game/progress';
import { badRequest, conflict, forbidden, handleError, ok, parseJson } from '@/lib/http';
import { Fighter } from '@/models/Fighter';

/**
 * POST /api/shop/buy { gearId } — beli gear kosmetik dengan koin.
 * Gear hanya membuka varian aksesoris (lihat gear-catalog.ts) — TIDAK
 * mengubah stat/damage. Pakai gear: PATCH /api/fighters/[id]
 * { accessories: { <part>: <variant> } } seperti biasa.
 */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const body = await parseJson(req);
    const gearId = body.gearId;
    if (typeof gearId !== 'string' || gearId.trim() === '') {
      throw badRequest('gearId wajib diisi');
    }
    const gear = gearById(gearId);
    if (!gear) throw badRequest(`Gear tidak ditemukan: ${gearId}`);
    await connectDB();

    const mine = await Fighter.findOne({ userId: session.userId });
    if (!mine) throw badRequest('Buat fighter dulu sebelum belanja', 'NO_FIGHTER');

    const progress = await getOrCreateProgress(mine._id.toString());
    if ((progress.gearOwned ?? []).includes(gear.id)) {
      throw conflict('Gear ini sudah kamu miliki', 'GEAR_ALREADY_OWNED');
    }
    if ((progress.coins ?? 0) < gear.price) {
      throw badRequest(
        `Koin tidak cukup — ${gear.label} butuh ${gear.price} koin, kamu punya ${progress.coins ?? 0}`,
        'COINS_NOT_ENOUGH',
      );
    }
    progress.coins -= gear.price;
    progress.gearOwned = [...(progress.gearOwned ?? []), gear.id];
    await progress.save();

    return ok({ gear, progress: serializeProgress(progress) });
  } catch (err) {
    return handleError(err);
  }
}
