import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import JSZip from "jszip";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as register } from "../../auth/register/route";
import { POST as login } from "../../auth/login/route";
import { GET as listFights } from "./route";
import { GET as postersZip } from "./posters-zip/route";
import { User } from "../../../../models/User";
import { Fighter } from "../../../../models/Fighter";
import { GameFight } from "../../../../models/GameFight";

/**
 * Admin "Pertandingan": daftar fight per hari WIB + ZIP poster.
 * Integration test dengan mongodb-memory-server (skip kalau binary tidak
 * bisa diunduh di VM ini — pola yang sama dengan api.integration.test.ts).
 */

const ADMIN_SLUG = "test-admin-slug";
const POSTER_B64 = Buffer.from("isi-poster-jpeg-palsu").toString("base64");
const POSTER_URL = `data:image/jpeg;base64,${POSTER_B64}`;

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

function req(path: string, opts: { cookie?: string | null; adminPath?: boolean } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.adminPath) headers["x-admin-path"] = ADMIN_SLUG;
  return new NextRequest(`http://localhost${path}`, { headers });
}

function extractCookie(res: Response): string | null {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const raw = cookies[0] ?? headers.get("set-cookie");
  if (!raw) return null;
  return raw.split(";")[0];
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

const SELF_DESC =
  "Petarung jalanan dari Semarang yang sudah latihan bertahun-tahun di sasana kecil dekat rumah.";

async function makeFighter(userId: mongoose.Types.ObjectId, name: string, ig: string) {
  return Fighter.create({
    userId,
    displayName: name,
    igUsername: ig,
    style: "boxing",
    selfDescription: SELF_DESC,
    rating: 1000,
    casualRecord: { wins: 0, losses: 0, draws: 0, kos: 0 },
  });
}

async function makeFight(
  a: mongoose.Types.ObjectId,
  b: mongoose.Types.ObjectId,
  opts: {
    createdAt: Date;
    completedAt?: Date;
    poster?: boolean;
    scoreA?: number;
    scoreB?: number;
  },
) {
  return GameFight.create({
    fighterAId: a,
    fighterBId: b,
    seed: 123456,
    map: "ring",
    durationSec: 60,
    status: "completed",
    config: {
      left: { name: "Pitung", style: "boxing", color: "#E10600" },
      right: { name: "Jamal geng sebelah", style: "wushu", color: "#1D4ED8" },
    },
    result: {
      winnerSide: "R",
      method: "KO",
      score: { a: opts.scoreA ?? 15, b: opts.scoreB ?? 0 },
      koTimeSec: 58.64,
    },
    posterDataUrl: opts.poster ? POSTER_URL : null,
    completedAt: opts.completedAt ?? opts.createdAt,
    createdAt: opts.createdAt,
  });
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
    process.env.JWT_SECRET = "test-jwt-secret-yang-cukup-panjang-untuk-hs256";
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

describe("Admin pertandingan: daftar hari ini + ZIP poster", () => {
  it("setup: admin login + 2 fighter + 3 fight (2 hari ini WIB, 1 kemarin WIB)", async () => {
    if (skipIfNoDb()) return;
    const reg = await register(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin_fights", password: "passwordkuat123" }),
      }),
    );
    expect(reg.status).toBe(201);
    await User.updateOne({ username: "admin_fights" }, { $set: { role: "admin" } });
    const loginRes = await login(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin_fights", password: "passwordkuat123" }),
      }),
    );
    expect(loginRes.status).toBe(200);
    adminCookie = extractCookie(loginRes);
    expect(adminCookie).toContain("sfh_token=");

    const u1 = await User.create({ username: "u_pitung", passwordHash: "x" });
    const u2 = await User.create({ username: "u_jamal", passwordHash: "x" });
    const fA = await makeFighter(u1._id as mongoose.Types.ObjectId, "Pitung", "sadiasyar");
    const fB = await makeFighter(u2._id as mongoose.Types.ObjectId, "Jamal geng sebelah", "jamalgeng");
    // Hari ini (WIB 2026-11-08): 2 fight — 00:30 WIB (= 17:30 UTC 7 Nov)
    // dan 10:00 WIB (= 03:00 UTC 8 Nov). Kemarin WIB: 23:30 WIB 7 Nov
    // (= 16:30 UTC 7 Nov) — harus TIDAK masuk daftar 8 Nov.
    await makeFight(fA._id as mongoose.Types.ObjectId, fB._id as mongoose.Types.ObjectId, {
      createdAt: new Date("2026-11-07T17:30:00.000Z"),
      poster: true,
      scoreA: 15,
      scoreB: 0,
    });
    await makeFight(fA._id as mongoose.Types.ObjectId, fB._id as mongoose.Types.ObjectId, {
      createdAt: new Date("2026-11-08T03:00:00.000Z"),
      poster: true,
      scoreA: 8,
      scoreB: 12,
    });
    await makeFight(fA._id as mongoose.Types.ObjectId, fB._id as mongoose.Types.ObjectId, {
      createdAt: new Date("2026-11-07T16:30:00.000Z"),
      poster: true,
      scoreA: 27,
      scoreB: 3,
    });
  });

  it("GET /api/admin/fights?date=2026-11-08: hitung 2, hanya fight hari itu (WIB)", async () => {
    if (skipIfNoDb()) return;
    const res = await listFights(
      req("/api/admin/fights?date=2026-11-08", { cookie: adminCookie, adminPath: true }),
    );
    expect(res.status).toBe(200);
    const body = await json<{
      ok: boolean;
      data: { date: string; total: number; fights: { posterFile: string; score: { a: number; b: number } }[] };
    }>(res);
    expect(body.ok).toBe(true);
    expect(body.data.date).toBe("2026-11-08");
    expect(body.data.total).toBe(2);
    const files = body.data.fights.map((f) => f.posterFile).sort();
    expect(files).toEqual([
      "2026-11-08_pitung-vs-jamal-geng-sebelah_15-0.jpg",
      "2026-11-08_pitung-vs-jamal-geng-sebelah_8-12.jpg",
    ]);
  });

  it("GET /api/admin/fights?date=2026-11-07: hanya fight kemarin (1)", async () => {
    if (skipIfNoDb()) return;
    const res = await listFights(
      req("/api/admin/fights?date=2026-11-07", { cookie: adminCookie, adminPath: true }),
    );
    expect(res.status).toBe(200);
    const body = await json<{ ok: boolean; data: { total: number } }>(res);
    expect(body.data.total).toBe(1);
  });

  it("GET /api/admin/fights/posters-zip?date=2026-11-08: ZIP berisi 2 poster dengan nama benar", async () => {
    if (skipIfNoDb()) return;
    const res = await postersZip(
      req("/api/admin/fights/posters-zip?date=2026-11-08", { cookie: adminCookie, adminPath: true }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toContain("poster-2026-11-08.zip");
    expect(res.headers.get("X-Poster-Count")).toBe("2");
    const buf = Buffer.from(await res.arrayBuffer());
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual([
      "2026-11-08_pitung-vs-jamal-geng-sebelah_15-0.jpg",
      "2026-11-08_pitung-vs-jamal-geng-sebelah_8-12.jpg",
    ]);
    const content = await zip.file(names[0])!.async("string");
    expect(content).toBe("isi-poster-jpeg-palsu");
  });

  it("tanpa x-admin-path -> 404; tanpa login -> 401", async () => {
    if (skipIfNoDb()) return;
    const noPath = await listFights(req("/api/admin/fights?date=2026-11-08", { cookie: adminCookie }));
    expect(noPath.status).toBe(404);
    const noLogin = await listFights(req("/api/admin/fights?date=2026-11-08", { adminPath: true }));
    expect(noLogin.status).toBe(401);
  });
});
