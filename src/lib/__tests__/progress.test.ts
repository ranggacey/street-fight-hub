import { describe, expect, it } from 'vitest';
import { checkAchievements } from '../game/achievement-catalog';
import { detectCombo } from '../game/combos';
import {
  coinsForOutcome,
  getEffectiveStats,
  levelFromXp,
  rollInjury,
  xpForLevelUp,
  xpForOutcome,
  xpInCurrentLevel,
} from '../game/progress';
import { computeRivalry } from '../game/rivalry';
import { matchupMultiplier } from '../game/style-matchups';
import {
  isSameWeightClass,
  weightClassDistance,
  weightClassLabel,
  weightClassOf,
  weightMismatchWarning,
} from '../game/weight-classes';

describe('Level & XP (100 * level per naik level)', () => {
  it('xpForLevelUp: 100, 200, 300…', () => {
    expect(xpForLevelUp(1)).toBe(100);
    expect(xpForLevelUp(2)).toBe(200);
    expect(xpForLevelUp(5)).toBe(500);
  });

  it('levelFromXp: 0→1, 99→1, 100→2, 300→3', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(299)).toBe(2);
    expect(levelFromXp(300)).toBe(3);
    expect(levelFromXp(600)).toBe(4);
  });

  it('xpInCurrentLevel: 150 XP = 50 di level 2', () => {
    expect(xpInCurrentLevel(150)).toBe(50);
    expect(xpInCurrentLevel(0)).toBe(0);
  });

  it('xpForOutcome: menang 100, kalah 30, seri 50, KO +50', () => {
    expect(xpForOutcome('win', 'decision')).toBe(100);
    expect(xpForOutcome('win', 'KO')).toBe(150);
    expect(xpForOutcome('loss', 'KO')).toBe(30);
    expect(xpForOutcome('draw', 'draw')).toBe(50);
  });

  it('coinsForOutcome: menang 50, kalah 10, seri 25, title +100', () => {
    expect(coinsForOutcome('win', false)).toBe(50);
    expect(coinsForOutcome('win', true)).toBe(150);
    expect(coinsForOutcome('loss', true)).toBe(10);
    expect(coinsForOutcome('draw', false)).toBe(25);
  });
});

describe('Cedera (murni)', () => {
  const base = { power: 20, speed: 20, stamina: 20, defense: 20, accuracy: 20 };

  it('getEffectiveStats: stat cedera -15%, lainnya utuh', () => {
    const eff = getEffectiveStats(base, { stat: 'power', pct: 15, fightsRemaining: 3 });
    expect(eff.power).toBe(17);
    expect(eff.speed).toBe(20);
  });

  it('getEffectiveStats: tanpa cedera / sudah sembuh = utuh', () => {
    expect(getEffectiveStats(base, null)).toEqual(base);
    expect(getEffectiveStats(base, { stat: 'power', pct: 15, fightsRemaining: 0 })).toEqual(base);
  });

  it('rollInjury: pemenang & seri tidak pernah cedera', () => {
    expect(rollInjury('win', 'KO', () => 0)).toBeNull();
    expect(rollInjury('draw', 'draw', () => 0)).toBeNull();
  });

  it('rollInjury: kalah KO rng 0 → cedera power (stat pertama)', () => {
    expect(rollInjury('loss', 'KO', () => 0)).toEqual({
      stat: 'power',
      pct: 15,
      fightsRemaining: 3,
    });
  });

  it('rollInjury: kalah KO rng 0.9 → tidak cedera (>25%)', () => {
    expect(rollInjury('loss', 'KO', () => 0.9)).toBeNull();
  });

  it('rollInjury: kalah decision rng 0.05 → cedera (<=10%)', () => {
    expect(rollInjury('loss', 'decision', () => 0.05)).not.toBeNull();
  });
});

describe('Achievement (murni)', () => {
  const baseCtx = {
    wins: 0,
    kos: 0,
    totalFights: 0,
    currentWinStreak: 0,
    activityStreakDays: 0,
    isTitleHolder: false,
    alreadyUnlocked: [] as string[],
  };

  it('kemenangan pertama + KO pertama terbuka bersamaan', () => {
    expect(checkAchievements({ ...baseCtx, wins: 1, kos: 1, totalFights: 1 })).toEqual([
      'first-win',
      'first-ko',
    ]);
  });

  it('yang sudah terbuka tidak diulang', () => {
    expect(
      checkAchievements({ ...baseCtx, wins: 12, kos: 6, alreadyUnlocked: ['first-win', 'first-ko'] }),
    ).toEqual(['wins-10', 'kos-5']);
  });

  it('streak 7 hari + 100 fight + 5x tak terkalahkan + gelar', () => {
    const out = checkAchievements({
      ...baseCtx,
      wins: 5,
      totalFights: 100,
      currentWinStreak: 5,
      activityStreakDays: 7,
      isTitleHolder: true,
    });
    expect(out).toContain('title-holder');
    expect(out).toContain('streak-7');
    expect(out).toContain('fights-100');
    expect(out).toContain('undefeated-5');
  });
});

describe('Kombo (murni)', () => {
  it('jab→cross→hook = Kombo Kilat +15%', () => {
    expect(detectCombo(['jab', 'cross', 'hook'])).toEqual({
      name: 'Kombo Kilat',
      bonusPct: 15,
      length: 3,
    });
  });

  it('lowkick→bodykick→headkick = Kombo Badai +15%', () => {
    expect(detectCombo(['lowkick', 'bodykick', 'headkick'])?.name).toBe('Kombo Badai');
  });

  it('doubleleg→suplex = Kombo Banting +20%', () => {
    expect(detectCombo(['doubleleg', 'suplex'])).toEqual({
      name: 'Kombo Banting',
      bonusPct: 20,
      length: 2,
    });
  });

  it('hanya akhir history yang dihitung; urutan salah = null', () => {
    expect(detectCombo(['cross', 'jab', 'hook'])).toBeNull();
    expect(detectCombo(['jab', 'cross'])).toBeNull();
    expect(detectCombo(['jab', 'jab', 'cross', 'hook'])?.name).toBe('Kombo Kilat');
  });

  it('history kosong = null', () => {
    expect(detectCombo([])).toBeNull();
  });
});

describe('Style matchup (murni, rentang 0.95–1.10)', () => {
  it('muay-thai vs boxing 1.05; kebalikannya 0.97', () => {
    expect(matchupMultiplier('muay-thai', 'boxing')).toBe(1.05);
    expect(matchupMultiplier('boxing', 'muay-thai')).toBe(0.97);
  });

  it('wrestling vs boxing 1.08', () => {
    expect(matchupMultiplier('wrestling', 'boxing')).toBe(1.08);
  });

  it('mirror = 1.00; tak dikenal = 1.00', () => {
    expect(matchupMultiplier('boxing', 'boxing')).toBe(1);
    expect(matchupMultiplier('nonsense', 'boxing')).toBe(1);
    expect(matchupMultiplier('boxing', null)).toBe(1);
  });

  it('semua pasangan dalam rentang', () => {
    const styles = ['boxing', 'taekwondo', 'muay-thai', 'street', 'karate', 'wrestling', 'judo'];
    for (const a of styles) {
      for (const b of styles) {
        const m = matchupMultiplier(a, b);
        expect(m).toBeGreaterThanOrEqual(0.95);
        expect(m).toBeLessThanOrEqual(1.1);
      }
    }
  });
});

describe('Kelas berat (murni)', () => {
  it('batas: 69 ringan, 70 menengah, 85 menengah, 86 berat', () => {
    expect(weightClassOf(69)).toBe('ringan');
    expect(weightClassOf(70)).toBe('menengah');
    expect(weightClassOf(85)).toBe('menengah');
    expect(weightClassOf(86)).toBe('berat');
    expect(weightClassOf(null)).toBeNull();
    expect(weightClassOf(undefined)).toBeNull();
  });

  it('label: tanpa kelas kalau berat kosong', () => {
    expect(weightClassLabel(null)).toBe('Tanpa kelas');
    expect(weightClassLabel(65)).toBe('Ringan (<70 kg)');
  });

  it('jarak kelas: sekelas 0, sebelah 1, ringan-vs-berat 2; tanpa kelas 0', () => {
    expect(weightClassDistance(65, 68)).toBe(0);
    expect(weightClassDistance(65, 75)).toBe(1);
    expect(weightClassDistance(65, 90)).toBe(2);
    expect(weightClassDistance(null, 90)).toBe(0);
    expect(isSameWeightClass(80, 85)).toBe(true);
  });

  it('peringatan hanya kalau selisih > 1', () => {
    expect(weightMismatchWarning(65, 90)).toContain('Ringan vs Berat');
    expect(weightMismatchWarning(65, 75)).toBeNull();
    expect(weightMismatchWarning(null, 90)).toBeNull();
  });
});

describe('Rivalry (murni)', () => {
  it('hitung menang/kalah/seri + lastFightAt', () => {
    const r = computeRivalry('A', 'B', [
      { winnerFighterId: 'A', method: 'KO', decidedAt: new Date('2026-11-01') },
      { winnerFighterId: 'B', method: 'decision', decidedAt: new Date('2026-11-05') },
      { winnerFighterId: 'A', method: 'decision', decidedAt: new Date('2026-11-03') },
      { winnerFighterId: null, method: 'draw', decidedAt: new Date('2026-11-04') },
    ]);
    expect(r.winsA).toBe(2);
    expect(r.winsB).toBe(1);
    expect(r.draws).toBe(1);
    expect(r.totalFights).toBe(4);
    expect(r.lastFightAt?.toISOString()).toContain('2026-11-05');
  });

  it('belum pernah bertemu = 0', () => {
    expect(computeRivalry('A', 'B', []).totalFights).toBe(0);
  });
});
