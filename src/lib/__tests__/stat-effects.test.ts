import { describe, expect, it } from 'vitest';
import {
  buildFightOpts,
  deckStrength,
  defaultStats,
  effectiveStat,
  effectiveStats,
  knockdownProb,
  NO_DECK_STRENGTH,
  normalizeGameplan,
  statModsFor,
  staminaPoolFor,
  winBiasFromStats,
  WIN_BIAS_MAX,
  type DeckInput,
  type Gameplan,
  type Stats,
} from '../game/stat-effects';

const S10: Stats = { power: 10, speed: 10, stamina: 10, defense: 10, accuracy: 10 };

function at(level: number): Stats {
  return { power: level, speed: level, stamina: level, defense: level, accuracy: level };
}

describe('effectiveStat — diminishing returns di atas 80', () => {
  it('<= 80: nilai mentah', () => {
    expect(effectiveStat(10)).toBe(10);
    expect(effectiveStat(50)).toBe(50);
    expect(effectiveStat(80)).toBe(80);
  });

  it('> 80: tiap poin dihitung setengah', () => {
    expect(effectiveStat(81)).toBe(80.5);
    expect(effectiveStat(90)).toBe(85);
    expect(effectiveStat(100)).toBe(90);
  });

  it('dibatasi 10..100', () => {
    expect(effectiveStat(5)).toBe(10);
    expect(effectiveStat(150)).toBe(90);
  });

  it('effectiveStats memetakan semua stat', () => {
    expect(effectiveStats(at(90))).toEqual(at(85));
    expect(effectiveStats(S10)).toEqual(S10);
  });
});

describe('statModsFor — efek per poin (relatif terhadap dasar 10)', () => {
  it('stat 10 semua = netral', () => {
    const m = statModsFor(S10);
    expect(m.dmgMul).toBe(1);
    expect(m.dmgTakenMul).toBe(1);
    expect(m.dodgeBonus).toBe(0);
    expect(m.blockBonus).toBe(0);
    expect(m.hitBonus).toBe(0);
    expect(m.attackSpeedMul).toBe(1);
    expect(m.fatigueRate).toBe(1);
  });

  it('Power 30 → +20% damage', () => {
    expect(statModsFor({ ...S10, power: 30 }).dmgMul).toBeCloseTo(1.2, 10);
  });

  it('Power 100 (efektif 90) → +80% damage', () => {
    expect(statModsFor({ ...S10, power: 100 }).dmgMul).toBeCloseTo(1.8, 10);
  });

  it('Defense 30 → -20% damage diterima + 6% block', () => {
    const m = statModsFor({ ...S10, defense: 30 });
    expect(m.dmgTakenMul).toBeCloseTo(0.8, 10);
    expect(m.blockBonus).toBeCloseTo(0.06, 10);
  });

  it('Defense dicap -50% (tidak bisa kebal total)', () => {
    expect(statModsFor({ ...S10, defense: 100 }).dmgTakenMul).toBe(0.5);
    expect(statModsFor({ ...S10, defense: 80 }).dmgTakenMul).toBeCloseTo(0.5, 10);
  });

  it('Speed 50 → +20% kecepatan serang, +8% dodge', () => {
    const m = statModsFor({ ...S10, speed: 50 });
    expect(m.attackSpeedMul).toBeCloseTo(1.2, 10);
    expect(m.dodgeBonus).toBeCloseTo(0.08, 10);
  });

  it('Accuracy 60 → +20% hit', () => {
    expect(statModsFor({ ...S10, accuracy: 60 }).hitBonus).toBeCloseTo(0.2, 10);
  });

  it('Stamina 50 → biaya stamina 40% lebih murah', () => {
    expect(statModsFor({ ...S10, stamina: 50 }).fatigueRate).toBeCloseTo(0.6, 10);
  });
});

describe('knockdownProb — peluang knockdown dari stat (bukan angka tetap)', () => {
  it('10v10 → 0,10 (baseline lama)', () => {
    expect(knockdownProb(10, 10, 10)).toBeCloseTo(0.1, 10);
  });

  it('Power jauh di atas Defense/Stamina → naik sampai cap 0,25', () => {
    expect(knockdownProb(90, 10, 10)).toBe(0.25);
    expect(knockdownProb(30, 10, 10)).toBeCloseTo(0.22, 10);
  });

  it('Defense/Stamina jauh di atas Power → turun sampai lantai 0,01', () => {
    expect(knockdownProb(10, 90, 90)).toBe(0.01);
    expect(knockdownProb(30, 50, 50)).toBeCloseTo(0.01, 10);
  });

  it('monoton: makin besar selisih Power-Defense, makin besar peluang', () => {
    const a = knockdownProb(20, 10, 10); // 0,16
    const b = knockdownProb(30, 10, 10); // 0,22
    const c = knockdownProb(30, 20, 10); // 0,18
    expect(b).toBeGreaterThan(a);
    expect(b).toBeGreaterThan(c);
  });
});

describe('winBiasFromStats', () => {
  it('stat sama → 0', () => {
    expect(winBiasFromStats(at(30), at(30))).toBe(0);
    expect(winBiasFromStats(S10, S10)).toBe(0);
  });

  it('antisimetris', () => {
    expect(winBiasFromStats(at(50), at(10))).toBe(-winBiasFromStats(at(10), at(50)));
  });

  it('30v10 → ~0,19 (di dalam batas)', () => {
    expect(winBiasFromStats(at(30), at(10))).toBeCloseTo(0.1904, 3);
  });

  it('dibatasi ±WIN_BIAS_MAX', () => {
    expect(winBiasFromStats(at(100), at(10))).toBe(WIN_BIAS_MAX);
    expect(winBiasFromStats(at(10), at(100))).toBe(-WIN_BIAS_MAX);
    expect(WIN_BIAS_MAX).toBe(0.35);
  });

  it('satu stat saja juga menggeser (Power 50 vs 10)', () => {
    const b = winBiasFromStats({ ...S10, power: 50 }, S10);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeCloseTo(40 * 0.0028, 5);
  });

  it('deck kuat vs deck kosong menaikkan winBias (stat sama)', () => {
    const strong = { cards: ['headkick', 'roundhouse', 'uppercut', 'hook', 'bodykick', 'lowkick'], signature: 'flyknee' };
    const empty = { cards: [], signature: null };
    const b = winBiasFromStats(S10, S10, strong, empty);
    expect(b).toBeGreaterThan(0.05);
    expect(b).toBeLessThan(WIN_BIAS_MAX);
    // deck lemah (semua jab) vs kosong justru merugikan
    const weak = { cards: ['jab', 'jab', 'jab'], signature: null };
    expect(winBiasFromStats(S10, S10, weak, empty)).toBeLessThan(0);
    // dua deck kosong = sama seperti tanpa deck
    expect(winBiasFromStats(S10, S10, empty, empty)).toBe(0);
  });
});

describe('deckStrength', () => {
  it('deck kosong = baseline pool semua gaya', () => {
    expect(deckStrength({ cards: [], signature: null })).toBe(NO_DECK_STRENGTH);
    expect(deckStrength(null)).toBe(NO_DECK_STRENGTH);
    expect(NO_DECK_STRENGTH).toBeGreaterThan(2);
    expect(NO_DECK_STRENGTH).toBeLessThan(4);
  });

  it('deck kuat > baseline > deck lemah', () => {
    const strong = deckStrength({ cards: ['headkick', 'roundhouse', 'uppercut'], signature: null });
    const weak = deckStrength({ cards: ['jab', 'jab'], signature: null });
    expect(strong).toBeGreaterThan(NO_DECK_STRENGTH);
    expect(weak).toBeLessThan(NO_DECK_STRENGTH);
  });

  it('signature berbobot 2,5x dalam rata-rata', () => {
    const withSig = deckStrength({ cards: ['jab'], signature: 'headkick' });
    const withoutSig = deckStrength({ cards: ['jab'], signature: null });
    expect(withSig).toBeGreaterThan(withoutSig);
  });
});

describe('normalizeGameplan', () => {
  it('default untuk input kosong/invalid', () => {
    expect(normalizeGameplan(null)).toEqual({ tempo: 'seimbang', focus: 'balanced' });
    expect(normalizeGameplan({})).toEqual({ tempo: 'seimbang', focus: 'balanced' });
    expect(normalizeGameplan({ tempo: 'cepat', focus: '' })).toEqual({
      tempo: 'seimbang',
      focus: 'balanced',
    });
  });

  it('nilai valid diteruskan', () => {
    expect(normalizeGameplan({ tempo: 'agresif', focus: 'headkick' })).toEqual({
      tempo: 'agresif',
      focus: 'headkick',
    });
  });
});

describe('buildFightOpts', () => {
  it('stat 10 + deck kosong + seimbang = opts netral', () => {
    const o = buildFightOpts(
      S10,
      S10,
      { cards: [], signature: null },
      { cards: [], signature: null },
      { tempo: 'seimbang', focus: 'balanced' },
      { tempo: 'seimbang', focus: 'balanced' },
    );
    expect(o.winBias).toBe(0);
    expect(o.weights).toEqual({ R: {}, B: {} });
    expect(o.tempo).toEqual({ R: 'seimbang', B: 'seimbang' });
    expect(o.stamina).toEqual({ R: 100, B: 100 });
    expect(o.comboBonus).toEqual({ R: 1, B: 1 });
    expect(o.matchupMul).toEqual({ R: 1, B: 1 });
    expect(o.statMods.R.dmgMul).toBe(1);
  });

  it('kartu deck 2x, signature 2,5x, fokus gameplan +50%', () => {
    const o = buildFightOpts(
      S10,
      S10,
      { cards: ['jab', 'headkick'], signature: 'flyknee' },
      { cards: [], signature: null },
      { tempo: 'agresif', focus: 'headkick' },
      { tempo: 'bertahan', focus: 'balanced' },
    );
    expect(o.weights.R.jab).toBe(2);
    // headkick: kartu 2x, lalu fokus x1,5 → 3
    expect(o.weights.R.headkick).toBe(3);
    expect(o.weights.R.flyknee).toBe(2.5);
    expect(o.weights.B).toEqual({});
    expect(o.tempo).toEqual({ R: 'agresif', B: 'bertahan' });
  });

  it('fokus pada jurus yang bukan kartu = bobot 1,5', () => {
    const o = buildFightOpts(
      S10,
      S10,
      { cards: [], signature: null },
      { cards: [], signature: null },
      { tempo: 'seimbang', focus: 'cross' },
      { tempo: 'seimbang', focus: 'balanced' },
    );
    expect(o.weights.R.cross).toBe(1.5);
  });

  it('pool stamina naik dengan Stamina', () => {
    expect(staminaPoolFor(S10)).toBe(100);
    expect(staminaPoolFor({ ...S10, stamina: 50 })).toBe(180);
    expect(staminaPoolFor({ ...S10, stamina: 100 })).toBe(260);
  });

  it('deterministik: input sama → opts sama persis', () => {
    const left: Stats = at(40);
    const right: Stats = at(20);
    const leftDeck: DeckInput = { cards: ['jab'], signature: 'cross' };
    const rightDeck: DeckInput = { cards: ['lowkick'], signature: null };
    const leftGp: Gameplan = { tempo: 'agresif', focus: 'jab' };
    const rightGp: Gameplan = { tempo: 'bertahan', focus: 'balanced' };
    expect(buildFightOpts(left, right, leftDeck, rightDeck, leftGp, rightGp)).toEqual(
      buildFightOpts(left, right, leftDeck, rightDeck, leftGp, rightGp),
    );
  });

  it('defaultStats = 10 semua', () => {
    expect(defaultStats()).toEqual(S10);
  });
});
