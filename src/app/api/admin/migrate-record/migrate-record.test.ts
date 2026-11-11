import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as register } from "../../auth/register/route";
import { POST as login } from "../../auth/login/route";
import { GET as dryRun, POST as apply } from "./route";
import { User } from "../../../../models/User";
import { Fighter } from "../../../../models/Fighter";
import { GameFight } from "../../../../models/GameFight";
import { Match } from "../../../../models/Match";
import { Tournament } from "../../../../models/Tournament";

/**
 * Migrasi penyatuan rekor (admin): record lama + casualRecord lama -> record.
 * Integration test dengan mongodb-memory-server (skip kalau binary tidak
 * bisa diunduh di VM ini — pola yang sama dengan fights.test.ts).
 */

const ADMIN_SLUG = "test-admin-slug";

let mongod: MongoMemoryServer | null = null;
let dbReady = false;
let adminCookie: string | null = null;

function skipIfNoDb(): boolean {
  if (!dbReady) {
    console.warn("SKIP: integration test dilewati (tidak ada MongoDB in-memory).");
    return true;
  }
  return false;
}

function req(path: string, method: string, opts: { cookie?: string | null; adminPath?: boolean } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.adminPath) headers["x-admin-path"] = ADMIN_SLUG;
  return new NextRequest(`http://localhost${path}`, { method, headers });
}

function extractCookie(res: Response): string | null {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const raw = cookies[0] ?? headers.get("set-cookie");
  if (!raw) return null;
  return raw.split(";")[0];
}

async function json<T>(res: Response): Promise<{ data: T }> {
  return (await res.json()) as { data: T };
}

const SELF_DESC =
  "Petarung jalanan dari Semarang yang sudah latihan bertahun-tahun di sasana kecil dekat rumah.";

interface MigrateOut {
  dryRun: boolean;
  applied?: number;
  skipped?: number;
  decidedMatches: number;
  completedFights: number;
  fighters: {
    fighterId: string;
    displayName: string;
    storedRecord: { wins: number; losses: number; draws: number; kos: number };
    storedCasual: { wins: number; losses: number; draws: number; kos: number };
    recountFromGameFights: { wins: number; losses: number; draws: number; kos: number };
    recountFromTournament: { wins: number; losses: number; draws: number; kos: number };
    recountTotal: { wins: number; losses: number; draws: number; kos: number };
    casualMatchesRecount: boolean;
    mergedRecord: { wins: number; losses: number; draws: number; kos: number };
    alreadyMigrated: boolean;
  }[];
}

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
    process.env.ADMIN_SLUG = ADMIN_SLUG;
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

describe("Admin migrasi rekor: kasual + turnamen -> satu record", () => {
  it("setup: admin login + 2 fighter + 2 fight completed", async () => {
    if (skipIfNoDb()) return;
    const reg = await register(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin_migrate", password: "passwordkuat123" }),
      }),
    );
    expect(reg.status).toBe(201);
    await User.updateOne({ username: "admin_migrate" }, { $set: { role: "admin" } });
    const loginRes = await login(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin_migrate", password: "passwordkuat123" }),
      }),
    );
    expect(loginRes.status).toBe(200);
    adminCookie = extractCookie(loginRes);
    expect(adminCookie).toBeTruthy();

    const userA = await User.create({ username: "u_mig_a", passwordHash: "x" });
    const userB = await User.create({ username: "u_mig_b", passwordHash: "x" });
    // A: 1 menang turnamen (record lama) + 1W-1L kasual (dari 2 GameFight).
    // casualRecord ditulis via driver mentah (collection) — skema baru
    // sudah tidak punya field ini, jadi Fighter.create (strict) akan
    // membuangnya; ini mensimulasikan data LAMA sebelum migrasi.
    // Kemenangan turnamen A dicatat sebagai Match decided (A menang KO
    // atas B) — persis seperti yang dilakukan draw.ts di produksi.
    const tourney = await Tournament.create({
      name: "Turnamen Uji Migrasi",
      slug: "turnamen-uji-migrasi",
      bracketSize: 8,
      regOpenAt: new Date("2026-11-01T00:00:00Z"),
      regCloseAt: new Date("2026-11-07T00:00:00Z"),
      createdBy: userA._id,
    });
    const fa = await Fighter.create({
      userId: userA._id,
      displayName: "A Migran",
      igUsername: "a_migran",
      style: "boxing",
      selfDescription: SELF_DESC,
      rating: 1016,
      record: { wins: 1, losses: 0, draws: 0, kos: 1 },
    });
    await Fighter.collection.updateOne(
      { _id: fa._id },
      { $set: { casualRecord: { wins: 1, losses: 1, draws: 0, kos: 1 } } },
    );
    // B: 1 kalah turnamen (dari Match decided di atas) + 1W-1L kasual.
    const fb = await Fighter.create({
      userId: userB._id,
      displayName: "B Migran",
      igUsername: "b_migran",
      style: "wushu",
      selfDescription: SELF_DESC,
      rating: 984,
      record: { wins: 0, losses: 1, draws: 0, kos: 0 },
    });
    await Fighter.collection.updateOne(
      { _id: fb._id },
      { $set: { casualRecord: { wins: 1, losses: 1, draws: 0, kos: 0 } } },
    );
    await Match.create({
      tournamentId: tourney._id,
      round: "QF",
      fighterAId: fa._id,
      fighterBId: fb._id,
      winnerId: fa._id,
      method: "KO",
      score: { a: 70, b: 50 },
      koTimeSec: 38,
      drawSeed: 424242,
      status: "decided",
      decidedAt: new Date("2026-11-09T10:00:00Z"),
    });
    // Fight 1: A menang KO atas B. Fight 2: B menang decision atas A.
    await GameFight.create({
      fighterAId: fa._id,
      fighterBId: fb._id,
      seed: 111,
      map: "ring",
      durationSec: 60,
      status: "completed",
      config: { left: { name: "A", style: "boxing" }, right: { name: "B", style: "wushu" } },
      result: { winnerSide: "R", winnerFighterId: fa._id, method: "KO", score: { a: 15, b: 0 }, koTimeSec: 58.1 },
      completedAt: new Date("2026-11-08T10:00:00Z"),
      createdAt: new Date("2026-11-08T10:00:00Z"),
    });
    await GameFight.create({
      fighterAId: fa._id,
      fighterBId: fb._id,
      seed: 222,
      map: "ring",
      durationSec: 60,
      status: "completed",
      config: { left: { name: "A", style: "boxing" }, right: { name: "B", style: "wushu" } },
      result: { winnerSide: "B", winnerFighterId: fb._id, method: "decision", score: { a: 8, b: 14 }, koTimeSec: null },
      completedAt: new Date("2026-11-08T11:00:00Z"),
      createdAt: new Date("2026-11-08T11:00:00Z"),
    });
  });

  it("GET dry-run: rencana benar, tanpa menulis", async () => {
    if (skipIfNoDb()) return;
    const res = await dryRun(req("/api/admin/migrate-record", "GET", { cookie: adminCookie, adminPath: true }));
    expect(res.status).toBe(200);
    const body = (await json<MigrateOut>(res)).data;
    expect(body.dryRun).toBe(true);
    expect(body.completedFights).toBe(2);
    expect(body.decidedMatches).toBe(1);
    expect(body.fighters).toHaveLength(2);
    const fa = body.fighters.find((f) => f.displayName === "A Migran")!;
    // Kasual tersimpan (1W-1L 1KO) == hitung ulang dari 2 GameFight.
    expect(fa.casualMatchesRecount).toBe(true);
    expect(fa.recountFromGameFights).toEqual({ wins: 1, losses: 1, draws: 0, kos: 1 });
    // Hitung ulang turnamen: 1 menang KO dari Match decided.
    expect(fa.recountFromTournament).toEqual({ wins: 1, losses: 0, draws: 0, kos: 1 });
    // Gabungan kasual + turnamen == rekor gabungan (gate migrasi).
    expect(fa.recountTotal).toEqual({ wins: 2, losses: 1, draws: 0, kos: 2 });
    // Gabungan: turnamen 1W 1KO + kasual 1W-1L 1KO = 2W-1L 2KO.
    expect(fa.mergedRecord).toEqual({ wins: 2, losses: 1, draws: 0, kos: 2 });
    expect(fa.mergedRecord).toEqual(fa.recountTotal);
    const fb = body.fighters.find((f) => f.displayName === "B Migran")!;
    expect(fb.recountFromTournament).toEqual({ wins: 0, losses: 1, draws: 0, kos: 0 });
    expect(fb.recountTotal).toEqual({ wins: 1, losses: 2, draws: 0, kos: 0 });
    expect(fb.mergedRecord).toEqual({ wins: 1, losses: 2, draws: 0, kos: 0 });
    expect(fb.mergedRecord).toEqual(fb.recountTotal);
    // Dry-run TIDAK menulis: rekor di DB masih lama (casualRecord dibaca
    // dari dokumen mentah — field lama tidak ada di skema baru).
    const faDb = (await Fighter.findOne({ displayName: "A Migran" }).lean()) as unknown as Record<string, unknown>;
    expect(faDb?.record).toMatchObject({ wins: 1, losses: 0, kos: 1 });
    expect(faDb?.casualRecord).toMatchObject({ wins: 1, losses: 1 });
  });

  it("POST apply: record digabung + casualRecord hilang", async () => {
    if (skipIfNoDb()) return;
    const res = await apply(req("/api/admin/migrate-record", "POST", { cookie: adminCookie, adminPath: true }));
    expect(res.status).toBe(200);
    const body = (await json<MigrateOut>(res)).data;
    expect(body.dryRun).toBe(false);
    expect(body.applied).toBe(2);
    expect(body.skipped).toBe(0);
    const faDb = (await Fighter.findOne({ displayName: "A Migran" }).lean()) as unknown as Record<string, unknown>;
    expect(faDb?.record).toMatchObject({ wins: 2, losses: 1, draws: 0, kos: 2 });
    expect(faDb?.casualRecord).toBeUndefined();
    const fbDb = (await Fighter.findOne({ displayName: "B Migran" }).lean()) as unknown as Record<string, unknown>;
    expect(fbDb?.record).toMatchObject({ wins: 1, losses: 2, draws: 0, kos: 0 });
    expect(fbDb?.casualRecord).toBeUndefined();
  });

  it("POST kedua: idempotent (applied 0, skipped 2)", async () => {
    if (skipIfNoDb()) return;
    const res = await apply(req("/api/admin/migrate-record", "POST", { cookie: adminCookie, adminPath: true }));
    expect(res.status).toBe(200);
    const body = (await json<MigrateOut>(res)).data;
    expect(body.applied).toBe(0);
    expect(body.skipped).toBe(2);
    expect(body.fighters.every((f) => f.alreadyMigrated)).toBe(true);
  });

  it("tanpa x-admin-path -> 404; tanpa login -> 401", async () => {
    if (skipIfNoDb()) return;
    const noPath = await dryRun(req("/api/admin/migrate-record", "GET", { cookie: adminCookie }));
    expect(noPath.status).toBe(404);
    const noLogin = await dryRun(req("/api/admin/migrate-record", "GET", { adminPath: true }));
    expect(noLogin.status).toBe(401);
  });
});
