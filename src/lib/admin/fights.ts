/**
 * Helper admin "Pertandingan": daftar fight per hari WIB + nama file poster.
 * Fungsi di sini MURNI (tanpa DB) supaya bisa dites unit tanpa MongoDB.
 */
import { wibDayWindow } from "../game/daily-limit";

/** Tanggal WIB hari ini sebagai `YYYY-MM-DD` (Asia/Jakarta, UTC+7). */
export function todayWibDateStr(now: Date = new Date()): string {
  const WIB_MS = 7 * 60 * 60 * 1000;
  return new Date(now.getTime() + WIB_MS).toISOString().slice(0, 10);
}

/**
 * Jendela hari WIB untuk tanggal `YYYY-MM-DD` (00:00–24:00 Asia/Jakarta).
 * Kembalikan null kalau format tanggal tidak valid.
 */
export function wibDateWindow(dateStr: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const noon = new Date(`${dateStr}T12:00:00+07:00`);
  if (Number.isNaN(noon.getTime())) return null;
  return wibDayWindow(noon);
}

/** Slug nama fighter untuk nama file: kecil, spasi jadi `-`, buang karakter lain. */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "fighter";
}

/**
 * Nama file poster satu fight, langsung bisa dipakai untuk upload harian:
 * `2026-11-08_pitung-vs-jamal-geng-sebelah_15-0.jpg`.
 * Skor null (fight belum selesai / tanpa skor) -> `tanpa-skor`.
 */
export function posterFileName(
  dateStr: string,
  nameA: string,
  nameB: string,
  scoreA: number | null,
  scoreB: number | null,
): string {
  const score =
    scoreA !== null && scoreB !== null ? `${scoreA}-${scoreB}` : "tanpa-skor";
  return `${dateStr}_${slugifyName(nameA)}-vs-${slugifyName(nameB)}_${score}.jpg`;
}
