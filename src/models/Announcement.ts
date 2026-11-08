import mongoose, { Schema } from 'mongoose';

const announcementSchema = new Schema(
  {
    text: { type: String, required: true, maxlength: 200 },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

announcementSchema.index({ active: 1, createdAt: -1 });

export const Announcement =
  mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
