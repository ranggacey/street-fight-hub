import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { handleError, ok, serialize, serializeRecord } from '@/lib/http';
import { Fighter } from '@/models/Fighter';
import { User } from '@/models/User';

/** GET /api/admin/users?q= — list user ringkas + fighter-nya. */
export async function GET(req: NextRequest) {
  try {
    await requireAdminApi(req);
    await connectDB();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const filter: Record<string, unknown> = {};
    if (q) filter.username = { $regex: q, $options: 'i' };

    const users = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();
    const list = await Promise.all(
      users.map(async (u) => {
        const fighter = await Fighter.findOne({ userId: u._id }).lean();
        return { ...serializeRecord(u), fighter: fighter ? serialize(fighter) : null };
      }),
    );
    return ok({ users: list });
  } catch (err) {
    return handleError(err);
  }
}
