import mongoose, { Schema } from 'mongoose';

// Persona AI DIHAPUS 2026-11-07 (perintah rangga — AI generate menggantung
// 10 menit, user minta hapus). Fighter hanya punya identitas inti:
// displayName, igUsername, style, selfDescription. Warna kartu diambil
// dari gaya bertarung (styleColor di components/api.ts), bukan persona.

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
      enum: ['boxing', 'taekwondo', 'muay-thai', 'street', 'karate', 'silat', 'wrestling', 'other'],
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
  },
  { timestamps: true },
);

export const Fighter = mongoose.models.Fighter || mongoose.model('Fighter', fighterSchema);
