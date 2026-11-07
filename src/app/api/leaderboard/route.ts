import { connectDB } from '@/lib/db';
import { ensureRecentSnapshot } from '@/lib/game/leaderboard';
import { handleError, ok } from '@/lib/http';

/**
 * GET /api/leaderboard — klasemen kasual (rating Elo + casualRecord).
 * Snapshot diambil lazy kalau belum ada snapshot 7 hari terakhir.
 */
export async function GET() {
  try {
    await connectDB();
    const snap = await ensureRecentSnapshot();
    return ok({
      entries: snap.entries,
      snapshotAt: snap.at.toISOString(),
      snapshotReason: snap.reason,
    });
  } catch (err) {
    return handleError(err);
  }
}
