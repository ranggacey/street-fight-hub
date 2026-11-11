/**
 * Progres fighter — XP, level, koin, achievement, cedera, prediksi.
 *
 * SATU-SATUNYA tempat logika anti-monoton yang menyentuh DB. Semua
 * angka di sini mengikuti keputusan user 2026-11-11:
 * - XP fight: menang 100, kalah 30, seri 50, bonus KO +50 (pemenang KO).
 * - Level: butuh 100 * level XP untuk naik dari level L ke L+1
 *   (level 1 mulai 0 XP; naik ke level 2 butuh 100 XP, ke level 3
 *   butuh 200 XP lagi, dst.).
 * - Koin fight: menang 50, kalah 10, seri 25, bonus menang title fight +100.
 * - Cedera: hanya yang KALAH yang bisa cedera (kalah KO 25%, kalah
 *   decision 10%, pemenang 0%). Satu stat acak efeknya -15% selama
 *   3 fight berikutnya, lalu sembuh.
 *
 * INTERFACE STABIL UNTUK AGEN LAIN:
 * - `awardFightOutcome(fighterId, outcome, ctx?)` — dipanggil dari
 *   result route GameFight (sudah dipasang) dan dari decideMatch di
 *   draw.ts (agen lain — jangan ubah signature ini). Panggil SETELAH
 *   record/rating di-update, karena achievement membaca record
 *   terbaru Fighter. `outcome.method` = 'KO' | 'decision' | 'draw'.
 * - `resolvePredictions(fightId, kind, winnerFighterId)` — dipanggil
 *   per FIGHT (bukan per fighter) setelah pemenang diketahui, dari
 *   result route dan dari decideMatch. kind 'game' = GameFight,
 *   'tournament' = Match turnamen.
 * - `getEffectiveStats(baseStats, injury)` — dipakai agen engine saat
 *   membangun fight opts: stat yang cedera dikurangi pct-nya.
 *   `baseStats` = { power, speed, stamina, defense, accuracy }
 *   (angka dari sistem training/stat — modul ini TIDAK menghitung
 *   stat dasar, hanya menerapkan pengurangan cedera).
 */
import { Fighter } from '../../models/Fighter';
import { FighterProgress, type InjuryStat } from '../../models/FighterProgress';
import { Prediction } from '../../models/Prediction';
import { Title } from '../../models/Title';
import { checkAchievements } from './achievement-catalog';

// ---------------------------------------------------------------------------
// Angka ekonomi (keputusan user — jangan ubah diam-diam)
// ---------------------------------------------------------------------------

export const XP_WIN = 100;
export const XP_LOSS = 30;
export const XP_DRAW = 50;
export const XP_KO_BONUS = 50;

export const COINS_WIN = 50;
export const COINS_LOSS = 10;
export const COINS_DRAW = 25;
export const COINS_TITLE_WIN_BONUS = 100;

export const PREDICTION_STAKE = 10;
export const PREDICTION_WIN_PAYOUT = 20;

export const INJURY_PCT = 15;
export const INJURY_FIGHTS = 3;
export const INJURY_CHANCE_KO_LOSS = 0.25;
export const INJURY_CHANCE_DECISION_LOSS = 0.1;

export const INJURY_STATS: InjuryStat[] = ['power', 'speed', 'stamina', 'defense', 'accuracy'];

export const INJURY_STAT_LABELS: Record<InjuryStat, string> = {
  power: 'Power',
  speed: 'Speed',
  stamina: 'Stamina',
  defense: 'Defense',
  accuracy: 'Accuracy',
};

// ---------------------------------------------------------------------------
// Level (murni)
// ---------------------------------------------------------------------------

/** XP yang dibutuhkan untuk naik dari level L ke L+1. */
export function xpForLevelUp(level: number): number {
  return 100 * Math.max(1, level);
}

/** Level dari total XP (level 1 mulai 0 XP). */
export function levelFromXp(xp: number): number {
  let level = 1;
  let remaining = Math.max(0, xp);
  while (remaining >= xpForLevelUp(level)) {
    remaining -= xpForLevelUp(level);
    level += 1;
  }
  return level;
}

/** XP yang sudah terkumpul di dalam level saat ini (0..xpForLevelUp(level)-1). */
export function xpInCurrentLevel(xp: number): number {
  let remaining = Math.max(0, xp);
  let level = 1;
  while (remaining >= xpForLevelUp(level)) {
    remaining -= xpForLevelUp(level);
    level += 1;
  }
  return remaining;
}

// ---------------------------------------------------------------------------
// XP / koin per hasil fight (murni)
// ---------------------------------------------------------------------------

export type FightResultKind = 'win' | 'loss' | 'draw';
export type FightMethod = 'KO' | 'decision' | 'draw';

export function xpForOutcome(result: FightResultKind, method: FightMethod): number {
  let xp = result === 'win' ? XP_WIN : result === 'loss' ? XP_LOSS : XP_DRAW;
  if (result === 'win' && method === 'KO') xp += XP_KO_BONUS;
  return xp;
}

export function coinsForOutcome(
  result: FightResultKind,
  isTitleFight: boolean,
): number {
  let coins = result === 'win' ? COINS_WIN : result === 'loss' ? COINS_LOSS : COINS_DRAW;
  if (result === 'win' && isTitleFight) coins += COINS_TITLE_WIN_BONUS;
  return coins;
}

// ---------------------------------------------------------------------------
// Cedera (murni)
// ---------------------------------------------------------------------------

export interface Injury {
  stat: InjuryStat;
  pct: number;
  fightsRemaining: number;
}

export interface TrainingStats {
  power: number;
  speed: number;
  stamina: number;
  defense: number;
  accuracy: number;
}

/**
 * Nilai EFEKTIF stat setelah cedera: stat yang cedera dikurangi pct%.
 * Dipakai agen engine saat membangun fight opts — modul ini tidak
 * menghitung stat dasar, hanya menerapkan pengurangan ini.
 * Cedera dengan fightsRemaining <= 0 dianggap sudah sembuh (diabaikan).
 */
export function getEffectiveStats(
  baseStats: TrainingStats,
  injury: Injury | null | undefined,
): TrainingStats {
  const out = { ...baseStats };
  if (injury && injury.fightsRemaining > 0) {
    const factor = 1 - injury.pct / 100;
    out[injury.stat] = Math.max(0, Math.round(baseStats[injury.stat] * factor * 10) / 10);
  }
  return out;
}

/**
 * Roll cedera untuk yang kalah (murni — rng bisa di-inject di tes).
 * Pemenang / seri: selalu null. Kalah KO: 25%, kalah decision: 10%.
 */
export function rollInjury(
  result: FightResultKind,
  method: FightMethod,
  rng: () => number = Math.random,
): Injury | null {
  if (result !== 'loss') return null;
  const chance =
    method === 'KO' ? INJURY_CHANCE_KO_LOSS : method === 'decision' ? INJURY_CHANCE_DECISION_LOSS : 0;
  if (chance <= 0 || rng() >= chance) return null;
  const stat = INJURY_STATS[Math.floor(rng() * INJURY_STATS.length)];
  return { stat, pct: INJURY_PCT, fightsRemaining: INJURY_FIGHTS };
}

// ---------------------------------------------------------------------------
// Helper tanggal WIB (untuk streak harian)
// ---------------------------------------------------------------------------

function wibDayString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/** Ambil progres fighter, buat baru (0 XP/koin) kalau belum ada. */
export async function getOrCreateProgress(fighterId: string) {
  const existing = await FighterProgress.findOne({ fighterId });
  if (existing) return existing;
  try {
    return await FighterProgress.create({ fighterId });
  } catch {
    // Race: dua pemanggil bersamaan — ambil yang sudah terbuat.
    const raced = await FighterProgress.findOne({ fighterId });
    if (raced) return raced;
    throw new Error('Gagal membuat FighterProgress');
  }
}

export interface FightOutcomeInput {
  result: FightResultKind;
  method: FightMethod;
  isTitleFight: boolean;
  isTournament: boolean;
}

export interface AwardContext {
  /** Dipakai tes supaya roll cedera deterministik. */
  rng?: () => number;
  now?: Date;
}

export interface AwardResult {
  fighterId: string;
  xpGained: number;
  coinsGained: number;
  levelBefore: number;
  level: number;
  levelUp: boolean;
  achievementsUnlocked: string[];
  injury: Injury | null;
}

/**
 * Beri hadiah hasil fight ke satu fighter: XP + koin, naik level,
 * streak (menang beruntun + hari aktif beruntun), cek achievement,
 * kurangi sisa cedera lama lalu roll cedera baru kalau kalah.
 *
 * Panggil SETELAH record/rating Fighter di-update (achievement
 * membaca Fighter.record terbaru). Untuk seri, kedua fighter
 * dipanggil dengan result 'draw' (tidak ada yang cedera).
 * isTournament hanya penanda asal (saat ini tidak mengubah hadiah).
 */
export async function awardFightOutcome(
  fighterId: string,
  outcome: FightOutcomeInput,
  ctx: AwardContext = {},
): Promise<AwardResult> {
  const rng = ctx.rng ?? Math.random;
  const now = ctx.now ?? new Date();
  const progress = await getOrCreateProgress(fighterId);

  const xpGained = xpForOutcome(outcome.result, outcome.method);
  const coinsGained = coinsForOutcome(outcome.result, outcome.isTitleFight);
  const levelBefore = progress.level ?? levelFromXp(progress.xp ?? 0);
  progress.xp = (progress.xp ?? 0) + xpGained;
  progress.coins = (progress.coins ?? 0) + coinsGained;
  progress.level = levelFromXp(progress.xp);
  progress.totalFights = (progress.totalFights ?? 0) + 1;
  progress.currentWinStreak =
    outcome.result === 'win' ? (progress.currentWinStreak ?? 0) + 1 : 0;

  // Streak hari aktif (WIB): fight hari ini setelah jeda 1 hari → +1;
  // hari yang sama → tetap; jeda > 1 hari → reset ke 1.
  const today = wibDayString(now);
  const yesterday = wibDayString(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (progress.lastFightDay === today) {
    // sudah dihitung hari ini — streak tidak berubah
  } else if (progress.lastFightDay === yesterday) {
    progress.activityStreakDays = (progress.activityStreakDays ?? 0) + 1;
  } else {
    progress.activityStreakDays = 1;
  }
  progress.lastFightDay = today;
  progress.lastFightAt = now;

  // Cedera lama: kurangi 1 fight; habis → sembuh (null). Lalu roll
  // cedera baru hanya untuk yang kalah.
  let injury: Injury | null = (progress.injury as Injury | null) ?? null;
  if (injury) {
    injury = { ...injury, fightsRemaining: injury.fightsRemaining - 1 };
    if (injury.fightsRemaining <= 0) injury = null;
  }
  const newInjury = rollInjury(outcome.result, outcome.method, rng);
  if (newInjury) injury = newInjury;
  progress.injury = injury;

  // Achievement: baca record terbaru + status pemegang gelar.
  const fighter = await Fighter.findById(fighterId).select('record').lean();
  const title = await Title.findOne().select('holderFighterId').lean().catch(() => null);
  const isTitleHolder =
    !!title?.holderFighterId && title.holderFighterId.toString() === fighterId;
  const achievementsUnlocked = checkAchievements({
    wins: fighter?.record?.wins ?? 0,
    kos: fighter?.record?.kos ?? 0,
    totalFights: progress.totalFights,
    currentWinStreak: progress.currentWinStreak,
    activityStreakDays: progress.activityStreakDays,
    isTitleHolder,
    alreadyUnlocked: progress.achievements ?? [],
  });
  if (achievementsUnlocked.length > 0) {
    progress.achievements = [...(progress.achievements ?? []), ...achievementsUnlocked];
  }

  await progress.save();

  return {
    fighterId,
    xpGained,
    coinsGained,
    levelBefore,
    level: progress.level,
    levelUp: progress.level > levelBefore,
    achievementsUnlocked,
    injury,
  };
}

// ---------------------------------------------------------------------------
// Prediksi penonton
// ---------------------------------------------------------------------------

export interface ResolvePredictionsResult {
  resolved: number;
  won: number;
  lost: number;
  /** Total koin yang dibayarkan ke pemenang prediksi. */
  paidOut: number;
}

/**
 * Selesaikan semua prediksi 'open' untuk satu fight.
 * Benar → status 'won', payout 20 koin (stake 10 kembali + 10 untung)
 *   dikreditkan ke progres fighter milik user itu (kalau user punya
 *   fighter; kalau belum punya fighter, status tetap 'won' dengan
 *   payout tercatat tapi koin tidak bisa dikreditkan ke mana-mana).
 * Salah → status 'lost', payout 0 (stake 10 hangus — sudah dipotong
 *   saat prediksi dibuat).
 * Seri (winnerFighterId null) → prediksi tetap 'open' (tidak ada yang
 *   menang/kalah); kembalikan resolved 0.
 */
export async function resolvePredictions(
  fightId: string,
  kind: 'game' | 'tournament',
  winnerFighterId: string | null,
): Promise<ResolvePredictionsResult> {
  if (!winnerFighterId) return { resolved: 0, won: 0, lost: 0, paidOut: 0 };
  const open = await Prediction.find({ fightId, kind, status: 'open' });
  let won = 0;
  let lost = 0;
  let paidOut = 0;
  for (const p of open) {
    const correct = p.predictedWinnerFighterId.toString() === winnerFighterId;
    if (correct) {
      p.status = 'won';
      p.payout = PREDICTION_WIN_PAYOUT;
      won += 1;
      paidOut += PREDICTION_WIN_PAYOUT;
      // Kredit koin ke fighter milik user yang memprediksi.
      const fighter = await Fighter.findOne({ userId: p.userId }).select('_id').lean();
      if (fighter) {
        const progress = await getOrCreateProgress(fighter._id.toString());
        progress.coins = (progress.coins ?? 0) + PREDICTION_WIN_PAYOUT;
        await progress.save();
      }
    } else {
      p.status = 'lost';
      p.payout = 0;
      lost += 1;
    }
    await p.save();
  }
  return { resolved: open.length, won, lost, paidOut };
}

/** Bentuk progres untuk API (dipakai GET /api/fighters/[id]/progress). */
export function serializeProgress(progress: {
  fighterId: unknown;
  xp: number;
  level: number;
  coins: number;
  gearOwned: string[];
  achievements: string[];
  injury: Injury | null;
  totalFights: number;
  currentWinStreak: number;
  activityStreakDays: number;
  lastFightAt: Date | null;
}): Record<string, unknown> {
  const xp = progress.xp ?? 0;
  const level = progress.level ?? levelFromXp(xp);
  const xpInLevel = xpInCurrentLevel(xp);
  const xpNeeded = xpForLevelUp(level);
  return {
    fighterId: String(progress.fighterId),
    xp,
    level,
    xpInLevel,
    xpForNextLevel: xpNeeded,
    xpProgressPct: Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)),
    coins: progress.coins ?? 0,
    gearOwned: progress.gearOwned ?? [],
    achievements: progress.achievements ?? [],
    injury: progress.injury ?? null,
    totalFights: progress.totalFights ?? 0,
    currentWinStreak: progress.currentWinStreak ?? 0,
    activityStreakDays: progress.activityStreakDays ?? 0,
    lastFightAt: progress.lastFightAt ? progress.lastFightAt.toISOString() : null,
  };
}
