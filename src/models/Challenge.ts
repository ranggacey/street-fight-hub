import mongoose, { Schema } from 'mongoose';

// Tantangan 1v1 antar fighter (Fase 1 integrasi game).
// Satu tantangan aktif per pasangan; kedaluwarsa 3 hari (dicek lazy saat dibaca).
//
// DUA JENIS TANTANGAN (field `kind`):
// - 'direct' (default): tantangan ke 1 fighter tertentu —
//   `challengedFighterId` wajib diisi, hanya fighter itu yang bisa
//   menerima/menolak lewat /api/challenges/[id]/accept|decline.
// - 'open': tantangan TERBUKA ke semua orang — `challengedFighterId`
//   null saat dibuat, diisi OTOMATIS dengan fighter yang PERTAMA
//   menerima lewat /api/challenges/[id]/accept-open. Yang menerima
//   belakangan ditolak (status sudah bukan 'pending').
//   Alasan `kind` + null, bukan koleksi terpisah: satu skema, satu
//   hitungan limit harian (countChallengesSentToday / countFightsToday
//   memangku keduanya), dan satu alur kedaluwarsa lazy yang sama.
//   `challengedFighterId` dibuat tidak required supaya dokumen 'open'
//   valid sebelum ada yang menerima; route direct tetap memvalidasi
//   keberadaannya (validateChallengeBody).

const challengeSchema = new Schema(
  {
    challengerFighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true },
    challengedFighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', default: null },
    kind: {
      type: String,
      enum: ['direct', 'open'],
      default: 'direct',
    },
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
// Tantangan terbuka: daftar yang masih bisa diterima + cek 1 open aktif per penantang.
challengeSchema.index({ kind: 1, status: 1, createdAt: -1 });
challengeSchema.index({ challengerFighterId: 1, kind: 1, status: 1 });

export const Challenge =
  mongoose.models.Challenge || mongoose.model('Challenge', challengeSchema);
