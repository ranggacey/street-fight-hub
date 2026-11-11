/**
 * Validasi deck jurus (6 kartu + signature di luar deck).
 *
 * Aturan (skema yang disetujui 2026-11-10):
 * - Maks 6 kartu, tiap kartu = satu kind gerakan yang ADA di STYLES
 *   moves.js untuk gaya APA PUN (tidak dibatasi gaya fighter sendiri).
 * - Kartu tidak boleh duplikat.
 * - Yang TIDAK boleh jadi kartu: 'finisher' (hanya dipanggil director
 *   di akhir jalur KO), 'feint'/'ginga' (bukan serangan), gerakan
 *   senjata kayu (stickswing/stickchop — fighter Hub tidak pegang kayu).
 * - Signature (Fighter.signatureMove) berada DI LUAR deck, 1x/fight
 *   (bobot 2,5x di engine); kind signature tidak boleh juga ada di
 *   kartu deck.
 */
import { badRequest } from '../http';
import { STYLES, WEAPON_MOVES } from '../fight-engine/moves.js';

export const DECK_MAX_CARDS = 6;

/**
 * Apakah fighter "punya deck"? Definisi gate tarung (/tantangan):
 * deck = kartu, jadi cards.length > 0. Signature saja (tanpa kartu)
 * TIDAK dihitung punya deck — kartu yang dipakai engine 2x lebih
 * sering di fight, signature hanya 1x/fight dan berada di luar deck.
 *
 * Nilai non-array (null/undefined) = tidak punya deck. Pemanggil di
 * client (TantanganClient) memperlakukan fetch deck yang GAGAL sebagai
 * fail-open (dianggap punya deck) supaya gate tidak memblokir saat
 * jaringan bermasalah — gate ini hanya UX, server tidak menegakkannya.
 */
export function hasDeck(cards: unknown): boolean {
  return Array.isArray(cards) && cards.length > 0;
}

/** Kind yang tidak pernah boleh masuk deck (alasan di header file). */
export const DECK_EXCLUDED_KINDS = new Set(['finisher', 'feint', 'ginga']);

export interface MoveKindOption {
  kind: string;
  label: string;
  /** Gaya pertama yang memiliki kind ini (untuk label di UI). */
  style: string;
  styleLabel: string;
  /** Catatan teknik singkat dari moves.js (satu baris, utk kartu deck). */
  note?: string;
}

type StyleDef = { label: string; moves: { kind: string; label: string; note?: string }[] };

/** Semua kind yang boleh jadi kartu deck (unik per kind, urut abjad kind). */
export function allDeckKinds(): MoveKindOption[] {
  const seen = new Map<string, MoveKindOption>();
  const styles = STYLES as Record<string, StyleDef>;
  for (const [styleKey, def] of Object.entries(styles)) {
    if (!def || !Array.isArray(def.moves)) continue;
    for (const m of def.moves) {
      if (!m || typeof m.kind !== 'string') continue;
      if (DECK_EXCLUDED_KINDS.has(m.kind)) continue;
      if (WEAPON_MOVES.has(m.kind)) continue;
      if (!seen.has(m.kind)) {
        seen.set(m.kind, {
          kind: m.kind,
          label: m.label || m.kind,
          style: styleKey,
          styleLabel: def.label || styleKey,
          note: m.note,
        });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.kind.localeCompare(b.kind));
}

/** Apakah kind ini boleh jadi kartu deck? */
export function isDeckCardKind(kind: unknown): boolean {
  if (typeof kind !== 'string' || !kind) return false;
  if (DECK_EXCLUDED_KINDS.has(kind)) return false;
  if (WEAPON_MOVES.has(kind)) return false;
  const styles = STYLES as Record<string, StyleDef>;
  for (const def of Object.values(styles)) {
    if (def?.moves?.some((m) => m.kind === kind)) return true;
  }
  return false;
}

/**
 * Validasi daftar kartu deck. Mengembalikan kartu yang sudah dibersihkan
 * (trim). Throw HttpError 400 bila tidak valid.
 */
export function validateDeckCards(input: unknown): string[] {
  if (!Array.isArray(input)) {
    throw badRequest('Deck harus berupa daftar jurus');
  }
  if (input.length > DECK_MAX_CARDS) {
    throw badRequest(`Deck maksimal ${DECK_MAX_CARDS} kartu`);
  }
  const cards: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string' || !raw.trim()) {
      throw badRequest('Tiap kartu deck harus berupa nama jurus');
    }
    const kind = raw.trim();
    if (!isDeckCardKind(kind)) {
      throw badRequest(`Jurus tidak dikenal / tidak boleh jadi kartu deck: ${kind}`);
    }
    if (cards.includes(kind)) {
      throw badRequest(`Jurus duplikat di deck: ${kind}`);
    }
    cards.push(kind);
  }
  return cards;
}

/**
 * Validasi pasangan kartu + signature. Signature tidak boleh duplikat
 * dengan kartu (signature sudah di luar deck).
 */
export function validateDeckWithSignature(
  cards: string[],
  signature: string | null,
): void {
  if (signature && cards.includes(signature)) {
    throw badRequest(
      'Jurus khas (signature) tidak boleh juga ada di kartu deck — signature sudah di luar deck',
    );
  }
}
