import { GoogleGenerativeAI } from '@google/generative-ai';
import { validateAiPersona, type AiPersona } from './validation';

/**
 * Gemini — generate persona fighter (CONTRACT §7).
 * Model gemini-3.8-flash (gemini-2.0-flash DIPENSIUNKAN Google 2026-11 —
 * API mengembalikan 404 "no longer available"; ganti per rekomendasi
 * error Google), temperature 0.9, prompt Bahasa Indonesia,
 * minta JSON SAJA. Validasi hasil + 1x retry. Jika GEMINI_API_KEY kosong
 * → error kode GEMINI_NOT_CONFIGURED (route ubah jadi 503).
 */

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
    model: 'gemini-3.8-flash',
    generationConfig: { temperature: 0.9 },
  });
  const prompt = buildPrompt(input);

  let lastError: unknown = null;
  // 1x percobaan + 1x retry dengan prompt yang sama.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await model.generateContent(prompt);
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
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error('Gagal generate persona AI');
}

/** Deteksi error "API key not valid" dari SDK Google (status 400). */
function isInvalidKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /API key not valid|API_KEY_INVALID/i.test(msg);
}
