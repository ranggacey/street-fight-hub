import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { checkChatRateLimit } from '@/lib/game/chat-rate';
import {
  forbidden,
  handleError,
  ok,
  parseJson,
  serialize,
  tooMany,
} from '@/lib/http';
import { validateChatText } from '@/lib/validation';
import { ChatMessage } from '@/models/ChatMessage';

/** GET /api/chat/messages?limit= — 50 pesan terakhir (urut kronologis). */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
    const messages = await ChatMessage.find()
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    // Balik: tampil kronologis (terlama dulu) supaya chat mengalir ke bawah.
    const ordered = [...messages].reverse();
    const shaped = (serialize(ordered) as Record<string, unknown>[]).map((m) => ({
      id: m.id,
      text: m.text,
      createdAt: m.createdAt,
      username:
        m.userId && typeof m.userId === 'object'
          ? (m.userId as Record<string, unknown>).username ?? '—'
          : '—',
    }));
    return ok({ messages: shaped });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/chat/messages — kirim pesan (auth, 1–500 karakter, rate limit). */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const body = await parseJson(req);
    const text = validateChatText(body);
    await connectDB();

    const rate = checkChatRateLimit(session.userId);
    if (!rate.allowed) {
      throw tooMany(
        `Terlalu cepat — tunggu ${Math.ceil(rate.retryAfterMs / 1000)} detik lagi`,
      );
    }

    const message = await ChatMessage.create({ userId: session.userId, text });
    return ok(
      {
        message: {
          id: message._id.toString(),
          text: message.text,
          createdAt: message.createdAt.toISOString(),
          username: session.username,
        },
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
