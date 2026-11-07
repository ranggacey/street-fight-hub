import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { handleError, ok, serialize } from '@/lib/http';
import { Fighter } from '@/models/Fighter';

/** GET /api/admin/fighters?q= — list fighter + search. */
export async function GET(req: NextRequest) {
  try {
    await requireAdminApi(req);
    await connectDB();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const filter: Record<string, unknown> = {};
    if (q) {
      const regex = { $regex: q, $options: 'i' };
      filter.$or = [{ displayName: regex }, { igUsername: regex }];
    }

    const fighters = await Fighter.find(filter)
      .populate('userId', 'username role')
      .sort({ createdAt: -1 })
      .lean();
    return ok({ fighters: serialize(fighters) });
  } catch (err) {
    return handleError(err);
  }
}
