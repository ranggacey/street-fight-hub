import { handleError, notFound } from '@/lib/http';

/**
 * Stub — route migrasi one-time delete-glaciero SUDAH DIHAPUS setelah
 * dipakai (2026-11-08: Glaciero Aurelio + entry NFC#1 dihapus, commit
 * ec61e77e). File ini dipertahankan sebagai stub 404 karena push via
 * konektor GitHub tidak mendukung penghapusan file. Jangan mengembalikan
 * logika hapus ke file ini.
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
