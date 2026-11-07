import type { NextRequest } from 'next/server';
import { checkOrigin, requireAdminApi } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { forbidden, handleError, ok, parseJson, serialize } from '@/lib/http';
import { validateTournamentBody } from '@/lib/validation';
import { Tournament } from '@/models/Tournament';

/**
 * POST /api/admin/tournaments — buat turnamen.
 * Slug auto: night-fight-championship-N (N = nomor urut turnamen, mulai 1).
 * Guard: role admin + header x-admin-path == ADMIN_SLUG (kalau salah → 404).
 */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAdminApi(req);
    const body = await parseJson(req);
    const input = validateTournamentBody(body);
    await connectDB();

    let n = (await Tournament.countDocuments()) + 1;
    let slug = `night-fight-championship-${n}`;
    while (await Tournament.findOne({ slug }).lean()) {
      n += 1;
      slug = `night-fight-championship-${n}`;
    }

    const tournament = await Tournament.create({
      name: input.name,
      slug,
      format: 'single-elim',
      bracketSize: input.bracketSize,
      regOpenAt: input.regOpenAt,
      regCloseAt: input.regCloseAt,
      rules: input.rules,
      status: 'upcoming',
      championId: null,
      bracketSeed: null,
      createdBy: session.userId,
    });

    await audit(
      session.userId,
      'tournament.create',
      'Tournament',
      tournament._id.toString(),
      `Buat turnamen ${input.name} (${slug})`,
    );
    return ok({ tournament: serialize(tournament.toObject()) }, 201);
  } catch (err) {
    return handleError(err);
  }
}
