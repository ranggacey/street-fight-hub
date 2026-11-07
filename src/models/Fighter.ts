import mongoose, { Schema } from 'mongoose';

const aiPersonaSchema = new Schema(
  {
    nickname: { type: String, required: true },
    styleSummary: { type: String, required: true },
    strengths: { type: [String], required: true },
    weakness: { type: String, required: true },
    signatureMove: { type: String, required: true },
    introLine: { type: String, required: true },
    color: { type: String, required: true },
    gear: { type: String, required: true },
  },
  { _id: false },
);

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
    selfDescription: { type: String, required: true, minlength: 50, maxlength: 600 },
    aiPersona: { type: aiPersonaSchema, default: null },
    record: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      kos: { type: Number, default: 0 },
    },
    status: { type: String, enum: ['active', 'retired'], default: 'active' },
    regenCount: { type: Number, default: 0, max: 3 },
  },
  { timestamps: true },
);

export const Fighter = mongoose.models.Fighter || mongoose.model('Fighter', fighterSchema);
