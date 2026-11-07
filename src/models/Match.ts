import mongoose, { Schema } from 'mongoose';

const scoreSchema = new Schema(
  {
    a: { type: Number, required: true },
    b: { type: Number, required: true },
  },
  { _id: false },
);

const matchSchema = new Schema(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    round: { type: String, enum: ['R32', 'R16', 'QF', 'SF', 'F'], required: true },
    fighterAId: { type: Schema.Types.ObjectId, ref: 'Fighter', required: true },
    fighterBId: { type: Schema.Types.ObjectId, ref: 'Fighter', default: null },
    winnerId: { type: Schema.Types.ObjectId, ref: 'Fighter', default: null },
    method: { type: String, enum: ['KO', 'decision', 'draw', 'bye'], default: null },
    score: { type: scoreSchema, default: null },
    koTimeSec: { type: Number, default: null },
    drawSeed: { type: Number, required: true },
    drawAdvancerId: { type: Schema.Types.ObjectId, ref: 'Fighter', default: null },
    drawReRollSeed: { type: Number, default: null },
    isBye: { type: Boolean, default: false },
    status: { type: String, enum: ['scheduled', 'decided', 'video_done'], default: 'scheduled' },
    reelUrl: { type: String, default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

matchSchema.index({ tournamentId: 1, round: 1 });

export const Match = mongoose.models.Match || mongoose.model('Match', matchSchema);
