import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TopFighters, { toTopFighter } from "../TopFighters";
import type { LeaderboardEntry } from "../types";

/**
 * Top 5 home: data awal server dipetakan ke FighterCard, lalu komponen
 * menyegarkan sendiri dari /api/leaderboard (efek client — tidak bisa
 * diuji lewat render statis; yang diuji di sini: pemetaan + render awal).
 */

const entries: LeaderboardEntry[] = [
  {
    rank: 1,
    fighterId: "f-dayrot",
    displayName: "Dayrot jagoan",
    igUsername: "danukolor12",
    style: "kali-arnis",
    rating: 1046,
    record: { wins: 2, losses: 0, draws: 0, kos: 1 },
  },
  {
    rank: 2,
    fighterId: "f-pitung",
    displayName: "Pitung",
    igUsername: "Sadiasyar",
    style: "street",
    rating: 1000,
    record: { wins: 0, losses: 1, draws: 0, kos: 0 },
  },
];

describe("toTopFighter", () => {
  it("memetakan entry leaderboard ke Fighter lengkap", () => {
    const f = toTopFighter(entries[0]);
    expect(f._id).toBe("f-dayrot");
    expect(f.displayName).toBe("Dayrot jagoan");
    expect(f.rating).toBe(1046);
    expect(f.record).toEqual({ wins: 2, losses: 0, draws: 0, kos: 1 });
    expect(f.status).toBe("active");
  });

  it("default aman kalau record/rating/style kosong", () => {
    const f = toTopFighter({ fighterId: "f-x", displayName: "Baru" });
    expect(f.record).toEqual({ wins: 0, losses: 0, draws: 0, kos: 0 });
    expect(f.rating).toBe(1000);
    expect(f.style).toBe("tinju");
  });
});

describe("TopFighters (render awal server)", () => {
  it("menampilkan nama + rating + rekor dari data awal", () => {
    const html = renderToStaticMarkup(<TopFighters initial={entries} />);
    expect(html).toContain("Dayrot jagoan");
    expect(html).toContain("1046");
    expect(html).toContain("Pitung");
    expect(html).toContain("1000");
    // FighterCard menampilkan baris M/K/S/KO dari record
    expect(html).toContain("Menang");
    expect(html).toContain("Kalah");
  });

  it("urutan tetap sesuai urutan entries (rating desc dari server)", () => {
    const html = renderToStaticMarkup(<TopFighters initial={entries} />);
    expect(html.indexOf("Dayrot jagoan")).toBeLessThan(
      html.indexOf("Pitung"),
    );
  });
});
