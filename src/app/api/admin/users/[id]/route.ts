import type { NextRequest } from 'next/server';
import { checkOrigin, requireAdminApi } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { badRequest, forbidden, handleError, notFound, ok, parseJson } from '@/lib/http';
import { User } from '@/models/User';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/users/[id] { role? } — MVP: hanya ubah role user↔admin.
 * Fitur banned DITUNDA (jangan implementasi): body berisi `banned` → 400.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAdminApi(req);
    const { id } = await params;
    const body = await parseJson(req);
    await connectDB();

    const user = await User.findById(id);
    if (!user) throw notFound('User tidak ditemukan');

    if ('banned' in body) {
      throw badRequest('Fitur banned ditunda (MVP) — belum bisa dipakai');
    }
    if (body.role !== undefined) {
      if (body.role !== 'user' && body.role !== 'admin') {
        throw badRequest('role harus user atau admin');
      }
      user.role = body.role;
    }
    await user.save();

    await audit(
      session.userId,
      'user.update-role',
      'User',
      id,
      `Role ${user.username} → ${user.role}`,
    );
    return ok({
      user: { id: user._id.toString(), username: user.username, role: user.role },
    });
  } catch (err) {
    return handleError(err);
  }
}
