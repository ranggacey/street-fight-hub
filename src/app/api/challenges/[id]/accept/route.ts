import { randomInt } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import {
  BATCH_CANCEL_REASON,
  cancelBatchSiblings,
  expireStaleChallenges,
} from '@/lib/game/challenges';
import { countFightsToday, DAILY_FIGHT_LIMIT } from '@/lib/game/daily-limit';
import { FIGHT_DURATION_SEC, toEngineFighter } from '@/lib/game/engine-config';
import { notifyFighterOwner } from '@/lib/game/notify';
import { ensureTitleCurrent } from '@/lib/game/title-service';
import {
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

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/challenges/[id]/accept — yang ditantang menerima.
 * Membuat GameFight + seed server, mengembalikan payload sfa-config.
 * Cek limit 3 fight/hari (WIB) untuk KEDUA fighter + kekosongan gelar (lazy).
 *
 * Anti-race (pola yang sama dengan accept-open): klaim dilakukan dengan
 * SATU update atomik findOneAndUpdate({ _id, status: 'pending' }) —
 * hanya satu request yang berhasil mengubah pending → accepted.
 * GameFight baru dibuat SETELAH klaim menang, supaya tidak ada fight
 * yatim; kalau pembuatan fight gagal, klaim di-rollback ke pending.
 *
 * Tantang-banyak-orang (batch): kalau challenge ini bagian dari satu
 * batch, yang menerima duluan yang bertarung. Guard anti-race:
 * setelah klaim, cek apakah ada sibling SATU BATCH lain yang sudah
 * 'accepted'. Kalau ada, accept ini KALAH: klaim di-rollback ke
 * pending dan dijawab 409 BATCH_ALREADY_ACCEPTED. Rollback ke pending
 * (bukan cancelled) sengaja dipilih: kalau dua accept bersamaan
 * sama-sama kalah guard (keduanya melihat satu sama lain sudah
 * accepted), keduanya tetap pending dan bisa retry — tidak ada fight
 * ganda, tidak ada batch yang mati sia-sia. Yang menang (tepat satu,
 * lihat bukti di bawah) melanjutkan dan membatalkan semua sibling
 * pending lain (cancelBatchSiblings).
 *
 * Bukti tepat-satu-pemenang: misal X dan Y accept bersamaan. X lolos
 * guard ⟺ saat guard X berjalan, Y belum accepted. Y lolos guard ⟺
 * saat guard Y berjalan, X belum accepted. Kalau X lolos, Y belum
 * klaim saat guard X berjalan, jadi klaim Y terjadi sesudahnya —
 * dan saat guard Y berjalan, X masih accepted (X baru melepas klaim
 * kalau kalah guard / gagal buat fight). Jadi Y melihat X accepted
 * dan kalah. Simetris untuk Y lolos. Jadi keduanya tidak bisa lolos
 * bersamaan — maksimal satu fight. (Keduanya kalah mungkin terjadi
 * hanya kalau kedua guard berjalan saat keduanya masih accepted;
 * keduanya rollback ke pending dan retry akan menang.)
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const { id } = await params;
    await connectDB();
    await expireStaleChallenges();

    const challenge = await Challenge.findById(id);
    if (!challenge) throw notFound('Tantangan tidak ditemukan');
    if (challenge.status !== 'pending') {
      throw conflict('Tantangan ini sudah tidak aktif', 'CHALLENGE_NOT_PENDING');
    }
    // Tantangan terbuka tidak bisa diterima lewat endpoint langsung —
    // pakai /api/challenges/[id]/accept-open (siapa pun boleh menerima).
    if (challenge.kind === 'open') {
      throw conflict(
        'Tantangan terbuka diterima lewat halaman Obrolan',
        'CHALLENGE_NOT_DIRECT',
      );
    }

    const challenged = await Fighter.findById(challenge.challengedFighterId);
    if (!challenged) throw notFound('Fighter yang ditantang tidak ditemukan');
    if (challenged.userId.toString() !== session.userId) {
      throw forbidden('Hanya fighter yang ditantang yang bisa menerima');
    }
    const challenger = await Fighter.findById(challenge.challengerFighterId);
    if (!challenger) throw notFound('Fighter penantang tidak ditemukan');

    // Limit 3 fight/hari (WIB) — kedua fighter.
    const [usedA, usedB] = await Promise.all([
      countFightsToday(challenger._id.toString()),
      countFightsToday(challenged._id.toString()),
    ]);
    if (usedA >= DAILY_FIGHT_LIMIT || usedB >= DAILY_FIGHT_LIMIT) {
      throw conflict(
        'Jatah tarung hari ini sudah habis (maks 3 fight/hari, reset tengah malam WIB)',
        'DAILY_LIMIT_REACHED',
      );
    }

    // Klaim atomik: hanya satu penerima per challenge yang bisa
    // mengubah pending → accepted.
    const claimed = await Challenge.findOneAndUpdate(
      { _id: challenge._id, status: 'pending' },
      { $set: { status: 'accepted', respondedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!claimed) {
      throw conflict('Tantangan ini sudah tidak aktif', 'CHALLENGE_NOT_PENDING');
    }

    // Guard batch: kalau ada sibling SATU BATCH lain yang sudah
    // accepted, accept ini kalah — rollback klaim ke pending supaya
    // bisa retry, lalu jawab 409. (Lihat bukti tepat-satu-pemenang di
    // komentar file ini.)
    if (claimed.batchId) {
      const otherWinner = await Challenge.findOne({
        batchId: claimed.batchId,
        status: 'accepted',
        _id: { $ne: claimed._id },
      })
        .select('_id')
        .lean();
      if (otherWinner) {
        await Challenge.updateOne(
          { _id: claimed._id, status: 'accepted' },
          { $set: { status: 'pending', respondedAt: null } },
        );
        throw conflict(
          'Sudah ada yang menerima duluan — tantangan ini otomatis batal',
          'BATCH_ALREADY_ACCEPTED',
        );
      }
    }

    try {
      // Kekosongan gelar dicek lazy di sini (tanpa cron).
      const { title } = await ensureTitleCurrent();
      const holderId = title.holderFighterId ? title.holderFighterId.toString() : null;
      const isTitleFight =
        holderId === challenger._id.toString() || holderId === challenged._id.toString();

      // Seed server (acak, 6 digit seperti randomSeed arena).
      const seed = randomInt(100000, 1000000);
      const left = toEngineFighter(challenger.toObject());
      const right = toEngineFighter(challenged.toObject());

      const fight = await GameFight.create({
        fighterAId: challenger._id,
        fighterBId: challenged._id,
        challengeId: challenge._id,
        tournamentId: null,
        seed,
        map: challenge.map,
        durationSec: FIGHT_DURATION_SEC,
        status: 'pending',
        config: { left, right },
        isTitleFight,
      });

      claimed.gameFightId = fight._id;
      await claimed.save();

      // Batch: batalkan semua sibling pending lain + beri tahu pemiliknya.
      if (claimed.batchId) {
        const cancelled = await cancelBatchSiblings(claimed.batchId, claimed._id);
        for (const sib of cancelled) {
          if (sib.challengedFighterId) {
            await notifyFighterOwner(
              sib.challengedFighterId,
              'challenge_cancelled',
              sib.id,
            );
          }
        }
      }

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
        },
      });
    } catch (err) {
      // Rollback klaim supaya tantangan tetap bisa diterima orang lain.
      await Challenge.updateOne(
        { _id: challenge._id, status: 'accepted' },
        { $set: { status: 'pending', respondedAt: null, gameFightId: null } },
      ).catch(() => undefined);
      throw err;
    }
  } catch (err) {
    return handleError(err);
  }
}
