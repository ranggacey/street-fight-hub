import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getRivalry, rivalryLabel } from '@/lib/game/rivalry';
import { badRequest, handleError, notFound, ok } from '@/lib/http';
import { Fighter } from '@/models/Fighter';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/fighters/[id]/rivalry?opponentId= — head-to-head dua fighter
 * (GameFight selesai + match turnamen yang diputuskan).
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const opponentId = searchParams.get('opponentId');
    if (!opponentId) throw badRequest('opponentId wajib diisi');
    if (opponentId === id) throw badRequest('opponentId harus fighter lain');
    await connectDB();
    const [a, b] = await Promise.all([
      Fighter.findById(id).select('_id displayName').lean(),
      Fighter.findById(opponentId).select('_id displayName').lean(),
    ]);
    if (!a || !b) throw notFound('Fighter tidak ditemukan');

    const rivalry = await getRivalry(id, opponentId);
    return ok({
      rivalry,
      label: rivalryLabel(rivalry),
      fighterA: { id: a._id.toString(), displayName: a.displayName },
      fighterB: { id: b._id.toString(), displayName: b.displayName },
    });
  } catch (err) {
    return handleError(err);
  }
}
