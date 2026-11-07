import type { NextRequest } from 'next/server';
import { checkOrigin, requireAdminApi } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { buildBracket, canReshuffle } from '@/lib/bracket';
import { connectDB } from '@/lib/db';
import { badRequest, forbidden, handleError, notFound, ok, serialize } from '@/lib/http';
import { Match } from '@/models/Match';
import { Tournament } from '@/models/Tournament';
import { TournamentEntry } from '@/models/TournamentEntry';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/tournaments/[id]/reshuffle-bracket
 * Acak ulang pasangan ronde pertama dengan seed baru. Hanya boleh sebelum
 * ada pertandingan sungguhan yang diundi (canReshuffle): semua match masih
 * di ronde pertama dan tidak ada match non-bye yang decided. Bye ikut
 * diacak ulang. Match lama dihapus, match baru dibuat, seed entry +
 * bracketSeed diperbarui.
 * 400 jika bracket belum dibuat / sudah ada yang diundi / peserta < 4.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAdminApi(req);
    const { id } = await params;
    await connectDB();

    const tournament = await Tournament.findById(id);
    if (!tournament) throw notFound('Turnamen tidak ditemukan');
    if (tournament.status !== 'in_progress') {
      throw badRequest('Turnamen belum berjalan — bracket belum dibuat');
    }

    const existing = await Match.find({ tournamentId: tournament._id }).lean();
    if (!canReshuffle(existing)) {
      throw badRequest('Bracket tidak bisa diacak ulang — sudah ada pertandingan yang diundi');
    }

    const entries = await TournamentEntry.find({
      tournamentId: tournament._id,
      status: 'active',
    })
      .sort({ joinedAt: 1 })
      .lean();
    if (entries.length < 4) throw badRequest('Turnamen butuh min 4 peserta');

    const fighterIds = entries.map((e) => String(e.fighterId));
    const result = buildBracket(fighterIds);

    // Hapus match lama, lalu buat ulang dari hasil shuffle baru.
    await Match.deleteMany({ tournamentId: tournament._id });

    const seedByFighter = new Map<string, number>();
    result.order.forEach((fighterId, index) => seedByFighter.set(fighterId, index + 1));
    await Promise.all(
      entries.map((entry) =>
        TournamentEntry.updateOne(
          { _id: entry._id },
          { $set: { seed: seedByFighter.get(String(entry.fighterId)) ?? null } },
        ),
      ),
    );

    const created = await Promise.all(
      result.matches.map((m) =>
        Match.create({
          tournamentId: tournament._id,
          round: result.firstRound,
          fighterAId: m.fighterAId,
          fighterBId: m.fighterBId,
          winnerId: m.winnerId,
          method: m.method,
          isBye: m.isBye,
          status: m.status,
          drawSeed: m.isBye ? 0 : Math.floor(Math.random() * 2 ** 31),
          decidedAt: m.isBye ? new Date() : null,
        }),
      ),
    );

    tournament.bracketSeed = result.bracketSeed;
    await tournament.save();

    await audit(
      session.userId,
      'tournament.reshuffle-bracket',
      'Tournament',
      id,
      `Acak ulang bracket ${tournament.name}: ${entries.length} peserta, target ${result.target}, ${result.byes.length} bye`,
    );

    return ok({
      tournament: serialize(tournament.toObject()),
      matches: serialize(created.map((m) => m.toObject())),
      byes: result.byes,
      bracketSeed: result.bracketSeed,
    });
  } catch (err) {
    return handleError(err);
  }
}
