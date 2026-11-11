import { randomInt } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { expireStaleChallenges } from '@/lib/game/challenges';
import { countFightsToday, DAILY_FIGHT_LIMIT } from '@/lib/game/daily-limit';
import { FIGHT_DURATION_SEC, toEngineFighter } from '@/lib/game/engine-config';
import { buildFightSetup } from '@/lib/game/fight-setup';
import { notifyFighterOwner } from '@/lib/game/notify';
import { ensureTitleCurrent } from '@/lib/game/title-service';
import {
  badRequest,
  conflict,
  forbidden,
  handleError,
  notFound,
  ok,
  serialize,
} from '@/lib/http';
import { Challenge } from '@/models/Challenge';
import { Fighter } from '@/models/Fighter';
import { GameFight } from '@/models/GameFight';
import { normalizeGameplanInput } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/challenges/[id]/accept-open — fighter mana pun (kecuali
 * penantang) menerima tantangan TERBUKA. Yang PERTAMA menerima yang
 * gelud; sisanya ditolak.
 *
 * Anti-race: klaim dilakukan dengan SATU update atomik
 * findOneAndUpdate({ _id, kind: 'open', status: 'pending' }) — hanya
 * satu request yang berhasil mengubah pending → accepted. Yang kalah
 * race mendapat null dan dijawab 409 CHALLENGE_NOT_PENDING. GameFight
 * baru dibuat SETELAH klaim menang, supaya tidak ada fight yatim;
 * kalau pembuatan fight gagal, klaim di-rollback ke pending.
 *
 * Limit harian: cek 5 fight/hari (WIB) untuk KEDUA fighter — penantang
 * dan yang menerima — sama seperti alur terima tantangan langsung.
 * Tantangan UNLIMITED (tidak ada jatah tantangan/hari); di sini tidak
 * dicek lagi (menerima bukan mengirim).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const { id } = await params;
    // Gameplan penerima (opsional, body boleh kosong → default).
    const rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const accepterGameplan = normalizeGameplanInput(rawBody?.gameplan);
    await connectDB();
    await expireStaleChallenges();

    const challenge = await Challenge.findById(id);
    if (!challenge) throw notFound('Tantangan tidak ditemukan');
    if (challenge.kind !== 'open') {
      throw conflict(
        'Tantangan ini bukan tantangan terbuka',
        'CHALLENGE_NOT_OPEN',
      );
    }
    if (challenge.status !== 'pending') {
      throw conflict(
        'Tantangan terbuka ini sudah tidak aktif — mungkin sudah diterima orang lain',
        'CHALLENGE_NOT_PENDING',
      );
    }

    const accepter = await Fighter.findOne({ userId: session.userId, status: 'active' });
    if (!accepter) throw badRequest('Buat fighter dulu sebelum menerima tantangan');
    if (accepter._id.toString() === challenge.challengerFighterId.toString()) {
      throw badRequest('Tidak bisa menerima tantangan terbuka sendiri');
    }

    const challenger = await Fighter.findById(challenge.challengerFighterId);
    if (!challenger) throw notFound('Fighter penantang tidak ditemukan');

    // Limit 5 fight/hari (WIB) — kedua fighter.
    const [usedA, usedB] = await Promise.all([
      countFightsToday(challenger._id.toString()),
      countFightsToday(accepter._id.toString()),
    ]);
    if (usedA >= DAILY_FIGHT_LIMIT || usedB >= DAILY_FIGHT_LIMIT) {
      throw conflict(
        'Jatah tarung hari ini sudah habis (maks 5 fight/hari, reset tengah malam WIB)',
        'DAILY_LIMIT_REACHED',
      );
    }

    // Klaim atomik: hanya satu penerima yang bisa mengubah pending → accepted.
    const claimed = await Challenge.findOneAndUpdate(
      { _id: challenge._id, kind: 'open', status: 'pending' },
      {
        $set: {
          status: 'accepted',
          challengedFighterId: accepter._id,
          respondedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );
    if (!claimed) {
      throw conflict(
        'Tantangan terbuka ini sudah tidak aktif — mungkin sudah diterima orang lain',
        'CHALLENGE_NOT_PENDING',
      );
    }

    try {
      // Kekosongan gelar dicek lazy di sini (tanpa cron) — sama seperti terima langsung.
      const { title } = await ensureTitleCurrent();
      const holderId = title.holderFighterId ? title.holderFighterId.toString() : null;
      const isTitleFight =
        holderId === challenger._id.toString() || holderId === accepter._id.toString();

      // Seed server (acak, 6 digit seperti randomSeed arena).
      const seed = randomInt(100000, 1000000);
      const left = toEngineFighter(challenger.toObject());
      const right = toEngineFighter(accepter.toObject());

      const setup = await buildFightSetup(
        challenger,
        accepter,
        challenge.gameplan,
        accepterGameplan,
      );

      const fight = await GameFight.create({
        fighterAId: challenger._id,
        fighterBId: accepter._id,
        challengeId: challenge._id,
        tournamentId: null,
        seed,
        map: challenge.map,
        durationSec: FIGHT_DURATION_SEC,
        status: 'pending',
        config: { left, right, fightOpts: setup.fightOpts, gameplans: setup.gameplans },
        isTitleFight,
      });

      claimed.gameFightId = fight._id;
      await claimed.save();

      await notifyFighterOwner(
        challenger._id.toString(),
        'challenge_accepted',
        challenge._id.toString(),
      );

      return ok({
        challenge: serialize(claimed.toObject()),
        gameFight: { id: fight._id.toString() },
        isTitleFight,
        config: {
          type: 'sfa-config',
          fightId: fight._id.toString(),
          fighters: { left, right },
          seed,
          map: challenge.map,
          duration: FIGHT_DURATION_SEC,
          opts: setup.fightOpts,
        },
      });
    } catch (err) {
      // Rollback klaim supaya tantangan tetap bisa diterima orang lain.
      await Challenge.updateOne(
        { _id: challenge._id, status: 'accepted' },
        { $set: { status: 'pending', challengedFighterId: null, respondedAt: null } },
      ).catch(() => undefined);
      throw err;
    }
  } catch (err) {
    return handleError(err);
  }
}
