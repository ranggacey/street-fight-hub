import { describe, expect, it } from "vitest";
import {
  addRecords,
  normalizeRecord,
  planRecordMigration,
  recountRecordForFighter,
  recordsEqual,
  type CompletedFightForRecount,
} from "../admin/record-migration";

/**
 * Penyatuan rekor: kasual + turnamen -> SATU record.
 * Hitung ulang dari GameFight completed adalah sumber kebenaran.
 */
describe("record migration helpers", () => {
  const a = "507f1f77bcf86cd799439011";
  const b = "507f1f77bcf86cd799439012";
  const c = "507f1f77bcf86cd799439013";

  const fights: CompletedFightForRecount[] = [
    // A menang KO atas B
    { fighterAId: a, fighterBId: b, result: { winnerFighterId: a, method: "KO" } },
    // B menang decision atas A
    { fighterAId: a, fighterBId: b, result: { winnerFighterId: b, method: "decision" } },
    // A vs C seri
    { fighterAId: a, fighterBId: c, result: { winnerFighterId: null, method: "draw" } },
    // B menang KO atas C
    { fighterAId: b, fighterBId: c, result: { winnerFighterId: b, method: "KO" } },
    // Fight tanpa result (belum selesai) -> diabaikan
    { fighterAId: a, fighterBId: b, result: null },
  ];

  it("recount: A 1W-1L-1D 1KO, B 2W-1L 1KO, C 0W-1L-1D", () => {
    expect(recountRecordForFighter(fights, a)).toEqual({
      wins: 1,
      losses: 1,
      draws: 1,
      kos: 1,
    });
    expect(recountRecordForFighter(fights, b)).toEqual({
      wins: 2,
      losses: 1,
      draws: 0,
      kos: 1,
    });
    expect(recountRecordForFighter(fights, c)).toEqual({
      wins: 0,
      losses: 1,
      draws: 1,
      kos: 0,
    });
  });

  it("recount: fighter tanpa fight -> 0-0-0", () => {
    expect(recountRecordForFighter(fights, "507f1f77bcf86cd799439099")).toEqual({
      wins: 0,
      losses: 0,
      draws: 0,
      kos: 0,
    });
  });

  it("addRecords: kasual + turnamen dijumlah per komponen", () => {
    expect(
      addRecords(
        { wins: 2, losses: 1, draws: 0, kos: 1 },
        { wins: 1, losses: 2, draws: 1, kos: 0 },
      ),
    ).toEqual({ wins: 3, losses: 3, draws: 1, kos: 1 });
    expect(addRecords({ wins: 0, losses: 0, draws: 0, kos: 0 }, { wins: 1, losses: 0, draws: 0, kos: 0 })).toEqual({
      wins: 1,
      losses: 0,
      draws: 0,
      kos: 0,
    });
  });

  it("normalizeRecord + recordsEqual", () => {
    expect(normalizeRecord(null)).toEqual({ wins: 0, losses: 0, draws: 0, kos: 0 });
    expect(normalizeRecord({ wins: 2 })).toEqual({ wins: 2, losses: 0, draws: 0, kos: 0 });
    expect(recordsEqual({ wins: 1, losses: 0, draws: 0, kos: 0 }, { wins: 1, losses: 0, draws: 0, kos: 0 })).toBe(true);
    expect(recordsEqual({ wins: 1, losses: 0, draws: 0, kos: 0 }, { wins: 2, losses: 0, draws: 0, kos: 0 })).toBe(false);
  });

  it("plan: kasual cocok dengan hitung ulang -> merged = turnamen + kasual", () => {
    const plan = planRecordMigration(
      [
        {
          _id: a,
          displayName: "A",
          record: { wins: 1, losses: 0, draws: 0, kos: 0 }, // 1 menang turnamen
          casualRecord: { wins: 1, losses: 1, draws: 1, kos: 1 }, // == recount
          hasCasualRecord: true,
        },
        {
          _id: b,
          displayName: "B",
          record: { wins: 0, losses: 0, draws: 0, kos: 0 },
          casualRecord: { wins: 2, losses: 1, draws: 0, kos: 1 },
          hasCasualRecord: true,
        },
      ],
      fights,
    );
    expect(plan[0].casualMatchesRecount).toBe(true);
    expect(plan[0].mergedRecord).toEqual({ wins: 2, losses: 1, draws: 1, kos: 1 });
    expect(plan[0].alreadyMigrated).toBe(false);
    expect(plan[1].casualMatchesRecount).toBe(true);
    expect(plan[1].mergedRecord).toEqual({ wins: 2, losses: 1, draws: 0, kos: 1 });
  });

  it("plan: kasual TIDAK cocok dengan hitung ulang -> dilaporkan (bukan ditutup)", () => {
    const plan = planRecordMigration(
      [
        {
          _id: a,
          displayName: "A",
          record: { wins: 0, losses: 0, draws: 0, kos: 0 },
          // Tersimpan 5 menang, padahal hitung ulang cuma 1 menang.
          casualRecord: { wins: 5, losses: 0, draws: 0, kos: 0 },
          hasCasualRecord: true,
        },
      ],
      fights,
    );
    expect(plan[0].casualMatchesRecount).toBe(false);
    expect(plan[0].recountFromGameFights.wins).toBe(1);
    expect(plan[0].storedCasual.wins).toBe(5);
    // merged tetap memakai angka tersimpan (bukan diam-diam diganti recount).
    expect(plan[0].mergedRecord.wins).toBe(5);
  });

  it("plan: sudah dimigrasi (tanpa casualRecord) -> alreadyMigrated", () => {
    const plan = planRecordMigration(
      [
        {
          _id: a,
          displayName: "A",
          record: { wins: 1, losses: 1, draws: 1, kos: 1 },
          casualRecord: null,
          hasCasualRecord: false,
        },
      ],
      fights,
    );
    expect(plan[0].alreadyMigrated).toBe(true);
    expect(plan[0].mergedRecord).toEqual({ wins: 1, losses: 1, draws: 1, kos: 1 });
  });
});
