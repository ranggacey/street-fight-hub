import mongoose, { Schema } from 'mongoose';

/**
 * Prediksi penonton atas satu fight.
 *
 * - fightId menyimpan id GameFight (kind 'game') ATAU Match turnamen
 *   (kind 'tournament') sebagai string — sengaja bukan ref karena
 *   dua koleksi berbeda.
 * - stake 10 koin dipotong saat prediksi dibuat; benar → +20 koin
 *   (stake kembali + 10 untung); salah → stake hangus.
 * - Satu prediksi per user per fight (unique index).
 * - Resolusi di resolvePredictions() (progress.ts), dipanggil dari
 *   result route GameFight dan (oleh agen lain) dari decideMatch.
 */
const predictionSchema = new Schema(
  {
    fightId: { type: String, required: true },
    kind: { type: String, enum: ['game', 'tournament'], required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    predictedWinnerFighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true },
    stake: { type: Number, default: 10 },
    status: { type: String, enum: ['open', 'won', 'lost'], default: 'open' },
    /** Koin yang dibayarkan saat menang (20) atau 0 saat kalah. */
    payout: { type: Number, default: 0 },
  },
  { timestamps: true },
);

predictionSchema.index({ fightId: 1, kind: 1, userId: 1 }, { unique: true });
predictionSchema.index({ fightId: 1, kind: 1, status: 1 });

export const Prediction =
  mongoose.models.Prediction || mongoose.model('Prediction', predictionSchema);
