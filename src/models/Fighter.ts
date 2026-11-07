import mongoose, { Schema } from 'mongoose';

// Persona AI DIHAPUS 2026-11-07 (perintah rangga — AI generate menggantung
// 10 menit, user minta hapus). Fighter hanya punya identitas inti:
// displayName, igUsername, style, selfDescription. Warna kartu diambil
// dari gaya bertarung (styleColor di components/api.ts), bukan persona.
//
// Fase 1 integrasi game (2026-11-07): field game — rating Elo kasual,
// casualRecord (TERPISAH dari record turnamen), signatureMove, tempo,
// dan warna RGB bebas per bagian (colors). Warna TIDAK mengubah gameplay,
// hanya tampilan di arena (EMBED-CONTRACT §4).

const fighterSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    displayName: { type: String, required: true, minlength: 1, maxlength: 30, trim: true },
    igUsername: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 30,
      trim: true,
      match: /^[A-Za-z0-9._]+$/,
    },
    style: {
      type: String,
      enum: [
        'boxing',
        'taekwondo',
        'muay-thai',
        'street',
        'karate',
        'silat',
        'wrestling',
        'other',
        // Gaya baru Fase 1 (engine arena sudah punya semuanya):
        'kali-arnis',
        'judo',
        'kudo',
        'jeet-kune-do',
        'capoeira',
        'wushu',
        'kung-fu',
      ],
      required: true,
    },
    styleOther: { type: String, default: null },
    selfDescription: { type: String, required: true, minlength: 1, maxlength: 600 },
    record: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      kos: { type: Number, default: 0 },
    },
    status: { type: String, enum: ['active', 'retired'], default: 'active' },
    // --- Game kasual (Fase 1) ---
    rating: { type: Number, default: 1000 },
    casualRecord: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      kos: { type: Number, default: 0 },
    },
    /** Jurus khas: kind gerakan dari moves.js gaya ini (bobot 2.5x di engine). */
    signatureMove: { type: String, default: null },
    tempo: {
      type: String,
      enum: ['agresif', 'seimbang', 'bertahan'],
      default: 'seimbang',
    },
    /** Warna RGB bebas per bagian; 'none' = bagian tidak dipakai (belt/headband). */
    colors: {
      body: { type: String, default: null },
      gloves: { type: String, default: '#141210' },
      shoes: { type: String, default: '#FBF8F1' },
      belt: { type: String, default: 'none' },
      headband: { type: String, default: 'none' },
      weapon: { type: String, default: '#8B5E34' },
    },
  },
  { timestamps: true },
);

export const Fighter = mongoose.models.Fighter || mongoose.model('Fighter', fighterSchema);
