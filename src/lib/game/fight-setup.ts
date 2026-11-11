/**
 * Setup fight dari data tersimpan (stat + deck + gameplan kedua fighter).
 *
 * Dipakai challenge accept, accept-open, dan quick-fight saat membuat
 * GameFight: opts yang dihitung di sini disimpan di
 * GameFight.config.fightOpts, dikirim ke arena (sfa-config `opts`),
 * dan dipakai verifikasi server (verifyFightResult) — jadi fight yang
 * sama (seed + config + opts) selalu menghasilkan hasil yang sama.
 *
 * Fighter tanpa dokumen stat/deck = stat 10 semua + deck kosong
 * (kompatibel mundur dengan fight lama). Cedera aktif (FighterProgress)
 * ikut diterapkan di sini — stat EFEKTIF yang dipakai fight DAN sim
 * turnamen (decideMatch memakai loadFighterStats yang sama), supaya
 * cedera berpengaruh di semua jalur. Matchup gaya (style-matchups)
 * diisi di buildFightSetup dari gaya kedua fighter.
 */
import {
  buildFightOpts,
  defaultStats,
  normalizeGameplan,
  type FightOpts,
  type Gameplan,
  type Stats,
} from './stat-effects';
import { getEffectiveStats } from './progress';
import { matchupMultiplier } from './style-matchups';
import { FighterDeck } from '@/models/FighterDeck';
import { FighterProgress } from '@/models/FighterProgress';
import { FighterStats } from '@/models/FighterStats';

export interface FighterSetupDoc {
  _id: unknown;
  signatureMove?: string | null;
  /** Gaya bertarung Hub ('muay-thai', 'boxing', dst.) — untuk matchup. */
  style?: string | null;
}

export interface FightSetup {
  fightOpts: FightOpts;
  gameplans: { left: Gameplan; right: Gameplan };
  stats: { left: Stats; right: Stats };
}

function toStats(doc: unknown): Stats {
  const s = (doc as { stats?: Partial<Stats> } | null)?.stats;
  return {
    power: s?.power ?? 10,
    speed: s?.speed ?? 10,
    stamina: s?.stamina ?? 10,
    defense: s?.defense ?? 10,
    accuracy: s?.accuracy ?? 10,
  };
}

/**
 * Stat EFEKTIF satu fighter: stat dasar latihan dikurangi cedera aktif
 * (kalau ada; cedera dengan fightsRemaining <= 0 dianggap sembuh).
 * Dipakai fight arena (buildFightSetup) dan sim turnamen (decideMatch).
 */
export async function loadFighterStats(fighterId: string): Promise<Stats> {
  const [doc, progress] = await Promise.all([
    FighterStats.findOne({ fighterId }).lean(),
    FighterProgress.findOne({ fighterId }).lean(),
  ]);
  const base = doc ? toStats(doc) : defaultStats();
  return getEffectiveStats(base, progress?.injury ?? null);
}

export async function loadFighterDeck(
  fighterId: string,
  signatureMove?: string | null,
): Promise<{ cards: string[]; signature: string | null }> {
  const doc = await FighterDeck.findOne({ fighterId }).lean();
  return {
    cards: Array.isArray(doc?.cards) ? [...doc.cards] : [],
    signature: doc?.signature ?? signatureMove ?? null,
  };
}

/**
 * Hitung fightOpts + gameplan ternormalisasi untuk sepasang fighter.
 * `gameplanLeft` = gameplan fighter kiri (R), `gameplanRight` = kanan (B).
 * Input gameplan apa pun dinormalisasi (default seimbang/balanced).
 */
export async function buildFightSetup(
  leftFighter: FighterSetupDoc,
  rightFighter: FighterSetupDoc,
  gameplanLeft: unknown,
  gameplanRight: unknown,
): Promise<FightSetup> {
  const leftId = String(leftFighter._id);
  const rightId = String(rightFighter._id);
  const [leftStats, rightStats, leftDeck, rightDeck] = await Promise.all([
    loadFighterStats(leftId),
    loadFighterStats(rightId),
    loadFighterDeck(leftId, leftFighter.signatureMove ?? null),
    loadFighterDeck(rightId, rightFighter.signatureMove ?? null),
  ]);
  const gl = normalizeGameplan(gameplanLeft);
  const gr = normalizeGameplan(gameplanRight);
  const fightOpts = buildFightOpts(
    leftStats,
    rightStats,
    leftDeck,
    rightDeck,
    gl,
    gr,
  );
  // Matchup gaya: pengali damage per sisi dari pasangan gaya kedua
  // fighter (0.95–1.10; mirror = 1.00; gaya tak dikenal = 1.00).
  // buildFightOpts mengembalikan netral 1 — diisi di sini karena gaya
  // hanya ada di dokumen Fighter, bukan di stat/deck.
  fightOpts.matchupMul = {
    R: matchupMultiplier(leftFighter.style ?? null, rightFighter.style ?? null),
    B: matchupMultiplier(rightFighter.style ?? null, leftFighter.style ?? null),
  };
  return {
    fightOpts,
    gameplans: { left: gl, right: gr },
    stats: { left: leftStats, right: rightStats },
  };
}
