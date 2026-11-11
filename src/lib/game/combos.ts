/**
 * Kombo — modul MURNI (tanpa DB, tanpa engine).
 *
 * Satu kombo = urutan move kinds (lihat moves.js — kind yang dipakai
 * di sini semuanya ada di move library: jab/cross/hook/uppercut/
 * lowkick/bodykick/headkick/doubleleg/suplex) + nama + bonus damage
 * persen pada pukulan/tendangan TERAKHIR rangkaian.
 *
 * INTERFACE UNTUK AGEN ENGINE (yang memasang ke fight.js):
 * - Panggil `detectCombo(history)` dengan `history` = daftar kind
 *   gerakan yang SUDAH dilempar penyerang itu, urut kronologis
 *   (termasuk gerakan yang baru saja dilempar sebagai elemen terakhir).
 * - Kalau kembali `{ name, bonusPct }`, kalikan damage hit terakhir
 *   dengan (1 + bonusPct / 100) — hanya hit terakhir, bukan seluruh
 *   kombo. Kalau null, tidak ada bonus.
 * - Kombo terpanjang yang cocok menang (mis. jab→cross→hook mengalahkan
 *   kombo 2 gerakan yang juga cocok di akhir history).
 *
 * Modul ini TIDAK menyentuh fight.js — pemasangan di engine adalah
 * tugas agen lain.
 */

export interface ComboDefinition {
  /** Urutan kind gerakan, mis. ['jab', 'cross', 'hook']. */
  sequence: string[];
  name: string;
  /** Bonus damage persen pada hit terakhir (mis. 15 = +15%). */
  bonusPct: number;
}

export const COMBOS: ComboDefinition[] = [
  { sequence: ['jab', 'cross', 'hook'], name: 'Kombo Kilat', bonusPct: 15 },
  { sequence: ['lowkick', 'bodykick', 'headkick'], name: 'Kombo Badai', bonusPct: 15 },
  { sequence: ['doubleleg', 'suplex'], name: 'Kombo Banting', bonusPct: 20 },
  { sequence: ['jab', 'jab', 'cross'], name: 'Kombo Satu-Dua', bonusPct: 10 },
  { sequence: ['cross', 'hook', 'uppercut'], name: 'Kombo Upper', bonusPct: 15 },
  { sequence: ['takedown', 'bodyslam'], name: 'Kombo Banting Jalanan', bonusPct: 20 },
];

export interface DetectedCombo {
  name: string;
  bonusPct: number;
  /** Panjang rangkaian yang cocok. */
  length: number;
}

/**
 * Deteksi kombo dari akhir history. Mengembalikan kombo terpanjang
 * yang cocok, atau null kalau tidak ada rangkaian yang selesai.
 */
export function detectCombo(history: string[]): DetectedCombo | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  let best: DetectedCombo | null = null;
  for (const combo of COMBOS) {
    const n = combo.sequence.length;
    if (history.length < n) continue;
    const tail = history.slice(history.length - n);
    if (tail.every((kind, i) => kind === combo.sequence[i])) {
      if (!best || n > best.length) {
        best = { name: combo.name, bonusPct: combo.bonusPct, length: n };
      }
    }
  }
  return best;
}

/** Bonus damage persen untuk hit terakhir (0 kalau tidak ada kombo). */
export function comboBonusPct(history: string[]): number {
  return detectCombo(history)?.bonusPct ?? 0;
}
