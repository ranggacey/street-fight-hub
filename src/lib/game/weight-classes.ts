/**
 * Kelas berat — HANYA mekanik matchmaking / tarung.
 *
 * Batas: Ringan <70 kg, Menengah 70–85 kg, Berat >85 kg.
 * Fighter tanpa weightKg = "Tanpa kelas", bisa melawan siapa saja.
 *
 * ATURAN KERAS: kelas berat TIDAK PERNAH membagi klasemen — klasemen
 * tetap SATU ranking murni. Modul ini hanya dipakai:
 * - Gas Tarung (quick-fight): prefer lawan sekelas (±1 kelas diizinkan,
 *   lintas kelas hanya kalau tidak ada lawan sekelas yang siap).
 * - Kartu tantangan: peringatan kalau selisih kelas > 1.
 *
 * Modul murni — tidak menyentuh DB, bisa diuji tanpa MongoDB.
 */

export type WeightClass = 'ringan' | 'menengah' | 'berat';

export const WEIGHT_CLASS_ORDER: WeightClass[] = ['ringan', 'menengah', 'berat'];

export const WEIGHT_CLASS_LABELS: Record<WeightClass, string> = {
  ringan: 'Ringan',
  menengah: 'Menengah',
  berat: 'Berat',
};

/** Batas bawah kelas Menengah (kg) dan Berat (kg). */
export const WEIGHT_CLASS_BOUNDARIES = { menengahMin: 70, beratMin: 85 } as const;

/**
 * Kelas dari berat badan. null/undefined/bukan angka → null
 * ("Tanpa kelas"). Batas inklusif bawah: 70 kg = Menengah, 85 kg = Berat.
 */
export function weightClassOf(weightKg: number | null | undefined): WeightClass | null {
  if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (weightKg < 70) return 'ringan';
  if (weightKg <= 85) return 'menengah';
  return 'berat';
}

/** Label tampil kelas, atau "Tanpa kelas" kalau berat belum diisi. */
export function weightClassLabel(weightKg: number | null | undefined): string {
  const cls = weightClassOf(weightKg);
  if (!cls) return 'Tanpa kelas';
  if (cls === 'ringan') return 'Ringan (<70 kg)';
  if (cls === 'menengah') return 'Menengah (70–85 kg)';
  return 'Berat (>85 kg)';
}

/**
 * Jarak kelas: 0 = sekelas, 1 = bersebelahan, 2 = Ringan vs Berat.
 * Kalau salah satu tanpa kelas → 0 (bisa melawan siapa saja).
 */
export function weightClassDistance(
  aKg: number | null | undefined,
  bKg: number | null | undefined,
): number {
  const a = weightClassOf(aKg);
  const b = weightClassOf(bKg);
  if (!a || !b) return 0;
  return Math.abs(WEIGHT_CLASS_ORDER.indexOf(a) - WEIGHT_CLASS_ORDER.indexOf(b));
}

/** Apakah pasangan ini sekelas (atau salah satu tanpa kelas)? */
export function isSameWeightClass(
  aKg: number | null | undefined,
  bKg: number | null | undefined,
): boolean {
  return weightClassDistance(aKg, bKg) === 0;
}

/**
 * Peringatan selisih kelas untuk kartu tantangan: hanya muncul kalau
 * selisih > 1 (Ringan vs Berat). null = tidak ada peringatan.
 */
export function weightMismatchWarning(
  aKg: number | null | undefined,
  bKg: number | null | undefined,
): string | null {
  if (weightClassDistance(aKg, bKg) > 1) {
    return 'Peringatan: selisih kelas berat lebih dari 1 — Ringan vs Berat. Fight tetap bisa jalan, tapi berat badan jauh berbeda.';
  }
  return null;
}
