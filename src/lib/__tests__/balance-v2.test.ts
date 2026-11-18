/**
 * Balance v2 (2026-11-18) — deck counter + skor matchup + determinisme.
 * Prinsip user: stat KECIL, counter (deck + gaya) yang menentukan,
 * TIDAK ADA hoki (pemenang dari skor, bukan lotere).
 */
import { describe, expect, it } from 'vitest';
import { buildFight as buildFightHub } from '../fight-engine/fight.js';
import { buildFight as buildFightArena } from '../../../public/arena/js/fight.js';
import {
  coverage,
  dominantThreat,
} from '../game/deck-counters';
import {
  buildFightOpts,
  matchupScoreV2,
  type Gameplan,
  type Stats,
} from '../game/stat-effects';

function at(level: number): Stats {
  return { power: level, speed: level, stamina: level, defense: level, accuracy: level };
}
const S10: Stats = at(10);
const SEIMBANG: Gameplan = { tempo: 'seimbang', focus: 'balanced' };
const NO_DECK = { cards: [], signature: null };
const DECK_KUAT = {
  cards: ['headkick', 'roundhouse', 'uppercut', 'hook', 'bodykick', 'lowkick'],
  signature: 'flyknee',
};
const DECK_ANTI_KICK = {
  cards: ['takedown', 'doubleleg', 'clinch', 'lowkick', 'sweep', 'singleleg'],
  signature: 'suplex',
};

describe('deck counter — ancaman dominan + coverage', () => {
  it('deck tendangan dominan = KICK', () => {
    expect(dominantThreat(DECK_KUAT)).toBe('KICK');
  });

  it('deck anti-kick dominan = GRAPPLE', () => {
    expect(dominantThreat(DECK_ANTI_KICK)).toBe('GRAPPLE');
  });

  it('seri keluarga / deck kosong = tidak ada ancaman (null)', () => {
    expect(
      dominantThreat({ cards: ['headkick', 'lowkick', 'jab', 'cross'], signature: null }),
    ).toBe(null);
    expect(dominantThreat(NO_DECK)).toBe(null);
    expect(dominantThreat(null)).toBe(null);
  });

  it('coverage: deck anti-kick menjawab ancaman KICK penuh (7/7)', () => {
    expect(coverage(DECK_ANTI_KICK, 'KICK')).toBeCloseTo(1, 10);
  });

  it('coverage: deck kuat hanya menjawab GRAPPLE 2/7 (uppercut + flyknee)', () => {
    expect(coverage(DECK_KUAT, 'GRAPPLE')).toBeCloseTo(2 / 7, 10);
  });

  it('coverage tanpa ancaman = 0', () => {
    expect(coverage(DECK_KUAT, null)).toBe(0);
    expect(coverage(NO_DECK, 'KICK')).toBe(0);
  });
});

describe('matchupScoreV2 — komponen + cap', () => {
  it('stat sama + gaya sama + deck sama + tempo sama = 0', () => {
    const s = matchupScoreV2(S10, S10, 'muaythai', 'muaythai', DECK_KUAT, DECK_KUAT, 'seimbang', 'seimbang');
    expect(s.total).toBe(0);
    expect(s).toEqual({ stat: 0, style: 0, deck: 0, gameplan: 0, total: 0 });
  });

  it('100v10 tanpa counter: stat ≈ +0,047 (tanh, bukan linear)', () => {
    const s = matchupScoreV2(at(100), at(10), 'tinju', 'tinju', DECK_KUAT, DECK_KUAT, 'seimbang', 'seimbang');
    expect(s.stat).toBeCloseTo(0.047, 2);
    expect(s.total).toBeCloseTo(0.047, 2);
  });

  it('30v10 tanpa counter: stat ≈ +0,021', () => {
    const s = matchupScoreV2(at(30), at(10), 'tinju', 'tinju', DECK_KUAT, DECK_KUAT, 'seimbang', 'seimbang');
    expect(s.stat).toBeCloseTo(0.021, 2);
  });

  it('gaya: gulat vs tinju = (1,08 − 0,95) × 0,3 ≈ +0,039', () => {
    const s = matchupScoreV2(S10, S10, 'gulat', 'tinju', NO_DECK, NO_DECK, 'seimbang', 'seimbang');
    expect(s.style).toBeCloseTo(0.039, 3);
  });

  it('counter lengkap: stat 30 + gulat anti-kick vs stat 50 tinju ≈ +0,046', () => {
    const s = matchupScoreV2(
      at(30),
      at(50),
      'gulat',
      'tinju',
      DECK_ANTI_KICK,
      DECK_KUAT,
      'seimbang',
      'seimbang',
    );
    expect(s.stat).toBeCloseTo(-0.021, 2);
    expect(s.style).toBeCloseTo(0.039, 3);
    expect(s.deck).toBeCloseTo(0.029, 2);
    expect(s.total).toBeCloseTo(0.046, 2);
  });

  it('gameplan: bertahan > agresif (+0,015), agresif < bertahan (−0,015)', () => {
    const a = matchupScoreV2(S10, S10, null, null, NO_DECK, NO_DECK, 'bertahan', 'agresif');
    const b = matchupScoreV2(S10, S10, null, null, NO_DECK, NO_DECK, 'agresif', 'bertahan');
    expect(a.gameplan).toBe(0.015);
    expect(b.gameplan).toBe(-0.015);
  });

  it('total tidak pernah melewati cap ±0,15', () => {
    const s = matchupScoreV2(
      at(100),
      at(10),
      'gulat',
      'tinju',
      DECK_ANTI_KICK,
      NO_DECK,
      'bertahan',
      'agresif',
    );
    expect(Math.abs(s.total)).toBeLessThanOrEqual(0.15);
  });
});

describe('buildFightOpts v2 — skor + geser KD', () => {
  it('stat 10 + deck kosong + seimbang = matchupScore 0', () => {
    const o = buildFightOpts(S10, S10, NO_DECK, NO_DECK, SEIMBANG, SEIMBANG);
    expect(o.matchupScore).toBe(0);
  });

  it('counter menggeser powerEff exchange (KD selaras pemenang skor)', () => {
    const o = buildFightOpts(
      at(30),
      at(50),
      DECK_ANTI_KICK,
      DECK_KUAT,
      SEIMBANG,
      SEIMBANG,
      'gulat',
      'tinju',
    );
    expect(o.matchupScore).toBeCloseTo(0.046, 2);
    // Geser = (gaya 0,039 + deck 0,029) × 600 ≈ +41 untuk R, −41 untuk B.
    expect(o.statMods.R.powerEff).toBeGreaterThan(30);
    expect(o.statMods.B.powerEff).toBeLessThan(50);
    expect(o.statMods.R.powerEff).toBeCloseTo(71, 0);
    expect(o.statMods.B.powerEff).toBeCloseTo(9, 0);
  });

  it('tanpa counter, powerEff = stat efektif mentah (tanpa geser)', () => {
    const o = buildFightOpts(at(30), at(10), DECK_KUAT, DECK_KUAT, SEIMBANG, SEIMBANG, 'tinju', 'tinju');
    expect(o.statMods.R.powerEff).toBe(30);
    expect(o.statMods.B.powerEff).toBe(10);
  });
});

describe('balance v2 end-to-end — determinisme + counter kalahkan stat', () => {
  const LEFT = { name: 'Merah', color: '#ef4444', style: 'gulat', tempo: 'seimbang' };
  const RIGHT = { name: 'Biru', color: '#3b82f6', style: 'tinju', tempo: 'seimbang' };

  it('seed + config sama → hasil sama persis di kedua copy engine', () => {
    const o = buildFightOpts(at(30), at(50), DECK_ANTI_KICK, DECK_KUAT, SEIMBANG, SEIMBANG, 'gulat', 'tinju');
    const a = buildFightHub(LEFT, RIGHT, 60, 777, o);
    const b = buildFightHub(LEFT, RIGHT, 60, 777, o);
    const c = buildFightArena(LEFT, RIGHT, 60, 777, o);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('counter (stat 30 + gulat anti-kick) kalahkan stat 50 (N=300)', () => {
    const o = buildFightOpts(at(30), at(50), DECK_ANTI_KICK, DECK_KUAT, SEIMBANG, SEIMBANG, 'gulat', 'tinju');
    let winR = 0;
    const N = 300;
    for (let s = 1; s <= N; s++) {
      const f = buildFightHub(LEFT, RIGHT, 60, s, o);
      if (f.winner === 'R') winR++;
    }
    // Teori: skor +0,046 → P(menang | non-draw) = (0,046+0,10)/0,20 = 73%
    // → winR ≈ 66%. Batas bawah longgar 55%.
    expect(winR / N).toBeGreaterThan(0.55);
  });
});
