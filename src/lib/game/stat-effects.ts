/**
 * Efek stat + deck + gameplan untuk fight (modul MURNI — tanpa DB/IO).
 *
 * Skema yang disetujui user (2026-11-10) + klarifikasi knockdown
 * (2026-11-11 11:11): hasil tarung ditentukan latihan, stat, dan deck —
 * BUKAN hoki. Semua efek dihitung RELATIF terhadap stat dasar 10
 * (fighter stat 10 = netral, pengali 1 / bonus 0).
 *
 * Efek per poin (di atas dasar 10, setelah diminishing returns):
 * - Power:    +1% damage yang diberikan / poin
 * - Speed:    +0,5% kecepatan serang & +0,2% dodge / poin
 * - Stamina:  1% lebih lambat capek (biaya stamina gerakan) / poin
 * - Defense:  -1% damage diterima / poin (total maks -50%)
 *             +0,3% block / poin
 * - Accuracy: +0,4% hit / poin
 *
 * DIMINISHING RETURNS di atas 80 (aturan yang disetujui):
 *   stat efektif = raw                     (raw <= 80)
 *   stat efektif = 80 + (raw - 80) * 0,5   (raw > 80)
 * Jadi 1 poin di atas 80 hanya memberi setengah efek. Contoh: Power 90
 * → efektif 85 → +75% damage (bukan +80%). Power 100 → efektif 90 →
 * +80% damage. Poin yang dialokasikan TETAP tercatat mentah di
 * FighterStats (0..100); yang dipotong setengah hanya EFEKNYA.
 *
 * KNOCKDOWN (bukan angka tetap — perintah user 2026-11-11):
 *   p = clamp(0,10 + (powerPenyerang - defenseBertahan) * 0,004
 *                  + (powerPenyerang - staminaBertahan) * 0,002,
 *             0,01, 0,25)
 * memakai stat EFEKTIF. Dasar 0,10 = baseline lama pra-stat (10% per
 * hit kena, rata-rata ~4,7 knockdown/fight) sehingga fight stat 10v10
 * berperilaku persis seperti sebelum ada stat; keunggulan Power
 * menaikkan peluang, Defense/Stamina lawan menurunkannya. Rumus yang
 * sama (cermin) ada di fight.js kedua copy — lihat
 * src/lib/fight-engine/ENGINE-SYNC.md.
 *
 * WIN BIAS (pengganti lotere pemenang murni — perintah user: tidak ada
 * menang karena hoki): winBias ∈ [-0,35, +0,35], positif = menguntungkan
 * sisi R (kiri). Dihitung dari selisih stat efektif kedua fighter +
 * selisih kekuatan deck:
 *   skorStat = Δpower*1,0 + Δspeed*0,6 + Δstamina*0,5 + Δdefense*0,7
 *              + Δaccuracy*0,6
 *   winBias = clamp(skorStat * 0,0028
 *                   + (deckStrA - deckStrB) * 0,1, -0,35, 0,35)
 * deckStr = rata-rata dmg kartu deck (signature berbobot 2,5x); deck
 * kosong = rata-rata dmg pool semua gaya (~3,53) — kartu lemah bisa
 * MERUGIKAN karena engine dipaksa lebih sering memilihnya.
 * Engine memakai winBias HANYA untuk roll pemenang (peluang menang
 * = 0,5 + winBias di antara fight non-draw); distribusi metode
 * (decision 60% / KO 30% / draw 10%) TIDAK berubah. winBias = 0 →
 * lotere lama persis (aliran rng tidak berubah).
 */

import { FINISHER_KINDS, STYLES } from '../fight-engine/moves.js';

export type StatKey = 'power' | 'speed' | 'stamina' | 'defense' | 'accuracy';

export const STAT_KEYS: StatKey[] = ['power', 'speed', 'stamina', 'defense', 'accuracy'];

export const STAT_LABELS: Record<StatKey, string> = {
  power: 'Power',
  speed: 'Speed',
  stamina: 'Stamina',
  defense: 'Defense',
  accuracy: 'Accuracy',
};

export const STAT_START = 10;
export const STAT_MAX = 100;
/** Di atas nilai ini tiap poin hanya dihitung setengah (efek). */
export const DIMINISH_START = 80;
/** Batas winBias: peluang menang bergeser paling jauh ±35 poin persen. */
export const WIN_BIAS_MAX = 0.35;

export interface Stats {
  power: number;
  speed: number;
  stamina: number;
  defense: number;
  accuracy: number;
}

export function defaultStats(): Stats {
  return {
    power: STAT_START,
    speed: STAT_START,
    stamina: STAT_START,
    defense: STAT_START,
    accuracy: STAT_START,
  };
}

export function isStatKey(v: unknown): v is StatKey {
  return typeof v === 'string' && (STAT_KEYS as string[]).includes(v);
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/** Stat efektif setelah diminishing returns (lihat header file). */
export function effectiveStat(raw: number): number {
  const c = clamp(Math.round(raw), STAT_START, STAT_MAX);
  if (c <= DIMINISH_START) return c;
  return DIMINISH_START + (c - DIMINISH_START) * 0.5;
}

export function effectiveStats(s: Stats): Stats {
  return {
    power: effectiveStat(s.power),
    speed: effectiveStat(s.speed),
    stamina: effectiveStat(s.stamina),
    defense: effectiveStat(s.defense),
    accuracy: effectiveStat(s.accuracy),
  };
}

/** Pengali/bonus satu sisi yang dibaca engine (buildFight opts.statMods). */
export interface SideStatMods {
  /** Pengali damage yang diberikan (Power). */
  dmgMul: number;
  /** Pengali damage yang diterima (Defense, maks -50% → min 0,5). */
  dmgTakenMul: number;
  /** Bonus peluang dodge (Speed). */
  dodgeBonus: number;
  /** Bonus peluang block (Defense). */
  blockBonus: number;
  /** Bonus peluang hit (Accuracy). */
  hitBonus: number;
  /** Pengali kecepatan serang — gap antar serangan dibagi nilai ini. */
  attackSpeedMul: number;
  /** Pengali biaya stamina gerakan (Stamina; makin kecil makin hemat). */
  fatigueRate: number;
  /** Stat efektif (untuk knockdown + debug) — cermin stat-effects. */
  powerEff: number;
  defenseEff: number;
  staminaEff: number;
  speedEff: number;
  accuracyEff: number;
}

export function statModsFor(s: Stats): SideStatMods {
  const e = effectiveStats(s);
  const d = (v: number): number => v - STAT_START;
  return {
    dmgMul: 1 + 0.01 * d(e.power),
    dmgTakenMul: Math.max(0.5, 1 - 0.01 * d(e.defense)),
    dodgeBonus: 0.002 * d(e.speed),
    blockBonus: 0.003 * d(e.defense),
    hitBonus: 0.004 * d(e.accuracy),
    attackSpeedMul: 1 + 0.005 * d(e.speed),
    fatigueRate: Math.max(0.1, 1 - 0.01 * d(e.stamina)),
    powerEff: e.power,
    defenseEff: e.defense,
    staminaEff: e.stamina,
    speedEff: e.speed,
    accuracyEff: e.accuracy,
  };
}

/** Peluang knockdown per hit kena (stat efektif kedua belah pihak). */
export function knockdownProb(
  attPowerEff: number,
  defDefenseEff: number,
  defStaminaEff: number,
): number {
  return clamp(
    0.1 +
      (attPowerEff - defDefenseEff) * 0.004 +
      (attPowerEff - defStaminaEff) * 0.002,
    0.01,
    0.25,
  );
}

/**
 * Kekuatan deck = rata-rata dmg kartu-kartunya (signature berbobot 2,5x).
 * Deck kosong (atau hanya berisi kind tak dikenal) = baseline: rata-rata
 * dmg semua gerakan di semua gaya (tanpa feint dmg 0 dan tanpa finisher).
 * Skala ~0..5, baseline dihitung sekali saat modul dimuat.
 */
export const MOVE_DMG: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const style of Object.values(STYLES) as Array<{
    moves: Array<{ kind: string; dmg: number }>;
  }>) {
    for (const mv of style.moves) {
      if (!(mv.kind in m)) m[mv.kind] = mv.dmg;
    }
  }
  return m;
})();

export const NO_DECK_STRENGTH: number = (() => {
  let sum = 0;
  let n = 0;
  for (const [kind, dmg] of Object.entries(MOVE_DMG)) {
    if (dmg <= 0 || FINISHER_KINDS.has(kind)) continue;
    sum += dmg;
    n += 1;
  }
  return n > 0 ? sum / n : 2.8;
})();

/** Koefisien komponen deck di winBias (per poin dmg selisih deck). */
export const DECK_BIAS_COEF = 0.1;

export function deckStrength(deck: DeckInput | null | undefined): number {
  if (!deck) return NO_DECK_STRENGTH;
  let sum = 0;
  let w = 0;
  for (const kind of deck.cards ?? []) {
    const dmg = typeof kind === 'string' ? MOVE_DMG[kind] : undefined;
    if (dmg === undefined) continue;
    sum += dmg;
    w += 1;
  }
  if (deck.signature) {
    const dmg = MOVE_DMG[deck.signature];
    if (dmg !== undefined) {
      sum += dmg * 2.5;
      w += 2.5;
    }
  }
  return w > 0 ? sum / w : NO_DECK_STRENGTH;
}

/**
 * Pergeseran peluang menang dari selisih stat + selisih kekuatan deck
 * (dipakai turnamen draw — agent lain memanggil ini; murni + deterministik).
 * Deck opsional: tanpa deck → komponen deck 0 (baseline vs baseline).
 * Positif = menguntungkan fighter pertama (sisi R / kiri).
 */
export function winBiasFromStats(
  a: Stats,
  b: Stats,
  deckA?: DeckInput | null,
  deckB?: DeckInput | null,
): number {
  const ea = effectiveStats(a);
  const eb = effectiveStats(b);
  const score =
    (ea.power - eb.power) * 1.0 +
    (ea.speed - eb.speed) * 0.6 +
    (ea.stamina - eb.stamina) * 0.5 +
    (ea.defense - eb.defense) * 0.7 +
    (ea.accuracy - eb.accuracy) * 0.6;
  const deckPart =
    (deckStrength(deckA) - deckStrength(deckB)) * DECK_BIAS_COEF;
  return clamp(score * 0.0028 + deckPart, -WIN_BIAS_MAX, WIN_BIAS_MAX);
}

// ---------------------------------------------------------------------------
// Gameplan — dipilih SEKALI sebelum fight, lalu dikunci (disimpan di
// GameFight.config supaya verifikasi server mereproduksi fight yang sama).
// ---------------------------------------------------------------------------

export type GameplanTempo = 'agresif' | 'seimbang' | 'bertahan';
export const GAMEPLAN_TEMPOS: GameplanTempo[] = ['agresif', 'seimbang', 'bertahan'];

export interface Gameplan {
  tempo: GameplanTempo;
  /** Kind gerakan yang difokuskan, atau 'balanced' (tanpa fokus). */
  focus: string;
}

export const DEFAULT_GAMEPLAN: Gameplan = { tempo: 'seimbang', focus: 'balanced' };

export const GAMEPLAN_TEMPO_LABELS: Record<GameplanTempo, string> = {
  agresif: 'Agresif (sering menyerang, jeda pendek)',
  seimbang: 'Seimbang',
  bertahan: 'Bertahan (jaga jarak, pilih pukulan)',
};

/** Normalisasi input gameplan apa pun → gameplan valid (default bila kosong). */
export function normalizeGameplan(input: unknown): Gameplan {
  if (!input || typeof input !== 'object') return { ...DEFAULT_GAMEPLAN };
  const o = input as Record<string, unknown>;
  const tempo =
    typeof o.tempo === 'string' &&
    (GAMEPLAN_TEMPOS as string[]).includes(o.tempo)
      ? (o.tempo as GameplanTempo)
      : 'seimbang';
  const focus =
    typeof o.focus === 'string' && o.focus.trim().length > 0
      ? o.focus.trim()
      : 'balanced';
  return { tempo, focus };
}

// ---------------------------------------------------------------------------
// Deck — 6 kartu jurus (bobot 2x) + 1 signature di luar deck (bobot 2,5x,
// sudah ditangani engine dari Fighter.signatureMove).
// ---------------------------------------------------------------------------

export interface DeckInput {
  cards: string[];
  signature?: string | null;
}

/** Pool stamina awal satu sisi dari stat Stamina efektif. */
export function staminaPoolFor(s: Stats): number {
  const e = effectiveStats(s);
  return 100 + (e.stamina - STAT_START) * 2;
}

/** Bentuk opts yang dikirim ke buildFight (kedua copy fight.js). */
export interface FightOpts {
  weights: { R: Record<string, number>; B: Record<string, number> };
  tempo: { R: GameplanTempo; B: GameplanTempo };
  statMods: { R: SideStatMods; B: SideStatMods };
  winBias: number;
  stamina: { R: number; B: number };
  /** Kind kartu deck per sisi (biaya stamina 1,5x di engine). */
  deck: { R: string[]; B: string[] };
  /** Pengali damage statis dari modul combo (agent lain). Deteksi kombo
   *  LIVE terjadi di fight.js (detectCombo); field ini pengali tambahan
   *  (default 1) — bukan mekanisme utama. */
  comboBonus: { R: number; B: number };
  /** Pengali damage dari matchup gaya. buildFightOpts mengembalikan
   *  netral 1; buildFightSetup mengisinya dari matchupMultiplier. */
  matchupMul: { R: number; B: number };
  gameplan: { R: Gameplan; B: Gameplan };
}

/**
 * Bobot pilih gerak satu sisi: kartu deck 2x, signature 2,5x, fokus
 * gameplan +50% (dikalikan di atas bobot yang sudah ada).
 */
export function deckWeights(deck: DeckInput, gameplan: Gameplan): Record<string, number> {
  const w: Record<string, number> = {};
  for (const kind of deck.cards ?? []) {
    if (typeof kind === 'string' && kind) w[kind] = 2;
  }
  if (deck.signature) w[deck.signature] = 2.5;
  if (gameplan.focus && gameplan.focus !== 'balanced') {
    w[gameplan.focus] = (w[gameplan.focus] ?? 1) * 1.5;
  }
  return w;
}

/**
 * Bangun opts buildFight lengkap dari stat + deck + gameplan kedua fighter.
 * Deterministik: input sama → opts sama persis (server re-run = hasil sama).
 */
export function buildFightOpts(
  leftStats: Stats,
  rightStats: Stats,
  leftDeck: DeckInput,
  rightDeck: DeckInput,
  leftGameplan: Gameplan,
  rightGameplan: Gameplan,
): FightOpts {
  return {
    weights: {
      R: deckWeights(leftDeck, leftGameplan),
      B: deckWeights(rightDeck, rightGameplan),
    },
    tempo: { R: leftGameplan.tempo, B: rightGameplan.tempo },
    statMods: { R: statModsFor(leftStats), B: statModsFor(rightStats) },
    winBias: winBiasFromStats(leftStats, rightStats, leftDeck, rightDeck),
    stamina: {
      R: staminaPoolFor(leftStats),
      B: staminaPoolFor(rightStats),
    },
    deck: {
      R: [...(leftDeck.cards ?? [])],
      B: [...(rightDeck.cards ?? [])],
    },
    comboBonus: { R: 1, B: 1 },
    matchupMul: { R: 1, B: 1 },
    gameplan: { R: { ...leftGameplan }, B: { ...rightGameplan } },
  };
}
