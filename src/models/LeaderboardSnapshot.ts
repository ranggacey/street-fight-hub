import mongoose, { Schema } from 'mongoose';

// Snapshot klasemen kasual (murah): diambil lazy saat /api/leaderboard
// dibuka kalau belum ada snapshot 7 hari terakhir (reason 'periodic'),
// atau saat turnamen berakhir (reason 'tournament_end' — Fase 2).
// UI riwayat klasemen = Fase 2 (baca snapshot ini).

const leaderboardSnapshotSchema = new Schema(
  {
    at: { type: Date, required: true },
    reason: { type: String, enum: ['tournament_end', 'periodic'], required: true },
    entries: [
      {
        fighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true },
        rating: { type: Number, required: true },
        casualWins: { type: Number, required: true },
        rank: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true },
);

leaderboardSnapshotSchema.index({ at: -1 });

export const LeaderboardSnapshot =
  mongoose.models.LeaderboardSnapshot ||
  mongoose.model('LeaderboardSnapshot', leaderboardSnapshotSchema);
