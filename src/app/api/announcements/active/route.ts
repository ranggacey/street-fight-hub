import { connectDB } from '@/lib/db';
import { handleError, ok, serialize } from '@/lib/http';
import { Announcement } from '@/models/Announcement';

/** GET /api/announcements/active — pengumuman aktif (publik) atau null. */
export async function GET() {
  try {
    await connectDB();
    const announcement = await Announcement.findOne({ active: true })
      .sort({ createdAt: -1 })
      .lean();
    return ok({ announcement: announcement ? serialize(announcement) : null });
  } catch (err) {
    return handleError(err);
  }
}
