import mongoose, { Schema } from 'mongoose';

/**
 * Progres fighter — XP, level, koin, gear, achievement, cedera.
 *
 * SENGAJA terpisah dari dokumen Fighter: Fighter menyimpan identitas +
 * rekor + rating (SATU rekor permanen); semua sistem anti-monoton
 * (XP/koin/gear/achievement/cedera) tinggal di sini supaya Fighter
 * tetap ramping dan tidak ada sistem ekonomi yang menyentuh rekor.
 * Satu FighterProgress per fighter (fighterId unique).
 */
export type InjuryStat = 'power' | 'speed' | 'stamina' | 'defense' | 'accuracy';

const injurySchema = new Schema(
  {
    /** Stat yang efeknya berkurang selama cedera. */
    stat: {
      type: String,
      enum: ['power', 'speed', 'stamina', 'defense', 'accuracy'],
      required: true,
    },
    /** Persen pengurangan nilai EFEKTIF stat (15 = -15%). */
    pct: { type: Number, required: true },
    /** Sisa fight yang harus dijalani sampai sembuh (turun 1 tiap fight). */
    fightsRemaining: { type: Number, required: true },
  },
  { _id: false },
);

const fighterProgressSchema = new Schema(
  {
    fighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true, unique: true },
    /** Total XP terkumpul (level dihitung dari XP — lihat progress.ts). */
    xp: { type: Number, default: 0 },
    /** Level (cache dari XP; dihitung ulang tiap awardFightOutcome). */
    level: { type: Number, default: 1 },
    /** Koin: dipakai beli gear kosmetik + taruhan prediksi. */
    coins: { type: Number, default: 0 },
    /** ID gear yang sudah dibeli (katalog src/lib/game/gear-catalog.ts). */
    gearOwned: { type: [String], default: [] },
    /** ID achievement yang sudah terbuka (katalog achievement-catalog.ts). */
    achievements: { type: [String], default: [] },
    /** Cedera aktif, atau null kalau sehat. */
    injury: { type: injurySchema, default: null },
    /** Jumlah fight yang sudah dijalani (dipakai achievement 100 fight). */
    totalFights: { type: Number, default: 0 },
    /** Kemenangan beruntun saat ini (dipakai achievement 5x tak terkalahkan). */
    currentWinStreak: { type: Number, default: 0 },
    /** Hari beruntun ada fight (dipakai achievement streak 7 hari). */
    activityStreakDays: { type: Number, default: 0 },
    /** Tanggal (WIB, YYYY-MM-DD) fight terakhir — penentu streak harian. */
    lastFightDay: { type: String, default: null },
    lastFightAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const FighterProgress =
  mongoose.models.FighterProgress ||
  mongoose.model('FighterProgress', fighterProgressSchema);
