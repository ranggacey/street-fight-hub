import mongoose, { Schema } from 'mongoose';

const videoTaskSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true, unique: true },
    status: {
      type: String,
      enum: ['queued', 'in_production', 'uploaded', 'blocked'],
      default: 'queued',
    },
    note: { type: String, default: '' },
    reelUrl: { type: String, default: null },
  },
  { timestamps: true },
);

export const VideoTask =
  mongoose.models.VideoTask || mongoose.model('VideoTask', videoTaskSchema);
