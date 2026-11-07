import mongoose, { Schema } from 'mongoose';

// Riwayat gelar — SATU event per perubahan gelar. WAJIB ada sebelum fight
// pertama: halaman /gelar + Hall of Fame + riwayat gelar per fighter
// semuanya dihitung dari koleksi ini (bukan dari dokumen Title saja).
// - `score`: jumlah kemenangan race saat penobatan (race_*_win), null untuk
//   takeover/vacated.
// - `defensesAtEnd`: jumlah defense reign yang berakhir (takeover/vacated).
// - `raceStartAt`: awal race yang dimenangkan (race_*_win) — dipakai
//   menghitung "raihan gelar tercepat" (at - raceStartAt).

export const TITLE_HISTORY_TYPES = [
  'race_10_win',
  'race_7_win',
  'takeover',
  'vacated_inactivity',
] as const;

const titleHistorySchema = new Schema(
  {
    type: { type: String, enum: TITLE_HISTORY_TYPES, required: true },
    previousHolderFighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', default: null },
    newHolderFighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', default: null },
    at: { type: Date, required: true },
    fightId: { type: Schema.Types.ObjectId, ref: 'GameFight', default: null },
    score: { type: Number, default: null },
    defensesAtEnd: { type: Number, default: null },
    raceStartAt: { type: Date, default: null },
  },
  { timestamps: true },
);

titleHistorySchema.index({ at: -1 });
titleHistorySchema.index({ newHolderFighterId: 1, at: -1 });
titleHistorySchema.index({ previousHolderFighterId: 1, at: -1 });

export const TitleHistory =
  mongoose.models.TitleHistory || mongoose.model('TitleHistory', titleHistorySchema);
