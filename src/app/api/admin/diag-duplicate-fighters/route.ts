import type { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { handleError, notFound, ok, serialize } from '@/lib/http';
import { Challenge } from '@/models/Challenge';
import { ChatMessage } from '@/models/ChatMessage';
import { Fighter } from '@/models/Fighter';
import { GameFight } from '@/models/GameFight';
import { Match } from '@/models/Match';
import { Title } from '@/models/Title';
import { TitleHistory } from '@/models/TitleHistory';
import { Tournament } from '@/models/Tournament';
import { TournamentEntry } from '@/models/TournamentEntry';
import { User } from '@/models/User';

/**
 * DIAGNOSTIK ONE-TIME, READ-ONLY (2026-11-08): selidiki fighter ganda
 * @strivox_id (STRIVOX + Glaciero Aurelio). GET saja, tanpa operasi
 * tulis apa pun. Dilindungi token sekali pakai di header `x-diag-token`.
 * HAPUS (ganti stub 404) segera setelah dipakai — JANGAN dibiarkan hidup.
 */
const DIAG_TOKEN = '599f35068b011c8108b41f5f77b4ec00';

type LeanDoc = Record<string, unknown>;

function idStr(v: unknown): string {
  if (typeof v === 'string') return v;
  const o = v as { toString?: () => string } | null;
  return o?.toString?.() ?? '';
}

export async function GET(req: NextRequest) {
  try {
    if (req.headers.get('x-diag-token') !== DIAG_TOKEN) {
      throw notFound('Tidak ditemukan');
    }
    await connectDB();

    // 1. Index koleksi fighters — apakah unique index userId benar ada?
    const indexes = (await Fighter.collection.getIndexes()) as Record<
      string,
      unknown
    >;

    // 2. Semua fighter + user pemiliknya.
    const fighters = (await Fighter.find().sort({ createdAt: 1 }).lean()) as LeanDoc[];
    const userIds = [...new Set(fighters.map((f) => idStr(f.userId)).filter(Boolean))];
    const users = (await User.find({ _id: { $in: userIds } })
      .select('username role createdAt lastLoginAt')
      .lean()) as LeanDoc[];

    // 3. Scan duplikat: per userId dan per igUsername (case-insensitive).
    const byUser = new Map<string, LeanDoc[]>();
    const byIg = new Map<string, LeanDoc[]>();
    for (const f of fighters) {
      const uid = idStr(f.userId);
      const ig = typeof f.igUsername === 'string' ? f.igUsername.toLowerCase() : '';
      if (uid) byUser.set(uid, [...(byUser.get(uid) ?? []), f]);
      if (ig) byIg.set(ig, [...(byIg.get(ig) ?? []), f]);
    }
    const duplicatesByUserId = [...byUser.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([userId, list]) => ({ userId, fighterIds: list.map((f) => idStr(f._id)) }));
    const duplicatesByIg = [...byIg.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([ig, list]) => ({
        igUsername: ig,
        fighterIds: list.map((f) => idStr(f._id)),
        userIds: list.map((f) => idStr(f.userId)),
      }));

    // 4. Pemakaian tiap fighter: fights, challenge, turnamen, gelar, match.
    const fighterIds = fighters.map((f) => f._id);
    const [gameFights, challenges, entries, matches, titles, titleHistories] =
      await Promise.all([
        GameFight.find({
          $or: [{ fighterAId: { $in: fighterIds } }, { fighterBId: { $in: fighterIds } }],
        })
          .select('fighterAId fighterBId challengeId status result completedAt createdAt')
          .sort({ createdAt: 1 })
          .lean() as Promise<LeanDoc[]>,
        Challenge.find({
          $or: [
            { challengerFighterId: { $in: fighterIds } },
            { challengedFighterId: { $in: fighterIds } },
          ],
        })
          .select('challengerFighterId challengedFighterId kind status createdAt')
          .sort({ createdAt: 1 })
          .lean() as Promise<LeanDoc[]>,
        TournamentEntry.find({ fighterId: { $in: fighterIds } })
          .select('tournamentId fighterId status seed joinedAt')
          .sort({ joinedAt: 1 })
          .lean() as Promise<LeanDoc[]>,
        Match.find({
          $or: [
            { fighterAId: { $in: fighterIds } },
            { fighterBId: { $in: fighterIds } },
            { winnerId: { $in: fighterIds } },
          ],
        })
          .select('tournamentId round fighterAId fighterBId winnerId method status decidedAt')
          .sort({ createdAt: 1 })
          .lean() as Promise<LeanDoc[]>,
        Title.find({ holderFighterId: { $in: fighterIds } })
          .select('holderFighterId status createdAt')
          .lean() as Promise<LeanDoc[]>,
        TitleHistory.find({
          $or: [
            { holderFighterId: { $in: fighterIds } },
            { challengerFighterId: { $in: fighterIds } },
          ],
        })
          .select('holderFighterId challengerFighterId event createdAt')
          .sort({ createdAt: 1 })
          .lean() as Promise<LeanDoc[]>,
      ]);

    const tournaments = (await Tournament.find()
      .select('name slug status bracketSize regOpenAt regCloseAt createdAt')
      .sort({ createdAt: 1 })
      .lean()) as LeanDoc[];

    // 5. Pesan chat per user yang terlibat (hitung saja, tanpa isi pesan).
    // Aggregate tidak me-cast string ke ObjectId otomatis — konversi manual.
    const chatCounts = (await ChatMessage.aggregate([
      {
        $match: {
          userId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
        },
      },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ])) as LeanDoc[];

    return ok({
      indexes,
      fighters: serialize(fighters),
      users: serialize(users),
      duplicatesByUserId,
      duplicatesByIg,
      usage: serialize({
        gameFights,
        challenges,
        entries,
        matches,
        titles,
        titleHistories,
      }),
      tournaments: serialize(tournaments),
      chatCounts: serialize(chatCounts),
      totals: {
        fighters: fighters.length,
        users: users.length,
        gameFights: gameFights.length,
        challenges: challenges.length,
        entries: entries.length,
        matches: matches.length,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
