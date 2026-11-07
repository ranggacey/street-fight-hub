import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { forbidden, handleError, ok, parseJson, serialize } from '@/lib/http';
import { Notification } from '@/models/Notification';

/** GET /api/notifications?unread=1 — notifikasi saya, terbaru dulu. */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await connectDB();
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') === '1';
    const filter: Record<string, unknown> = { userId: session.userId };
    if (unreadOnly) filter.read = false;
    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(50).lean(),
      Notification.countDocuments({ userId: session.userId, read: false }),
    ]);
    return ok({ notifications: serialize(notifications), unreadCount });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/notifications { action: 'read', ids?: string[] } | { action: 'read-all' }
 * — tandai sudah dibaca. Hanya notifikasi milik caller yang berubah
 * (filter userId di query — tidak bisa menandai notifikasi orang lain).
 */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const body = await parseJson(req);
    await connectDB();

    const action = body.action;
    if (action === 'read-all') {
      const res = await Notification.updateMany(
        { userId: session.userId, read: false },
        { $set: { read: true } },
      );
      return ok({ marked: res.modifiedCount ?? 0 });
    }
    if (action === 'read') {
      const ids = Array.isArray(body.ids) ? body.ids : [];
      const clean = ids.filter(
        (v): v is string => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v),
      );
      if (clean.length === 0) {
        return ok({ marked: 0 });
      }
      const res = await Notification.updateMany(
        { userId: session.userId, _id: { $in: clean } },
        { $set: { read: true } },
      );
      return ok({ marked: res.modifiedCount ?? 0 });
    }
    return ok({ marked: 0 });
  } catch (err) {
    return handleError(err);
  }
}
