/**
 * Helper notifikasi in-site (Fase 1). Semua notifikasi dibuat server-side
 * sebagai efek dari aksi game — klien tidak pernah membuat notifikasi
 * sendiri.
 */
import { Types } from 'mongoose';
import { Fighter } from '../../models/Fighter';
import { Notification } from '../../models/Notification';
import type { NOTIFICATION_TYPES } from '../../models/Notification';

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export async function notifyUser(
  userId: string,
  type: NotificationType,
  relatedId?: string | null,
): Promise<void> {
  await Notification.create({
    userId: new Types.ObjectId(userId),
    type,
    relatedId: relatedId ? new Types.ObjectId(relatedId) : null,
    read: false,
  });
}

/** Kirim notifikasi ke pemilik satu fighter (dicari lewat Fighter.userId). */
export async function notifyFighterOwner(
  fighterId: string,
  type: NotificationType,
  relatedId?: string | null,
): Promise<void> {
  const fighter = await Fighter.findById(fighterId).select('userId').lean();
  if (!fighter) return;
  await notifyUser(fighter.userId.toString(), type, relatedId);
}
