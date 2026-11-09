/**
 * Konfigurasi training/testing sandbox (/testing-training).
 *
 * Halaman training membangun config embed Arena (EMBED-CONTRACT §3)
 * dari DUA setup yang dipilih owner — tanpa login, tanpa challenge,
 * tanpa GameFight, tanpa catatan apa pun di database. Config yang
 * dihasilkan PERSIS seperti config fight normal (toEngineFighter yang
 * sama dengan challenge): Hub-enum gaya dikirim apa adanya, arena yang
 * memetakan ke engine-key lewat normalizeStyle.
 *
 * Pure module — aman di-import dari client component (pola yang sama
 * dengan FighterSayaForm yang meng-import engine-config).
 */
import { normalizeStyle } from '../fight-engine/moves.js';
import type { EngineFighter } from '../fight-engine/verify';
import {
  ARENA_MAPS,
  FIGHT_DURATION_SEC,
  TEMPOS,
  toEngineFighter,
  type Tempo,
} from './engine-config';

export type { Tempo };

/** Daftar gaya Hub — CERMIN STYLE_LABELS di components/api.ts. */
export const TRAINING_STYLES: string[] = [
  'boxing',
  'taekwondo',
  'muay-thai',
  'street',
  'karate',
  'silat',
  'wrestling',
  'other',
  'kali-arnis',
  'judo',
  'kudo',
  'jeet-kune-do',
  'capoeira',
  'wushu',
  'kung-fu',
];

export type TrainingSide = 'left' | 'right';

export interface TrainingSideSetup {
  style: string;
  tempo: Tempo;
}

export interface TrainingSetup {
  left: TrainingSideSetup;
  right: TrainingSideSetup;
  map: string;
  /** Teks seed mentah dari input (boleh kosong = acak). */
  seedInput: string;
}

/** Config sfa-config yang dikirim ke iframe arena (EMBED-CONTRACT §3). */
export interface TrainingSfaConfig {
  type: 'sfa-config';
  fightId: string;
  fighters: { left: EngineFighter; right: EngineFighter };
  seed: number;
  map: string;
  duration: number;
}

/** Seed uint32 hasil hash FNV-1a — deterministik per teks. */
function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Parse input seed: kosong → null (acak saat fight dimulai);
 * bilangan bulat → nilainya (abs, dipotong ke uint32);
 * teks lain → hash FNV-1a (teks yang sama = seed yang sama).
 */
export function parseTrainingSeed(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  if (/^-?\d+$/.test(t)) {
    const n = Number(t);
    if (Number.isSafeInteger(n)) return Math.abs(n) % 0x100000000;
    // Bilangan terlalu besar untuk safe integer — hash teksnya saja.
    return fnv1a32(t);
  }
  return fnv1a32(t);
}

/**
 * Seed yang dipakai fight: hasil parse input, atau acak bila input kosong.
 * `randomSeed` bisa di-inject di tes supaya deterministik.
 */
export function resolveTrainingSeed(
  input: string,
  randomSeed: () => number = () =>
    Math.floor(Math.random() * 0x100000000),
): number {
  return parseTrainingSeed(input) ?? randomSeed();
}

/** Nama tampil di arena: kiri = Merah, kanan = Biru. */
export function trainingFighterName(side: TrainingSide): string {
  return side === 'left' ? 'Merah' : 'Biru';
}

/**
 * Bangun objek fighter engine untuk satu sisi training.
 * Warna badan = default per gaya (seperti fighter baru di form),
 * tanpa jurus khas — engine memakai bobot default.
 * Mirror match (gaya sama di kedua sisi) dibolehkan: nama tetap beda.
 */
export function buildTrainingFighter(
  side: TrainingSide,
  style: string,
  tempo: Tempo,
): EngineFighter {
  return toEngineFighter({
    displayName: trainingFighterName(side),
    style,
    tempo,
  });
}

/**
 * Bangun sfa-config lengkap untuk satu fight training.
 * - fightId sintetis "training-<seed>" (tidak pernah dikirim ke API).
 * - duration 60 detik seperti match normal (FIGHT_DURATION_SEC).
 * - TANPA `opts`: tempo menumpang di objek fighter (seperti config
 *   GameFight produksi — EMBED-CONTRACT §6: Hub tidak mengirim opts).
 */
export function buildTrainingConfig(
  setup: TrainingSetup,
  seed: number,
): TrainingSfaConfig {
  return {
    type: 'sfa-config',
    fightId: `training-${seed}`,
    fighters: {
      left: buildTrainingFighter('left', setup.left.style, setup.left.tempo),
      right: buildTrainingFighter(
        'right',
        setup.right.style,
        setup.right.tempo,
      ),
    },
    seed,
    map: setup.map,
    duration: FIGHT_DURATION_SEC,
  };
}

/** Engine-key hasil pemetaan gaya Hub (arena yang memetakan). */
export function engineKeyForStyle(style: string): string {
  return normalizeStyle(style);
}

export function isValidTrainingStyle(style: string): boolean {
  return TRAINING_STYLES.includes(style);
}

export function isValidTrainingMap(map: string): boolean {
  return (ARENA_MAPS as readonly string[]).includes(map);
}

export function isValidTrainingTempo(tempo: string): tempo is Tempo {
  return (TEMPOS as readonly string[]).includes(tempo);
}
