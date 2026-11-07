import type { NextRequest } from 'next/server';
import { checkOrigin, requireAdminApi } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { badRequest, forbidden, handleError, notFound, ok, parseJson, serialize } from '@/lib/http';
import { parseFighterPatch } from '@/lib/validation';
import { Fighter } from '@/models/Fighter';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/fighters/[id] — edit data fighter (moderasi admin). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAdminApi(req);
    const { id } = await params;
    const body = await parseJson(req);
    const patch = parseFighterPatch(body);
    await connectDB();

    const fighter = await Fighter.findById(id);
    if (!fighter) throw notFound('Fighter tidak ditemukan');

    if (patch.top.style === 'other') {
      const styleOther = patch.top.styleOther ?? fighter.styleOther;
      if (!styleOther) throw badRequest('Gaya lain wajib diisi');
      patch.top.styleOther = styleOther;
    }

    Object.assign(fighter, patch.top);
    await fighter.save();

    await audit(
      session.userId,
      'fighter.moderate',
      'Fighter',
      id,
      `Moderasi fighter ${fighter.displayName}`,
    );
    return ok({ fighter: serialize(fighter.toObject()) });
  } catch (err) {
    return handleError(err);
  }
}
