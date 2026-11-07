import type { NextRequest } from 'next/server';
import { checkOrigin, requireAdminApi } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { badRequest, forbidden, handleError, notFound, ok, parseJson, serialize } from '@/lib/http';
import { isValidInstagramReelUrl } from '@/lib/validation';
import { Match } from '@/models/Match';
import { VideoTask } from '@/models/VideoTask';

type Ctx = { params: Promise<{ id: string }> };

const TASK_STATUSES = ['queued', 'in_production', 'uploaded', 'blocked'];

/**
 * PATCH /api/admin/video-tasks/[id] { status, reelUrl?, note? }
 * - 'uploaded' wajib reelUrl (URL instagram.com/reel atau /p); set match
 *   reelUrl + status 'video_done'.
 * - 'blocked' wajib note.
 * - 'in_production' tanpa syarat.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAdminApi(req);
    const { id } = await params;
    const body = await parseJson(req);
    await connectDB();

    const task = await VideoTask.findById(id);
    if (!task) throw notFound('Video task tidak ditemukan');

    const status = body.status;
    if (typeof status !== 'string' || !TASK_STATUSES.includes(status)) {
      throw badRequest('status harus queued, in_production, uploaded, atau blocked');
    }

    const reelUrl = typeof body.reelUrl === 'string' ? body.reelUrl.trim() : null;
    const note = typeof body.note === 'string' ? body.note.trim() : null;

    if (status === 'uploaded') {
      if (!reelUrl || !isValidInstagramReelUrl(reelUrl)) {
        throw badRequest('Status uploaded wajib menyertakan URL Reel Instagram yang valid (instagram.com/reel atau /p)');
      }
    }
    if (status === 'blocked' && !note) {
      throw badRequest('Status blocked wajib menyertakan note');
    }

    task.status = status;
    if (reelUrl !== null) task.reelUrl = reelUrl;
    if (note !== null) task.note = note;
    await task.save();

    if (status === 'uploaded' && reelUrl) {
      const match = await Match.findById(task.matchId);
      if (match) {
        match.reelUrl = reelUrl;
        match.status = 'video_done';
        await match.save();
      }
    }

    await audit(
      session.userId,
      'video-task.update',
      'VideoTask',
      id,
      `Video task ${task.matchId} → ${status}`,
    );
    return ok({ videoTask: serialize(task.toObject()) });
  } catch (err) {
    return handleError(err);
  }
}
