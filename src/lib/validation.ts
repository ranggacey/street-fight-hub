import { badRequest } from './http';

/**
 * Validasi server-side untuk semua input API.
 * Semua fungsi throw HttpError 400 (VALIDATION_ERROR) jika tidak valid.
 */

export const USERNAME_RE = /^[a-z0-9_]+$/;
export const IG_USERNAME_RE = /^[A-Za-z0-9._]+$/;
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const FIGHTER_STYLES = [
  'boxing',
  'taekwondo',
  'muay-thai',
  'street',
  'karate',
  'silat',
  'wrestling',
  'other',
] as const;
export type FighterStyle = (typeof FIGHTER_STYLES)[number];

export const MATCH_ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F'] as const;
export type MatchRound = (typeof MATCH_ROUNDS)[number];

export const BRACKET_SIZES = [8, 16, 32] as const;

export interface AiPersona {
  nickname: string;
  styleSummary: string;
  strengths: [string, string];
  weakness: string;
  signatureMove: string;
  introLine: string;
  color: string;
  gear: string;
}

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

export interface FighterInput {
  displayName: string;
  igUsername: string;
  style: FighterStyle;
  styleOther: string | null;
  selfDescription: string;
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
  const selfDescription = checkLength(
    reqString(body, 'selfDescription', 'Deskripsi diri'),
    50,
    600,
    'Deskripsi diri',
  );
  return { displayName, igUsername, style, styleOther, selfDescription };
}

export interface FighterPatch {
  top: {
    displayName?: string;
    igUsername?: string;
    style?: FighterStyle;
    styleOther?: string | null;
    selfDescription?: string;
  };
  persona: Partial<AiPersona>;
}

/** Validasi PATCH fighter (owner maupun admin moderasi). Semua field opsional. */
export function parseFighterPatch(body: Record<string, unknown>): FighterPatch {
  const top: FighterPatch['top'] = {};
  const persona: Partial<AiPersona> = {};

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
      50,
      600,
      'Deskripsi diri',
    );
  }

  if (body.nickname !== undefined) persona.nickname = checkLength(reqString(body, 'nickname', 'Nickname'), 1, 30, 'Nickname');
  if (body.styleSummary !== undefined) persona.styleSummary = checkLength(reqString(body, 'styleSummary', 'Ringkasan gaya'), 1, 200, 'Ringkasan gaya');
  if (body.strengths !== undefined) {
    const value = body.strengths;
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      value.some((s) => typeof s !== 'string' || s.trim() === '' || s.trim().length > 50)
    ) {
      throw badRequest('Strengths harus array berisi tepat 2 string (maks 50 karakter)');
    }
    persona.strengths = [value[0].trim(), value[1].trim()] as [string, string];
  }
  if (body.weakness !== undefined) persona.weakness = checkLength(reqString(body, 'weakness', 'Kelemahan'), 1, 200, 'Kelemahan');
  if (body.signatureMove !== undefined) persona.signatureMove = checkLength(reqString(body, 'signatureMove', 'Jurus andalan'), 1, 50, 'Jurus andalan');
  if (body.introLine !== undefined) persona.introLine = checkLength(reqString(body, 'introLine', 'Kalimat pembuka'), 1, 200, 'Kalimat pembuka');
  if (body.color !== undefined) {
    const value = reqString(body, 'color', 'Warna');
    if (!HEX_COLOR_RE.test(value)) throw badRequest('Warna harus format hex #rrggbb');
    persona.color = value;
  }
  if (body.gear !== undefined) persona.gear = checkLength(reqString(body, 'gear', 'Gear'), 1, 100, 'Gear');

  return { top, persona };
}

/**
 * Gabungkan patch persona dengan aiPersona yang sudah ada.
 * Return null jika tidak ada field persona di patch.
 * Throw 400 jika hasil gabungan tidak lengkap (semua 8 field wajib).
 */
export function mergePersona(
  existing: unknown,
  patch: Partial<AiPersona>,
): AiPersona | null {
  if (Object.keys(patch).length === 0) return null;
  const merged = { ...(existing && typeof existing === 'object' ? (existing as Record<string, unknown>) : {}), ...patch };
  return validateAiPersona(merged);
}

/** Validasi objek aiPersona (dipakai Gemini + PATCH). Throw 400 jika tidak valid. */
export function validateAiPersona(value: unknown): AiPersona {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('Persona AI tidak valid');
  }
  const obj = value as Record<string, unknown>;
  const req = (key: string, label: string, min: number, max: number): string => {
    const v = obj[key];
    if (typeof v !== 'string' || v.trim() === '') throw badRequest(`Persona AI: ${label} wajib diisi`);
    return checkLength(v.trim(), min, max, `Persona AI: ${label}`);
  };
  const nickname = req('nickname', 'nickname', 1, 30);
  const styleSummary = req('styleSummary', 'styleSummary', 1, 200);
  const strengthsRaw = obj.strengths;
  if (
    !Array.isArray(strengthsRaw) ||
    strengthsRaw.length !== 2 ||
    strengthsRaw.some((s) => typeof s !== 'string' || s.trim() === '' || s.trim().length > 50)
  ) {
    throw badRequest('Persona AI: strengths harus berisi tepat 2 string');
  }
  const strengths = [strengthsRaw[0].trim(), strengthsRaw[1].trim()] as [string, string];
  const weakness = req('weakness', 'weakness', 1, 200);
  const signatureMove = req('signatureMove', 'signatureMove', 1, 50);
  const introLine = req('introLine', 'introLine', 1, 200);
  const colorRaw = req('color', 'color', 7, 7);
  if (!HEX_COLOR_RE.test(colorRaw)) throw badRequest('Persona AI: color harus format hex #rrggbb');
  const gear = req('gear', 'gear', 1, 100);
  return { nickname, styleSummary, strengths, weakness, signatureMove, introLine, color: colorRaw, gear };
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
