import mongoose from 'mongoose';

// Daftarkan SEMUA skema Mongoose di sini. Setiap route handler hanya
// mengimpor model yang dipakainya sendiri, jadi tanpa ini populate() ke
// model lain gagal dengan MissingSchemaError di serverless instance yang
// dingin (route yang pertama kali dipanggil di instance itu belum pernah
// memuat model yang di-populate). Semua route memakai connectDB(), jadi
// semua skema selalu terdaftar sebelum query apa pun jalan.
import '@/models/AdminAuditLog';
import '@/models/Announcement';
import '@/models/Fighter';
import '@/models/Match';
import '@/models/Tournament';
import '@/models/TournamentEntry';
import '@/models/User';
import '@/models/VideoTask';

/**
 * Koneksi Mongoose dengan cache global (pola resmi Next.js App Router).
 * Jika MONGODB_URI tidak ada, connectDB() throw error jelas — route harus
 * mengubahnya jadi respons 503, jangan sampai crash build/server.
 */

declare global {
  var __sfhMongoose:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

const cached: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } =
  globalThis.__sfhMongoose ?? { conn: null, promise: null };
globalThis.__sfhMongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'DB_NOT_CONFIGURED: MONGODB_URI tidak ada — isi .env.local (lihat .env.example)',
    );
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { dbName: 'street-fight-hub' });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
