import mongoose, { Schema } from 'mongoose';

const tournamentEntrySchema = new Schema(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    fighterId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true },
    joinedAt: { type: Date, default: () => new Date() },
    seed: { type: Number, default: null },
    status: {
      type: String,
      enum: ['active', 'eliminated', 'champion', 'withdrawn'],
      default: 'active',
    },
  },
  { timestamps: true },
);

tournamentEntrySchema.index({ tournamentId: 1, fighterId: 1 }, { unique: true });

export const TournamentEntry =
  mongoose.models.TournamentEntry || mongoose.model('TournamentEntry', tournamentEntrySchema);
