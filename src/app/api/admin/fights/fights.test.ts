import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import JSZip from "jszip";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as register } from "../../auth/register/route";
import { POST as login } from "../../auth/login/route";
import { GET as listFights } from "./route";
import { GET as postersZip } from "./posters-zip/route";
import { POST as createVideoTask } from "../../admin/video-tasks/route";
import { PATCH as patchVideoTask } from "../../admin/video-tasks/[id]/route";
import { User } from "../../../../models/User";
import { Fighter } from "../../../../models/Fighter";
import { GameFight } from "../../../../models/GameFight";
import { VideoTask } from "../../../../models/VideoTask";

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

function reqJson(
  path: string,
  method: string,
  body: unknown,
  opts: { cookie?: string | null; adminPath?: boolean } = {},
): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.adminPath) headers["x-admin-path"] = ADMIN_SLUG;
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
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
    record: { wins: 0, losses: 0, draws: 0, kos: 0 },
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
    status?: "pending" | "playing" | "completed";
    isTitleFight?: boolean;
    winnerId?: mongoose.Types.ObjectId;
  },
) {
  return GameFight.create({
    fighterAId: a,
    fighterBId: b,
    seed: 123456,
    map: "ring",
    durationSec: 60,
    status: opts.status ?? "completed",
    config: {
      left: { name: "Pitung", style: "boxing", color: "#E10600" },
      right: { name: "Jamal geng sebelah", style: "wushu", color: "#1D4ED8" },
    },
    result:
      opts.status === "pending"
        ? {
            winnerSide: null,
            method: null,
            score: { a: null, b: null },
            koTimeSec: null,
          }
        : {
            winnerSide: "R",
            winnerFighterId: opts.winnerId ?? a,
            method: "KO",
            score: { a: opts.scoreA ?? 15, b: opts.scoreB ?? 0 },
            koTimeSec: 58.64,
          },
    posterDataUrl: opts.poster ? POSTER_URL : null,
    isTitleFight: opts.isTitleFight ?? false,
    completedAt:
      opts.status === "pending" ? null : (opts.completedAt ?? opts.createdAt),
    createdAt: opts.createdAt,
  });
}

let fightToday1Id = "";
let fightToday2Id = "";
let fightPendingId = "";
let fightTitleId = "";
let titleTaskId = "";

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
    // Tambahan: 1 fight pending + 1 title fight (dengan VideoTask queued)
    // pada 8 Nov WIB — daftar harus memuat SEMUA status, bukan cuma selesai.
    const fight1 = await makeFight(fA._id as mongoose.Types.ObjectId, fB._id as mongoose.Types.ObjectId, {
      createdAt: new Date("2026-11-07T17:30:00.000Z"),
      poster: true,
      scoreA: 15,
      scoreB: 0,
      winnerId: fA._id as mongoose.Types.ObjectId,
    });
    const fight2 = await makeFight(fA._id as mongoose.Types.ObjectId, fB._id as mongoose.Types.ObjectId, {
      createdAt: new Date("2026-11-08T03:00:00.000Z"),
      poster: true,
      scoreA: 8,
      scoreB: 12,
      winnerId: fB._id as mongoose.Types.ObjectId,
    });
    await makeFight(fA._id as mongoose.Types.ObjectId, fB._id as mongoose.Types.ObjectId, {
      createdAt: new Date("2026-11-07T16:30:00.000Z"),
      poster: true,
      scoreA: 27,
      scoreB: 3,
      winnerId: fA._id as mongoose.Types.ObjectId,
    });
    const fightPending = await makeFight(
      fA._id as mongoose.Types.ObjectId,
      fB._id as mongoose.Types.ObjectId,
      {
        createdAt: new Date("2026-11-08T03:30:00.000Z"),
        status: "pending",
      },
    );
    const fightTitle = await makeFight(
      fA._id as mongoose.Types.ObjectId,
      fB._id as mongoose.Types.ObjectId,
      {
        createdAt: new Date("2026-11-08T04:00:00.000Z"),
        scoreA: 20,
        scoreB: 10,
        winnerId: fA._id as mongoose.Types.ObjectId,
        isTitleFight: true,
      },
    );
    const titleTask = await VideoTask.create({
      kind: "title",
      gameFightId: fightTitle._id,
      status: "queued",
      note: "Title fight test",
    });
    fightToday1Id = String(fight1._id);
    fightToday2Id = String(fight2._id);
    fightPendingId = String(fightPending._id);
    fightTitleId = String(fightTitle._id);
    titleTaskId = String(titleTask._id);
  });

  it("GET /api/admin/fights?date=2026-11-08: hitung 4, semua status (completed + pending + title)", async () => {
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
    expect(body.data.total).toBe(4);
    const files = body.data.fights.map((f) => f.posterFile).sort();
    expect(files).toEqual([
      "2026-11-08_pitung-vs-jamal-geng-sebelah_15-0.jpg",
      "2026-11-08_pitung-vs-jamal-geng-sebelah_20-10.jpg",
      "2026-11-08_pitung-vs-jamal-geng-sebelah_8-12.jpg",
      "2026-11-08_pitung-vs-jamal-geng-sebelah_tanpa-skor.jpg",
    ]);
  });

  it("baris daftar membawa winnerName + videoTask (null / queued)", async () => {
    if (skipIfNoDb()) return;
    const res = await listFights(
      req("/api/admin/fights?date=2026-11-08", { cookie: adminCookie, adminPath: true }),
    );
    const body = await json<{
      ok: boolean;
      data: {
        fights: {
          fightId: string;
          winnerName: string | null;
          status: string;
          isTitleFight: boolean;
          score: { a: number | null; b: number | null };
          videoTask: { id: string; status: string; reelUrl: string | null } | null;
        }[];
      };
    }>(res);
    const byId = new Map(body.data.fights.map((f) => [f.fightId, f]));
    // 15-0: pemenang Pitung, belum ada VideoTask.
    expect(byId.get(fightToday1Id)?.winnerName).toBe("Pitung");
    expect(byId.get(fightToday1Id)?.videoTask).toBeNull();
    // 8-12: pemenang Jamal geng sebelah (skor lebih tinggi).
    expect(byId.get(fightToday2Id)?.winnerName).toBe("Jamal geng sebelah");
    // Pending: tanpa pemenang & tanpa skor, tapi tetap masuk daftar.
    expect(byId.get(fightPendingId)?.status).toBe("pending");
    expect(byId.get(fightPendingId)?.winnerName).toBeNull();
    expect(byId.get(fightPendingId)?.score).toEqual({ a: null, b: null });
    // Title fight: badge gelar + VideoTask queued ikut terbawa.
    expect(byId.get(fightTitleId)?.isTitleFight).toBe(true);
    expect(byId.get(fightTitleId)?.videoTask?.id).toBe(titleTaskId);
    expect(byId.get(fightTitleId)?.videoTask?.status).toBe("queued");
    expect(byId.get(fightTitleId)?.videoTask?.reelUrl).toBeNull();
    // Urutan: terbaru dulu (title 04:00 UTC paling atas).
    expect(body.data.fights[0].fightId).toBe(fightTitleId);
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

  it("POST /api/admin/video-tasks: fight tanpa task -> dibuat sebagai uploaded (201)", async () => {
    if (skipIfNoDb()) return;
    const res = await createVideoTask(
      reqJson(
        "/api/admin/video-tasks",
        "POST",
        { gameFightId: fightToday1Id, reelUrl: "https://www.instagram.com/reel/Df123456/" },
        { cookie: adminCookie, adminPath: true },
      ),
    );
    expect(res.status).toBe(201);
    const body = await json<{
      ok: boolean;
      data: { videoTask: { id: string; status: string; reelUrl: string; gameFightId: string; kind: string } };
    }>(res);
    expect(body.ok).toBe(true);
    expect(body.data.videoTask.status).toBe("uploaded");
    expect(body.data.videoTask.reelUrl).toBe("https://www.instagram.com/reel/Df123456/");
    expect(body.data.videoTask.gameFightId).toBe(fightToday1Id);
    expect(body.data.videoTask.kind).toBe("match");
    // Daftar fight ikut menunjukkan task terunggah.
    const list = await listFights(
      req("/api/admin/fights?date=2026-11-08", { cookie: adminCookie, adminPath: true }),
    );
    const listBody = await json<{
      data: { fights: { fightId: string; videoTask: { status: string; reelUrl: string } | null }[] };
    }>(list);
    const row = listBody.data.fights.find((f) => f.fightId === fightToday1Id);
    expect(row?.videoTask?.status).toBe("uploaded");
    expect(row?.videoTask?.reelUrl).toBe("https://www.instagram.com/reel/Df123456/");
  });

  it("POST /api/admin/video-tasks: idempotent — task yang sama diperbarui, bukan duplikat (200)", async () => {
    if (skipIfNoDb()) return;
    const before = await VideoTask.countDocuments({ gameFightId: fightToday1Id });
    expect(before).toBe(1);
    const res = await createVideoTask(
      reqJson(
        "/api/admin/video-tasks",
        "POST",
        { gameFightId: fightToday1Id, reelUrl: "https://instagram.com/p/AbC999/" },
        { cookie: adminCookie, adminPath: true },
      ),
    );
    expect(res.status).toBe(200);
    const body = await json<{
      data: { videoTask: { id: string; reelUrl: string } };
    }>(res);
    expect(body.data.videoTask.reelUrl).toBe("https://instagram.com/p/AbC999/");
    expect(await VideoTask.countDocuments({ gameFightId: fightToday1Id })).toBe(1);
  });

  it("PATCH /api/admin/video-tasks/[id]: task title yang queued -> uploaded", async () => {
    if (skipIfNoDb()) return;
    const res = await patchVideoTask(
      reqJson(
        `/api/admin/video-tasks/${titleTaskId}`,
        "PATCH",
        { status: "uploaded", reelUrl: "https://www.instagram.com/reel/DfTitle01/" },
        { cookie: adminCookie, adminPath: true },
      ),
      { params: Promise.resolve({ id: titleTaskId }) },
    );
    expect(res.status).toBe(200);
    const body = await json<{
      data: { videoTask: { status: string; reelUrl: string } };
    }>(res);
    expect(body.data.videoTask.status).toBe("uploaded");
    expect(body.data.videoTask.reelUrl).toBe("https://www.instagram.com/reel/DfTitle01/");
  });

  it("POST /api/admin/video-tasks: reelUrl tidak valid -> 400; gameFightId tidak ada -> 404", async () => {
    if (skipIfNoDb()) return;
    const badUrl = await createVideoTask(
      reqJson(
        "/api/admin/video-tasks",
        "POST",
        { gameFightId: fightToday2Id, reelUrl: "https://www.youtube.com/watch?v=x" },
        { cookie: adminCookie, adminPath: true },
      ),
    );
    expect(badUrl.status).toBe(400);
    const noFight = await createVideoTask(
      reqJson(
        "/api/admin/video-tasks",
        "POST",
        { gameFightId: new mongoose.Types.ObjectId().toString(), reelUrl: "https://www.instagram.com/reel/Df123456/" },
        { cookie: adminCookie, adminPath: true },
      ),
    );
    expect(noFight.status).toBe(404);
  });

  it("POST /api/admin/video-tasks: tanpa x-admin-path -> 404; tanpa login -> 401", async () => {
    if (skipIfNoDb()) return;
    const noPath = await createVideoTask(
      reqJson(
        "/api/admin/video-tasks",
        "POST",
        { gameFightId: fightToday2Id, reelUrl: "https://www.instagram.com/reel/Df123456/" },
        { cookie: adminCookie },
      ),
    );
    expect(noPath.status).toBe(404);
    const noLogin = await createVideoTask(
      reqJson(
        "/api/admin/video-tasks",
        "POST",
        { gameFightId: fightToday2Id, reelUrl: "https://www.instagram.com/reel/Df123456/" },
        { adminPath: true },
      ),
    );
    expect(noLogin.status).toBe(401);
  });
});
