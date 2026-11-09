import { badRequest } from './http';
import { isValidSignatureMove } from './game/engine-config';
import {
  ACCESSORY_CATALOG,
  ACCESSORY_PARTS,
  type AccessoryPart,
} from './game/accessories';

/**
 * Validasi server-side untuk semua input API.
 * Semua fungsi throw HttpError 400 (VALIDATION_ERROR) jika tidak valid.
 */

export const USERNAME_RE = /^[a-z0-9_]+$/;
export const IG_USERNAME_RE = /^[A-Za-z0-9._]+$/;

export const FIGHTER_STYLES = [
  'boxing',
  'taekwondo',
  'muay-thai',
  'street',
  'karate',
  'silat',
  'wrestling',
  'other',
  // Gaya baru Fase 1 (engine arena sudah punya semuanya):
  'kali-arnis',
  'judo',
  'kudo',
  'jeet-kune-do',
  'capoeira',
  'wushu',
  'kung-fu',
] as const;
export type FighterStyle = (typeof FIGHTER_STYLES)[number];

/** Tempo fighter (mempengaruhi jeda kontak + bobot gerakan di engine). */
export const FIGHTER_TEMPOS = ['agresif', 'seimbang', 'bertahan'] as const;
export type FighterTempo = (typeof FIGHTER_TEMPOS)[number];

/** Map arena yang bisa dipilih saat menantang. */
export const ARENA_MAPS = ['ring', 'gudang', 'jalanan', 'dojo'] as const;
export type ArenaMap = (typeof ARENA_MAPS)[number];

/** Escape input untuk dipakai di $regex MongoDB (cegah ReDoS / pola liar). */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const MATCH_ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F'] as const;
export type MatchRound = (typeof MATCH_ROUNDS)[number];

export const BRACKET_SIZES = [8, 16, 32] as const;

function reqString(body: Record<string, unknown>, key: string, label: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`${label} wajib diisi`);
  }
  return value.trim();
}

function optString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw badRequest(`Field ${key} harus berupa string`);
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function checkLength(value: string, min: number, max: number, label: string): string {
  if (value.length < min || value.length > max) {
    throw badRequest(`${label} harus ${min}-${max} karakter`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export function validateUsername(username: unknown): string {
  if (typeof username !== 'string') throw badRequest('Username wajib diisi');
  const value = username.trim().toLowerCase();
  if (value.length < 3 || value.length > 20 || !USERNAME_RE.test(value)) {
    throw badRequest('Username harus 3-20 karakter, huruf kecil, angka, atau underscore');
  }
  return value;
}

export function validatePassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 8) {
    throw badRequest('Password minimal 8 karakter');
  }
  return password;
}

// ---------------------------------------------------------------------------
// Fighter
// ---------------------------------------------------------------------------

export interface FighterGameFields {
  signatureMove: string | null;
  tempo: FighterTempo;
  colors: Record<string, string>;
  accessories: Record<string, string>;
}

export interface FighterInput {
  displayName: string;
  igUsername: string;
  style: FighterStyle;
  styleOther: string | null;
  selfDescription: string;
  game: FighterGameFields;
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const COLOR_PARTS = ['body', 'gloves', 'shoes', 'belt', 'headband', 'weapon'] as const;
/** Bagian yang boleh 'none' (tidak dipakai): sabuk, ikat kepala, senjata. */
const COLOR_NONEABLE = new Set(['belt', 'headband', 'weapon']);

/** Validasi warna RGB bebas per bagian (input type=color + field hex). */
export function parseFighterColors(value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('colors harus berupa objek');
  }
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!(COLOR_PARTS as readonly string[]).includes(key)) {
      throw badRequest(`Bagian warna tidak dikenal: ${key}`);
    }
    if (typeof raw !== 'string') throw badRequest(`Warna ${key} harus berupa string`);
    const v = raw.trim();
    if (v === 'none') {
      if (!COLOR_NONEABLE.has(key)) throw badRequest(`Warna ${key} tidak boleh 'none'`);
      out[key] = 'none';
    } else if (HEX_COLOR_RE.test(v)) {
      out[key] = v;
    } else {
      throw badRequest(`Warna ${key} harus format hex #RRGGBB atau 'none'`);
    }
  }
  return out;
}

/**
 * Validasi aksesoris per bagian (katalog src/lib/game/accessories.ts).
 * Partial diizinkan (bagian yang tidak dikirim tidak diubah); key tak
 * dikenal dan ID tak dikenal DITOLAK dengan pesan yang menyebut
 * pilihannya — bukan diam-diam diganti default.
 */
export function parseFighterAccessories(value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('accessories harus berupa objek');
  }
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!(ACCESSORY_PARTS as readonly string[]).includes(key)) {
      throw badRequest(`Bagian aksesoris tidak dikenal: ${key}`);
    }
    const part = key as AccessoryPart;
    if (typeof raw !== 'string') {
      throw badRequest(`Aksesoris ${key} harus berupa string`);
    }
    const v = raw.trim();
    const known = ACCESSORY_CATALOG[part].map((variant) => variant.id);
    if (!known.includes(v)) {
      throw badRequest(
        `Aksesoris ${key} tidak dikenal: ${v}. Pilihan: ${known.join(', ')}`,
      );
    }
    out[key] = v;
  }
  return out;
}

function parseTempo(value: unknown): FighterTempo {
  if (value === undefined || value === null || value === '') return 'seimbang';
  if (typeof value !== 'string' || !(FIGHTER_TEMPOS as readonly string[]).includes(value)) {
    throw badRequest(`Tempo tidak valid: ${String(value)}`);
  }
  return value as FighterTempo;
}

function parseSignatureMove(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^[a-z]+$/.test(value)) {
    throw badRequest('Jurus khas tidak valid');
  }
  return value;
}

export function validateFighterBody(body: Record<string, unknown>): FighterInput {
  const displayName = checkLength(reqString(body, 'displayName', 'Nama tampilan'), 1, 30, 'Nama tampilan');
  const igUsername = reqString(body, 'igUsername', 'Username Instagram');
  if (igUsername.length < 1 || igUsername.length > 30 || !IG_USERNAME_RE.test(igUsername)) {
    throw badRequest('Username Instagram harus 1-30 karakter (huruf, angka, titik, underscore)');
  }
  const styleRaw = reqString(body, 'style', 'Gaya bertarung');
  if (!(FIGHTER_STYLES as readonly string[]).includes(styleRaw)) {
    throw badRequest(`Gaya bertarung tidak valid: ${styleRaw}`);
  }
  const style = styleRaw as FighterStyle;
  let styleOther: string | null = null;
  if (style === 'other') {
    styleOther = checkLength(reqString(body, 'styleOther', 'Gaya lain'), 1, 50, 'Gaya lain');
  } else {
    styleOther = optString(body, 'styleOther');
  }
  // Deskripsi diri: TIDAK ada minimum (2026-11-07, perintah rangga —
  // deskripsi pendek seperti "Aku geng yang suka bawa senjata" harus lolos).
  // Hanya batas atas 600 karakter yang dipertahankan.
  const selfDescription = checkLength(
    reqString(body, 'selfDescription', 'Deskripsi diri'),
    1,
    600,
    'Deskripsi diri',
  );
  // Field game (opsional saat buat — default dari skema kalau kosong).
  const signatureMove = parseSignatureMove(body.signatureMove);
  if (signatureMove && !isValidSignatureMove(style, signatureMove)) {
    throw badRequest(`Jurus khas ${signatureMove} tidak ada di gaya ${style}`);
  }
  return {
    displayName,
    igUsername,
    style,
    styleOther,
    selfDescription,
    game: {
      signatureMove,
      tempo: parseTempo(body.tempo),
      colors: parseFighterColors(body.colors),
      accessories: parseFighterAccessories(body.accessories),
    },
  };
}

export interface FighterPatch {
  top: {
    displayName?: string;
    igUsername?: string;
    style?: FighterStyle;
    styleOther?: string | null;
    selfDescription?: string;
    signatureMove?: string | null;
    tempo?: FighterTempo;
    colors?: Record<string, string>;
    accessories?: Record<string, string>;
  };
}

/** Validasi PATCH fighter (owner maupun admin moderasi). Semua field opsional. */
export function parseFighterPatch(body: Record<string, unknown>): FighterPatch {
  const top: FighterPatch['top'] = {};

  if (body.displayName !== undefined) {
    top.displayName = checkLength(reqString(body, 'displayName', 'Nama tampilan'), 1, 30, 'Nama tampilan');
  }
  if (body.igUsername !== undefined) {
    const value = reqString(body, 'igUsername', 'Username Instagram');
    if (value.length < 1 || value.length > 30 || !IG_USERNAME_RE.test(value)) {
      throw badRequest('Username Instagram harus 1-30 karakter (huruf, angka, titik, underscore)');
    }
    top.igUsername = value;
  }
  if (body.style !== undefined) {
    const styleRaw = reqString(body, 'style', 'Gaya bertarung');
    if (!(FIGHTER_STYLES as readonly string[]).includes(styleRaw)) {
      throw badRequest(`Gaya bertarung tidak valid: ${styleRaw}`);
    }
    top.style = styleRaw as FighterStyle;
    if (top.style === 'other' && body.styleOther !== undefined) {
      top.styleOther = checkLength(reqString(body, 'styleOther', 'Gaya lain'), 1, 50, 'Gaya lain');
    }
  }
  if (body.styleOther !== undefined && top.style !== 'other') {
    top.styleOther = optString(body, 'styleOther');
  }
  if (body.selfDescription !== undefined) {
    top.selfDescription = checkLength(
      reqString(body, 'selfDescription', 'Deskripsi diri'),
      1,
      600,
      'Deskripsi diri',
    );
  }
  // Field game (customize fighter): jurus khas, tempo, warna per bagian.
  // signatureMove divalidasi terhadap gaya EFEKTIF di route (gaya baru
  // kalau diubah, kalau tidak gaya lama fighter) — di sini hanya format.
  if (body.signatureMove !== undefined) {
    top.signatureMove = parseSignatureMove(body.signatureMove);
  }
  if (body.tempo !== undefined) {
    top.tempo = parseTempo(body.tempo);
  }
  if (body.colors !== undefined) {
    top.colors = parseFighterColors(body.colors);
  }
  if (body.accessories !== undefined) {
    top.accessories = parseFighterAccessories(body.accessories);
  }

  return { top };
}

// ---------------------------------------------------------------------------
// Turnamen
// ---------------------------------------------------------------------------

export interface TournamentInput {
  name: string;
  bracketSize: 8 | 16 | 32;
  regOpenAt: Date;
  regCloseAt: Date;
  rules: string;
}

export function validateTournamentBody(body: Record<string, unknown>): TournamentInput {
  const name = checkLength(reqString(body, 'name', 'Nama turnamen'), 3, 100, 'Nama turnamen');
  const bracketSizeRaw = body.bracketSize;
  if (typeof bracketSizeRaw !== 'number' || !(BRACKET_SIZES as readonly number[]).includes(bracketSizeRaw)) {
    throw badRequest('bracketSize harus 8, 16, atau 32');
  }
  const bracketSize = bracketSizeRaw as 8 | 16 | 32;
  const regOpenAt = new Date(String(body.regOpenAt ?? ''));
  const regCloseAt = new Date(String(body.regCloseAt ?? ''));
  if (Number.isNaN(regOpenAt.getTime())) throw badRequest('regOpenAt harus tanggal yang valid');
  if (Number.isNaN(regCloseAt.getTime())) throw badRequest('regCloseAt harus tanggal yang valid');
  if (regCloseAt.getTime() <= regOpenAt.getTime()) {
    throw badRequest('regCloseAt harus setelah regOpenAt');
  }
  const rulesRaw = optString(body, 'rules') ?? '';
  if (rulesRaw.length > 5000) throw badRequest('Rules maksimal 5000 karakter');
  return { name, bracketSize, regOpenAt, regCloseAt, rules: rulesRaw };
}

// ---------------------------------------------------------------------------
// Lainnya
// ---------------------------------------------------------------------------

export function validateAnnounceBody(body: Record<string, unknown>): string {
  const text = reqString(body, 'text', 'Teks pengumuman');
  if (text.length > 200) throw badRequest('Teks pengumuman maksimal 200 karakter');
  return text;
}

/** Validasi URL Reel Instagram: instagram.com/reel/<id> atau instagram.com/p/<id>. */
export function isValidInstagramReelUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname !== 'instagram.com' && parsed.hostname !== 'www.instagram.com') return false;
    return parsed.pathname.startsWith('/reel/') || parsed.pathname.startsWith('/p/');
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Game (Fase 1)
// ---------------------------------------------------------------------------

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export function validateObjectId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !OBJECT_ID_RE.test(value)) {
    throw badRequest(`${label} tidak valid`);
  }
  return value;
}

export interface ChallengeInput {
  challengedFighterId: string;
  message: string | null;
  map: ArenaMap;
}

/** Batas lawan sekali kirim bulk — pelindung spam, bukan jatah harian. */
export const MAX_BULK_OPPONENTS = 20;

export interface BulkChallengeInput {
  opponentIds: string[];
  message: string | null;
  map: ArenaMap;
}

/**
 * Validasi body POST /api/challenges/bulk: daftar id lawan (1–20,
 * didedup, masing-masing ObjectId valid) + map + pesan (aturan sama
 * dengan tantangan langsung).
 */
export function validateBulkChallengeBody(body: Record<string, unknown>): BulkChallengeInput {
  const raw = body.opponentIds;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw badRequest('Pilih minimal 1 lawan untuk ditantang');
  }
  if (raw.length > MAX_BULK_OPPONENTS) {
    throw badRequest(`Maksimal ${MAX_BULK_OPPONENTS} lawan sekali kirim`);
  }
  const opponentIds = [...new Set(raw.map((v) => validateObjectId(v, 'Fighter yang ditantang')))];
  let message: string | null = null;
  if (body.message !== undefined && body.message !== null) {
    if (typeof body.message !== 'string') throw badRequest('Pesan tantangan harus berupa string');
    message = body.message.trim();
    if (message.length > 140) throw badRequest('Pesan tantangan maksimal 140 karakter');
    if (message === '') message = null;
  }
  let map: ArenaMap = 'ring';
  if (body.map !== undefined && body.map !== null) {
    if (typeof body.map !== 'string' || !(ARENA_MAPS as readonly string[]).includes(body.map)) {
      throw badRequest(`Map tidak valid: ${String(body.map)}`);
    }
    map = body.map as ArenaMap;
  }
  return { opponentIds, message, map };
}

export function validateChallengeBody(body: Record<string, unknown>): ChallengeInput {
  const challengedFighterId = validateObjectId(
    body.challengedFighterId,
    'Fighter yang ditantang',
  );
  let message: string | null = null;
  if (body.message !== undefined && body.message !== null) {
    if (typeof body.message !== 'string') throw badRequest('Pesan tantangan harus berupa string');
    message = body.message.trim();
    if (message.length > 140) throw badRequest('Pesan tantangan maksimal 140 karakter');
    if (message === '') message = null;
  }
  let map: ArenaMap = 'ring';
  if (body.map !== undefined && body.map !== null) {
    if (typeof body.map !== 'string' || !(ARENA_MAPS as readonly string[]).includes(body.map)) {
      throw badRequest(`Map tidak valid: ${String(body.map)}`);
    }
    map = body.map as ArenaMap;
  }
  return { challengedFighterId, message, map };
}

/** Validasi teks chat global (1–500 karakter). */
export function validateChatText(body: Record<string, unknown>): string {
  const text = reqString(body, 'text', 'Pesan chat');
  if (text.length > 500) throw badRequest('Pesan chat maksimal 500 karakter');
  return text;
}

export interface FightStatsInput {
  accuracyA: number;
  accuracyB: number;
  damageDealtA: number;
  damageDealtB: number;
  strikesThrownA: number;
  strikesThrownB: number;
  strikesLandedA: number;
  strikesLandedB: number;
  knockdowns: number;
}

export interface FightResultInput {
  winner: 'R' | 'B' | null;
  method: 'KO' | 'decision' | 'draw';
  score: { a: number; b: number };
  koTimeSec: number | null;
  stats: FightStatsInput;
  keyMoments: unknown;
  posterDataUrl: string | null;
  seed: number | null;
}

function reqFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw badRequest(`${label} harus berupa angka`);
  }
  return value;
}

/**
 * Validasi payload `sfa-result` dari iframe. TIDAK mempercayai isinya
 * untuk ranking — verifikasi sebenarnya dilakukan server dengan
 * buildFight ulang (verifyFightResult); di sini hanya bentuk + tipe.
 */
export function validateFightResultBody(body: Record<string, unknown>): FightResultInput {
  const winnerRaw = body.winner;
  if (winnerRaw !== 'R' && winnerRaw !== 'B' && winnerRaw !== null) {
    throw badRequest('winner harus R, B, atau null (seri)');
  }
  const methodRaw = body.method;
  if (methodRaw !== 'KO' && methodRaw !== 'decision' && methodRaw !== 'draw') {
    throw badRequest('method harus KO, decision, atau draw');
  }
  const scoreRaw = body.score;
  if (
    !scoreRaw ||
    typeof scoreRaw !== 'object' ||
    Array.isArray(scoreRaw)
  ) {
    throw badRequest('score harus berupa objek { a, b }');
  }
  const score = {
    a: reqFiniteNumber((scoreRaw as Record<string, unknown>).a, 'score.a'),
    b: reqFiniteNumber((scoreRaw as Record<string, unknown>).b, 'score.b'),
  };
  if (score.a < 0 || score.a > 100 || score.b < 0 || score.b > 100) {
    throw badRequest('score harus 0–100');
  }
  let koTimeSec: number | null = null;
  if (body.koTimeSec !== undefined && body.koTimeSec !== null) {
    koTimeSec = reqFiniteNumber(body.koTimeSec, 'koTimeSec');
    if (koTimeSec < 0 || koTimeSec > 60) throw badRequest('koTimeSec harus 0–60');
  }
  const statsRaw = body.stats;
  if (!statsRaw || typeof statsRaw !== 'object' || Array.isArray(statsRaw)) {
    throw badRequest('stats wajib diisi');
  }
  const s = statsRaw as Record<string, unknown>;
  const stats: FightStatsInput = {
    accuracyA: reqFiniteNumber(s.accuracyA, 'stats.accuracyA'),
    accuracyB: reqFiniteNumber(s.accuracyB, 'stats.accuracyB'),
    damageDealtA: reqFiniteNumber(s.damageDealtA, 'stats.damageDealtA'),
    damageDealtB: reqFiniteNumber(s.damageDealtB, 'stats.damageDealtB'),
    strikesThrownA: reqFiniteNumber(s.strikesThrownA, 'stats.strikesThrownA'),
    strikesThrownB: reqFiniteNumber(s.strikesThrownB, 'stats.strikesThrownB'),
    strikesLandedA: reqFiniteNumber(s.strikesLandedA, 'stats.strikesLandedA'),
    strikesLandedB: reqFiniteNumber(s.strikesLandedB, 'stats.strikesLandedB'),
    knockdowns: reqFiniteNumber(s.knockdowns, 'stats.knockdowns'),
  };
  let posterDataUrl: string | null = null;
  if (typeof body.posterDataUrl === 'string' && body.posterDataUrl.startsWith('data:image/jpeg;base64,')) {
    posterDataUrl = body.posterDataUrl;
  }
  let seed: number | null = null;
  if (body.seed !== undefined && body.seed !== null) {
    seed = reqFiniteNumber(body.seed, 'seed');
  }
  return {
    winner: winnerRaw,
    method: methodRaw,
    score,
    koTimeSec,
    stats,
    keyMoments: body.keyMoments ?? null,
    posterDataUrl,
    seed,
  };
}
