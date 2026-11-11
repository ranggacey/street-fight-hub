import mongoose, { Schema } from 'mongoose';
import { STAT_MAX, STAT_START } from '../lib/game/stat-effects';

// Stat fighter dari latihan kamera (skema disetujui 2026-11-10).
// Satu dokumen per fighter. Stat mulai 10, maks 100 (mentah —
// diminishing returns di atas 80 hanya berlaku untuk EFEK, lihat
// stat-effects.ts). pointsAvailable = poin latihan yang sudah didapat
// tapi belum dialokasikan. lifetime = total rep sepanjang masa (untuk
// profil/statistik, tidak memengaruhi cap harian).
const fighterStatsSchema = new Schema(
  {
    fighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true, unique: true },
    stats: {
      power: { type: Number, default: STAT_START, min: STAT_START, max: STAT_MAX },
      speed: { type: Number, default: STAT_START, min: STAT_START, max: STAT_MAX },
      stamina: { type: Number, default: STAT_START, min: STAT_START, max: STAT_MAX },
      defense: { type: Number, default: STAT_START, min: STAT_START, max: STAT_MAX },
      accuracy: { type: Number, default: STAT_START, min: STAT_START, max: STAT_MAX },
    },
    pointsAvailable: { type: Number, default: 0, min: 0 },
    lifetime: {
      pushups: { type: Number, default: 0, min: 0 },
      squats: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true },
);

export const FighterStats =
  mongoose.models.FighterStats || mongoose.model('FighterStats', fighterStatsSchema);
