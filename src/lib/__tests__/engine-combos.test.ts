import { describe, expect, it } from 'vitest';
import {
  COMBO_DEFS as COMBO_DEFS_HUB,
  buildFight as buildFightHub,
  detectCombo as detectComboHub,
} from '../fight-engine/fight.js';
import {
  COMBO_DEFS as COMBO_DEFS_ARENA,
  buildFight as buildFightArena,
  detectCombo as detectComboArena,
} from '../../../public/arena/js/fight.js';
import { COMBOS, detectCombo as detectComboTS } from '../game/combos';
import {
  buildFightOpts,
  type Gameplan,
  type Stats,
} from '../game/stat-effects';
import type { EngineFighter } from '../fight-engine/verify';

const LEFT: EngineFighter = {
  name: 'Petarung A',
  color: '#ef4444',
  style: 'tinju',
  tempo: 'seimbang',
};
const RIGHT: EngineFighter = {
  name: 'Petarung B',
  color: '#3b82f6',
  style: 'tinju',
  tempo: 'seimbang',
};
const DURATION = 60;
const SEIMBANG: Gameplan = { tempo: 'seimbang', focus: 'balanced' };
const S10: Stats = { power: 10, speed: 10, stamina: 10, defense: 10, accuracy: 10 };
const NO_DECK = { cards: [], signature: null };

type Attack = { combo?: string; outcome: string; kind: string; power: number };
const attacksOf = (f: unknown) =>
  (f as { attacks: Attack[] }).attacks;

describe('kombo: paritas tabel fight.js vs combos.ts', () => {
  it('COMBO_DEFS kedua copy fight.js identik dengan COMBOS (urutan/nama/bonus)', () => {
    const norm = (defs: { sequence: string[]; name: string; bonusPct: number }[]) =>
      defs.map((d) => ({ sequence: d.sequence, name: d.name, bonusPct: d.bonusPct }));
    expect(norm(COMBO_DEFS_HUB)).toEqual(norm(COMBOS));
    expect(norm(COMBO_DEFS_ARENA)).toEqual(norm(COMBOS));
  });

  it('detectCombo fight.js == detectCombo combos.ts untuk semua history uji', () => {
    const histories: string[][] = [
      [],
      ['jab'],
      ['jab', 'cross'],
      ['jab', 'cross', 'hook'],
      ['jab', 'jab', 'cross'],
      ['lowkick', 'bodykick', 'headkick'],
      ['doubleleg', 'suplex'],
      ['cross', 'hook', 'uppercut'],
      ['takedown', 'bodyslam'],
      ['hook', 'jab', 'cross', 'hook'],
      ['jab', 'cross', 'hook', 'uppercut'],
      ['jab', 'jab', 'jab'],
      ['ginga', 'jab', 'cross', 'hook'],
      ['jab', 'cross', 'hook', 'jab', 'cross', 'hook'],
      ['lowkick', 'lowkick', 'bodykick', 'headkick'],
    ];
    for (const h of histories) {
      expect(detectComboHub(h)).toEqual(detectComboTS(h));
      expect(detectComboArena(h)).toEqual(detectComboTS(h));
    }
  });

  it('kombo terpanjang menang (jab→cross→hook mengalahkan Satu-Dua di akhir yang sama)', () => {
    // ['jab','jab','cross','hook']: suffix 3 = jab,cross,hook (Kilat);
    // suffix 2 tidak cocok dengan kombo 2-gerakan mana pun.
    expect(detectComboHub(['jab', 'jab', 'cross', 'hook'])?.name).toBe('Kombo Kilat');
    expect(detectComboHub(['jab', 'jab', 'cross'])?.name).toBe('Kombo Satu-Dua');
  });
});

describe('kombo: deteksi live di buildFight', () => {
  /** Bobot ekstrem supaya R hampir selalu melempar jab/cross/hook. */
  function kilatOpts() {
    const o = buildFightOpts(S10, S10, NO_DECK, NO_DECK, SEIMBANG, SEIMBANG);
    o.weights.R = { jab: 50, cross: 50, hook: 50 };
    return o;
  }

  it('Kombo Kilat benar-benar terjadi di fight nyata (seed 1..30)', () => {
    let foundSeed: number | null = null;
    for (let seed = 1; seed <= 30; seed++) {
      const f = buildFightHub(LEFT, RIGHT, DURATION, seed, kilatOpts());
      if (attacksOf(f).some((a) => a.combo === 'Kombo Kilat')) {
        foundSeed = seed;
        break;
      }
    }
    expect(foundSeed).not.toBeNull();
  });

  it('label kombo hanya pada hit yang mendarat + hasil deterministik', () => {
    const opts = kilatOpts();
    const f1 = buildFightHub(LEFT, RIGHT, DURATION, 7, opts);
    const f2 = buildFightHub(LEFT, RIGHT, DURATION, 7, opts);
    const fArena = buildFightArena(LEFT, RIGHT, DURATION, 7, opts);
    // Seed + opts sama → serangan identik di kedua copy (termasuk kombo).
    expect(attacksOf(f1)).toEqual(attacksOf(f2));
    expect(attacksOf(f1)).toEqual(attacksOf(fArena));
    for (const a of attacksOf(f1)) {
      if (a.combo) expect(a.outcome).toBe('hit');
    }
  });

  it('tanpa kombo, fight netral tidak berubah (tidak ada label kombo acak)', () => {
    // Tinju tanpa bobot ekstrem: kombo tetap BISA terjadi secara alami,
    // tapi label yang muncul harus selalu nama kombo yang valid.
    const valid = new Set(COMBOS.map((c) => c.name));
    const opts = buildFightOpts(S10, S10, NO_DECK, NO_DECK, SEIMBANG, SEIMBANG);
    for (let seed = 1; seed <= 5; seed++) {
      const f = buildFightHub(LEFT, RIGHT, DURATION, seed, opts);
      for (const a of attacksOf(f)) {
        if (a.combo) expect(valid.has(a.combo)).toBe(true);
      }
    }
  });
});
