/**
 * move-meta.ts — Lookup metadata jurus untuk UI (preview, deck, testing).
 *
 * Murni + ter-tes: tidak menyentuh DB, tidak mengubah aturan bisnis.
 * Satu-satunya sumber kebenaran katalog adalah STYLES di moves.js
 * (label, dmg, target, note teknik); warna cincin spesial dari
 * SPECIAL_FX di public/arena/js/special-fx.js; keyframe dari
 * TECHNIQUE_KEYS di fight-engine/techniques.js.
 *
 * Perbedaan penting:
 * - `isSpecialKind(kind)` = kind PUNYA profil FX di special-fx.js
 *   (57 kind) ATAU finisher ATAU bisa jadi signature move satu gaya.
 *   Ini metadata — BUKAN aturan tampilnya efek cincin.
 * - Efek cincin di preview mengikuti aturan film.js `specialForAttack`:
 *   tampil hanya untuk kind finisher ATAU kind yang dipasang sebagai
 *   jurus khas (prop `isSpecial`/`signature` di MovePreview).
 */
import { FINISHER_KINDS, STYLES, normalizeStyle } from '../fight-engine/moves.js';
import { TECHNIQUE_KEYS } from '../fight-engine/techniques.js';
import {
  SPECIAL_FX,
  isFinisherKind,
  specialProfileFor,
} from '../../../public/arena/js/special-fx.js';
import { signatureMoveOptions } from './engine-config';

type StyleMove = {
  kind: string;
  label: string;
  dmg: number;
  range: string;
  power: number;
  target: string;
  note: string;
};

type StyleDef = { label: string; moves: StyleMove[] };

const STYLES_TYPED = STYLES as unknown as Record<string, StyleDef>;
const SPECIAL_FX_TYPED = SPECIAL_FX as unknown as Record<
  string,
  { ringColor: string; ringSize: number } | undefined
>;
const TECHNIQUE_KEYS_TYPED = TECHNIQUE_KEYS as unknown as Record<
  string,
  unknown
>;

export interface MoveMeta {
  kind: string;
  label: string;
  /** Kunci gaya engine pertama yang memiliki kind ini ('' kalau tak dikenal). */
  style: string;
  styleLabel: string;
  /** Catatan teknik singkat dari moves.js ('' kalau tak dikenal). */
  note: string;
  dmg: number;
  target: string;
  power: number;
  /** Punya profil FX di special-fx.js / finisher / bisa jadi signature. */
  isSpecial: boolean;
  /** false = kind tidak ada di katalog STYLES (fallback aman dipakai). */
  found: boolean;
}

/** Label Bahasa Indonesia untuk target serangan. */
export const TARGET_LABELS: Record<string, string> = {
  head: 'Kepala',
  body: 'Badan',
  leg: 'Kaki',
};

export function targetLabel(target: string): string {
  return TARGET_LABELS[target] ?? target ?? '-';
}

/** Fallback aman untuk kind yang tidak ada di katalog. */
export function fallbackMoveMeta(kind: string): MoveMeta {
  return {
    kind,
    label: kind || 'Jurus tak dikenal',
    style: '',
    styleLabel: '',
    note: '',
    dmg: 0,
    target: '',
    power: 0,
    isSpecial: false,
    found: false,
  };
}

/**
 * Metadata satu jurus. Kind dicari di gaya pertama (urutan STYLES)
 * yang memilikinya — label/style/note bisa beda antar gaya untuk kind
 * yang sama (mis. 'jab' Tinju vs Muay Thai), jadi yang dipakai adalah
 * definisi pertama.
 */
export function getMoveMeta(kind: unknown): MoveMeta {
  if (typeof kind !== 'string' || !kind) return fallbackMoveMeta('');
  for (const [styleKey, def] of Object.entries(STYLES_TYPED)) {
    if (!def || !Array.isArray(def.moves)) continue;
    const m = def.moves.find((mv) => mv && mv.kind === kind);
    if (!m) continue;
    return {
      kind,
      label: m.label || kind,
      style: styleKey,
      styleLabel: def.label || styleKey,
      note: m.note || '',
      dmg: typeof m.dmg === 'number' ? m.dmg : 0,
      target: m.target || '',
      power: typeof m.power === 'number' ? m.power : 0,
      isSpecial: isSpecialKind(kind),
      found: true,
    };
  }
  return fallbackMoveMeta(kind);
}

/**
 * Apakah kind ini punya profil jurus spesial? true kalau ada di
 * SPECIAL_FX, ATAU kind finisher, ATAU bisa dipilih jadi signature
 * move untuk satu gaya mana pun.
 */
export function isSpecialKind(kind: unknown): boolean {
  if (typeof kind !== 'string' || !kind) return false;
  if (SPECIAL_FX_TYPED[kind]) return true;
  if ((FINISHER_KINDS as unknown as Set<string>).has(kind)) return true;
  if (isFinisherKind(kind)) return true;
  for (const styleKey of Object.keys(STYLES_TYPED)) {
    if (signatureMoveOptions(styleKey).some((o) => o.kind === kind)) {
      return true;
    }
  }
  return false;
}

/** Apakah kind ini kind finisher (cincin merah dsb. — aturan film.js)? */
export function isFinisherMove(kind: unknown): boolean {
  if (typeof kind !== 'string' || !kind) return false;
  return isFinisherKind(kind);
}

/**
 * Warna + ukuran cincin impact dari special-fx.js, atau null kalau
 * kind tidak punya profil FX. Dipakai MovePreview untuk efek ring.
 */
export function getSpecialRing(
  kind: unknown,
): { ringColor: string; ringSize: number } | null {
  if (typeof kind !== 'string' || !kind) return null;
  const p = specialProfileFor(kind) as {
    ringColor: string;
    ringSize: number;
  } | null;
  if (!p) return null;
  return { ringColor: p.ringColor, ringSize: p.ringSize };
}

/** Apakah kind ini punya keyframe teknik (bisa dianimasikan preview)? */
export function hasTechniqueKeys(kind: unknown): boolean {
  if (typeof kind !== 'string' || !kind) return false;
  return Boolean(TECHNIQUE_KEYS_TYPED[kind]);
}

/**
 * Semua jurus satu gaya (Hub enum / engine key / tak dikenal → brawler),
 * sebagai MoveMeta — dipakai galeri preview testing-training.
 */
export function movesForStyle(style: unknown): MoveMeta[] {
  const key = normalizeStyle(typeof style === 'string' ? style : '');
  const def = STYLES_TYPED[key];
  if (!def || !Array.isArray(def.moves)) return [];
  return def.moves.map((m) => getMoveMeta(m.kind));
}
