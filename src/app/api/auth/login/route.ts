import type { NextRequest } from 'next/server';
import {
  checkOrigin,
  COOKIE_NAME,
  getClientIp,
  isLoginThrottled,
  recordFailedLogin,
  resetLoginAttempts,
  sessionCookieOptions,
  signToken,
  verifyPassword,
} from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { forbidden, handleError, ok, parseJson, tooMany, unauthorized } from '@/lib/http';
import { User } from '@/models/User';

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const body = await parseJson(req);
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password) throw unauthorized('Username atau password salah');

    const ip = getClientIp(req);
    if (isLoginThrottled(username, ip)) {
      throw tooMany('Terlalu banyak percobaan login gagal, coba lagi dalam 15 menit');
    }

    await connectDB();
    const user = await User.findOne({ username });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      recordFailedLogin(username, ip);
      throw unauthorized('Username atau password salah');
    }

    resetLoginAttempts(username, ip);
    user.lastLoginAt = new Date();
    await user.save();

    const token = await signToken({
      id: user._id.toString(),
      username: user.username,
      role: user.role,
    });
    const res = ok({ user: { id: user._id.toString(), username: user.username, role: user.role } });
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions());
    return res;
  } catch (err) {
    return handleError(err);
  }
}
