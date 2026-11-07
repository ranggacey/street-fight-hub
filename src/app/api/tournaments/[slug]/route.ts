import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { handleError, notFound, ok, serialize } from '@/lib/http';
import { Match } from '@/models/Match';
import { Tournament } from '@/models/Tournament';
import { TournamentEntry } from '@/models/TournamentEntry';

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/tournaments/[slug] — detail + entries + bracket + participantCount. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { slug } = await params;
    await connectDB();
    const tournament = await Tournament.findOne({ slug })
      // championId di-populate supaya kartu Champion di halaman detail +
      // "Juara Terakhir" di home bisa menampilkan nama juara.
      .populate('championId', 'displayName igUsername style')
      .lean();
    if (!tournament) throw notFound('Turnamen tidak ditemukan');

    // Entries: semua kecuali yang mundur — turnamen selesai harus tetap
    // menampilkan pesertanya (status 'eliminated'/'champion'), bukan
    // "Belum ada peserta". Halaman sendiri yang menyaring 'withdrawn'.
    const entries = await TournamentEntry.find({
      tournamentId: tournament._id,
      status: { $in: ['active', 'eliminated', 'champion'] },
    })
      .populate('fighterId', 'displayName igUsername style record status')
      .sort({ joinedAt: 1 })
      .lean();

    const matches = await Match.find({ tournamentId: tournament._id })
      .populate('fighterAId', 'displayName igUsername style record')
      .populate('fighterBId', 'displayName igUsername style record')
      .populate('winnerId', 'displayName')
      .sort({ createdAt: 1 })
      .lean();

    return ok({
      tournament: serialize(tournament),
      entries: serialize(entries),
      bracket: serialize(matches),
      participantCount: entries.length,
    });
  } catch (err) {
    return handleError(err);
  }
}
