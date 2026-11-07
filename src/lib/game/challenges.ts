/**
 * Helper tantangan: kedaluwarsa lazy (tanpa cron di Fase 1).
 * Challenge pending dengan expiresAt lewat → 'expired'.
 */
import { Challenge } from '../../models/Challenge';

export const CHALLENGE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 hari

/** Tandai semua challenge pending yang sudah lewat expiresAt sebagai expired. */
export async function expireStaleChallenges(now: Date = new Date()): Promise<number> {
  const res = await Challenge.updateMany(
    { status: 'pending', expiresAt: { $lt: now } },
    { $set: { status: 'expired' } },
  );
  return res.modifiedCount ?? 0;
}
