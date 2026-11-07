import { COOKIE_NAME, sessionCookieOptions } from '@/lib/auth';
import { ok } from '@/lib/http';

export async function POST() {
  const res = ok({ loggedOut: true });
  res.cookies.set(COOKIE_NAME, '', { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
