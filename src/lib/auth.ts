import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { forbidden, notFound, unauthorized } from './http';

/**
 * Auth: bcryptjs (12 rounds) + JWT HS256 via jose + cookie httpOnly.
 * Cookie: `sfh_token`, SameSite=Lax, Secure di production, maxAge 30 hari.
 */

export const COOKIE_NAME = 'sfh_token';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 hari

export interface SessionUser {
  userId: string;
  username: string;
  role: 'user' | 'admin';
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET tidak dikonfigurasi');
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(user: {
  id: string;
  username: string;
  role: string;
}): Promise<string> {
  return new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());
}

function sessionFromToken(token: string | undefined | null): Promise<SessionUser | null> {
  return (async () => {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, getJwtSecret());
      const userId = typeof payload.sub === 'string' ? payload.sub : null;
      const username = typeof payload.username === 'string' ? payload.username : null;
      const role = payload.role === 'admin' ? 'admin' : 'user';
      if (!userId || !username) return null;
      return { userId, username, role };
    } catch {
      return null;
    }
  })();
}

/** Baca sesi dari cookie `sfh_token` (untuk Server Component). */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return sessionFromToken(store.get(COOKIE_NAME)?.value);
}

/** Baca sesi dari header Cookie request (untuk Route Handler — testable). */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const token = match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : null;
  return sessionFromToken(token);
}

/** Throw 401 jika tidak ada sesi valid. */
export async function requireAuth(req: NextRequest): Promise<SessionUser> {
  const session = await getSessionFromRequest(req);
  if (!session) throw unauthorized();
  return session;
}

/** Throw 401 jika tak login, 403 jika role bukan admin. */
export function requireAdmin(session: SessionUser | null): SessionUser {
  if (!session) throw unauthorized();
  if (session.role !== 'admin') throw forbidden('Hanya admin');
  return session;
}

/**
 * Guard gabungan untuk semua API admin:
 * (a) header `x-admin-path` harus == env ADMIN_SLUG, kalau tidak → 404
 *     (bukan 403, supaya path admin tidak bocor);
 * (b) lalu sesi harus ada (401) dan role admin (403).
 */
export async function requireAdminApi(req: NextRequest): Promise<SessionUser> {
  const slug = process.env.ADMIN_SLUG;
  const header = req.headers.get('x-admin-path');
  if (!slug || !header || header !== slug) throw notFound('Tidak ditemukan');
  const session = await getSessionFromRequest(req);
  if (!session) throw unauthorized();
  if (session.role !== 'admin') throw forbidden('Hanya admin');
  return session;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// Login throttling (in-memory): maks 5 percobaan gagal per username+IP
// per 15 menit → 429. (Reset saat VM restart — cukup untuk MVP.)
// ---------------------------------------------------------------------------

interface LoginAttempt {
  count: number;
  firstAt: number;
}

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, LoginAttempt>();

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function loginKey(username: string, ip: string): string {
  return `${username.toLowerCase()}:${ip}`;
}

export function isLoginThrottled(username: string, ip: string): boolean {
  const key = loginKey(username, ip);
  const rec = loginAttempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return false;
  }
  return rec.count >= LOGIN_MAX_ATTEMPTS;
}

export function recordFailedLogin(username: string, ip: string): void {
  const key = loginKey(username, ip);
  const rec = loginAttempts.get(key);
  if (!rec || Date.now() - rec.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAt: Date.now() });
  } else {
    rec.count += 1;
  }
}

export function resetLoginAttempts(username: string, ip: string): void {
  loginAttempts.delete(loginKey(username, ip));
}

// ---------------------------------------------------------------------------
// CSRF: cookie SameSite=Lax + cek Origin/Referer pada semua POST/PATCH/DELETE.
// Tolak jika origin ada dan host-nya bukan host sendiri.
// Request tanpa Origin (mis. curl/postman/server-to-server) diizinkan.
// ---------------------------------------------------------------------------

export function checkOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin') ?? req.headers.get('referer');
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (!host) return true;
    return originHost === host;
  } catch {
    return false;
  }
}
