import type { NextRequest } from 'next/server';
import { checkOrigin, requireAdminApi } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { badRequest, forbidden, handleError, notFound, ok, parseJson, serialize } from '@/lib/http';
import { Tournament } from '@/models/Tournament';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/tournaments/[id] — edit name/rules/window;
 * body { action: 'close' } → status 'closed';
 * body { action: 'cancel' } → status 'cancelled' (hanya jika belum in_progress).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAdminApi(req);
    const { id } = await params;
    const body = await parseJson(req);
    await connectDB();

    const tournament = await Tournament.findById(id);
    if (!tournament) throw notFound('Turnamen tidak ditemukan');

    if (body.action === 'close') {
      tournament.status = 'closed';
      await tournament.save();
      await audit(session.userId, 'tournament.close', 'Tournament', id, `Tutup pendaftaran ${tournament.name}`);
      return ok({ tournament: serialize(tournament.toObject()) });
    }

    if (body.action === 'cancel') {
      if (tournament.status === 'in_progress') {
        throw badRequest('Turnamen yang sedang berjalan tidak bisa dibatalkan');
      }
      tournament.status = 'cancelled';
      await tournament.save();
      await audit(session.userId, 'tournament.cancel', 'Tournament', id, `Batalkan turnamen ${tournament.name}`);
      return ok({ tournament: serialize(tournament.toObject()) });
    }

    if (typeof body.name === 'string' && body.name.trim() !== '') {
      if (body.name.trim().length < 3 || body.name.trim().length > 100) {
        throw badRequest('Nama turnamen harus 3-100 karakter');
      }
      tournament.name = body.name.trim();
    }
    if (typeof body.rules === 'string') {
      if (body.rules.length > 5000) throw badRequest('Rules maksimal 5000 karakter');
      tournament.rules = body.rules;
    }
    if (body.regOpenAt !== undefined) {
      const date = new Date(String(body.regOpenAt));
      if (Number.isNaN(date.getTime())) throw badRequest('regOpenAt harus tanggal yang valid');
      tournament.regOpenAt = date;
    }
    if (body.regCloseAt !== undefined) {
      const date = new Date(String(body.regCloseAt));
      if (Number.isNaN(date.getTime())) throw badRequest('regCloseAt harus tanggal yang valid');
      tournament.regCloseAt = date;
    }
    if (tournament.regCloseAt.getTime() <= tournament.regOpenAt.getTime()) {
      throw badRequest('regCloseAt harus setelah regOpenAt');
    }

    await tournament.save();
    await audit(session.userId, 'tournament.update', 'Tournament', id, `Edit turnamen ${tournament.name}`);
    return ok({ tournament: serialize(tournament.toObject()) });
  } catch (err) {
    return handleError(err);
  }
}
