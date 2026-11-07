import mongoose, { Schema } from 'mongoose';

// Gelar "Juara Street Fight" — SATU dokumen (singleton, slug unik).
// - `raceTarget`: 10 untuk race pertama, 7 untuk semua race setelah gelar
//   pernah kosong (`everVacated`).
// - `raceStartAt`: awal race yang sedang berjalan (null saat gelar dipegang).
//   Kemenangan race dihitung dari GameFight terverifikasi (completed)
//   dengan completedAt >= raceStartAt.
// - `lastFightAt` holder diupdate di SETIAP fight holder (menang/kalah);
//   kalau now - lastFightAt > 6 hari → gelar kosong (lazy, ensureTitleCurrent).

const titleSchema = new Schema(
  {
    name: { type: String, default: 'Juara Street Fight' },
    slug: { type: String, unique: true, default: 'juara-street-fight' },
    holderFighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', default: null },
    wonAt: { type: Date, default: null },
    lastFightAt: { type: Date, default: null },
    defenses: { type: Number, default: 0 },
    raceTarget: { type: Number, default: 10 },
    raceStartAt: { type: Date, default: () => new Date() },
    everVacated: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Title = mongoose.models.Title || mongoose.model('Title', titleSchema);
