import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { GeminiError, generatePersona } from '@/lib/gemini';
import { forbidden, handleError, notFound, ok, serialize, tooMany, unavailable } from '@/lib/http';
import { Fighter } from '@/models/Fighter';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/fighters/[id]/ai-generate — generate persona AI (owner, maks 3x). */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const { id } = await params;
    await connectDB();

    const fighter = await Fighter.findById(id);
    if (!fighter) throw notFound('Fighter tidak ditemukan');
    if (fighter.userId.toString() !== session.userId) {
      throw forbidden('Hanya pemilik fighter yang bisa generate persona');
    }
    if (fighter.regenCount >= 3) {
      throw tooMany('Batas generate persona (3x) sudah habis');
    }

    let persona;
    try {
      persona = await generatePersona({
        displayName: fighter.displayName,
        style: fighter.style,
        styleOther: fighter.styleOther,
        selfDescription: fighter.selfDescription,
      });
    } catch (err) {
      if (err instanceof GeminiError && err.code === 'GEMINI_NOT_CONFIGURED') {
        throw unavailable('AI belum dikonfigurasi', 'GEMINI_NOT_CONFIGURED');
      }
      if (err instanceof GeminiError && err.code === 'GEMINI_INVALID_KEY') {
        throw unavailable('Kunci AI tidak valid — periksa GEMINI_API_KEY', 'GEMINI_INVALID_KEY');
      }
      if (err instanceof GeminiError && err.code === 'GEMINI_TIMEOUT') {
        throw unavailable('AI terlalu lama merespons — coba lagi sebentar', 'GEMINI_TIMEOUT');
      }
      if (err instanceof GeminiError && err.code === 'GEMINI_BUSY') {
        throw unavailable('AI sedang sibuk — coba lagi sebentar', 'GEMINI_BUSY');
      }
      throw err;
    }

    fighter.aiPersona = persona;
    fighter.regenCount += 1;
    await fighter.save();

    return ok({
      fighter: serialize(fighter.toObject()),
      regenLeft: 3 - fighter.regenCount,
    });
  } catch (err) {
    return handleError(err);
  }
}
