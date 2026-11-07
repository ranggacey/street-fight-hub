/**
 * Elo untuk ranking kasual game (Fase 1 integrasi game).
 * Rumus standar: expected score E_A = 1 / (1 + 10^(-(R_A - R_B)/400)).
 * Rating awal fighter 1000, K=32 (tetap — jangan ubah tanpa migrasi data).
 * Fungsi murni — tidak menyentuh DB, bisa diuji tanpa MongoDB.
 */

export const ELO_INITIAL_RATING = 1000;
export const ELO_K_FACTOR = 32;

/** Peluang menang A atas B (0..1) dari selisih rating. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, -(ratingA - ratingB) / 400));
}

/** Win% pra-fight A vs B (0..100, dibulatkan), untuk tampilan. */
export function winPercent(ratingA: number, ratingB: number): number {
  return Math.round(expectedScore(ratingA, ratingB) * 100);
}

/**
 * Rating baru kedua fighter setelah satu fight.
 * scoreA: 1 = A menang, 0.5 = seri, 0 = A kalah.
 */
export function updateRatings(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  k: number = ELO_K_FACTOR,
): [number, number] {
  const ea = expectedScore(ratingA, ratingB);
  const eb = 1 - ea;
  const newA = Math.round(ratingA + k * (scoreA - ea));
  const newB = Math.round(ratingB + k * ((1 - scoreA) - eb));
  return [newA, newB];
}
