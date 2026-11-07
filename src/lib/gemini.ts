import { GoogleGenerativeAI } from '@google/generative-ai';
import { validateAiPersona, type AiPersona } from './validation';

/**
 * Gemini — generate persona fighter (CONTRACT §7).
 * Model gemini-flash-lite-latest (ganti dari gemini-3.8-flash 2026-11-07:
 * 3.8-flash sedang overload — API mengembalikan 503 "high demand" dan
 * request menggantung sampai Vercel timeout 300 dtk; lite merespons
 * instan untuk tugas JSON kecil seperti ini), temperature 0.9, prompt
 * Bahasa Indonesia, minta JSON SAJA. Validasi hasil + 1x retry untuk
 * error cepat (503/busy, JSON rusak). Timeout 45 dtk per percobaan —
 * JANGAN pernah menggantung (frontend juga punya timeout sendiri).
 * Jika GEMINI_API_KEY kosong → error kode GEMINI_NOT_CONFIGURED
 * (route ubah jadi 503).
 */

const MODEL_NAME = 'gemini-flash-lite-latest';
/** Batas tunggu satu percobaan generate (Vercel timeout 300 dtk). */
const GENERATE_TIMEOUT_MS = 45_000;

export class GeminiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface GeneratePersonaInput {
  displayName: string;
  style: string;
  styleOther?: string | null;
  selfDescription: string;
}

function buildPrompt(input: GeneratePersonaInput): string {
  const styleText = input.style === 'other' && input.styleOther ? input.styleOther : input.style;
  return [
    'Kamu adalah komentator turnamen stickman fight berbahasa Indonesia.',
    'Buatkan persona petarung untuk fighter berikut:',
    `- Nama tampilan: ${input.displayName}`,
    `- Gaya bertarung: ${styleText}`,
    `- Deskripsi diri: ${input.selfDescription}`,
    '',
    'Jawab HANYA dengan JSON valid (tanpa markdown, tanpa penjelasan) dengan field berikut:',
    '- nickname: string (nama panggilan keren, maks 30 karakter)',
    '- styleSummary: string (1 kalimat ringkasan gaya bertarung)',
    '- strengths: array berisi TEPAT 2 string (kelebihan utama, masing-masing maks 50 karakter)',
    '- weakness: string (1 kelemahan, 1 kalimat)',
    '- signatureMove: string (nama jurus andalan, maks 50 karakter)',
    '- introLine: string (1 kalimat pembuka yang diucapkan sebelum bertarung)',
    '- color: string (warna utama persona, format hex #rrggbb)',
    '- gear: string (1 perlengkapan khas, maks 100 karakter)',
    '',
    'Gunakan Bahasa Indonesia yang seru dan hidup, gaya Gen Z, tanpa kata kasar.',
  ].join('\n');
}

/** Parse JSON dari respons (strip markdown fence bila ada), lalu validasi. */
export function parsePersonaJson(text: string): AiPersona {
  const stripped = text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Respons AI bukan JSON');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped.slice(start, end + 1));
  } catch {
    throw new Error('Respons AI bukan JSON valid');
  }
  return validateAiPersona(parsed);
}

export async function generatePersona(input: GeneratePersonaInput): Promise<AiPersona> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError('GEMINI_NOT_CONFIGURED', 'AI belum dikonfigurasi');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { temperature: 0.9 },
  });
  const prompt = buildPrompt(input);

  let lastError: unknown = null;
  // 1x percobaan + 1x retry — HANYA untuk error cepat (503/busy, JSON
  // rusak). Timeout TIDAK di-retry: model yang menggantung biasanya
  // tetap menggantung di percobaan kedua, dan user harus segera dapat
  // pesan jelas, bukan menunggu 2x lipat.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await withTimeout(
        model.generateContent(prompt),
        GENERATE_TIMEOUT_MS,
      );
      return parsePersonaJson(result.response.text());
    } catch (err) {
      lastError = err;
      // Kunci API tidak valid → jangan retry, langsung beri kode jelas.
      if (isInvalidKeyError(err)) {
        throw new GeminiError(
          'GEMINI_INVALID_KEY',
          'Kunci API Gemini tidak valid — periksa GEMINI_API_KEY',
        );
      }
      // Timeout → jangan retry, langsung beri kode jelas.
      if (err instanceof GeminiError && err.code === 'GEMINI_TIMEOUT') {
        throw err;
      }
      // Overload 503 → retry sekali; kalau masih sibuk, kode jelas.
      if (isBusyError(err)) {
        if (attempt === 0) continue;
        throw new GeminiError(
          'GEMINI_BUSY',
          'AI sedang sibuk (server Gemini penuh) — coba lagi sebentar',
        );
      }
      // Error lain (mis. JSON tidak valid) → retry sekali seperti semula.
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error('Gagal generate persona AI');
}

/** Balap promise dengan timer: tolak dengan GEMINI_TIMEOUT kalau lewat batas. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new GeminiError(
            'GEMINI_TIMEOUT',
            `AI terlalu lama merespons (lebih dari ${ms / 1000} detik)`,
          ),
        ),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/** Deteksi error overload 503 dari SDK Google (pesan mengandung 503/overload). */
function isBusyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /503|overload|UNAVAILABLE|high demand/i.test(msg);
}

/** Deteksi error "API key not valid" dari SDK Google (status 400). */
function isInvalidKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /API key not valid|API_KEY_INVALID/i.test(msg);
}
