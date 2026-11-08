import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { badRequest, handleError, ok } from '@/lib/http';
import { todayWibDateStr } from '@/lib/admin/fights';
import { listFightsForWibDate } from '@/lib/admin/fight-list';

/**
 * GET /api/admin/fights?date=YYYY-MM-DD — daftar fight per hari WIB (admin).
 * Default tanggal = hari ini (WIB). Poster ikut dikembalikan (posterDataUrl)
 * untuk thumbnail + unduh satuan — TIDAK render ulang.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminApi(req);
    await connectDB();
    const dateStr = req.nextUrl.searchParams.get('date') || todayWibDateStr();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw badRequest('Format tanggal harus YYYY-MM-DD');
    }
    const fights = await listFightsForWibDate(dateStr);
    return ok({ date: dateStr, total: fights.length, fights });
  } catch (err) {
    return handleError(err);
  }
}
