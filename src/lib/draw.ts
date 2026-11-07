import { Fighter } from '../models/Fighter';
import { Match } from '../models/Match';
import { Tournament } from '../models/Tournament';
import { TournamentEntry } from '../models/TournamentEntry';
import { VideoTask } from '../models/VideoTask';
import { nextRound, type RoundName } from './bracket';

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

export function simulateFight(seed: number): FightSimulation {
  const rng = mulberry32(seed);
  const rolls: number[] = [];
  const roll = (): number => {
    const value = rng();
    rolls.push(value);
    return value;
  };

  const methodPick = roll() < 0.5 ? 'KO' : 'decision';
  // Roll pemenang dipakai untuk KO; untuk decision pemenang ditentukan skor.
  const winnerPick = roll() < 0.5 ? 'A' : 'B';
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
 */
export async function decideMatch(matchId: string, seed: number): Promise<DecideMatchResult> {
  const match = await Match.findById(matchId);
  if (!match) throw new Error('Match tidak ditemukan');
  if (match.isBye || match.status === 'decided') {
    throw new Error('Match sudah diputuskan atau bye');
  }

  const sim = simulateFight(seed);
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

  const winner = await Fighter.findById(winnerId);
  if (sim.method === 'KO') {
    if (winner) {
      winner.record.wins += 1;
      winner.record.kos += 1;
      await winner.save();
    }
    if (loserId) {
      const loser = await Fighter.findById(loserId);
      if (loser) {
        loser.record.losses += 1;
        await loser.save();
      }
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
    if (loserId) {
      const loser = await Fighter.findById(loserId);
      if (loser) {
        loser.record.losses += 1;
        await loser.save();
      }
      await TournamentEntry.updateOne(
        { tournamentId: match.tournamentId, fighterId: loserId },
        { $set: { status: 'eliminated' } },
      );
    }
  } else {
    // draw: keduanya draws+1, advancer tetap maju
    const otherId = advancerIsA ? match.fighterBId : match.fighterAId;
    const other = await Fighter.findById(otherId);
    if (winner) {
      winner.record.draws += 1;
      await winner.save();
    }
    if (other) {
      other.record.draws += 1;
      await other.save();
    }
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
