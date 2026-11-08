import type { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { conflict, handleError, notFound, ok } from '@/lib/http';
import { Challenge } from '@/models/Challenge';
import { Fighter } from '@/models/Fighter';
import { GameFight } from '@/models/GameFight';
import { Match } from '@/models/Match';
import { Title } from '@/models/Title';
import { TournamentEntry } from '@/models/TournamentEntry';

/**
 * Route migrasi ONE-TIME — hapus fighter Glaciero Aurelio + entry
 * turnamennya (NFC#1). Dibuat 2026-11-08 atas perintah user ("Hapus
 * aja glaciero") setelah investigasi membuktikan Glaciero adalah
 * duplikat igUsername strivox_id milik akun `strivox` (0-0-0, hanya 1
 * entry turnamen, tanpa fight/challenge/gelar) sementara STRIVOX milik
 * akun `aaronclarke` yang memegang semua riwayat.
 *
 * GET = dry-run (apa yang akan dihapus + scan duplikat igUsername).
 * POST = hapus, butuh header x-migration-token sekali pakai.
 * SETELAH DIPAKAI: ganti file ini jadi stub 404 (jangan kembalikan
 * logika hapus ke file ini).
 */

const GLACIERO_ID = '6aeeffd9e50785b5974f2da3';
const STRIVOX_ID = '6aefc93ef622565688a5a641';
const TOURNAMENT_ID = '6aeebb5d7f51b2703e6a9164';
const TOKEN = 'fb1822513f8f6b8aeceef05bb50a56cc';

async function scan() {
  await connectDB();
  const fighter = await Fighter.findById(GLACIERO_ID).lean();
  const strivox = await Fighter.findById(STRIVOX_ID).lean();
  const entry = await TournamentEntry.findOne({
    tournamentId: new mongoose.Types.ObjectId(TOURNAMENT_ID),
    fighterId: new mongoose.Types.ObjectId(GLACIERO_ID),
  }).lean();
  const entriesTotal = await TournamentEntry.countDocuments({
    tournamentId: new mongoose.Types.ObjectId(TOURNAMENT_ID),
  });
  const refs = {
    gameFights: await GameFight.countDocuments({
      $or: [{ fighterAId: GLACIERO_ID }, { fighterBId: GLACIERO_ID }],
    }),
    challenges: await Challenge.countDocuments({
      $or: [{ challengerFighterId: GLACIERO_ID }, { challengedFighterId: GLACIERO_ID }],
    }),
    matches: await Match.countDocuments({
      $or: [
        { fighterAId: GLACIERO_ID },
        { fighterBId: GLACIERO_ID },
        { winnerId: GLACIERO_ID },
        { drawAdvancerId: GLACIERO_ID },
      ],
    }),
    titles: await Title.countDocuments({ holderFighterId: GLACIERO_ID }),
    entries: await TournamentEntry.countDocuments({ fighterId: GLACIERO_ID }),
  };
  const dupIg = await Fighter.aggregate([
    {
      $group: {
        _id: { $toLower: '$igUsername' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);
  return {
    glaciero: fighter
      ? {
          id: String(fighter._id),
          displayName: fighter.displayName,
          igUsername: fighter.igUsername,
          rating: fighter.rating,
          casualRecord: fighter.casualRecord,
        }
      : null,
    strivox: strivox
      ? {
          id: String(strivox._id),
          displayName: strivox.displayName,
          igUsername: strivox.igUsername,
          rating: strivox.rating,
          casualRecord: strivox.casualRecord,
        }
      : null,
    entry: entry
      ? { id: String(entry._id), tournamentId: String(entry.tournamentId), status: entry.status }
      : null,
    entriesTotal,
    refs,
    duplicatesByIg: dupIg.map((d) => ({ igUsername: d._id, count: d.count })),
  };
}

export async function GET() {
  try {
    return ok(await scan());
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-migration-token') !== TOKEN) throw notFound('Tidak ditemukan');
    const before = await scan();
    if (!before.glaciero) throw notFound('Fighter Glaciero sudah tidak ada');
    if (
      before.refs.gameFights > 0 ||
      before.refs.challenges > 0 ||
      before.refs.matches > 0 ||
      before.refs.titles > 0
    ) {
      throw conflict(
        'Glaciero masih punya referensi (fight/challenge/match/gelar) — hapus dibatalkan',
        'UNEXPECTED_REFS',
      );
    }
    if (before.refs.entries !== 1 || !before.entry) {
      throw conflict(
        'Entry turnamen Glaciero tidak sesuai harapan (harus tepat 1 di NFC#1) — hapus dibatalkan',
        'UNEXPECTED_ENTRIES',
      );
    }
    await TournamentEntry.deleteOne({ _id: before.entry.id });
    await Fighter.deleteOne({ _id: GLACIERO_ID });
    const after = await scan();
    return ok({ deleted: { fighterId: GLACIERO_ID, entryId: before.entry.id }, before, after });
  } catch (err) {
    return handleError(err);
  }
}
