/**
 * Konfigurasi engine dari dokumen Fighter Hub → objek fighter arena.
 *
 * Hub mengirim Hub-enum gaya APA ADANYA ke iframe (arena menormalisasi
 * lewat `normalizeStyle` — EMBED-CONTRACT §5). Server memakai objek yang
 * PERSIS SAMA untuk verifikasi (`verifyFightResult`), jadi objek ini
 * disimpan utuh di `GameFight.config` saat challenge diterima.
 */
import { STYLES, movesFor, normalizeStyle } from '../fight-engine/moves.js';
import type { EngineFighter } from '../fight-engine/verify';
import {
  GLOVES_TYPE_MAP,
  SHOES_MODEL_MAP,
  resolveAccessories,
  type FighterAccessories,
} from './accessories';

export type { FighterAccessories };

export type Tempo = 'agresif' | 'seimbang' | 'bertahan';
export const TEMPOS: Tempo[] = ['agresif', 'seimbang', 'bertahan'];

export const ARENA_MAPS = ['ring', 'gudang', 'jalanan', 'dojo'] as const;
export type ArenaMap = (typeof ARENA_MAPS)[number];

export const FIGHT_DURATION_SEC = 60;

/** Warna badan default per gaya (cermin STYLE_COLORS di components/api.ts). */
export const DEFAULT_BODY_COLORS: Record<string, string> = {
  boxing: '#f5a623',
  taekwondo: '#22d3ee',
  'muay-thai': '#ef4444',
  street: '#f97316',
  karate: '#eab308',
  silat: '#a78bfa',
  wrestling: '#34d399',
  other: '#f5a623',
  'kali-arnis': '#fb923c',
  judo: '#38bdf8',
  kudo: '#f43f5e',
  'jeet-kune-do': '#facc15',
  capoeira: '#4ade80',
  wushu: '#c084fc',
  'kung-fu': '#c084fc',
};

export interface FighterColors {
  body: string;
  gloves: string;
  shoes: string;
  belt: string;
  headband: string;
  weapon: string;
}

export const DEFAULT_FIGHTER_COLORS: FighterColors = {
  body: '#f5a623',
  gloves: '#141210',
  shoes: '#FBF8F1',
  belt: 'none',
  headband: 'none',
  weapon: '#8B5E34',
};

export interface FighterLike {
  displayName: string;
  style: string;
  signatureMove?: string | null;
  tempo?: string | null;
  colors?: Partial<FighterColors> | null;
  /** Aksesoris tersimpan (partial) — kosong = fallback turunan warna. */
  accessories?: Partial<FighterAccessories> | null;
}

/** Warna lengkap fighter (default per gaya + override tersimpan). */
export function resolveFighterColors(f: FighterLike): FighterColors {
  const base = DEFAULT_BODY_COLORS[f.style] ?? DEFAULT_BODY_COLORS.other;
  return {
    body: f.colors?.body ?? base,
    gloves: f.colors?.gloves ?? DEFAULT_FIGHTER_COLORS.gloves,
    shoes: f.colors?.shoes ?? DEFAULT_FIGHTER_COLORS.shoes,
    belt: f.colors?.belt ?? DEFAULT_FIGHTER_COLORS.belt,
    headband: f.colors?.headband ?? DEFAULT_FIGHTER_COLORS.headband,
    weapon: f.colors?.weapon ?? DEFAULT_FIGHTER_COLORS.weapon,
  };
}

/**
 * Aksesoris lengkap fighter: pilihan tersimpan (partial) + fallback
 * turunan warna untuk bagian yang belum dipilih (aturan katalog:
 * headband/sabuk/senjata mengikuti apakah warnanya terpasang,
 * tangan = boxing, kaki = sneakers, badan = tanpa baju).
 * Fighter lama tanpa `accessories` mendapat default turunan ini.
 */
export function resolveFighterAccessories(f: FighterLike): FighterAccessories {
  return resolveAccessories(f.accessories, {
    headband: f.colors?.headband,
    belt: f.colors?.belt,
    weapon: f.colors?.weapon,
  });
}

/**
 * Bangun objek fighter engine dari dokumen Fighter.
 * - `style`: Hub-enum apa adanya (arena yang memetakan).
 * - `weapon`: selalu `{ kind: 'none' }` — game Hub tanpa senjata kayu
 *   (event ambil kayu hanya preset khusus arena, dimatikan di Hub).
 *   Aksesoris senjata HANYA visual (preview + arena render), move pool
 *   engine tidak berubah.
 * - `accessories`: hasil resolve (selalu lengkap 6 bagian).
 * - `gloves`/`shoes`: pemetaan legacy dari varian tangan/kaki.
 * - `signatureMove`/`tempo`: hanya disertakan kalau valid/terisi.
 */
export function toEngineFighter(f: FighterLike): EngineFighter {
  const colors = resolveFighterColors(f);
  const accessories = resolveFighterAccessories(f);
  const out: EngineFighter = {
    name: f.displayName.slice(0, 18),
    color: colors.body,
    style: f.style,
    colors,
    accessories,
    gloves: { type: GLOVES_TYPE_MAP[accessories.hands] ?? 'boxing' },
    shoes: { model: SHOES_MODEL_MAP[accessories.feet] ?? 'sneakers' },
    weapon: { kind: 'none', hand: 'right', color: colors.weapon },
  };
  if (f.signatureMove) out.signatureMove = f.signatureMove;
  if (f.tempo === 'agresif' || f.tempo === 'bertahan' || f.tempo === 'seimbang') {
    out.tempo = f.tempo;
  }
  return out;
}

/** Daftar jurus khas yang bisa dipilih untuk satu gaya Hub (dari moves.js yang di-vendor). */
export function signatureMoveOptions(hubStyle: string): { kind: string; label: string }[] {
  const engineKey = normalizeStyle(hubStyle) as keyof typeof STYLES;
  const styleDef = (STYLES as Record<string, { moves: { kind: string; label: string }[] } | undefined>)[engineKey];
  if (!styleDef) return [];
  // movesFor menyaring gerakan tongkat + finisher; feint juga tidak bisa
  // jadi jurus khas (director mengabaikan feint).
  const usable = new Set(
    movesFor({ style: hubStyle, weapon: { kind: 'none' } } as never).map(
      (m: { kind: string }) => m.kind,
    ),
  );
  return styleDef.moves
    .filter((m) => usable.has(m.kind) && m.kind !== 'feint')
    .map((m) => ({ kind: m.kind, label: m.label }));
}

/** Apakah `kind` jurus khas yang valid untuk gaya ini? */
export function isValidSignatureMove(hubStyle: string, kind: string): boolean {
  return signatureMoveOptions(hubStyle).some((o) => o.kind === kind);
}
