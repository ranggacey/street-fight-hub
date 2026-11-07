import mongoose, { Schema } from 'mongoose';

const videoTaskSchema = new Schema(
  {
    // Satu task per match turnamen (matchId unik). Untuk title fight game
    // TIDAK ADA Match — matchId dihilangkan (bukan null eksplisit, supaya
    // index unique yang sudah ada di Mongo tidak menolak task kedua;
    // dokumen tanpa field ini tidak masuk index unique). `sparse` TIDAK
    // ditambahkan di sini supaya Mongoose tidak mencoba membuat index
    // baru yang bentrok dengan index unique yang sudah ada di produksi.
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', unique: true },
    kind: { type: String, enum: ['match', 'title'], default: 'match' },
    gameFightId: { type: Schema.Types.ObjectId, ref: 'GameFight', default: null },
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
