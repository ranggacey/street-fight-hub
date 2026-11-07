import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { ensureTitleCurrent } from '@/lib/game/title-service';
import { handleError, ok, serialize } from '@/lib/http';
import { TitleHistory } from '@/models/TitleHistory';

/** GET /api/title/history?page=&limit= — riwayat gelar, terbaru dulu. */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    await ensureTitleCurrent();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '20') || 20));
    const total = await TitleHistory.countDocuments();
    const events = await TitleHistory.find()
      .populate('previousHolderFighterId', 'displayName igUsername style')
      .populate('newHolderFighterId', 'displayName igUsername style')
      .populate('fightId', 'status')
      .sort({ at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return ok({
      events: serialize(events),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return handleError(err);
  }
}
