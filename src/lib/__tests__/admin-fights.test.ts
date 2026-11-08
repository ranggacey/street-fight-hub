import { describe, expect, it } from "vitest";
import {
  posterFileName,
  slugifyName,
  todayWibDateStr,
  wibDateWindow,
} from "../admin/fights";

/**
 * Helper admin "Pertandingan": jendela hari WIB, slug nama, nama file poster.
 * Murni — tanpa MongoDB.
 */
describe("admin fights helpers", () => {
  it("wibDateWindow: 2026-11-08 = 00:00–24:00 WIB (17:00 UTC sebelumnya – 17:00 UTC)", () => {
    const w = wibDateWindow("2026-11-08");
    expect(w).not.toBeNull();
    expect(w!.start.toISOString()).toBe("2026-11-07T17:00:00.000Z");
    expect(w!.end.toISOString()).toBe("2026-11-08T17:00:00.000Z");
  });

  it("wibDateWindow: format salah -> null", () => {
    expect(wibDateWindow("8 Nov 2026")).toBeNull();
    expect(wibDateWindow("2026-13-40")).toBeNull();
    expect(wibDateWindow("")).toBeNull();
  });

  it("wibDateWindow: fight 2026-11-08 00:30 WIB masuk hari 8 Nov, bukan 7 Nov", () => {
    // 00:30 WIB 8 Nov = 17:30 UTC 7 Nov — masih >= start 8 Nov (17:00 UTC 7 Nov).
    const w8 = wibDateWindow("2026-11-08")!;
    const w7 = wibDateWindow("2026-11-07")!;
    const t = new Date("2026-11-07T17:30:00.000Z");
    expect(t >= w8.start && t < w8.end).toBe(true);
    expect(t >= w7.start && t < w7.end).toBe(false);
  });

  it("todayWibDateStr: 2026-11-08 01:00 UTC = 8 Nov WIB, 2026-11-08 16:00 UTC = 8 Nov WIB", () => {
    expect(todayWibDateStr(new Date("2026-11-08T01:00:00Z"))).toBe("2026-11-08");
    expect(todayWibDateStr(new Date("2026-11-08T16:00:00Z"))).toBe("2026-11-08");
    expect(todayWibDateStr(new Date("2026-11-08T17:00:00Z"))).toBe("2026-11-09");
  });

  it("slugifyName: kecil, spasi jadi -, buang karakter lain", () => {
    expect(slugifyName("Pitung")).toBe("pitung");
    expect(slugifyName("Jamal geng sebelah")).toBe("jamal-geng-sebelah");
    expect(slugifyName("Dayrot Jagoan!")).toBe("dayrot-jagoan");
    expect(slugifyName("  STRIVOX  ")).toBe("strivox");
  });

  it("posterFileName: format 2026-11-08_pitung-vs-jamal-geng-sebelah_15-0.jpg", () => {
    expect(posterFileName("2026-11-08", "Pitung", "Jamal geng sebelah", 15, 0)).toBe(
      "2026-11-08_pitung-vs-jamal-geng-sebelah_15-0.jpg",
    );
    expect(posterFileName("2026-11-08", "Dayrot jagoan", "STRIVOX", 8, 12)).toBe(
      "2026-11-08_dayrot-jagoan-vs-strivox_8-12.jpg",
    );
  });

  it("posterFileName: tanpa skor -> tanpa-skor", () => {
    expect(posterFileName("2026-11-08", "Pitung", "Jamal", null, null)).toBe(
      "2026-11-08_pitung-vs-jamal_tanpa-skor.jpg",
    );
  });
});
