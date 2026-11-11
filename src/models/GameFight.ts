import mongoose, { Schema } from 'mongoose';

// Satu fight game (challenge kasual / perebutan gelar).
// Fondasi replay Fase 2: `config` menyimpan objek fighter engine LENGKAP
// + seed + map + durasi — fight bisa dijalankan ulang identik dari data
// ini tanpa menyimpan video. `result`/`stats`/`keyMoments` HANYA diisi
// dari hasil yang sudah terverifikasi server (buildFight ulang); laporan
// klien yang tidak cocok → status `disputed`, ranking tidak berubah.

const gameFightSchema = new Schema(
  {
    fighterAId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true },
    fighterBId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true },
    challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge', default: null },
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', default: null },
    seed: { type: Number, required: true },
    map: {
      type: String,
      enum: ['ring', 'gudang', 'jalanan', 'dojo'],
      default: 'ring',
    },
    durationSec: { type: Number, default: 60 },
    status: {
      type: String,
      enum: ['pending', 'playing', 'completed', 'disputed'],
      default: 'pending',
    },
    /** Snapshot config sfa-config yang dikirim ke iframe (objek fighter engine). */
    config: {
      left: { type: Schema.Types.Mixed, required: true },
      right: { type: Schema.Types.Mixed, required: true },
      /**
       * Opts buildFight yang dipakai fight ini (stat/deck/gameplan —
       * dihitung server saat fight dibuat, lihat lib/game/fight-setup.ts).
       * Disimpan supaya verifikasi server (verifyFightResult) + replay
       * mereproduksi fight yang PERSIS SAMA. Null = fight lama pra-stat
       * (verifikasi tanpa opts, seperti dulu).
       */
      fightOpts: { type: Schema.Types.Mixed, default: null },
      /** Gameplan kedua sisi saat fight dibuat (tempo + fokus). */
      gameplans: { type: Schema.Types.Mixed, default: null },
    },
    result: {
      winnerSide: { type: String, enum: ['R', 'B', null], default: null },
      winnerFighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', default: null },
      method: { type: String, enum: ['KO', 'decision', 'draw', null], default: null },
      score: {
        a: { type: Number, default: null },
        b: { type: Number, default: null },
      },
      koTimeSec: { type: Number, default: null },
    },
    stats: {
      accuracyA: { type: Number, default: null },
      accuracyB: { type: Number, default: null },
      damageDealtA: { type: Number, default: null },
      damageDealtB: { type: Number, default: null },
      strikesThrownA: { type: Number, default: null },
      strikesThrownB: { type: Number, default: null },
      strikesLandedA: { type: Number, default: null },
      strikesLandedB: { type: Number, default: null },
      knockdowns: { type: Number, default: null },
    },
    keyMoments: { type: Schema.Types.Mixed, default: null },
    posterDataUrl: { type: String, default: null },
    isTitleFight: { type: Boolean, default: false },
    /** Alasan disputed (dari verifyFightResult), null kalau terverifikasi. */
    disputeReason: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

gameFightSchema.index({ fighterAId: 1, createdAt: -1 });
gameFightSchema.index({ fighterBId: 1, createdAt: -1 });
gameFightSchema.index({ status: 1, createdAt: -1 });
// Hitungan jatah harian (daily-limit): filter createdAt (rentang hari WIB)
// + satu fighter — index createdAt-dulu supaya rentang hari dipangkas
// sebelum mencocokkan fighter.
gameFightSchema.index({ createdAt: 1, fighterAId: 1 });
gameFightSchema.index({ createdAt: 1, fighterBId: 1 });

export const GameFight =
  mongoose.models.GameFight || mongoose.model('GameFight', gameFightSchema);
