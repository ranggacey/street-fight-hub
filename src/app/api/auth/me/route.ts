import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { handleError, ok, unauthorized } from '@/lib/http';
import { User } from '@/models/User';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) throw unauthorized();
    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user) throw unauthorized();
    return ok({ user: { id: user._id.toString(), username: user.username, role: user.role } });
  } catch (err) {
    return handleError(err);
  }
}
