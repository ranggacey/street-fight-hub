import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { conflict, forbidden, handleError, ok, parseJson, serialize } from '@/lib/http';
import { FIGHTER_STYLES, validateFighterBody } from '@/lib/validation';
import { Fighter } from '@/models/Fighter';

/** POST /api/fighters — buat fighter (auth, satu fighter aktif per user). */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const body = await parseJson(req);
    const input = validateFighterBody(body);
    await connectDB();

    const existing = await Fighter.findOne({ userId: session.userId }).lean();
    if (existing) throw conflict('Kamu sudah punya fighter');

    const fighter = await Fighter.create({
      userId: session.userId,
      ...input,
      aiPersona: null,
      record: { wins: 0, losses: 0, draws: 0, kos: 0 },
      status: 'active',
      regenCount: 0,
    });
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
      .lean();
    return ok({ fighters: serialize(fighters) });
  } catch (err) {
    return handleError(err);
  }
}
