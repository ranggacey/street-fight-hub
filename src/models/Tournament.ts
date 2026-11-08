import mongoose, { Schema } from 'mongoose';

const tournamentSchema = new Schema(
  {
    name: { type: String, required: true, minlength: 3, maxlength: 100, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    format: { type: String, enum: ['single-elim'], default: 'single-elim' },
    bracketSize: { type: Number, enum: [8, 16, 32], required: true },
    regOpenAt: { type: Date, required: true },
    regCloseAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['upcoming', 'closed', 'in_progress', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    rules: { type: String, default: '' },
    championId: { type: Schema.Types.ObjectId, ref: 'Fighter', default: null },
    bracketSeed: { type: Number, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

tournamentSchema.index({ status: 1, createdAt: -1 });

export const Tournament =
  mongoose.models.Tournament || mongoose.model('Tournament', tournamentSchema);
