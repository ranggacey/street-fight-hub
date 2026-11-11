import { describe, expect, it } from 'vitest';
import { buildFight as buildFightHub } from '../fight-engine/fight.js';
import { buildFight as buildFightArena } from '../../../public/arena/js/fight.js';
import {
  expectedResult,
  verifyFightResult,
  type ClientResult,
  type EngineFighter,
} from '../fight-engine/verify';
import {
  buildFightOpts,
  type Gameplan,
  type Stats,
} from '../game/stat-effects';

const LEFT: EngineFighter = {
  name: 'Petarung A',
  color: '#ef4444',
  style: 'tinju',
  tempo: 'seimbang',
};
const RIGHT: EngineFighter = {
  name: 'Petarung B',
  color: '#3b82f6',
  style: 'muaythai',
  tempo: 'seimbang',
};
const DURATION = 60;
const SEIMBANG: Gameplan = { tempo: 'seimbang', focus: 'balanced' };

/** buildFight JS tidak mendeklarasikan `stats` di tipe return (diisi
 * sesudah objek dibuat) — cast lokal untuk akses stats di tes. */
type FightWithStats = ReturnType<typeof buildFightHub> & {
  stats: {
    damageDealtA: number;
    damageDealtB: number;
    strikesLandedA: number;
    strikesLandedB: number;
  };
};
const fightStatsOf = (f: ReturnType<typeof buildFightHub>) => (f as FightWithStats).stats;

const S10: Stats = { power: 10, speed: 10, stamina: 10, defense: 10, accuracy: 10 };
function at(level: number): Stats {
  return { power: level, speed: level, stamina: level, defense: level, accuracy: level };
}
const NO_DECK = { cards: [], signature: null };

function optsFor(a: Stats, b: Stats, winBiasOverride?: number) {
  const o = buildFightOpts(a, b, NO_DECK, NO_DECK, SEIMBANG, SEIMBANG);
  if (winBiasOverride !== undefined) o.winBias = winBiasOverride;
  return o;
}

describe('Kedua copy fight.js identik (Hub vs Arena)', () => {
  it('hasil sama persis untuk seed + opts yang sama (termasuk stat/deck/stamina)', () => {
    const cases = [
      { seed: 12345, opts: undefined },
      { seed: 999, opts: optsFor(at(30), at(10)) },
      { seed: 777, opts: optsFor(at(100), at(10)) },
      {
        seed: 4242,
        opts: buildFightOpts(
          at(50),
          at(30),
          { cards: ['headkick', 'jab'], signature: 'flyknee' },
          { cards: ['lowkick'], signature: null },
          { tempo: 'agresif', focus: 'headkick' },
          { tempo: 'bertahan', focus: 'balanced' },
        ),
      },
    ];
    for (const c of cases) {
      const hub = buildFightHub(LEFT, RIGHT, DURATION, c.seed, c.opts);
      const arena = buildFightArena(LEFT, RIGHT, DURATION, c.seed, c.opts);
      expect(arena).toEqual(hub);
    }
  });
});

describe('Opts netral = perilaku lama persis', () => {
  it('buildFightOpts stat 10 + deck kosong TANPA stamina = hasil tanpa opts', () => {
    for (const seed of [1, 42, 12345, 999999]) {
      const o = optsFor(S10, S10);
      delete (o as unknown as Record<string, unknown>).stamina;
      const withOpts = buildFightHub(LEFT, RIGHT, DURATION, seed, o);
      const plain = buildFightHub(LEFT, RIGHT, DURATION, seed);
      expect(withOpts).toEqual(plain);
    }
  });

  it('dengan stamina aktif (pool 100), hasil BOLEH beda dari tanpa opts — tapi deterministik', () => {
    const o = optsFor(S10, S10);
    const a = buildFightHub(LEFT, RIGHT, DURATION, 12345, o);
    const b = buildFightHub(LEFT, RIGHT, DURATION, 12345, o);
    expect(b).toEqual(a);
    // Stamina mengubah dinamika (kedua sisi kehabisan stamina di
    // tengah fight) — jadi hasil tidak harus sama dengan tanpa opts.
    expect(fightStatsOf(a)).toBeDefined();
  });
});

describe('winBias — determinisme + arah', () => {
  it('config + seed sama → hasil sama persis', () => {
    const o = optsFor(at(50), at(10));
    const a = buildFightHub(LEFT, RIGHT, DURATION, 777, o);
    const b = buildFightHub(LEFT, RIGHT, DURATION, 777, o);
    expect(b).toEqual(a);
  });

  it('winBias +0,35 → R menang jelas lebih sering (N=300)', () => {
    let winR = 0;
    let draw = 0;
    const N = 300;
    for (let s = 1; s <= N; s++) {
      const f = buildFightHub(LEFT, RIGHT, DURATION, s, optsFor(S10, S10, 0.35));
      if (f.result === 'draw') draw++;
      else if (f.winner === 'R') winR++;
    }
    // Peluang teori R ≈ (0,5+0,35) * 0,9 ≈ 76%; batas bawah longgar 60%.
    expect(winR / N).toBeGreaterThan(0.6);
    expect(draw / N).toBeGreaterThan(0.05);
    expect(draw / N).toBeLessThan(0.2);
  });

  it('winBias -0,35 → R menang jelas lebih jarang (N=300)', () => {
    let winR = 0;
    const N = 300;
    for (let s = 1; s <= N; s++) {
      const f = buildFightHub(LEFT, RIGHT, DURATION, s, optsFor(S10, S10, -0.35));
      if (f.winner === 'R') winR++;
    }
    expect(winR / N).toBeLessThan(0.4);
  });

  it('winBias 0 → 40–60% (N=300)', () => {
    let winR = 0;
    const N = 300;
    for (let s = 1; s <= N; s++) {
      const f = buildFightHub(LEFT, RIGHT, DURATION, s, optsFor(S10, S10, 0));
      if (f.winner === 'R') winR++;
    }
    expect(winR / N).toBeGreaterThanOrEqual(0.35);
    expect(winR / N).toBeLessThanOrEqual(0.65);
  });

  it('distribusi metode tetap (decision ~60% / KO ~30% / draw ~10%) walau winBias ≠ 0', () => {
    let decision = 0;
    let ko = 0;
    let draw = 0;
    const N = 300;
    for (let s = 1; s <= N; s++) {
      const f = buildFightHub(LEFT, RIGHT, DURATION, s, optsFor(S10, S10, 0.35));
      if (f.result === 'decision') decision++;
      else if (f.result === 'ko') ko++;
      else draw++;
    }
    expect(decision / N).toBeGreaterThan(0.5);
    expect(decision / N).toBeLessThan(0.7);
    expect(ko / N).toBeGreaterThan(0.2);
    expect(ko / N).toBeLessThan(0.4);
    expect(draw / N).toBeGreaterThan(0.05);
    expect(draw / N).toBeLessThan(0.2);
  });
});

describe('Knockdown dari stat (bukan angka tetap)', () => {
  it('Power tinggi vs Defense/Stamina rendah → jauh lebih banyak knockdown (N=200)', () => {
    const N = 200;
    const strong = {
      statMods: {
        R: {
          dmgMul: 1.8, dmgTakenMul: 1, dodgeBonus: 0, blockBonus: 0, hitBonus: 0,
          attackSpeedMul: 1, fatigueRate: 1,
          powerEff: 90, defenseEff: 10, staminaEff: 10, speedEff: 10, accuracyEff: 10,
        },
        B: {
          dmgMul: 1, dmgTakenMul: 1, dodgeBonus: 0, blockBonus: 0, hitBonus: 0,
          attackSpeedMul: 1, fatigueRate: 1,
          powerEff: 10, defenseEff: 10, staminaEff: 10, speedEff: 10, accuracyEff: 10,
        },
      },
    };
    let kdByStrong = 0;
    let kdByWeak = 0;
    for (let s = 1; s <= N; s++) {
      const f = buildFightHub(LEFT, RIGHT, DURATION, s, strong);
      for (const k of f.knockdowns) {
        if (k.who === 'B') kdByStrong++;
        else kdByWeak++;
      }
    }
    // p knockdown penyerang kuat ≈ 0,25 (cap) vs lemah 0,10 → rasio > 1,5x.
    expect(kdByStrong).toBeGreaterThan(kdByWeak * 1.5);
    expect(kdByStrong / N).toBeGreaterThan(2);
  });

  it('tanpa statMods, knockdown tetap ~10% per hit kena (baseline)', () => {
    let kd = 0;
    let landed = 0;
    const N = 100;
    for (let s = 1; s <= N; s++) {
      const f = buildFightHub(LEFT, RIGHT, DURATION, s);
      kd += f.knockdowns.length;
      const st = fightStatsOf(f);
      landed += st.strikesLandedA + st.strikesLandedB;
    }
    const pct = (kd / landed) * 100;
    expect(pct).toBeGreaterThanOrEqual(6);
    expect(pct).toBeLessThanOrEqual(14);
  });
});

describe('Stamina di engine', () => {
  it('pool stamina raksasa (tidak pernah habis) = sama dengan tanpa sistem stamina', () => {
    const o = optsFor(at(50), at(50));
    const huge = { ...o, stamina: { R: 100000, B: 100000 } };
    const noStamina = { ...o };
    delete (noStamina as unknown as Record<string, unknown>).stamina;
    for (const seed of [11, 222, 3333]) {
      expect(buildFightHub(LEFT, RIGHT, DURATION, seed, huge)).toEqual(
        buildFightHub(LEFT, RIGHT, DURATION, seed, noStamina),
      );
    }
  });

  it('pool stamina kecil → petarung kehabisan stamina (damage turun di akhir fight)', () => {
    // Pool 5 = habis setelah ~1 gerakan → hampir seluruh fight dalam
    // kondisi exhausted (damage x0,7) → damage total jauh lebih kecil.
    const tiny = { ...optsFor(S10, S10), stamina: { R: 5, B: 5 } };
    const normal = optsFor(S10, S10);
    let dmgTiny = 0;
    let dmgNormal = 0;
    const N = 50;
    for (let s = 1; s <= N; s++) {
      const fTiny = buildFightHub(LEFT, RIGHT, DURATION, s, tiny);
      const fNormal = buildFightHub(LEFT, RIGHT, DURATION, s, normal);
      const stTiny = fightStatsOf(fTiny);
      const stNormal = fightStatsOf(fNormal);
      dmgTiny += stTiny.damageDealtA + stTiny.damageDealtB;
      dmgNormal += stNormal.damageDealtA + stNormal.damageDealtB;
    }
    expect(dmgTiny).toBeLessThan(dmgNormal * 0.8);
  });
});

describe('verifyFightResult dengan fightOpts', () => {
  function clientFromExpected(opts?: ReturnType<typeof optsFor>): ClientResult {
    const e = expectedResult(LEFT, RIGHT, DURATION, 12345, opts);
    return {
      winner: e.winner,
      method: e.method,
      score: e.score,
      koTimeSec: e.koTimeSec,
      stats: e.stats,
      keyMoments: e.keyMoments,
      seed: 12345,
    };
  }

  it('client dari expected DENGAN opts → verified bila opts yang sama diteruskan', () => {
    const o = optsFor(at(50), at(10));
    const res = verifyFightResult(LEFT, RIGHT, DURATION, 12345, clientFromExpected(o), o);
    expect(res.ok).toBe(true);
  });

  it('client dari expected DENGAN opts → TIDAK verified bila server re-run tanpa opts', () => {
    const o = optsFor(at(50), at(10));
    // Cari seed yang hasil ber-opts-nya beda dari tanpa-opts (deterministik).
    let seed = 1;
    let found = false;
    for (let s = 1; s <= 200; s++) {
      const withOpts = expectedResult(LEFT, RIGHT, DURATION, s, o);
      const without = expectedResult(LEFT, RIGHT, DURATION, s);
      if (
        withOpts.winner !== without.winner ||
        withOpts.score.a !== without.score.a ||
        withOpts.score.b !== without.score.b
      ) {
        seed = s;
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
    const e = expectedResult(LEFT, RIGHT, DURATION, seed, o);
    const client: ClientResult = {
      winner: e.winner,
      method: e.method,
      score: e.score,
      koTimeSec: e.koTimeSec,
      stats: e.stats,
      keyMoments: e.keyMoments,
      seed,
    };
    const res = verifyFightResult(LEFT, RIGHT, DURATION, seed, client);
    expect(res.ok).toBe(false);
    const resWith = verifyFightResult(LEFT, RIGHT, DURATION, seed, client, o);
    expect(resWith.ok).toBe(true);
  });

  it('tanpa opts, perilaku lama tetap (client dari expected tanpa opts → verified)', () => {
    const res = verifyFightResult(LEFT, RIGHT, DURATION, 12345, clientFromExpected());
    expect(res.ok).toBe(true);
  });
});
