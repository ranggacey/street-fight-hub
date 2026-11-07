import type { NextRequest } from 'next/server';
import { checkOrigin, requireAdminApi } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { forbidden, handleError, ok, parseJson, serialize } from '@/lib/http';
import { validateAnnounceBody } from '@/lib/validation';
import { Announcement } from '@/models/Announcement';

/**
 * POST /api/admin/announce { text } — nonaktifkan pengumuman lama,
 * buat pengumuman baru yang active.
 */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAdminApi(req);
    const body = await parseJson(req);
    const text = validateAnnounceBody(body);
    await connectDB();

    await Announcement.updateMany({ active: true }, { $set: { active: false } });
    const announcement = await Announcement.create({
      text,
      active: true,
      createdBy: session.userId,
    });

    await audit(
      session.userId,
      'announcement.create',
      'Announcement',
      announcement._id.toString(),
      `Pengumuman baru: ${text}`,
    );
    return ok({ announcement: serialize(announcement.toObject()) }, 201);
  } catch (err) {
    return handleError(err);
  }
}
