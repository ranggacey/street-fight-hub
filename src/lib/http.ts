import { NextResponse } from 'next/server';

/**
 * Helper respons JSON seragam + error handling untuk semua Route Handler.
 * Format sukses: { ok: true, data }
 * Format gagal:  { ok: false, error: { code, message } }
 */

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code = 'VALIDATION_ERROR') =>
  new HttpError(400, code, message);
export const unauthorized = (message = 'Belum login') =>
  new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Akses ditolak') =>
  new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Tidak ditemukan') =>
  new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string, code = 'CONFLICT') =>
  new HttpError(409, code, message);
export const tooMany = (message = 'Terlalu banyak percobaan, coba lagi nanti') =>
  new HttpError(429, 'RATE_LIMITED', message);
export const unavailable = (message: string, code = 'SERVICE_UNAVAILABLE') =>
  new HttpError(503, code, message);

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function errorResponse(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

/** Ubah error apa pun (termasuk HttpError) menjadi respons JSON seragam. */
export function handleError(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return errorResponse(err.code, err.message, err.status);
  }
  const message = err instanceof Error ? err.message : 'Terjadi kesalahan server';
  if (message.includes('MONGODB_URI') || message.includes('DB_NOT_CONFIGURED')) {
    return errorResponse('DB_UNAVAILABLE', 'Database belum dikonfigurasi', 503);
  }
  // Error duplikat dari MongoDB (unique index) — misalnya race condition register/join.
  const code = (err as { code?: unknown } | null)?.code;
  if (code === 11000) {
    return errorResponse('CONFLICT', 'Data sudah ada', 409);
  }
  if ((err as { name?: string } | null)?.name === 'ValidationError') {
    return errorResponse('VALIDATION_ERROR', message, 400);
  }
  console.error(err);
  return errorResponse('INTERNAL_ERROR', 'Terjadi kesalahan server', 500);
}

/**
 * Serialisasi dokumen menjadi objek JSON polos (untuk spread).
 * Jika hasilnya bukan objek, kembalikan objek kosong.
 */
export function serializeRecord(value: unknown): Record<string, unknown> {
  const out = serialize(value);
  if (out === null || typeof out !== 'object' || Array.isArray(out)) return {};
  return out as Record<string, unknown>;
}

export async function parseJson(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest('Body JSON tidak valid');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Body harus berupa objek JSON');
  }
  return body as Record<string, unknown>;
}

/**
 * Serialisasi dokumen Mongoose (lean) ke JSON publik:
 * - `_id` → `id` (string)
 * - ObjectId → string
 * - Date → ISO string
 * - `__v` dihapus
 */
export function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => serialize(v));
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // ObjectId (punya toHexString) → string
    if (typeof obj.toHexString === 'function') return obj.toString();
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === '_id') out.id = serialize(val);
      else if (key === '__v') continue;
      else out[key] = serialize(val);
    }
    return out;
  }
  return value;
}
