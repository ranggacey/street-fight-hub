/**
 * Migrasi penyatuan rekor (2026-11-08): casualRecord + record -> record.
 *
 * SATU rekor (menang/kalah/seri + KO) untuk semua fight — kasual,
 * turnamen, gelar. Dulu ada dua field: `record` (hanya match turnamen,
 * ditulis lib/draw.ts) dan `casualRecord` (hanya GameFight, ditulis
 * result/route.ts). Sekarang keduanya dijumlah per komponen:
 *   record baru = record lama + casualRecord lama
 * dan field casualRecord dihapus (unset).
 *
 * Bukti, bukan asumsi: hitung ulang dari seluruh GameFight completed
 * (recountRecordForFighter) harus sama dengan casualRecord tersimpan —
 * kalau tidak sama, migrasi MELAPORKAN selisihnya (bukan menutupinya).
 * Match turnamen yang sudah decided dihitung terpisah (via record lama,
 * karena hanya draw.ts yang menulis record lama).
 */

export interface RecordLike {
  wins: number;
  losses: number;
  draws: number;
  kos: number;
}

export const EMPTY_RECORD: RecordLike = { wins: 0, losses: 0, draws: 0, kos: 0 };

export function normalizeRecord(r: Partial<RecordLike> | null | undefined): RecordLike {
  return {
    wins: r?.wins ?? 0,
    losses: r?.losses ?? 0,
    draws: r?.draws ?? 0,
    kos: r?.kos ?? 0,
  };
}

/** Jumlah dua rekor per komponen. */
export function addRecords(a: RecordLike, b: RecordLike): RecordLike {
  return {
    wins: a.wins + b.wins,
    losses: a.losses + b.losses,
    draws: a.draws + b.draws,
    kos: a.kos + b.kos,
  };
}

export function recordsEqual(a: RecordLike, b: RecordLike): boolean {
  return (
    a.wins === b.wins && a.losses === b.losses && a.draws === b.draws && a.kos === b.kos
  );
}

export interface CompletedFightForRecount {
  fighterAId: string;
  fighterBId: string;
  result: {
    winnerFighterId: string | null;
    method: 'KO' | 'decision' | 'draw' | null;
  } | null;
}

/**
 * Hitung ulang rekor satu fighter dari seluruh GameFight completed.
 * Menang/kalah/seri + KO — sumber kebenaran untuk memverifikasi
 * casualRecord tersimpan sebelum digabung.
 */
export function recountRecordForFighter(
  fights: CompletedFightForRecount[],
  fighterId: string,
): RecordLike {
  const rec: RecordLike = { wins: 0, losses: 0, draws: 0, kos: 0 };
  for (const f of fights) {
    if (!f.result) continue;
    const isA = f.fighterAId === fighterId;
    const isB = f.fighterBId === fighterId;
    if (!isA && !isB) continue;
    if (f.result.method === 'draw') {
      rec.draws += 1;
      continue;
    }
    const won = f.result.winnerFighterId === fighterId;
    if (won) {
      rec.wins += 1;
      if (f.result.method === 'KO') rec.kos += 1;
    } else {
      rec.losses += 1;
    }
  }
  return rec;
}

/** Hasil rencana migrasi per fighter (dipakai GET dry-run + POST apply). */
export interface RecordMigrationPlan {
  fighterId: string;
  displayName: string;
  storedRecord: RecordLike;
  storedCasual: RecordLike;
  recountFromGameFights: RecordLike;
  /** casualRecord tersimpan == hitung ulang dari GameFight? */
  casualMatchesRecount: boolean;
  mergedRecord: RecordLike;
  /** Sudah dimigrasi (tidak ada lagi casualRecord tersimpan)? */
  alreadyMigrated: boolean;
}

export function planRecordMigration(
  fighters: {
    _id: string;
    displayName: string;
    record?: Partial<RecordLike> | null;
    casualRecord?: Partial<RecordLike> | null;
    hasCasualRecord: boolean;
  }[],
  completedFights: CompletedFightForRecount[],
): RecordMigrationPlan[] {
  return fighters.map((f) => {
    const storedRecord = normalizeRecord(f.record);
    const storedCasual = normalizeRecord(f.casualRecord);
    const recount = recountRecordForFighter(completedFights, f._id);
    return {
      fighterId: f._id,
      displayName: f.displayName,
      storedRecord,
      storedCasual,
      recountFromGameFights: recount,
      casualMatchesRecount: recordsEqual(storedCasual, recount),
      mergedRecord: addRecords(storedRecord, storedCasual),
      alreadyMigrated: !f.hasCasualRecord,
    };
  });
}
