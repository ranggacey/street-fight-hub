import { handleError, notFound } from '@/lib/http';

/**
 * Stub — route diagnostik one-time diag-duplicate-fighters SUDAH DIHAPUS
 * setelah dipakai (2026-11-08, commit d562390d + 42dafade0). File ini
 * dipertahankan sebagai stub 404 karena push via konektor GitHub tidak
 * mendukung penghapusan file. Jangan mengembalikan logika diagnostik
 * ke file ini.
 */
export async function GET() {
  try {
    throw notFound('Tidak ditemukan');
  } catch (err) {
    return handleError(err);
  }
}
