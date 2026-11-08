import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { conflict, forbidden, handleError, ok, parseJson, serialize } from '@/lib/http';
import { resolveFighterColors } from '@/lib/game/engine-config';
import { FIGHTER_STYLES, validateFighterBody } from '@/lib/validation';
import { Fighter } from '@/models/Fighter';

/** POST /api/fighters — buat fighter (auth, satu fighter aktif per user,
 * username IG unik case-insensitive). */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const body = await parseJson(req);
    const input = validateFighterBody(body);
    await connectDB();

    const existing = await Fighter.findOne({ userId: session.userId }).lean();
    if (existing) throw conflict('Kamu sudah punya fighter', 'FIGHTER_EXISTS');

    // Username IG tidak boleh diduplikat (case-insensitive): satu handle
    // IG hanya boleh dipakai satu fighter. Dicek di sini untuk pesan
    // error yang jelas; unique index di skema adalah penegak terakhir
    // (race dua request bersamaan tetap ditolak 409, bukan 500).
    const igTaken = await Fighter.findOne({ igUsername: input.igUsername })
      .collation({ locale: 'en', strength: 2 })
      .lean();
    if (igTaken) {
      throw conflict('Username Instagram sudah dipakai fighter lain', 'IG_USERNAME_TAKEN');
    }

    let fighter;
    try {
      fighter = await Fighter.create({
        userId: session.userId,
        displayName: input.displayName,
        igUsername: input.igUsername,
        style: input.style,
        styleOther: input.styleOther,
        selfDescription: input.selfDescription,
        record: { wins: 0, losses: 0, draws: 0, kos: 0 },
        status: 'active',
        rating: 1000,
        casualRecord: { wins: 0, losses: 0, draws: 0, kos: 0 },
        signatureMove: input.game.signatureMove,
        tempo: input.game.tempo,
        colors: resolveFighterColors({
          displayName: input.displayName,
          style: input.style,
          colors: input.game.colors,
        }),
        ...(Object.keys(input.game.accessories).length > 0
          ? { accessories: input.game.accessories }
          : {}),
      });
    } catch (err) {
      if ((err as { code?: unknown })?.code === 11000) {
        // Race: seseorang membuat fighter dengan userId/igUsername yang
        // sama di antara cek di atas dan insert. Bedakan penyebabnya
        // supaya pesannya tepat (bukan 500 dari handleError).
        const byUser = await Fighter.findOne({ userId: session.userId }).lean();
        if (byUser) throw conflict('Kamu sudah punya fighter', 'FIGHTER_EXISTS');
        throw conflict('Username Instagram sudah dipakai fighter lain', 'IG_USERNAME_TAKEN');
      }
      throw err;
    }
    return ok({ fighter: serialize(fighter.toObject()) }, 201);
  } catch (err) {
    return handleError(err);
  }
}

/** GET /api/fighters?sort=wins&style= — klasemen (wins desc, kos desc, losses asc). */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const style = searchParams.get('style');
    const filter: Record<string, unknown> = { status: 'active' };
    if (style && (FIGHTER_STYLES as readonly string[]).includes(style)) {
      filter.style = style;
    }
    const fighters = await Fighter.find(filter)
      .sort({ 'record.wins': -1, 'record.kos': -1, 'record.losses': 1, createdAt: 1 })
      // Dibatasi 100 baris: daftar ini dipakai klasemen + pencarian fighter
      // sendiri di beberapa halaman. Projection TIDAK dipakai — form
      // fighter-saya mengisi semua field (deskripsi, jurus, tempo, warna,
      // aksesoris) dari satu baris daftar ini, jadi field harus lengkap.
      .limit(100)
      .lean();
    return ok({ fighters: serialize(fighters) });
  } catch (err) {
    return handleError(err);
  }
}
