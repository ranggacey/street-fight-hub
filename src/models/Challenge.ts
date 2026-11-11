import mongoose, { Schema } from 'mongoose';

// Tantangan 1v1 antar fighter (Fase 1 integrasi game).
// Satu tantangan aktif per pasangan; kedaluwarsa 3 hari (dicek lazy saat dibaca).
//
// TANTANGAN TIDAK ADA BATAS HARIAN (perintah user 9 Nov 2026): berapa
// pun tantangan boleh dikirim per hari; yang dibatasi hanya jatah
// tarung 5/hari (dicek saat accept, bukan saat kirim).
//
// DUA JENIS TANTANGAN (field `kind`):
// - 'direct' (default): tantangan ke 1 fighter tertentu —
//   `challengedFighterId` wajib diisi, hanya fighter itu yang bisa
//   menerima/menolak lewat /api/challenges/[id]/accept|decline.
// - 'open': tantangan TERBUKA ke semua orang — `challengedFighterId`
//   null saat dibuat, diisi OTOMATIS dengan fighter yang PERTAMA
//   menerima lewat /api/challenges/[id]/accept-open. Yang menerima
//   belakangan ditolak (status sudah bukan 'pending').
//
// TANTANG BANYAK ORANG (field `batchId`, perintah user 9 Nov 2026):
// satu kirim ke N lawan = N Challenge direct dengan batchId yang sama.
// Saat SATU challenge dalam batch di-accept, sibling pending lain
// dalam batch yang sama OTOMATIS dibatalkan (status 'cancelled' +
// cancelReason). Status 'cancelled' HANYA dipakai untuk pembatalan
// otomatis ini — penolakan manual tetap 'declined'.

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
      enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
      default: 'pending',
    },
    /** Alasan pembatalan otomatis batch (hanya saat status 'cancelled'). */
    cancelReason: { type: String, maxlength: 140, default: null },
    /** Batch tantang-banyak-orang: Challenge dalam satu kirim berbagi batchId. */
    batchId: { type: Schema.Types.ObjectId, default: null },
    gameFightId: { type: Schema.Types.ObjectId, ref: 'GameFight', default: null },
    /** Gameplan penantang saat tantangan dibuat (tempo + fokus) —
     * dipakai saat accept untuk membangun fightOpts. Null = default
     * (seimbang/balanced). */
    gameplan: { type: Schema.Types.Mixed, default: null },
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
// Kedaluwarsa lazy (expireStaleChallenges) + hitungan tantangan/hari:
// tanpa index keduanya COLLSCAN / pindai semua tantangan penantang.
challengeSchema.index({ status: 1, expiresAt: 1 });
challengeSchema.index({ challengerFighterId: 1, createdAt: -1 });
// Batch tantang-banyak-orang: cari sibling pending satu batch.
challengeSchema.index({ batchId: 1, status: 1 });

export const Challenge =
  mongoose.models.Challenge || mongoose.model('Challenge', challengeSchema);
