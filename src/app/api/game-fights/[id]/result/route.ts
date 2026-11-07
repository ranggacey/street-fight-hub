import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { updateRatings } from '@/lib/game/elo';
import { verifyFightResult } from '@/lib/fight-engine/verify';
import { notifyFighterOwner } from '@/lib/game/notify';
import { applyTitleAfterFight, ensureTitleCurrent } from '@/lib/game/title-service';
import {
  badRequest,
  conflict,
  forbidden,
  handleError,
  notFound,
  ok,
  parseJson,
  serialize,
} from '@/lib/http';
import { validateFightResultBody } from '@/lib/validation';
import { Fighter } from '@/models/Fighter';
import { GameFight } from '@/models/GameFight';
import { VideoTask } from '@/models/VideoTask';

type Ctx = { params: Promise<{ id: string }> };

const POSTER_MAX_BYTES = 200 * 1024;

function posterSizeOk(dataUrl: string): boolean {
  const base64 = dataUrl.split(',')[1] ?? '';
  return base64.length * 0.75 <= POSTER_MAX_BYTES;
}

/**
 * POST /api/game-fights/[id]/result — terima sfa-result dari iframe.
 * - Hanya peserta fight yang boleh submit; seed harus cocok.
 * - Server menjalankan ulang buildFight dari seed + config tersimpan:
 *   cocok → completed + Elo + casualRecord + gelar + notifikasi
 *   (+ VideoTask kalau title fight). Tidak cocok → disputed, ranking
 *   TIDAK berubah.
 * - Idempotent: submit kedua untuk fight yang sudah completed/disputed
 *   ditolak 409.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const { id } = await params;
    const body = await parseJson(req);
    const input = validateFightResultBody(body);
    await connectDB();

    const fight = await GameFight.findById(id);
    if (!fight) throw notFound('Fight tidak ditemukan');
    if (fight.status === 'completed') {
      throw conflict('Fight ini sudah selesai (hasil sudah tercatat)', 'FIGHT_ALREADY_COMPLETED');
    }
    if (fight.status === 'disputed') {
      throw conflict('Fight ini sudah ditandai disputed', 'FIGHT_DISPUTED');
    }

    const mine = await Fighter.findOne({ userId: session.userId }).select('_id');
    if (!mine) throw forbidden('Kamu belum punya fighter');
    const myId = mine._id.toString();
    if (
      fight.fighterAId.toString() !== myId &&
      fight.fighterBId.toString() !== myId
    ) {
      throw forbidden('Hanya peserta fight yang bisa mengirim hasil');
    }

    if (input.seed === null || input.seed !== fight.seed) {
      throw badRequest('seed hasil tidak cocok dengan seed fight');
    }

    // Kekosongan gelar dicek lazy juga di sini (sebelum logika gelar jalan).
    await ensureTitleCurrent();

    const config = fight.config as {
      left: Record<string, unknown>;
      right: Record<string, unknown>;
    };
    const verification = verifyFightResult(
      config.left as never,
      config.right as never,
      fight.durationSec,
      fight.seed,
      {
        winner: input.winner,
        method: input.method,
        score: input.score,
        koTimeSec: input.koTimeSec,
        stats: input.stats,
        keyMoments: (input.keyMoments ?? null) as never,
        seed: input.seed ?? undefined,
      },
    );

    const now = new Date();
    if (!verification.ok) {
      fight.status = 'disputed';
      fight.disputeReason = verification.reason ?? 'mismatch';
      fight.completedAt = now;
      await fight.save();
      return ok({
        fight: serialize(fight.toObject()),
        verified: false,
        disputeReason: verification.reason,
        detail: verification.detail ?? null,
        expected: verification.expected,
      });
    }

    // --- Terverifikasi: simpan hasil otoritatif versi server ---
    const expected = verification.expected;
    const winnerFighterId =
      expected.winner === 'R'
        ? fight.fighterAId
        : expected.winner === 'B'
          ? fight.fighterBId
          : null;
    fight.result = {
      winnerSide: expected.winner,
      winnerFighterId,
      method: expected.method,
      score: expected.score,
      koTimeSec: expected.koTimeSec,
    };
    fight.stats = { ...expected.stats };
    // keyMoments versi server (otoritatif), bukan kiriman klien.
    fight.keyMoments = expected.keyMoments;
    fight.posterDataUrl =
      input.posterDataUrl && posterSizeOk(input.posterDataUrl)
        ? input.posterDataUrl
        : null;
    fight.status = 'completed';
    fight.completedAt = now;

    // --- Elo + casualRecord (TERPISAH dari record turnamen) ---
    const fighterA = await Fighter.findById(fight.fighterAId);
    const fighterB = await Fighter.findById(fight.fighterBId);
    let eloBefore: { a: number; b: number } = { a: 1000, b: 1000 };
    let eloAfter: { a: number; b: number } = { a: 1000, b: 1000 };
    if (fighterA && fighterB) {
      eloBefore = { a: fighterA.rating ?? 1000, b: fighterB.rating ?? 1000 };
      const scoreA =
        expected.winner === 'R' ? 1 : expected.winner === 'B' ? 0 : 0.5;
      const [newA, newB] = updateRatings(eloBefore.a, eloBefore.b, scoreA);
      eloAfter = { a: newA, b: newB };
      fighterA.rating = newA;
      fighterB.rating = newB;
      if (expected.method === 'draw') {
        fighterA.casualRecord.draws += 1;
        fighterB.casualRecord.draws += 1;
      } else if (expected.winner === 'R') {
        fighterA.casualRecord.wins += 1;
        if (expected.method === 'KO') fighterA.casualRecord.kos += 1;
        fighterB.casualRecord.losses += 1;
      } else {
        fighterB.casualRecord.wins += 1;
        if (expected.method === 'KO') fighterB.casualRecord.kos += 1;
        fighterA.casualRecord.losses += 1;
      }
      await fighterA.save();
      await fighterB.save();
    }

    // --- Gelar (race / takeover / defense / kekosongan sudah lazy) ---
    // PENTING: fight disimpan completed DULU — countRaceWins di
    // applyTitleAfterFight menghitung dari DB, dan fight ini harus
    // termasuk dalam hitungan race pemenang.
    await fight.save();
    const titleOutcome = await applyTitleAfterFight(fight);
    const isTitleFight = fight.isTitleFight || titleOutcome.isTitleFight;
    if (isTitleFight && !fight.isTitleFight) {
      fight.isTitleFight = true;
      await fight.save();
    }

    if (isTitleFight) {
      const existingTask = await VideoTask.findOne({ gameFightId: fight._id });
      if (!existingTask) {
        await VideoTask.create({
          kind: 'title',
          gameFightId: fight._id,
          status: 'queued',
          note: `Title fight ${fight._id} — ${expected.method} ${expected.score.a}-${expected.score.b}`,
        });
      }
    }

    await notifyFighterOwner(fight.fighterAId.toString(), 'fight_result', fight._id.toString());
    await notifyFighterOwner(fight.fighterBId.toString(), 'fight_result', fight._id.toString());

    return ok({
      fight: serialize(fight.toObject()),
      verified: true,
      elo: { before: eloBefore, after: eloAfter },
      isTitleFight,
      titleEvents: titleOutcome.events,
    });
  } catch (err) {
    return handleError(err);
  }
}
