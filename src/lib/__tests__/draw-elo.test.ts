import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decideMatch, simulateFight } from "../draw";
import { updateRatings } from "../game/elo";
import { connectDB } from "../db";
import { User } from "../../models/User";
import { Fighter } from "../../models/Fighter";
import { FighterProgress } from "../../models/FighterProgress";
import { FighterStats } from "../../models/FighterStats";
import { Tournament } from "../../models/Tournament";
import { Match } from "../../models/Match";

/**
 * Kemenangan turnamen MENGUBAH rating Elo (keputusan 2026-11-11,
 * membalikkan aturan lama "turnamen tidak mengubah rating").
 * Persis seperti fight kasual: KO/decision skor 1/0, draw 0.5/0.5, K=32.
 * Bye: tidak ada perubahan rating.
 * Integration test dengan mongodb-memory-server (skip kalau binary tidak
 * bisa diunduh di VM ini).
 */

let mongod: MongoMemoryServer | null = null;
let dbReady = false;

function skipIfNoDb(): boolean {
  if (!dbReady) {
    console.warn("SKIP: integration test dilewati (tidak ada MongoDB in-memory).");
    return true;
  }
  return false;
}

const SELF_DESC =
  "Petarung jalanan dari Semarang yang sudah latihan bertahun-tahun di sasana kecil dekat rumah.";

beforeAll(async () => {
  try {
    mongod = await Promise.race([
      MongoMemoryServer.create(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout download binary mongodb-memory-server")), 120000),
      ),
    ]);
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = "test-jwt-secret-yang-cukup-panjang-123456";
    await connectDB();
    dbReady = true;
  } catch (err) {
    console.warn(
      "SKIP integration test: mongodb-memory-server tidak bisa jalan di VM ini:",
      (err as Error).message,
    );
  }
}, 180000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

/** Cari seed pertama yang menghasilkan method tertentu (sim murni, cepat). */
function findSeed(method: "KO" | "decision" | "draw"): number {
  for (let seed = 0; seed < 200000; seed++) {
    if (simulateFight(seed).method === method) return seed;
  }
  throw new Error(`tidak ada seed ${method} dalam 200000 percobaan`);
}

let n = 0;

async function makeMatch(ratingA: number, ratingB: number) {
  n++;
  const admin = await User.create({ username: `u_elo_admin_${n}`, passwordHash: "x" });
  const uA = await User.create({ username: `u_elo_a_${n}`, passwordHash: "x" });
  const uB = await User.create({ username: `u_elo_b_${n}`, passwordHash: "x" });
  const fA = await Fighter.create({
    userId: uA._id,
    displayName: `A Elo ${n}`,
    igUsername: `a_elo_${n}`,
    style: "boxing",
    selfDescription: SELF_DESC,
    rating: ratingA,
    record: { wins: 0, losses: 0, draws: 0, kos: 0 },
  });
  const fB = await Fighter.create({
    userId: uB._id,
    displayName: `B Elo ${n}`,
    igUsername: `b_elo_${n}`,
    style: "muay-thai",
    selfDescription: SELF_DESC,
    rating: ratingB,
    record: { wins: 0, losses: 0, draws: 0, kos: 0 },
  });
  const t = await Tournament.create({
    name: `Turnamen Elo ${n}`,
    slug: `turnamen-elo-${n}`,
    bracketSize: 8,
    regOpenAt: new Date(),
    regCloseAt: new Date(Date.now() + 86400000),
    status: "in_progress",
    createdBy: admin._id,
  });
  const m = await Match.create({
    tournamentId: t._id,
    round: "QF",
    fighterAId: fA._id,
    fighterBId: fB._id,
    drawSeed: 1,
    status: "scheduled",
  });
  return { fA, fB, m };
}

async function ratings(fAId: unknown, fBId: unknown) {
  const a = await Fighter.findById(fAId).lean();
  const b = await Fighter.findById(fBId).lean();
  return [a?.rating, b?.rating] as [number, number];
}

describe("decideMatch: kemenangan turnamen mengubah rating Elo", () => {
  it("KO/decision: pemenang +16 / kalah -16 saat rating sama (K=32)", async () => {
    if (skipIfNoDb()) return;
    const { fA, fB, m } = await makeMatch(1000, 1000);
    const seed = findSeed("KO");
    const sim = simulateFight(seed);
    expect(sim.method).toBe("KO");
    const scoreA = sim.winner === "A" ? 1 : 0;
    const [expA, expB] = updateRatings(1000, 1000, scoreA);

    const res = await decideMatch(String(m._id), seed);
    expect(res.simulation.method).toBe("KO");

    const [rA, rB] = await ratings(fA._id, fB._id);
    expect([rA, rB]).toEqual([expA, expB]);
    expect([rA, rB]).toEqual(scoreA === 1 ? [1016, 984] : [984, 1016]);
    // Rekor tetap berubah seperti dulu.
    const a = await Fighter.findById(fA._id).lean();
    const b = await Fighter.findById(fB._id).lean();
    const winner = scoreA === 1 ? a : b;
    const loser = scoreA === 1 ? b : a;
    expect(winner?.record.wins).toBe(1);
    expect(winner?.record.kos).toBe(1);
    expect(loser?.record.losses).toBe(1);
    // Hadiah progres (progress.ts): menang KO = XP 100+50, koin 50;
    // kalah = XP 30, koin 10.
    const progW = await FighterProgress.findOne({
      fighterId: scoreA === 1 ? fA._id : fB._id,
    }).lean();
    const progL = await FighterProgress.findOne({
      fighterId: scoreA === 1 ? fB._id : fA._id,
    }).lean();
    expect(progW?.xp).toBe(150);
    expect(progW?.coins).toBe(50);
    expect(progL?.xp).toBe(30);
    expect(progL?.coins).toBe(10);
  });

  it("decision: rating berubah sesuai updateRatings + rekor wins/losses", async () => {
    if (skipIfNoDb()) return;
    const { fA, fB, m } = await makeMatch(1100, 1000);
    const seed = findSeed("decision");
    const sim = simulateFight(seed);
    expect(sim.method).toBe("decision");
    const scoreA = sim.winner === "A" ? 1 : 0;
    const [expA, expB] = updateRatings(1100, 1000, scoreA);

    await decideMatch(String(m._id), seed);
    const [rA, rB] = await ratings(fA._id, fB._id);
    expect([rA, rB]).toEqual([expA, expB]);
    // Pemenang naik, kalah turun (siapa pun pemenangnya).
    if (scoreA === 1) {
      expect(rA).toBeGreaterThan(1100);
      expect(rB).toBeLessThan(1000);
    } else {
      expect(rA).toBeLessThan(1100);
      expect(rB).toBeGreaterThan(1000);
    }
  });

  it("draw: kedua rating bergerak sedikit ke arah satu sama lain", async () => {
    if (skipIfNoDb()) return;
    // Rating beda supaya draw terlihat bergerak (rating sama + draw = tetap).
    const { fA, fB, m } = await makeMatch(1200, 1000);
    const seed = findSeed("draw");
    const sim = simulateFight(seed);
    expect(sim.method).toBe("draw");
    const [expA, expB] = updateRatings(1200, 1000, 0.5);

    await decideMatch(String(m._id), seed);
    const [rA, rB] = await ratings(fA._id, fB._id);
    expect([rA, rB]).toEqual([expA, expB]);
    expect(rA).toBeLessThan(1200); // rating tinggi turun sedikit
    expect(rB).toBeGreaterThan(1000); // rating rendah naik sedikit
    // Rekor: keduanya draws+1.
    const a = await Fighter.findById(fA._id).lean();
    const b = await Fighter.findById(fB._id).lean();
    expect(a?.record.draws).toBe(1);
    expect(b?.record.draws).toBe(1);
    // Hadiah progres: seri = XP 50, koin 25 untuk keduanya.
    const progA = await FighterProgress.findOne({ fighterId: fA._id }).lean();
    const progB = await FighterProgress.findOne({ fighterId: fB._id }).lean();
    expect(progA?.xp).toBe(50);
    expect(progA?.coins).toBe(25);
    expect(progB?.xp).toBe(50);
    expect(progB?.coins).toBe(25);
  });

  it("bias stat: stat A jauh lebih tinggi membalik pemenang KO (bukan lotere murni)", async () => {
    if (skipIfNoDb()) return;
    // Cari seed KO yang roll pemenangnya jatuh di zona flip [0.5, 0.75):
    // bias 0 → pemenang B, bias +0.25 → pemenang A. Method/skor tidak
    // berubah oleh bias — hanya roll pemenang yang digeser.
    let flipSeed = -1;
    for (let seed = 0; seed < 20000; seed++) {
      const r0 = simulateFight(seed, 0);
      if (r0.method !== "KO" || r0.winner !== "B") continue;
      if (simulateFight(seed, 0.25).winner === "A") {
        flipSeed = seed;
        break;
      }
    }
    expect(flipSeed).toBeGreaterThanOrEqual(0);

    // Kontrol: tanpa dokumen stat → bias 0 → pemenang tetap B.
    const ctrl = await makeMatch(1000, 1000);
    const resCtrl = await decideMatch(String(ctrl.m._id), flipSeed);
    expect(resCtrl.simulation.winner).toBe("B");
    expect(String(resCtrl.winnerId)).toBe(String(ctrl.fB._id));

    // Perlakuan: stat A 100 semua vs B 10 semua → bias +0.25 → pemenang A.
    const trt = await makeMatch(1000, 1000);
    await FighterStats.create({
      fighterId: trt.fA._id,
      stats: { power: 100, speed: 100, stamina: 100, defense: 100, accuracy: 100 },
    });
    await FighterStats.create({
      fighterId: trt.fB._id,
      stats: { power: 10, speed: 10, stamina: 10, defense: 10, accuracy: 10 },
    });
    const resTrt = await decideMatch(String(trt.m._id), flipSeed);
    expect(resTrt.simulation.winner).toBe("A");
    expect(String(resTrt.winnerId)).toBe(String(trt.fA._id));
    const [rA, rB] = await ratings(trt.fA._id, trt.fB._id);
    expect([rA, rB]).toEqual([1016, 984]);
  });

  it("bye: decideMatch ditolak dan rating tidak berubah", async () => {
    if (skipIfNoDb()) return;
    const { fA, fB } = await makeMatch(1000, 1000);
    // Match bye: sudah decided sejak generate-bracket.
    const t = await Tournament.findOne({ slug: `turnamen-elo-${n}` });
    const bye = await Match.create({
      tournamentId: t!._id,
      round: "QF",
      fighterAId: fA._id,
      fighterBId: null,
      winnerId: fA._id,
      method: "bye",
      isBye: true,
      drawSeed: 0,
      status: "decided",
    });
    await expect(decideMatch(String(bye._id), 42)).rejects.toThrow(
      "Match sudah diputuskan atau bye",
    );
    const [rA, rB] = await ratings(fA._id, fB._id);
    expect([rA, rB]).toEqual([1000, 1000]);
  });
});
