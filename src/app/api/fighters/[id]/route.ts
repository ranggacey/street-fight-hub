import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { badRequest, forbidden, handleError, notFound, ok, parseJson, serialize } from '@/lib/http';
import { parseFighterPatch } from '@/lib/validation';
import { Fighter } from '@/models/Fighter';
import { Match } from '@/models/Match';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/fighters/[id] — profil publik + riwayat match. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await connectDB();
    const fighter = await Fighter.findById(id).lean();
    if (!fighter) throw notFound('Fighter tidak ditemukan');

    const matches = await Match.find({
      $or: [{ fighterAId: id }, { fighterBId: id }],
      status: { $in: ['decided', 'video_done'] },
    })
      .populate('tournamentId', 'name slug')
      .populate('fighterAId', 'displayName')
      .populate('fighterBId', 'displayName')
      .sort({ decidedAt: -1 })
      .lean();

    type SerializedMatch = {
      id: string;
      round: string;
      method: string | null;
      winnerId: string | null;
      score: { a: number; b: number } | null;
      koTimeSec: number | null;
      reelUrl: string | null;
      decidedAt: string | null;
      tournamentId:
        | { id: string; name: string; slug: string }
        | string
        | null;
      fighterAId: { id: string; displayName: string } | string | null;
      fighterBId: { id: string; displayName: string } | string | null;
    };

    // Serialisasi dulu: lean() tidak membawa virtual `id`, jadi bandingkan
    // lewat `id` hasil serialize (bukan `._id` mentah / `.id` yang undefined).
    // Bentuk riwayat mengikuti FightHistoryItem (types.ts): field DATAR
    // (tournamentName / opponentName), BUKAN objek bersarang — halaman
    // profil membaca field datar itu; versi sebelumnya mengembalikan
    // objek sehingga halaman menampilkan "Turnamen" dan "Lawan: —".
    const serializedMatches = serialize(matches) as SerializedMatch[];
    const history = serializedMatches.map((m) => {
      const aId = typeof m.fighterAId === 'string' ? m.fighterAId : (m.fighterAId?.id ?? null);
      const isA = aId === id;
      const opponent = isA ? m.fighterBId : m.fighterAId;
      const tour = m.tournamentId;
      let result: 'win' | 'loss' | 'draw' | 'bye' = 'draw';
      if (m.method === 'bye') result = 'bye';
      else if (m.method === 'draw') result = 'draw';
      else if (m.winnerId && m.winnerId === id) result = 'win';
      else result = 'loss';
      return {
        matchId: m.id,
        tournamentId: typeof tour === 'string' ? tour : (tour?.id ?? null),
        tournamentName: typeof tour === 'object' ? (tour?.name ?? null) : null,
        tournamentSlug: typeof tour === 'object' ? (tour?.slug ?? null) : null,
        round: m.round,
        opponentId:
          opponent && typeof opponent === 'object' ? opponent.id : null,
        opponentName:
          opponent && typeof opponent === 'object'
            ? opponent.displayName
            : null,
        result,
        method: m.method,
        score: m.score,
        koTimeSec: m.koTimeSec,
        reelUrl: m.reelUrl,
        decidedAt: m.decidedAt,
      };
    });

    return ok({ fighter: serialize(fighter), history: serialize(history) });
  } catch (err) {
    return handleError(err);
  }
}

/** PATCH /api/fighters/[id] — edit (hanya owner). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const { id } = await params;
    const body = await parseJson(req);
    const patch = parseFighterPatch(body);
    await connectDB();

    const fighter = await Fighter.findById(id);
    if (!fighter) throw notFound('Fighter tidak ditemukan');
    if (fighter.userId.toString() !== session.userId) {
      throw forbidden('Hanya pemilik fighter yang bisa mengedit');
    }

    if (patch.top.style === 'other') {
      // style diubah jadi 'other' → styleOther wajib ada (dari body atau yang lama)
      const styleOther = patch.top.styleOther ?? fighter.styleOther;
      if (!styleOther) throw badRequest('Gaya lain wajib diisi');
      patch.top.styleOther = styleOther;
    }

    Object.assign(fighter, patch.top);
    await fighter.save();

    return ok({ fighter: serialize(fighter.toObject()) });
  } catch (err) {
    return handleError(err);
  }
}
