import type { NextRequest } from 'next/server';
import { checkOrigin, COOKIE_NAME, hashPassword, sessionCookieOptions, signToken } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { conflict, forbidden, handleError, ok, parseJson } from '@/lib/http';
import { validatePassword, validateUsername } from '@/lib/validation';
import { User } from '@/models/User';

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const body = await parseJson(req);
    const username = validateUsername(body.username);
    const password = validatePassword(body.password);
    await connectDB();

    const existing = await User.findOne({ username }).lean();
    if (existing) throw conflict('Username sudah dipakai');

    const passwordHash = await hashPassword(password);
    const user = await User.create({ username, passwordHash, role: 'user' });
    const token = await signToken({
      id: user._id.toString(),
      username: user.username,
      role: user.role,
    });

    const res = ok(
      { user: { id: user._id.toString(), username: user.username, role: user.role } },
      201,
    );
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions());
    return res;
  } catch (err) {
    return handleError(err);
  }
}
