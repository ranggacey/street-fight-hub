import mongoose, { Schema } from 'mongoose';
import { ACCESSORY_IDS } from '../lib/game/accessories';

// Persona AI DIHAPUS 2026-11-07 (perintah rangga — AI generate menggantung
// 10 menit, user minta hapus). Fighter hanya punya identitas inti:
// displayName, igUsername, style, selfDescription. Warna kartu diambil
// dari gaya bertarung (styleColor di components/api.ts), bukan persona.
//
// Fase 1 integrasi game (2026-11-07): field game — rating Elo,
// record (SATU rekor untuk SEMUA fight: kasual, turnamen, perebutan
// gelar — menang ya menang, kalah ya kalah, di mana pun mainnya;
// 2026-11-08: casualRecord DIHAPUS, disatukan ke record), signatureMove,
// tempo, dan warna RGB bebas per bagian (colors). Warna TIDAK mengubah
// gameplay, hanya tampilan di arena (EMBED-CONTRACT §4).

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
    /**
     * SATU rekor (menang/kalah/seri + KO) untuk SEMUA fight yang selesai
     * — kasual 1v1, tantangan terbuka, turnamen, perebutan gelar.
     * Diperbarui oleh GameFight selesai (result/route.ts) dan oleh match
     * turnamen diputuskan (lib/draw.ts). Dulu ada casualRecord terpisah
     * (dihapus 2026-11-08, digabung ke sini).
     */
    record: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      kos: { type: Number, default: 0 },
    },
    status: { type: String, enum: ['active', 'retired'], default: 'active' },
    // --- Game kasual (Fase 1) ---
    // rating Elo: SATU angka (tidak terpecah kasual/turnamen); berubah
    // hanya saat GameFight selesai (kasual/terbuka/gelar). Match turnamen
    // (draw.ts) TIDAK mengubah rating — hanya record.
    rating: { type: Number, default: 1000 },
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
    /**
     * Aksesoris per bagian tubuh (katalog src/lib/game/accessories.ts).
     * Semua opsional, TANPA default di skema — resolusi (fallback
     * turunan warna) dilakukan di engine-config, jadi fighter lama
     * tanpa field ini tetap mendapat varian yang benar.
     */
    accessories: {
      head: { type: String, enum: ACCESSORY_IDS.head, default: undefined },
      hands: { type: String, enum: ACCESSORY_IDS.hands, default: undefined },
      feet: { type: String, enum: ACCESSORY_IDS.feet, default: undefined },
      body: { type: String, enum: ACCESSORY_IDS.body, default: undefined },
      belt: { type: String, enum: ACCESSORY_IDS.belt, default: undefined },
      weapon: { type: String, enum: ACCESSORY_IDS.weapon, default: undefined },
    },
  },
  { timestamps: true },
);

// Klasemen (rating) + klasemen (wins): keduanya mengurut seluruh fighter
// aktif atas SATU rekor (record) — tanpa index, Mongo mengurut di memori
// (SORT) sambil memindai semua dokumen. Diukur lokal 2000 fighter: SORT,
// 27 ms; dengan index di bawah: IXSCAN tanpa sort di memori (waktu mirip
// di skala ini, tapi tidak ada risiko sort memori saat fighter membanyak).
fighterSchema.index({ status: 1, rating: -1, 'record.wins': -1, createdAt: 1 });
fighterSchema.index({ status: 1, 'record.wins': -1, 'record.kos': -1, 'record.losses': 1, createdAt: 1 });

// Username IG unik (case-insensitive): satu handle IG hanya boleh
// dipakai satu fighter — cegah duplikat seperti kasus strivox_id
// (Glaciero Aurelio vs STRIVOX, 2026-11-08). Collation strength 2 =
// case-insensitive; query yang memakai collation yang sama memakai
// index ini, dan insert yang melanggar ditolak E11000 (bukan 500).
fighterSchema.index({ igUsername: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Fighter = mongoose.models.Fighter || mongoose.model('Fighter', fighterSchema);
