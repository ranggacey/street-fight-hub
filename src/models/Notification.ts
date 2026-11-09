import mongoose, { Schema } from 'mongoose';

// Notifikasi in-site minimal (Fase 1): tantangan, hasil fight, perubahan gelar.
// Ditampilkan di bell/daftar notifikasi; tidak ada push/email di Fase 1.

export const NOTIFICATION_TYPES = [
  'challenge_received',
  'challenge_accepted',
  'challenge_declined',
  'challenge_cancelled',
  'fight_result',
  'title_won',
  'title_lost',
  'title_vacant',
] as const;

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    /** Id dokumen terkait (Challenge / GameFight / TitleHistory). */
    relatedId: { type: Schema.Types.ObjectId, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
