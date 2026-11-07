import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { handleError, ok } from '@/lib/http';
import { Fighter } from '@/models/Fighter';
import { Tournament } from '@/models/Tournament';
import { User } from '@/models/User';
import { VideoTask } from '@/models/VideoTask';

/** GET /api/admin/stats — ringkasan dashboard admin. */
export async function GET(req: NextRequest) {
  try {
    await requireAdminApi(req);
    await connectDB();
    const [tournamentsLive, totalFighters, totalUsers, videoQueueDepth, pendingTasks] =
      await Promise.all([
        Tournament.countDocuments({ status: 'in_progress' }),
        Fighter.countDocuments(),
        User.countDocuments(),
        VideoTask.countDocuments({ status: 'queued' }),
        VideoTask.countDocuments({ status: { $in: ['queued', 'in_production'] } }),
      ]);
    return ok({ tournamentsLive, totalFighters, totalUsers, videoQueueDepth, pendingTasks });
  } catch (err) {
    return handleError(err);
  }
}
