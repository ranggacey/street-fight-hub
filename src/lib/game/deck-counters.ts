/**
 * Deck counter — keluarga ancaman + jawaban (modul MURNI, tanpa DB/IO).
 *
 * Prinsip balance v2 (perintah user 2026-11-18): hasil tarung ditentukan
 * COUNTER deck + matchup gaya, bukan hoki; pengaruh stat dikecilkan.
 * Deck musuh TIDAK terlihat saat memilih deck — tapi skor dihitung
 * server saat fight dibangun (kedua deck sudah terkunci), jadi
 * counter-pick adalah tebakan dari gaya (publik) + kebiasaan lawan
 * (riwayat fight). Kalau tebakanmu tepat, skor menghadiahimu.
 *
 * Model: tiap deck punya satu ancaman dominan = keluarga gerakan
 * terbanyak di 7 slotnya (6 kartu + signature). Seri / kosong = tidak
 * ada ancaman (deck seimbang = aman). Coverage = fraksi slot deck-mu
 * yang menjawab ancaman lawan. Skor deck di stat-effects.ts:
 *   (coverageA - coverageB) × DECK_SCORE_CAP
 *
 * Keluarga + jawaban grounded di katalog moves.js (semua kind di sini
 * ada di katalog; kind tanpa keluarga — mis. 'sweep', 'teep', 'knee' —
 * tetap bisa jadi JAWABAN meski bukan ancaman).
 */

import type { DeckInput } from './stat-effects';

/** Keluarga ancaman satu deck. */
export type ThreatFamily = 'KICK' | 'GRAPPLE' | 'PUNCH';

/** Kind gerakan → keluarga ancamannya (kind tak dikenal = bukan ancaman). */
export const MOVE_FAMILY: Record<string, ThreatFamily> = {
  // Tendangan (ancaman jarak jauh).
  headkick: 'KICK',
  roundhouse: 'KICK',
  frontkick: 'KICK',
  spinkick: 'KICK',
  spinhookkick: 'KICK',
  axekick: 'KICK',
  bodykick: 'KICK',
  lowkick: 'KICK',
  maegeri: 'KICK',
  yokogeri: 'KICK',
  sidekick: 'KICK',
  meialua: 'KICK',
  queixada: 'KICK',
  armada: 'KICK',
  meialuafrente: 'KICK',
  tornadokick: 'KICK',
  butterflykick: 'KICK',
  lotuskick: 'KICK',
  // Grappling / takedown / lemparan.
  takedown: 'GRAPPLE',
  doubleleg: 'GRAPPLE',
  singleleg: 'GRAPPLE',
  suplex: 'GRAPPLE',
  bodyslam: 'GRAPPLE',
  anklepick: 'GRAPPLE',
  seoinage: 'GRAPPLE',
  osotogari: 'GRAPPLE',
  uchimata: 'GRAPPLE',
  armbar: 'GRAPPLE',
  outsidetrip: 'GRAPPLE',
  clinch: 'GRAPPLE',
  // Pukulan (ancaman jarak dekat).
  jab: 'PUNCH',
  cross: 'PUNCH',
  hook: 'PUNCH',
  uppercut: 'PUNCH',
  bodyshot: 'PUNCH',
  overhand: 'PUNCH',
  haymaker: 'PUNCH',
  gyakuzuki: 'PUNCH',
  shuto: 'PUNCH',
  straightlead: 'PUNCH',
};

/** Kind gerakan yang menjawab satu keluarga ancaman. */
export const THREAT_ANSWERS: Record<ThreatFamily, ReadonlySet<string>> = {
  // Lawan tendangan: tutup jarak / tebang kaki tumpu.
  KICK: new Set([
    'clinch',
    'takedown',
    'doubleleg',
    'singleleg',
    'suplex',
    'bodyslam',
    'anklepick',
    'lowkick',
    'sweep',
    'seoinage',
    'osotogari',
    'uchimata',
  ]),
  // Lawan grappler: lutut/siku/teep saat dia masuk, uppercut saat shoot.
  GRAPPLE: new Set([
    'knee',
    'flyknee',
    'kneediag',
    'teep',
    'uppercut',
    'elbow',
    'elbowup',
    'elbowspin',
  ]),
  // Lawan petinju: jaga jarak dengan tendangan/lutut.
  PUNCH: new Set([
    'teep',
    'lowkick',
    'bodykick',
    'roundhouse',
    'headkick',
    'frontkick',
    'knee',
    'sidekick',
    'maegeri',
    'yokogeri',
  ]),
};

/** Semua slot deck (6 kartu + signature), kind kosong dibuang. */
export function deckSlots(deck: DeckInput | null | undefined): string[] {
  if (!deck) return [];
  return [...(deck.cards ?? []), deck.signature].filter(
    (k): k is string => typeof k === 'string' && !!k,
  );
}

/**
 * Ancaman dominan deck: keluarga terbanyak; seri / kosong → null
 * (deck seimbang = aman, tidak memberi skor ke siapa pun).
 */
export function dominantThreat(
  deck: DeckInput | null | undefined,
): ThreatFamily | null {
  const counts: Record<ThreatFamily, number> = {
    KICK: 0,
    GRAPPLE: 0,
    PUNCH: 0,
  };
  for (const k of deckSlots(deck)) {
    const f = MOVE_FAMILY[k];
    if (f) counts[f]++;
  }
  const top = (Object.entries(counts) as [ThreatFamily, number][]).sort(
    (x, y) => y[1] - x[1],
  );
  if (top[0][1] === 0 || top[0][1] === top[1][1]) return null;
  return top[0][0];
}

/** Fraksi slot deck yang menjawab ancaman (0..1; tanpa ancaman = 0). */
export function coverage(
  deck: DeckInput | null | undefined,
  threat: ThreatFamily | null,
): number {
  if (!threat) return 0;
  const slots = deckSlots(deck);
  if (slots.length === 0) return 0;
  const ans = THREAT_ANSWERS[threat];
  return slots.filter((k) => ans.has(k)).length / slots.length;
}
