import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { isValidSignatureMove } from '@/lib/game/engine-config';
import { badRequest, forbidden, handleError, notFound, ok, parseJson, serialize } from '@/lib/http';
import { parseFighterPatch } from '@/lib/validation';
import { Fighter } from '@/models/Fighter';
import { GameFight } from '@/models/GameFight';
import { Match } from '@/models/Match';
import { TitleHistory } from '@/models/TitleHistory';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/fighters/[id] — profil publik + riwayat match + riwayat game + riwayat gelar. */
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

    // --- Riwayat game kasual (GameFight completed/disputed) ---
    const gameFights = await GameFight.find({
      $or: [{ fighterAId: id }, { fighterBId: id }],
      status: { $in: ['completed', 'disputed'] },
    })
      .populate('fighterAId', 'displayName')
      .populate('fighterBId', 'displayName')
      .sort({ completedAt: -1, createdAt: -1 })
      .lean();
    const serializedFights = serialize(gameFights) as {
      id: string;
      fighterAId: { id: string; displayName: string } | string | null;
      fighterBId: { id: string; displayName: string } | string | null;
      status: string;
      isTitleFight: boolean;
      result: {
        winnerFighterId: string | null;
        method: string | null;
        score: { a: number; b: number } | null;
        koTimeSec: number | null;
      } | null;
      completedAt: string | null;
    }[];
    const gameHistory = serializedFights.map((g) => {
      const aId = typeof g.fighterAId === 'string' ? g.fighterAId : (g.fighterAId?.id ?? null);
      const isA = aId === id;
      const opponent = isA ? g.fighterBId : g.fighterAId;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      if (g.result?.method === 'draw') result = 'draw';
      else if (g.result?.winnerFighterId && g.result.winnerFighterId === id) result = 'win';
      else if (g.result?.winnerFighterId) result = 'loss';
      return {
        fightId: g.id,
        opponentId: opponent && typeof opponent === 'object' ? opponent.id : null,
        opponentName: opponent && typeof opponent === 'object' ? opponent.displayName : null,
        result,
        method: g.result?.method ?? null,
        score: g.result?.score ?? null,
        koTimeSec: g.result?.koTimeSec ?? null,
        isTitleFight: g.isTitleFight,
        status: g.status,
        completedAt: g.completedAt,
      };
    });

    // --- Riwayat gelar (TitleHistory: pernah merebut / kehilangan gelar) ---
    const titleEvents = await TitleHistory.find({
      $or: [{ newHolderFighterId: id }, { previousHolderFighterId: id }],
    })
      .sort({ at: -1 })
      .lean();
    const titleHistory = (serialize(titleEvents) as {
      id: string;
      type: string;
      previousHolderFighterId: string | null;
      newHolderFighterId: string | null;
      at: string;
      fightId: string | null;
      score: number | null;
      defensesAtEnd: number | null;
      raceStartAt: string | null;
    }[]).map((e) => ({
      id: e.id,
      type: e.type,
      at: e.at,
      fightId: e.fightId,
      score: e.score,
      defensesAtEnd: e.defensesAtEnd,
      raceStartAt: e.raceStartAt,
      // Peran fighter di event ini: merebut gelar / kehilangan gelar.
      role: e.newHolderFighterId === id ? 'won' : 'lost',
    }));

    return ok({ fighter: serialize(fighter), history: serialize(history), gameHistory, titleHistory });
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

    // Jurus khas harus cocok dengan gaya EFEKTIF (gaya baru kalau diubah,
    // kalau tidak gaya lama). Ganti gaya tanpa jurus baru juga dicek:
    // jurus lama yang tidak ada di gaya baru harus dipilih ulang.
    const effectiveStyle = patch.top.style ?? fighter.style;
    if (patch.top.signatureMove !== undefined) {
      if (
        patch.top.signatureMove !== null &&
        !isValidSignatureMove(effectiveStyle, patch.top.signatureMove)
      ) {
        throw badRequest(
          `Jurus khas ${patch.top.signatureMove} tidak ada di gaya ${effectiveStyle}`,
        );
      }
    } else if (
      patch.top.style !== undefined &&
      fighter.signatureMove &&
      !isValidSignatureMove(effectiveStyle, fighter.signatureMove)
    ) {
      throw badRequest(
        `Jurus khas ${fighter.signatureMove} tidak ada di gaya ${effectiveStyle} — pilih jurus khas baru`,
      );
    }

    // Warna digabung per bagian (bukan ganti seluruh objek colors).
    const colorsPatch = patch.top.colors;
    if (colorsPatch) {
      for (const [key, value] of Object.entries(colorsPatch)) {
        fighter.set(`colors.${key}`, value);
      }
      delete patch.top.colors;
    }

    // Aksesoris digabung per bagian (pola yang sama dengan colors).
    const accessoriesPatch = patch.top.accessories;
    if (accessoriesPatch) {
      for (const [key, value] of Object.entries(accessoriesPatch)) {
        fighter.set(`accessories.${key}`, value);
      }
      delete patch.top.accessories;
    }

    Object.assign(fighter, patch.top);
    await fighter.save();

    return ok({ fighter: serialize(fighter.toObject()) });
  } catch (err) {
    return handleError(err);
  }
}
