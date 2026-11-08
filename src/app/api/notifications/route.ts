import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { forbidden, handleError, ok, parseJson, serialize } from '@/lib/http';
import { Challenge } from '@/models/Challenge';
import { Notification } from '@/models/Notification';

/**
 * Detail tantangan untuk popup notifikasi: nama penantang + nama yang
 * ditantang (bila ada — tantangan terbuka belum punya yang ditantang).
 * Model Notification hanya menyimpan type + relatedId, jadi nama
 * diambil di sini dari Challenge terkait; tanpa ini popup hanya bisa
 * menampilkan kalimat generik tanpa nama fighter.
 */
async function challengeDetailsById(
  relatedIds: string[],
): Promise<Record<string, { challengerName: string | null; challengedName: string | null; kind: string | null; map: string | null }>> {
  const out: Record<string, { challengerName: string | null; challengedName: string | null; kind: string | null; map: string | null }> = {};
  if (relatedIds.length === 0) return out;
  const challenges = await Challenge.find({ _id: { $in: relatedIds } })
    .populate('challengerFighterId', 'displayName')
    .populate('challengedFighterId', 'displayName')
    .lean();
  for (const c of challenges) {
    const challenger = c.challengerFighterId as unknown as { displayName?: string } | null;
    const challenged = c.challengedFighterId as unknown as { displayName?: string } | null;
    out[c._id.toString()] = {
      challengerName: challenger?.displayName ?? null,
      challengedName: challenged?.displayName ?? null,
      kind: typeof c.kind === 'string' ? c.kind : null,
      map: typeof c.map === 'string' ? c.map : null,
    };
  }
  return out;
}

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
    const serialized = serialize(notifications) as Array<Record<string, unknown>>;
    // Lampirkan detail hanya untuk notifikasi tantangan (relatedId =
    // Challenge). Jenis lain (fight_result/title) tetap tanpa detail —
    // popup tantangan tidak memakainya.
    const challengeIds = serialized
      .filter(
        (n) =>
          typeof n.type === 'string' &&
          n.type.startsWith('challenge_') &&
          typeof n.relatedId === 'string' &&
          n.relatedId !== '',
      )
      .map((n) => n.relatedId as string);
    const details = await challengeDetailsById(challengeIds);
    for (const n of serialized) {
      if (typeof n.relatedId === 'string' && details[n.relatedId]) {
        n.detail = details[n.relatedId];
      }
    }
    return ok({ notifications: serialized, unreadCount });
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
