import mongoose from 'mongoose';

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
