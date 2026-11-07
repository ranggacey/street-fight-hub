import type { NextRequest } from 'next/server';
import { checkOrigin, requireAdminApi } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { buildBracket } from '@/lib/bracket';
import { connectDB } from '@/lib/db';
import { badRequest, forbidden, handleError, notFound, ok, serialize } from '@/lib/http';
import { Match } from '@/models/Match';
import { Tournament } from '@/models/Tournament';
import { TournamentEntry } from '@/models/TournamentEntry';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/tournaments/[id]/generate-bracket
 * 400 jika peserta < 4 ("Turnamen butuh min 4 peserta") atau bracket sudah ada.
 * Set status turnamen 'in_progress', simpan bracketSeed.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAdminApi(req);
    const { id } = await params;
    await connectDB();

    const tournament = await Tournament.findById(id);
    if (!tournament) throw notFound('Turnamen tidak ditemukan');

    const existingMatches = await Match.countDocuments({ tournamentId: tournament._id });
    if (existingMatches > 0) throw badRequest('Bracket sudah dibuat');

    const entries = await TournamentEntry.find({
      tournamentId: tournament._id,
      status: 'active',
    })
      .sort({ joinedAt: 1 })
      .lean();
    if (entries.length < 4) throw badRequest('Turnamen butuh min 4 peserta');

    const fighterIds = entries.map((e) => String(e.fighterId));
    const result = buildBracket(fighterIds);

    // Simpan seed entry sesuai urutan shuffle.
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

    tournament.status = 'in_progress';
    tournament.bracketSeed = result.bracketSeed;
    await tournament.save();

    await audit(
      session.userId,
      'tournament.generate-bracket',
      'Tournament',
      id,
      `Generate bracket ${tournament.name}: ${entries.length} peserta, target ${result.target}, ${result.byes.length} bye`,
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
