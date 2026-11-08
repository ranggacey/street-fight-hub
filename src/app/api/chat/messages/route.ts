import type { NextRequest } from 'next/server';
import { checkOrigin, getClientIp, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { checkChatRateLimit } from '@/lib/game/chat-rate';
import { checkRateLimit } from '@/lib/rate-limit';
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
import { Fighter } from '@/models/Fighter';

/**
 * Identitas fighter untuk satu pesan chat (PP + nama di client).
 * Bentuknya sama dengan `ChatFighterIdentity` di components/types.ts.
 */
export interface ChatFighterShape {
  displayName: string;
  style?: string;
  colors?: Record<string, unknown> | null;
  accessories?: Record<string, unknown> | null;
}

/** Ambil fighter (displayName, style, colors, accessories) per userId. */
async function fighterByUserId(
  userIds: string[],
): Promise<Map<string, ChatFighterShape>> {
  const map = new Map<string, ChatFighterShape>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const fighters = (await Fighter.find({ userId: { $in: ids } })
    .select('userId displayName style colors accessories')
    .lean()) as Record<string, unknown>[];
  for (const f of fighters) {
    const uid =
      typeof f.userId === 'string'
        ? f.userId
        : (f.userId as { toString?: () => string } | null)?.toString?.() ?? '';
    if (!uid || typeof f.displayName !== 'string') continue;
    map.set(uid, {
      displayName: f.displayName,
      style: typeof f.style === 'string' ? f.style : undefined,
      colors: (f.colors as Record<string, unknown> | null) ?? null,
      accessories:
        (f.accessories as Record<string, unknown> | null) ?? null,
    });
  }
  return map;
}

/** GET /api/chat/messages?limit= — 50 pesan terakhir (urut kronologis). */
export async function GET(req: NextRequest) {
  try {
    // Perlindungan dasar: polling normal 10 detik = 6 req/menit per
    // pengguna, jadi 300/menit per IP masih 50x lipatnya — hanya bot
    // yang menghantam berkali-kali per detik yang kena 429.
    const ip = getClientIp(req);
    const rl = checkRateLimit(`chat-get:${ip}`, 300, 60_000);
    if (!rl.allowed) {
      throw tooMany('Terlalu banyak permintaan, coba lagi sebentar lagi');
    }
    await connectDB();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
    const messages = await ChatMessage.find()
      .select('userId text createdAt')
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    // Balik: tampil kronologis (terlama dulu) supaya chat mengalir ke bawah.
    const ordered = [...messages].reverse();
    const shaped = serialize(ordered) as Record<string, unknown>[];
    // Identitas fighter per pengirim — satu query untuk semua pesan.
    const senderIds = shaped.map((m) => {
      const u = m.userId as Record<string, unknown> | null;
      return typeof u?.id === 'string' ? u.id : '';
    });
    const fighters = await fighterByUserId(senderIds);
    const withFighter = shaped.map((m) => {
      const u = (m.userId ?? {}) as Record<string, unknown>;
      const senderId = typeof u.id === 'string' ? u.id : '';
      return {
        id: m.id,
        userId: senderId,
        text: m.text,
        createdAt: m.createdAt,
        username: u.username ?? '—',
        fighter: fighters.get(senderId) ?? null,
      };
    });
    return ok({ messages: withFighter });
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
    // Lampirkan fighter pengirim supaya pesan baru langsung tampil
    // dengan PP + nama fighter (tanpa menunggu polling berikutnya).
    const fighters = await fighterByUserId([session.userId]);
    return ok(
      {
        message: {
          id: message._id.toString(),
          userId: session.userId,
          text: message.text,
          createdAt: message.createdAt.toISOString(),
          username: session.username,
          fighter: fighters.get(session.userId) ?? null,
        },
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
