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

  /**
   * Gate migrasi LIVE 2026-11-09 (data dari GET /api/leaderboard +
   * /api/fighters pagi itu): 8 fighter, 6 GameFight completed, 0 match
   * turnamen decided. Gabungan HARUS sama persis dengan tabel harapan
   * (record lama + casualRecord lama), DAN gabungan HARUS sama dengan
   * hitung ulang dari semua GameFight (bukti tidak ada fight yang
   * hilang / terhitung ganda).
   *
   * Catatan: casualMatchesRecount == false untuk Dayrot, Pitung, dan
   * pemuda licik itu WAJAR (bukan alasan menahan migrasi) — mereka sudah
   * main SETELAH update penyatuan rekor, jadi fight barunya sudah
   * tercatat di `record`, bukan di `casualRecord`. Hitung ulang (semua
   * fight) memang lebih besar dari kasual tersimpan untuk mereka.
   */
  it("plan LIVE 2026-11-09: merged == tabel harapan dan == hitung ulang", () => {
    const dayrot = "6aeed045411a1fbd5582e5b7";
    const pitung = "6af03c462554da0ac2c5c667";
    const jamal = "6aef67b59135c58ce1258d4d";
    const strivox = "6aefc93ef622565688a5a641";
    const licik = "6af0c542694c6a8bb48a14ca";
    const sijagoan = "6aeefa7fe9c854457ca67890";
    const nope = "6aeefcaff02653174c59d114";
    const zahran = "6aefdde571c6501d524561e0";

    const liveFights: CompletedFightForRecount[] = [
      // Dayrot menang decision atas STRIVOX
      { fighterAId: dayrot, fighterBId: strivox, result: { winnerFighterId: dayrot, method: "decision" } },
      // STRIVOX menang decision atas Dayrot
      { fighterAId: dayrot, fighterBId: strivox, result: { winnerFighterId: strivox, method: "decision" } },
      // Dayrot menang KO atas Jamal
      { fighterAId: dayrot, fighterBId: jamal, result: { winnerFighterId: dayrot, method: "KO" } },
      // Pitung menang KO atas Jamal (8 Nov 16:27)
      { fighterAId: pitung, fighterBId: jamal, result: { winnerFighterId: pitung, method: "KO" } },
      // Pagi 9 Nov: Dayrot menang decision atas Pitung
      { fighterAId: dayrot, fighterBId: pitung, result: { winnerFighterId: dayrot, method: "decision" } },
      // Pagi 9 Nov: Dayrot menang KO atas pemuda licik
      { fighterAId: dayrot, fighterBId: licik, result: { winnerFighterId: dayrot, method: "KO" } },
    ];

    const plan = planRecordMigration(
      [
        { _id: dayrot, displayName: "Dayrot jagoan", record: { wins: 2, losses: 0, draws: 0, kos: 1 }, casualRecord: { wins: 2, losses: 1, draws: 0, kos: 1 }, hasCasualRecord: true },
        { _id: pitung, displayName: "Pitung", record: { wins: 0, losses: 1, draws: 0, kos: 0 }, casualRecord: { wins: 1, losses: 0, draws: 0, kos: 1 }, hasCasualRecord: true },
        { _id: jamal, displayName: "Jamal geng sebelah", record: { wins: 0, losses: 0, draws: 0, kos: 0 }, casualRecord: { wins: 0, losses: 2, draws: 0, kos: 0 }, hasCasualRecord: true },
        { _id: strivox, displayName: "STRIVOX", record: { wins: 0, losses: 0, draws: 0, kos: 0 }, casualRecord: { wins: 1, losses: 1, draws: 0, kos: 0 }, hasCasualRecord: true },
        { _id: licik, displayName: "pemuda licik", record: { wins: 0, losses: 1, draws: 0, kos: 0 }, casualRecord: null, hasCasualRecord: false },
        { _id: sijagoan, displayName: "Sijagoan Batak", record: { wins: 0, losses: 0, draws: 0, kos: 0 }, casualRecord: { wins: 0, losses: 0, draws: 0, kos: 0 }, hasCasualRecord: true },
        { _id: nope, displayName: "Nope boy", record: { wins: 0, losses: 0, draws: 0, kos: 0 }, casualRecord: { wins: 0, losses: 0, draws: 0, kos: 0 }, hasCasualRecord: true },
        { _id: zahran, displayName: "zahran petarung", record: { wins: 0, losses: 0, draws: 0, kos: 0 }, casualRecord: { wins: 0, losses: 0, draws: 0, kos: 0 }, hasCasualRecord: true },
      ],
      liveFights,
    );

    const byId = new Map(plan.map((p) => [p.fighterId, p]));
    const expected: Record<string, { wins: number; losses: number; draws: number; kos: number }> = {
      [dayrot]: { wins: 4, losses: 1, draws: 0, kos: 2 },
      [pitung]: { wins: 1, losses: 1, draws: 0, kos: 1 },
      [jamal]: { wins: 0, losses: 2, draws: 0, kos: 0 },
      [strivox]: { wins: 1, losses: 1, draws: 0, kos: 0 },
      [licik]: { wins: 0, losses: 1, draws: 0, kos: 0 },
      [sijagoan]: { wins: 0, losses: 0, draws: 0, kos: 0 },
      [nope]: { wins: 0, losses: 0, draws: 0, kos: 0 },
      [zahran]: { wins: 0, losses: 0, draws: 0, kos: 0 },
    };

    for (const [id, want] of Object.entries(expected)) {
      const p = byId.get(id);
      expect(p).toBeDefined();
      expect(p!.mergedRecord).toEqual(want);
      // Integritas: gabungan (record + kasual tersimpan) harus sama
      // dengan hitung ulang dari semua GameFight — tidak ada fight
      // yang hilang atau terhitung ganda.
      expect(p!.mergedRecord).toEqual(p!.recountFromGameFights);
    }

    // Kasual cocok dengan hitung ulang hanya untuk fighter yang TIDAK
    // main setelah update (Jamal, STRIVOX, dan yang 0-0-0).
    expect(byId.get(dayrot)!.casualMatchesRecount).toBe(false);
    expect(byId.get(pitung)!.casualMatchesRecount).toBe(false);
    expect(byId.get(licik)!.casualMatchesRecount).toBe(false);
    expect(byId.get(jamal)!.casualMatchesRecount).toBe(true);
    expect(byId.get(strivox)!.casualMatchesRecount).toBe(true);
    expect(byId.get(zahran)!.casualMatchesRecount).toBe(true);
  });
});
