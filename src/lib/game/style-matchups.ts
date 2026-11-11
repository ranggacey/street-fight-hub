/**
 * Style matchup — modul MURNI (tanpa DB, tanpa engine).
 *
 * Matriks kecil pengali damage penyerang berdasarkan gaya kedua
 * fighter. Rentang 0.95–1.10 — sengaja KECIL supaya matchup memberi
 * warna taktis tanpa mendominasi hasil (menang tetap ditentukan
 * latihan/stat/deck, bukan gaya semata). Mirror matchup (gaya sama)
 * selalu 1.00. Gaya tak dikenal → 1.00.
 *
 * INTERFACE UNTUK AGEN ENGINE (yang memasang ke fight.js):
 * - Panggil `matchupMultiplier(attackerStyle, defenderStyle)` dengan
 *   style Hub apa adanya ('muay-thai', 'boxing', 'wrestling', dst. —
 *   alias 'muay-thai'/'boxing'/'wrestling' dinormalisasi di sini).
 * - Kalikan damage serangan penyerang dengan hasil ini.
 * - Jangan dipanggil dua arah untuk satu hit — satu hit = satu
 *   penyerang, jadi cukup sekali per serangan.
 *
 * Modul ini TIDAK menyentuh fight.js — pemasangan di engine adalah
 * tugas agen lain.
 */

export const MATCHUP_MIN = 0.95;
export const MATCHUP_MAX = 1.1;

/** Alias Hub → kunci matriks (sama seperti STYLE_ALIASES di moves.js). */
const STYLE_ALIASES: Record<string, string> = {
  'muay-thai': 'muaythai',
  boxing: 'tinju',
  wrestling: 'gulat',
  taekwondo: 'taekwondo',
  street: 'street',
  karate: 'karate',
  silat: 'silat',
  other: 'brawler',
  'kali-arnis': 'kali-arnis',
  judo: 'judo',
  kudo: 'kudo',
  'jeet-kune-do': 'jeet-kune-do',
  capoeira: 'capoeira',
  wushu: 'wushu',
  'kung-fu': 'kung-fu',
};

function normalize(style: string | null | undefined): string {
  if (!style) return 'brawler';
  return STYLE_ALIASES[style] ?? style;
}

/**
 * Keunggulan eksplisit penyerang vs bertahan. Pasangan yang tidak ada
 * di sini = 1.00. Nilai di sini adalah pengali penyerang; kebalikannya
 * ditulis eksplisit (bukan 1/x) supaya tetap dalam rentang 0.95–1.10.
 */
const ADVANTAGES: Record<string, Record<string, number>> = {
  // Muay Thai: tendangan + lutut + siku menembus guard tinju.
  muaythai: { tinju: 1.05, taekwondo: 1.03, karate: 1.03 },
  // Gulat: takedown menutup jarak striker.
  gulat: { tinju: 1.08, taekwondo: 1.08, muaythai: 1.05, karate: 1.05, street: 1.05 },
  // Judo: lemparan efektif lawan grappler lain & jalanan.
  judo: { gulat: 1.05, street: 1.05, tinju: 1.03 },
  // Taekwondo: tendangan cepat unggul atas karate & tinju jarak jauh.
  taekwondo: { karate: 1.05, tinju: 1.03 },
  // Tinju: pukulan rapat unggul atas taekwondo yang butuh jarak.
  tinju: { taekwondo: 0.97, muaythai: 0.97, gulat: 0.95 },
  // Karate: kalah jarak lawan tendangan Muay Thai / Taekwondo.
  karate: { muaythai: 0.97, taekwondo: 0.97, gulat: 0.97 },
  // Street/brawler: tak terduga lawan gaya formal yang kaku.
  street: { karate: 1.03 },
  // Capoeira: gerakan akrobatik sulit dibaca tinju.
  capoeira: { tinju: 1.05, karate: 1.03 },
  // Kudo: hibrida karate + gulat, unggul lawan striker murni.
  kudo: { tinju: 1.05, taekwondo: 1.05 },
};

/** Pengali damage penyerang (0.95–1.10) untuk pasangan gaya ini. */
export function matchupMultiplier(
  attackerStyle: string | null | undefined,
  defenderStyle: string | null | undefined,
): number {
  const a = normalize(attackerStyle);
  const d = normalize(defenderStyle);
  if (a === d) return 1;
  const m = ADVANTAGES[a]?.[d];
  if (typeof m !== 'number') return 1;
  return Math.min(MATCHUP_MAX, Math.max(MATCHUP_MIN, m));
}
