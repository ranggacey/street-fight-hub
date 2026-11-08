import { handleError, notFound } from '@/lib/http';

/**
 * Stub — route migrasi one-time backfill-rating SUDAH DIHAPUS setelah
 * dipakai (2026-11-08, commit e5045767). File ini dipertahankan sebagai
 * stub 404 karena push via konektor GitHub tidak mendukung penghapusan
 * file. Jangan mengembalikan logika migrasi ke file ini.
 */
export async function GET() {
  try {
    throw notFound('Tidak ditemukan');
  } catch (err) {
    return handleError(err);
  }
}

export async function POST() {
  try {
    throw notFound('Tidak ditemukan');
  } catch (err) {
    return handleError(err);
  }
}
