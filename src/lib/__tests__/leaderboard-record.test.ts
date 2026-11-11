import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getCasualLeaderboard, __resetLeaderboardCache } from "../game/leaderboard";
import { connectDB } from "../db";
import { User } from "../../models/User";
import { Fighter } from "../../models/Fighter";

/**
 * Klasemen menampilkan SATU rekor (record) — bukan lagi casualRecord
 * terpisah. Diurutkan rating desc, lalu record.wins desc.
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
    // getCasualLeaderboard dipanggil langsung (bukan lewat route API),
    // jadi koneksi DB harus dibuka eksplisit di sini.
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

describe("Klasemen: satu rekor (record) untuk semua fight", () => {
  it("entry memakai record (bukan casualRecord) + urutan rating desc", async () => {
    if (skipIfNoDb()) return;
    const u1 = await User.create({ username: "u_lb_a", passwordHash: "x" });
    const u2 = await User.create({ username: "u_lb_b", passwordHash: "x" });
    // A: rating lebih tinggi, rekor gabungan (kasual + turnamen) 2W-1L.
    await Fighter.create({
      userId: u1._id,
      displayName: "A Klasemen",
      igUsername: "a_klasemen",
      style: "boxing",
      selfDescription: SELF_DESC,
      rating: 1016,
      record: { wins: 2, losses: 1, draws: 0, kos: 1 },
    });
    // B: rating lebih rendah, rekor 1W-1L.
    await Fighter.create({
      userId: u2._id,
      displayName: "B Klasemen",
      igUsername: "b_klasemen",
      style: "wushu",
      selfDescription: SELF_DESC,
      rating: 984,
      record: { wins: 1, losses: 1, draws: 0, kos: 0 },
    });

    __resetLeaderboardCache();
    const entries = await getCasualLeaderboard();
    expect(entries).toHaveLength(2);
    // Urutan: rating desc (A dulu).
    expect(entries[0].displayName).toBe("A Klasemen");
    expect(entries[0].rating).toBe(1016);
    // SATU rekor — field-nya 'record', isinya rekor gabungan.
    expect(entries[0].record).toEqual({ wins: 2, losses: 1, draws: 0, kos: 1 });
    expect(entries[1].record).toEqual({ wins: 1, losses: 1, draws: 0, kos: 0 });
    // Tidak ada lagi field casualRecord di entry.
    expect((entries[0] as unknown as Record<string, unknown>).casualRecord).toBeUndefined();
    expect((entries[1] as unknown as Record<string, unknown>).casualRecord).toBeUndefined();
  });

  it("tie-break rating sama: wins desc, lalu kos desc, lalu losses asc", async () => {
    if (skipIfNoDb()) return;
    // Ketiga fighter rating sama (1000) — urutan ditentukan tie-break,
    // BUKAN createdAt. Mereka masuk di bawah A (1016) dari test sebelumnya
    // dan di atas B (984); jadi dicek urutan relatif antar ketiganya.
    const mk = async (suffix: string, record: { wins: number; losses: number; draws: number; kos: number }) => {
      const u = await User.create({ username: `u_lb_tb_${suffix}`, passwordHash: "x" });
      await Fighter.create({
        userId: u._id,
        displayName: `TB ${suffix}`,
        igUsername: `tb_${suffix}`,
        style: "street",
        selfDescription: SELF_DESC,
        rating: 1000,
        record,
      });
    };
    // C: 5W-0L, 2 KO — paling atas di grup rating 1000.
    await mk("c", { wins: 5, losses: 0, draws: 0, kos: 2 });
    // D: 5W-1L, 2 KO — kalah dari C karena losses lebih banyak.
    await mk("d", { wins: 5, losses: 1, draws: 0, kos: 2 });
    // E: 5W-0L, 1 KO — kalah dari C/D karena KO lebih sedikit.
    await mk("e", { wins: 5, losses: 0, draws: 0, kos: 1 });
    // F: 4W-0L, 9 KO — kalah dari ketiganya karena wins lebih sedikit
    // (KO banyak tidak menolong kalau wins kalah).
    await mk("f", { wins: 4, losses: 0, draws: 0, kos: 9 });

    __resetLeaderboardCache();
    const entries = await getCasualLeaderboard();
    const names = entries.map((e) => e.displayName);
    const idx = (name: string) => names.indexOf(name);
    expect(idx("TB c")).toBeGreaterThan(-1);
    expect(idx("TB c")).toBeLessThan(idx("TB d"));
    expect(idx("TB d")).toBeLessThan(idx("TB e"));
    expect(idx("TB e")).toBeLessThan(idx("TB f"));
  });
});
