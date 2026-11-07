import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { handleError, ok, serialize } from '@/lib/http';
import { VideoTask } from '@/models/VideoTask';

const TASK_STATUSES = ['queued', 'in_production', 'uploaded', 'blocked'];

/** GET /api/admin/video-tasks?status= — list + match + fighter ringkas. */
export async function GET(req: NextRequest) {
  try {
    await requireAdminApi(req);
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const filter: Record<string, unknown> = {};
    if (status && TASK_STATUSES.includes(status)) filter.status = status;

    const tasks = await VideoTask.find(filter)
      .populate({
        path: 'matchId',
        populate: [
          { path: 'fighterAId', select: 'displayName igUsername' },
          { path: 'fighterBId', select: 'displayName igUsername' },
          { path: 'tournamentId', select: 'name slug' },
        ],
      })
      // Title fight (game) tidak punya matchId — populate lewat gameFightId.
      .populate({
        path: 'gameFightId',
        populate: [
          { path: 'fighterAId', select: 'displayName igUsername' },
          { path: 'fighterBId', select: 'displayName igUsername' },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();
    return ok({ videoTasks: serialize(tasks) });
  } catch (err) {
    return handleError(err);
  }
}
