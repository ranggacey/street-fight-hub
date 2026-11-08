import type { NextRequest } from 'next/server';
import JSZip from 'jszip';
import { requireAdminApi } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { badRequest, handleError } from '@/lib/http';
import { todayWibDateStr } from '@/lib/admin/fights';
import { listFightsForWibDate } from '@/lib/admin/fight-list';

/**
 * GET /api/admin/fights/posters-zip?date=YYYY-MM-DD — ZIP semua poster
 * fight hari itu (admin). Poster diambil dari posterDataUrl yang sudah
 * tersimpan di GameFight — TIDAK render ulang. Hanya fight yang punya
 * poster yang masuk ZIP. Nama file per poster:
 * `2026-11-08_pitung-vs-jamal-geng-sebelah_15-0.jpg`; nama ZIP:
 * `poster-2026-11-08.zip`.
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
    const zip = new JSZip();
    let count = 0;
    for (const f of fights) {
      if (!f.posterDataUrl) continue;
      const m = f.posterDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!m) continue;
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const name = f.posterFile.replace(/\.jpg$/, `.${ext}`);
      zip.file(name, m[2], { base64: true });
      count += 1;
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    return new Response(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="poster-${dateStr}.zip"`,
        'X-Poster-Count': String(count),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
