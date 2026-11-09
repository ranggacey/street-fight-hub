/**
 * Helper tantangan: kedaluwarsa lazy (tanpa cron di Fase 1).
 * Challenge pending dengan expiresAt lewat → 'expired'.
 */
import { Types } from 'mongoose';
import { Challenge } from '../../models/Challenge';

export const CHALLENGE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 hari

/** Alasan pembatalan otomatis sibling satu batch saat ada yang menerima duluan. */
export const BATCH_CANCEL_REASON =
  'Sudah ada yang menerima duluan — tantangan ini otomatis batal.';

/** Tandai semua challenge pending yang sudah lewat expiresAt sebagai expired. */
export async function expireStaleChallenges(now: Date = new Date()): Promise<number> {
  const res = await Challenge.updateMany(
    { status: 'pending', expiresAt: { $lt: now } },
    { $set: { status: 'expired' } },
  );
  return res.modifiedCount ?? 0;
}

/**
 * Batalkan semua sibling pending dalam satu batch, kecuali challenge
 * yang baru saja diterima. Dipakai alur accept direct: yang menerima
 * duluan yang bertarung, tantangan ke lawan lain otomatis batal.
 * Mengembalikan sibling yang dibatalkan (id + fighter yang ditantang,
 * untuk notifikasi).
 */
export async function cancelBatchSiblings(
  batchId: Types.ObjectId | string,
  exceptChallengeId: Types.ObjectId | string,
): Promise<{ id: string; challengedFighterId: string }[]> {
  const siblings = await Challenge.find({
    batchId,
    status: 'pending',
    _id: { $ne: exceptChallengeId },
  })
    .select('_id challengedFighterId')
    .lean();
  if (siblings.length === 0) return [];
  await Challenge.updateMany(
    { batchId, status: 'pending', _id: { $ne: exceptChallengeId } },
    {
      $set: {
        status: 'cancelled',
        cancelReason: BATCH_CANCEL_REASON,
        respondedAt: new Date(),
      },
    },
  );
  return siblings.map((s) => ({
    id: s._id.toString(),
    challengedFighterId: s.challengedFighterId?.toString() ?? '',
  }));
}
