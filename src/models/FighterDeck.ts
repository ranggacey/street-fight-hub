import mongoose, { Schema } from 'mongoose';

// Deck jurus fighter: maks 6 kartu (dari gaya apa pun — validasi kind di
// lib/game/deck.ts) + 1 signature di luar deck (1x/fight, bobot 2,5x).
// `signature` di sini CERMIN Fighter.signatureMove: PUT /api/deck menulis
// keduanya supaya tidak pernah divergen (engine membaca signature dari
// objek fighter; deck API membaca dari dokumen ini).
const fighterDeckSchema = new Schema(
  {
    fighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true, unique: true },
    cards: { type: [String], default: [] },
    signature: { type: String, default: null },
  },
  { timestamps: true },
);

export const FighterDeck =
  mongoose.models.FighterDeck || mongoose.model('FighterDeck', fighterDeckSchema);
