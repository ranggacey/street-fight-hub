import mongoose, { Schema } from 'mongoose';

// Pesan chat global (Fase 1). Batas 1–500 karakter + rate limit di API
// (1 pesan / 3 detik, maks 30 / jam per user — lihat src/lib/game/chat-rate.ts).
// Render memakai escape default React; JANGAN pernah render teks chat
// dengan dangerouslySetInnerHTML.

const chatMessageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, minlength: 1, maxlength: 500 },
  },
  { timestamps: true },
);

chatMessageSchema.index({ createdAt: -1 });

export const ChatMessage =
  mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);
