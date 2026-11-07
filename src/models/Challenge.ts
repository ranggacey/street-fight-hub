import mongoose, { Schema } from 'mongoose';

// Tantangan 1v1 antar fighter (Fase 1 integrasi game).
// Satu tantangan aktif per pasangan; kedaluwarsa 3 hari (dicek lazy saat dibaca).

const challengeSchema = new Schema(
  {
    challengerFighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true },
    challengedFighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired'],
      default: 'pending',
    },
    gameFightId: { type: Schema.Types.ObjectId, ref: 'GameFight', default: null },
    map: {
      type: String,
      enum: ['ring', 'gudang', 'jalanan', 'dojo'],
      default: 'ring',
    },
    message: { type: String, maxlength: 140, default: null },
    respondedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

challengeSchema.index({ challengerFighterId: 1, challengedFighterId: 1, status: 1 });
challengeSchema.index({ challengedFighterId: 1, status: 1 });

export const Challenge =
  mongoose.models.Challenge || mongoose.model('Challenge', challengeSchema);
