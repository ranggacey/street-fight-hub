import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { handleError, ok } from '@/lib/http';
import { Fighter } from '@/models/Fighter';
import { GameFight } from '@/models/GameFight';
import { Match } from '@/models/Match';
import {
  planRecordMigration,
  type CompletedFightForRecount,
} from '@/lib/admin/record-migration';

/**
 * Migrasi satu kali: satukan rekor (2026-11-08).
 *
 * GET  /api/admin/migrate-record — dry-run: rencana per fighter, TANPA
 *      menulis. Menampilkan rekor turnamen tersimpan, rekor kasual
 *      tersimpan, hitung ulang dari GameFight completed, rekor gabungan,
 *      dan apakah kasual tersimpan == hitung ulang.
 * POST /api/admin/migrate-record — terapkan: record = record lama +
 *      casualRecord lama, lalu casualRecord di-unset. Idempotent:
 *      fighter yang sudah tidak punya casualRecord dilewati.
 *
 * Auth: sesi admin + header x-admin-path (requireAdminApi). BUKAN token
 * hardcoded di kode (pola itu memicu alert GitGuardian — dilarang).
 * Setelah migrasi terverifikasi live, route ini di-stub 404 seperti
 * route one-time sebelumnya (backfill-rating, delete-glaciero).
 */
async function buildPlan() {
  const fighters = await Fighter.find({})
    .select('displayName record casualRecord')
    .lean();
  const fights = await GameFight.find({ status: 'completed' })
    .select('fighterAId fighterBId result')
    .lean();
  const decidedMatches = await Match.countDocuments({ status: 'decided' });

  const completed: CompletedFightForRecount[] = fights.map((f) => ({
    fighterAId: f.fighterAId?.toString() ?? '',
    fighterBId: f.fighterBId?.toString() ?? '',
    result: f.result
      ? {
          winnerFighterId: f.result.winnerFighterId?.toString() ?? null,
          method: f.result.method ?? null,
        }
      : null,
  }));
  const plan = planRecordMigration(
    fighters.map((f) => ({
      _id: f._id.toString(),
      displayName: f.displayName,
      record: f.record ?? null,
      casualRecord: f.casualRecord ?? null,
      // lean() = dokumen mentah DB: field yang tidak tersimpan = undefined.
      hasCasualRecord: (f as { casualRecord?: unknown }).casualRecord !== undefined,
    })),
    completed,
  );
  return { plan, decidedMatches, completedFights: fights.length };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminApi(req);
    await connectDB();
    const { plan, decidedMatches, completedFights } = await buildPlan();
    return ok({
      dryRun: true,
      decidedMatches,
      completedFights,
      fighters: plan,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminApi(req);
    await connectDB();
    const { plan, decidedMatches, completedFights } = await buildPlan();
    let applied = 0;
    let skipped = 0;
    for (const p of plan) {
      if (p.alreadyMigrated) {
        skipped += 1;
        continue;
      }
      // strict: false — casualRecord sudah TIDAK ada di skema baru, jadi
      // Mongoose (strict default) akan membuang $unset-nya; opsi ini yang
      // membuat penghapusan field lama benar-benar terkirim ke MongoDB.
      await Fighter.updateOne(
        { _id: p.fighterId },
        {
          $set: { record: p.mergedRecord },
          $unset: { casualRecord: '' },
        },
        { strict: false },
      );
      applied += 1;
    }
    return ok({
      dryRun: false,
      applied,
      skipped,
      decidedMatches,
      completedFights,
      fighters: plan,
    });
  } catch (err) {
    return handleError(err);
  }
}
