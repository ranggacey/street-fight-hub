import mongoose from 'mongoose';
import type { NextRequest } from 'next/server';
import { checkOrigin, requireAdminApi } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { badRequest, handleError, notFound, ok, parseJson, serialize } from '@/lib/http';
import { isValidInstagramReelUrl } from '@/lib/validation';
import { GameFight } from '@/models/GameFight';
import { VideoTask } from '@/models/VideoTask';

const TASK_STATUSES = ['queued', 'in_production', 'uploaded', 'blocked'];

/** GET /api/admin/video-tasks?status= — list + match + fighter ringkas. */
export async function GET(req: NextRequest) {
  try {
    await requireAdminApi(req);
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const filter: Record<string, unknown> = {};
    if (status && TASK_STATUSES.includes(status)) filter.status = status;

    const tasks = await VideoTask.find(filter)
      .populate({
        path: 'matchId',
        populate: [
          { path: 'fighterAId', select: 'displayName igUsername' },
          { path: 'fighterBId', select: 'displayName igUsername' },
          { path: 'tournamentId', select: 'name slug' },
        ],
      })
      // Title fight (game) tidak punya matchId — populate lewat gameFightId.
      .populate({
        path: 'gameFightId',
        populate: [
          { path: 'fighterAId', select: 'displayName igUsername' },
          { path: 'fighterBId', select: 'displayName igUsername' },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();
    return ok({ videoTasks: serialize(tasks) });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/admin/video-tasks { gameFightId, reelUrl }
 * "Tandai Terunggah" untuk GameFight yang BELUM punya VideoTask (fight
 * kasual — task hanya dibuat otomatis untuk title fight & match turnamen).
 * Membuat task langsung berstatus 'uploaded' dengan reelUrl yang sama
 * validasinya dengan PATCH (instagram.com/reel atau /p, https).
 * Idempotent: kalau task untuk gameFightId ini sudah ada, task itu yang
 * diperbarui ke 'uploaded' (bukan dibuat duplikat) — 200, bukan 201.
 */
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw badRequest('Origin tidak valid');
    const session = await requireAdminApi(req);
    const body = await parseJson(req);
    await connectDB();

    const gameFightId = typeof body.gameFightId === 'string' ? body.gameFightId.trim() : '';
    if (!gameFightId) throw badRequest('gameFightId wajib diisi');
    const reelUrl = typeof body.reelUrl === 'string' ? body.reelUrl.trim() : '';
    if (!reelUrl || !isValidInstagramReelUrl(reelUrl)) {
      throw badRequest('reelUrl harus URL Reel Instagram yang valid (instagram.com/reel atau /p)');
    }

    const fight = await GameFight.findById(gameFightId);
    if (!fight) throw notFound('GameFight tidak ditemukan');

    const existing = await VideoTask.findOne({ gameFightId: fight._id });
    if (existing) {
      existing.status = 'uploaded';
      existing.reelUrl = reelUrl;
      await existing.save();
      await audit(
        session.userId,
        'video-task.create',
        'VideoTask',
        String(existing._id),
        `Video task yang sudah ada untuk fight ${gameFightId} ditandai terunggah`,
      );
      return ok({ videoTask: serialize(existing.toObject()) });
    }

    // Jebakan index (DITEMUKAN saat ngetes, 2026-11-11): field matchId di
    // VideoTask punya index UNIQUE NON-SPARSE. Komentar di model bilang
    // dokumen tanpa field matchId "tidak masuk index" — itu SALAH untuk
    // index non-sparse: MongoDB mengindeks field yang hilang sebagai
    // `null`, jadi hanya SATU task tanpa matchId yang boleh ada; task
    // kedua (title/kasual) gagal E11000 → 409. Menghilangkan field
    // (insertOne mentah) TIDAK membantu — diverifikasi langsung.
    // Workaround lokal: isi matchId dengan ObjectId acak sebagai
    // placeholder unik. Populate ke Match yang tak ada menghasilkan
    // null (tampilan AdminVideo untuk task title/kasual tetap "TBD",
    // sama seperti task tanpa matchId sekarang), dan PATCH tidak
    // menyentuh Match kalau findById null. PERBAIKAN YANG BENAR adalah
    // migrasi index (drop matchId_1 → buat ulang sparse) — itu butuh
    // keputusan + eksekusi di produksi, JANGAN dilakukan dari sini.
    // Migrasi itu juga memperbaiki create title task di result route,
    // yang hari ini kena E11000 yang sama di title fight kedua.
    const now = new Date();
    const inserted = await VideoTask.collection.insertOne({
      matchId: new mongoose.Types.ObjectId(),
      kind: fight.isTitleFight ? 'title' : 'match',
      gameFightId: fight._id,
      status: 'uploaded',
      reelUrl,
      note: '',
      createdAt: now,
      updatedAt: now,
    });
    const task = await VideoTask.findById(inserted.insertedId);
    if (!task) throw notFound('Video task tidak ditemukan setelah dibuat');
    await audit(
      session.userId,
      'video-task.create',
      'VideoTask',
      String(task._id),
      `Video task dibuat dari halaman pertandingan untuk fight ${gameFightId} (terunggah)`,
    );
    return ok({ videoTask: serialize(task.toObject()) }, 201);
  } catch (err) {
    return handleError(err);
  }
}
