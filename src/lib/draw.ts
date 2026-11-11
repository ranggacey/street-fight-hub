import { Fighter } from '../models/Fighter';
import { Match } from '../models/Match';
import { Tournament } from '../models/Tournament';
import { TournamentEntry } from '../models/TournamentEntry';
import { VideoTask } from '../models/VideoTask';
import { nextRound, type RoundName } from './bracket';
import { updateRatings } from './game/elo';
import { loadFighterStats } from './game/fight-setup';
import { awardFightOutcome, resolvePredictions } from './game/progress';
import { winBiasFromStats } from './game/stat-effects';

/**
 * Draw — simulasi pertarungan dengan seeded RNG (CONTRACT §6).
 *
 * Damage model: jab 8, cross 10, hook 12, uppercut 14, lowKick 14,
 * bodyKick 16, headKick 18, block chip 2.
 * Simulasi per 5 detik (12 tick untuk 60 detik): tiap tick tiap fighter
 * pilih strike acak; lawan block dengan peluang 0.3 → damage 2,
 * kalau tidak block → damage penuh strike. Skor = total damage yang DIBERIKAN.
 */

// ---------------------------------------------------------------------------
// Bagian murni (unit-testable tanpa DB)
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DAMAGE: Record<string, number> = {
  jab: 8,
  cross: 10,
  hook: 12,
  uppercut: 14,
  lowKick: 14,
  bodyKick: 16,
  headKick: 18,
};
export const BLOCK_CHIP = 2;
export const BLOCK_CHANCE = 0.3;
export const STRIKES = ['jab', 'cross', 'hook', 'uppercut', 'lowKick', 'bodyKick', 'headKick'] as const;

export interface FightSimulation {
  method: 'KO' | 'decision' | 'draw';
  winner: 'A' | 'B' | null;
  scoreA: number;
  scoreB: number;
  koTimeSec: number | null;
  advancer: 'A' | 'B' | null;
  drawReRollSeed: number | null;
  /** Angka roll mentah (untuk audit). */
  rolls: number[];
}

/**
 * Simulasi satu fight turnamen dari seed.
 *
 * @param seed seed RNG (mulberry32).
 * @param bias geser roll pemenang KO: positif menguntungkan A, negatif
 *   menguntungkan B (dijepit ke [-0.5, 0.5]). Dipakai koordinator untuk
 *   menyambung efek stat (winBiasFromStats) — bias 0 = perilaku lama
 *   persis, hasil deterministik per seed tidak berubah. Perhatian: bias
 *   hanya menggeser roll pemenang KO; pemenang decision tetap ditentukan
 *   skor damage, dan draw tetap dari skor sama.
 */
export function simulateFight(seed: number, bias = 0): FightSimulation {
  const rng = mulberry32(seed);
  const rolls: number[] = [];
  const roll = (): number => {
    const value = rng();
    rolls.push(value);
    return value;
  };

  const methodPick = roll() < 0.5 ? 'KO' : 'decision';
  // Roll pemenang dipakai untuk KO; untuk decision pemenang ditentukan skor.
  const clampedBias = Math.max(-0.5, Math.min(0.5, bias));
  const winnerPick = roll() < 0.5 + clampedBias ? 'A' : 'B';
  const koTimeSec = methodPick === 'KO' ? 35 + Math.floor(roll() * 21) : null; // 35-55

  const totalTicks = methodPick === 'KO' && koTimeSec !== null ? Math.ceil(koTimeSec / 5) : 12;
  let scoreA = 0;
  let scoreB = 0;

  for (let tick = 0; tick < totalTicks; tick++) {
    // A menyerang B
    const strikeA = STRIKES[Math.floor(roll() * STRIKES.length)];
    const blockedA = roll() < BLOCK_CHANCE;
    scoreA += blockedA ? BLOCK_CHIP : DAMAGE[strikeA];
    // B menyerang A
    const strikeB = STRIKES[Math.floor(roll() * STRIKES.length)];
    const blockedB = roll() < BLOCK_CHANCE;
    scoreB += blockedB ? BLOCK_CHIP : DAMAGE[strikeB];
  }

  if (methodPick === 'KO') {
    const winnerIsA = winnerPick === 'A';
    const winnerScore = winnerIsA ? scoreA : scoreB;
    const loserScore = winnerIsA ? scoreB : scoreA;
    // Pukulan KO: pastikan skor pemenang > skor lawan.
    if (winnerScore <= loserScore) {
      const extra = loserScore - winnerScore + 14;
      if (winnerIsA) scoreA += extra;
      else scoreB += extra;
    }
    return {
      method: 'KO',
      winner: winnerPick,
      scoreA,
      scoreB,
      koTimeSec,
      advancer: null,
      drawReRollSeed: null,
      rolls,
    };
  }

  if (scoreA === scoreB) {
    const advancer = roll() < 0.5 ? 'A' : 'B';
    const drawReRollSeed = Math.floor(roll() * 2 ** 31);
    return {
      method: 'draw',
      winner: null,
      scoreA,
      scoreB,
      koTimeSec: null,
      advancer,
      drawReRollSeed,
      rolls,
    };
  }

  return {
    method: 'decision',
    winner: scoreA > scoreB ? 'A' : 'B',
    scoreA,
    scoreB,
    koTimeSec: null,
    advancer: null,
    drawReRollSeed: null,
    rolls,
  };
}

// ---------------------------------------------------------------------------
// Bagian service (pakai DB)
// ---------------------------------------------------------------------------

export interface DecideMatchResult {
  matchId: string;
  simulation: FightSimulation;
  winnerId: string;
}

/**
 * Putuskan satu match: isi winner/method/score/KO time/draw, update record
 * kedua fighter, buat videoTask, lalu majukan pemenang (advanceWinners).
 * Aturan rekor: KO → pemenang wins+1 & kos+1, kalah losses+1.
 * Decision → wins+1 / losses+1. Draw → keduanya draws+1 (advancer tetap maju).
 * Aturan rating (keputusan 2026-11-11, membalikkan aturan lama):
 * kemenangan turnamen MENGUBAH rating Elo persis seperti fight kasual
 * (K=32, via updateRatings) — KO/decision skor 1/0, draw 0.5/0.5.
 * Bye tidak mengubah rating (match bye ditolak di awal fungsi ini).
 * Sim memakai bias stat (winBiasFromStats via loadFighterStats);
 * setelah record/rating di-update, hadiah progres + prediksi penonton
 * diberikan via awardFightOutcome / resolvePredictions (progress.ts).
 */
export async function decideMatch(matchId: string, seed: number): Promise<DecideMatchResult> {
  const match = await Match.findById(matchId);
  if (!match) throw new Error('Match tidak ditemukan');
  if (match.isBye || match.status === 'decided') {
    throw new Error('Match sudah diputuskan atau bye');
  }

  // Sim stat-aware (skema disetujui 2026-11-10): bias pemenang dari
  // selisih stat efektif kedua fighter (winBiasFromStats, ±0,25;
  // positif = menguntungkan A). Fighter tanpa dokumen stat = stat 10
  // semua → bias 0 → lotere lama persis.
  const [statsA, statsB] = await Promise.all([
    loadFighterStats(match.fighterAId.toString()),
    loadFighterStats(match.fighterBId!.toString()),
  ]);
  const sim = simulateFight(seed, winBiasFromStats(statsA, statsB));
  const advancerIsA = sim.advancer === 'A';
  const winnerSide = sim.method === 'draw' ? sim.advancer : sim.winner;
  const winnerId = winnerSide === 'A' ? match.fighterAId : match.fighterBId;
  const loserId =
    sim.method === 'draw' ? null : winnerSide === 'A' ? match.fighterBId : match.fighterAId;

  match.winnerId = winnerId;
  match.method = sim.method;
  match.score = { a: sim.scoreA, b: sim.scoreB };
  match.koTimeSec = sim.koTimeSec;
  match.drawSeed = seed;
  match.drawAdvancerId = sim.method === 'draw' ? winnerId : null;
  match.drawReRollSeed = sim.drawReRollSeed;
  match.status = 'decided';
  match.decidedAt = new Date();
  await match.save();

  // --- Rating Elo (keputusan 2026-11-11): kemenangan turnamen mengubah
  // rating persis seperti fight kasual — SATU field rating, K=32.
  // KO/decision: skor 1/0 untuk pemenang/kalah; draw: 0.5/0.5 untuk
  // keduanya (rating bergerak sedikit ke arah satu sama lain).
  const fighterA = await Fighter.findById(match.fighterAId);
  const fighterB = match.fighterBId
    ? await Fighter.findById(match.fighterBId)
    : null;
  const scoreA = sim.method === 'draw' ? 0.5 : winnerSide === 'A' ? 1 : 0;
  const [newRatingA, newRatingB] = updateRatings(
    fighterA?.rating ?? 1000,
    fighterB?.rating ?? 1000,
    scoreA,
  );
  if (fighterA) fighterA.rating = newRatingA;
  if (fighterB) fighterB.rating = newRatingB;
  // NOTE: tidak ada lagi TODO hook progress di sini — modul
  // src/lib/game/progress.ts sudah ada (antarmuka stabil) dan
  // dipanggil di bawah, setelah record/rating di-update.

  const winner = winnerSide === 'A' ? fighterA : fighterB;
  const loser =
    sim.method === 'draw'
      ? null
      : winnerSide === 'A'
        ? fighterB
        : fighterA;
  if (sim.method === 'KO') {
    if (winner) {
      winner.record.wins += 1;
      winner.record.kos += 1;
      await winner.save();
    }
    if (loser) {
      loser.record.losses += 1;
      await loser.save();
    }
    if (loserId) {
      await TournamentEntry.updateOne(
        { tournamentId: match.tournamentId, fighterId: loserId },
        { $set: { status: 'eliminated' } },
      );
    }
  } else if (sim.method === 'decision') {
    if (winner) {
      winner.record.wins += 1;
      await winner.save();
    }
    if (loser) {
      loser.record.losses += 1;
      await loser.save();
    }
    if (loserId) {
      await TournamentEntry.updateOne(
        { tournamentId: match.tournamentId, fighterId: loserId },
        { $set: { status: 'eliminated' } },
      );
    }
  } else {
    // draw: keduanya draws+1, advancer tetap maju
    const other = advancerIsA ? fighterB : fighterA;
    if (winner) {
      winner.record.draws += 1;
      await winner.save();
    }
    if (other) {
      other.record.draws += 1;
      await other.save();
    }
  }

  // --- Hadiah progres + prediksi penonton (src/lib/game/progress.ts,
  // antarmuka stabil untuk agen lain). SETELAH record/rating di-update,
  // karena achievement membaca record terbaru Fighter. Turnamen bukan
  // title fight (isTitleFight false). Seri: prediksi tetap open
  // (resolvePredictions dengan winner null → resolved 0).
  // Kegagalan di sini TIDAK boleh membatalkan match yang sudah
  // diputuskan — VideoTask + advanceWinners di bawah harus tetap
  // jalan (sama seperti result route GameFight).
  try {
    if (sim.method === 'draw') {
      const otherId = advancerIsA ? match.fighterBId : match.fighterAId;
      await awardFightOutcome(winnerId.toString(), {
        result: 'draw',
        method: 'draw',
        isTitleFight: false,
        isTournament: true,
      });
      await awardFightOutcome(String(otherId), {
        result: 'draw',
        method: 'draw',
        isTitleFight: false,
        isTournament: true,
      });
    } else {
      await awardFightOutcome(winnerId.toString(), {
        result: 'win',
        method: sim.method,
        isTitleFight: false,
        isTournament: true,
      });
      if (loserId) {
        await awardFightOutcome(loserId.toString(), {
          result: 'loss',
          method: sim.method,
          isTitleFight: false,
          isTournament: true,
        });
      }
    }
    await resolvePredictions(
      match._id.toString(),
      'tournament',
      sim.method === 'draw' ? null : winnerId.toString(),
    );
  } catch (progressErr) {
    console.error('Gagal mencatat progres turnamen', match._id.toString(), progressErr);
  }

  // Satu videoTask per match yang diputuskan (bye tidak dibuat di sini karena
  // bye sudah decided sejak generate-bracket).
  await VideoTask.create({ matchId: match._id, status: 'queued', note: '' });

  await advanceWinners(match.tournamentId.toString(), match.round as RoundName);

  return { matchId: match._id.toString(), simulation: sim, winnerId: winnerId.toString() };
}

/**
 * Majukan pemenang ronde ini ke ronde berikut. Hanya jalan jika SEMUA match
 * ronde ini sudah decided. Pemenang dipasangkan berurutan (sesuai urutan
 * pembuatan match) menjadi match ronde berikut. Jika ronde = F → set champion
 * dan status turnamen 'completed'.
 */
export async function advanceWinners(tournamentId: string, round: RoundName): Promise<void> {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return;

  const remaining = await Match.countDocuments({
    tournamentId,
    round,
    status: 'scheduled',
  });
  if (remaining > 0) return;

  const decided = await Match.find({ tournamentId, round, status: 'decided' })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  if (decided.length === 0) return;

  const next = nextRound(round);
  if (!next) {
    // Final: tentukan juara.
    const finalMatch = decided[0];
    const championId =
      finalMatch.method === 'draw' ? finalMatch.drawAdvancerId : finalMatch.winnerId;
    tournament.championId = championId ?? null;
    tournament.status = 'completed';
    await tournament.save();
    if (championId) {
      await TournamentEntry.updateOne(
        { tournamentId, fighterId: championId },
        { $set: { status: 'champion' } },
      );
    }
    return;
  }

  const winners = decided
    .map((m) => (m.method === 'draw' ? m.drawAdvancerId : m.winnerId))
    .filter((id): id is NonNullable<typeof id> => Boolean(id));

  for (let i = 0; i + 1 < winners.length; i += 2) {
    const exists = await Match.findOne({
      tournamentId,
      round: next,
      fighterAId: winners[i],
      fighterBId: winners[i + 1],
    });
    if (!exists) {
      await Match.create({
        tournamentId,
        round: next,
        fighterAId: winners[i],
        fighterBId: winners[i + 1],
        drawSeed: Math.floor(Math.random() * 2 ** 31),
        status: 'scheduled',
      });
    }
  }
}
