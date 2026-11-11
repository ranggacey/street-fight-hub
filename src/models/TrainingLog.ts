import mongoose, { Schema } from 'mongoose';

// Log latihan harian per fighter (satu dokumen per fighter per hari WIB).
// dateWIB = 'YYYY-MM-DD' Asia/Jakarta. pushups/squats = total hari itu
// (cap server: 50 push-up / 30 squat). pointsEarned = poin yang
// dihasilkan hari itu (maks 4 — dihitung ulang server dari hitungan).
const trainingLogSchema = new Schema(
  {
    fighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true },
    dateWIB: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    pushups: { type: Number, default: 0, min: 0 },
    squats: { type: Number, default: 0, min: 0 },
    pointsEarned: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

trainingLogSchema.index({ fighterId: 1, dateWIB: 1 }, { unique: true });

export const TrainingLog =
  mongoose.models.TrainingLog || mongoose.model('TrainingLog', trainingLogSchema);
