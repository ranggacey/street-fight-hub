import { randomInt } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { CHALLENGE_TTL_MS, expireStaleChallenges } from '@/lib/game/challenges';
import { countFightsToday, DAILY_FIGHT_LIMIT } from '@/lib/game/daily-limit';
import { FIGHT_DURATION_SEC, toEngineFighter } from '@/lib/game/engine-config';
import { notifyFighterOwner } from '@/lib/game/notify';
import {
  countActiveFights,
  findQuickFightOpponent,
  pickRandomMap,
} from '@/lib/game/quick-fight';
import { ensureTitleCurrent } from '@/lib/game/title-service';
import {
  badRequest,
  conflict,
  forbidden,
  handleError,
  ok,
  serialize,
} from '@/lib/http';
import { Challenge } from '@/models/Challenge';
import { Fighter } from '@/models/Fighter';
import { GameFight } from '@/models/GameFight';

/**
 * POST /api/quick-fight — Gas Tarung (quick match).
 *
 * Satu ketuk → server mencarikan lawan yang tersedia (fighter aktif,
 * bukan diri sendiri, masih punya jatah tarung hari ini, tidak sedang
 * dalam fight aktif; prefer rating ±100, fallback yang paling dekat)
 * → challenge + accept dibuat atomik di server → GameFight dibuat →
 * kembalikan fightId, klien langsung masuk /game/[fightId].
 * Fight ini fight kasual biasa: masuk unified record + rating seperti
 * 1v1 biasa; aturan title race tidak berubah (isTitleFight ditandai
 * seperti accept biasa).
 *
 * Anti-race (pola yang sama dengan accept-open): klaim challenge
 * dilakukan dengan SATU update atomik findOneAndUpdate({ _id,
 * status: 'pending' }); GameFight baru dibuat SETELAH klaim menang.
 * Pengaman kedua: setelah fight dibuat, dihitung ulang fight aktif
 * (pending/playing) kedua fighter — kalau ada yang > 1 (lawan yang
 * sama dicocokkan dua quick-fight bersamaan, atau lawan baru saja
 * masuk fight lain), fight dihapus + challenge dibatalkan dan dijawab
 * 409 QUICK_FIGHT_CONFLICT — klien retry sekali. Dua quick-fight
 * bersamaan bisa sama-sama kalah verifikasi (keduanya melihat 2
 * fight aktif) — keduanya rollback dan retry akan menang, tidak ada
 * fight ganda dan tidak ada jatah yang terbuang.
 *
 * Respons:
 * - 200 { status: 'matched', gameFight: { id }, opponent, isTitleFight, config }
 * - 200 { status: 'active_fight', gameFight: { id } } — saya sudah
 *   punya fight yang belum selesai, langsung lanjut ke fight itu.
 * - 200 { status: 'no_opponent' } — tidak ada lawan yang tersedia;
 *   JANGAN buat fight. Klien menawarkan buat tantangan terbuka.
 * - 409 DAILY_LIMIT_REACHED / 409 QUICK_FIGHT_CONFLICT / 400 NO_FIGHTER.
 */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    await connectDB();
    await expireStaleChallenges();

    const mine = await Fighter.findOne({ userId: session.userId, status: 'active' });
    if (!mine) throw badRequest('Buat fighter dulu sebelum tarung', 'NO_FIGHTER');

    // Jatah saya hari ini (WIB).
    if ((await countFightsToday(mine._id.toString())) >= DAILY_FIGHT_LIMIT) {
      throw conflict(
        'Jatah tarung hari ini sudah habis (maks 5 fight/hari, reset tengah malam WIB)',
        'DAILY_LIMIT_REACHED',
      );
    }

    // Saya sudah punya fight yang belum selesai — lanjut ke situ saja,
    // jangan buat fight kedua.
    const activeMine = await GameFight.findOne({
      status: { $in: ['pending', 'playing'] },
      $or: [{ fighterAId: mine._id }, { fighterBId: mine._id }],
    })
      .select('_id')
      .sort({ createdAt: -1 })
      .lean();
    if (activeMine) {
      return ok({
        status: 'active_fight',
        gameFight: { id: activeMine._id.toString() },
      });
    }

    const opponent = await findQuickFightOpponent(
      mine._id.toString(),
      mine.rating ?? 1000,
    );
    if (!opponent) {
      return ok({ status: 'no_opponent', opponent: null });
    }

    const now = new Date();
    const challenge = await Challenge.create({
      challengerFighterId: mine._id,
      challengedFighterId: opponent.id,
      kind: 'direct',
      status: 'pending',
      map: pickRandomMap(),
      message: 'Gas Tarung — lawan acak',
      expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
    });

    // Klaim atomik: hanya satu accept per challenge yang bisa menang.
    const claimed = await Challenge.findOneAndUpdate(
      { _id: challenge._id, status: 'pending' },
      { $set: { status: 'accepted', respondedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!claimed) {
      throw conflict(
        'Lawan ini baru saja masuk fight lain — coba Gas Tarung lagi',
        'QUICK_FIGHT_CONFLICT',
      );
    }

    try {
      // Jatah 5 fight/hari (WIB) — kedua fighter (dicek ulang setelah
      // klaim: jatah bisa habis di antara pemilihan lawan dan klaim).
      const [usedA, usedB] = await Promise.all([
        countFightsToday(mine._id.toString()),
        countFightsToday(opponent.id),
      ]);
      if (usedA >= DAILY_FIGHT_LIMIT || usedB >= DAILY_FIGHT_LIMIT) {
        await Challenge.updateOne(
          { _id: challenge._id, status: 'accepted' },
          {
            $set: {
              status: 'cancelled',
              cancelReason: 'Jatah tarung hari ini sudah habis (maks 5 fight/hari)',
              respondedAt: new Date(),
            },
          },
        );
        throw conflict(
          'Jatah tarung hari ini sudah habis (maks 5 fight/hari, reset tengah malam WIB)',
          'DAILY_LIMIT_REACHED',
        );
      }

      // Kekosongan gelar dicek lazy di sini (tanpa cron) — sama seperti terima langsung.
      const { title } = await ensureTitleCurrent();
      const holderId = title.holderFighterId ? title.holderFighterId.toString() : null;
      const isTitleFight =
        holderId === mine._id.toString() || holderId === opponent.id;

      // Seed server (acak, 6 digit seperti randomSeed arena).
      const seed = randomInt(100000, 1000000);
      const left = toEngineFighter(mine.toObject());
      const right = toEngineFighter(opponent);

      const fight = await GameFight.create({
        fighterAId: mine._id,
        fighterBId: opponent.id,
        challengeId: challenge._id,
        tournamentId: null,
        seed,
        map: challenge.map,
        durationSec: FIGHT_DURATION_SEC,
        status: 'pending',
        config: { left, right },
        isTitleFight,
      });

      // Pengaman race: masing-masing fighter hanya boleh punya SATU
      // fight aktif. Kalau lawan (atau saya) ternyata punya > 1 fight
      // aktif — quick-fight lain memilih lawan yang sama bersamaan,
      // atau lawan baru saja masuk fight lain — rollback fight ini.
      const [activeA, activeB] = await Promise.all([
        countActiveFights(mine._id.toString()),
        countActiveFights(opponent.id),
      ]);
      if (activeA > 1 || activeB > 1) {
        await GameFight.deleteOne({ _id: fight._id }).catch(() => undefined);
        await Challenge.updateOne(
          { _id: challenge._id, status: 'accepted' },
          {
            $set: {
              status: 'cancelled',
              cancelReason: 'Lawan ini baru saja masuk fight lain — coba Gas Tarung lagi',
              respondedAt: new Date(),
            },
          },
        ).catch(() => undefined);
        throw conflict(
          'Lawan ini baru saja masuk fight lain — coba Gas Tarung lagi',
          'QUICK_FIGHT_CONFLICT',
        );
      }

      claimed.gameFightId = fight._id;
      await claimed.save();

      // Beri tahu lawan: ada fight Gas Tarung yang melibatkannya
      // (hasil fight nanti memberitahu keduanya via 'fight_result').
      await notifyFighterOwner(
        opponent.id,
        'challenge_accepted',
        challenge._id.toString(),
      );

      return ok({
        status: 'matched',
        challenge: serialize(claimed.toObject()),
        gameFight: { id: fight._id.toString() },
        opponent: {
          id: opponent.id,
          displayName: opponent.displayName,
          rating: opponent.rating,
        },
        isTitleFight,
        config: {
          type: 'sfa-config',
          fightId: fight._id.toString(),
          fighters: { left, right },
          seed,
          map: challenge.map,
          duration: FIGHT_DURATION_SEC,
        },
      });
    } catch (err) {
      // Rollback klaim (kalau masih accepted) supaya challenge tidak
      // menggantung — kecuali errornya sudah membatalkan sendiri di atas.
      await Challenge.updateOne(
        { _id: challenge._id, status: 'accepted' },
        { $set: { status: 'cancelled', respondedAt: new Date() } },
      ).catch(() => undefined);
      throw err;
    }
  } catch (err) {
    return handleError(err);
  }
}
