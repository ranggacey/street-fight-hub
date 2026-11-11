import { describe, expect, it } from 'vitest';
import { mulberry32, simulateFight } from '../draw';

describe('mulberry32', () => {
  it('deterministik dan menghasilkan angka [0, 1)', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 20; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('seed beda → urutan beda', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('simulateFight', () => {
  it('deterministik: seed sama → hasil sama persis', () => {
    expect(simulateFight(42)).toEqual(simulateFight(42));
    expect(simulateFight(7)).toEqual(simulateFight(7));
  });

  it('seed beda → hasil (biasanya) beda', () => {
    expect(simulateFight(42)).not.toEqual(simulateFight(43));
  });

  it('KO: koTimeSec 35-55 dan skor pemenang > skor lawan', () => {
    let found = 0;
    for (let seed = 0; seed < 5000; seed++) {
      const r = simulateFight(seed);
      if (r.method === 'KO') {
        found++;
        expect(r.koTimeSec).not.toBeNull();
        expect(r.koTimeSec!).toBeGreaterThanOrEqual(35);
        expect(r.koTimeSec!).toBeLessThanOrEqual(55);
        const winnerScore = r.winner === 'A' ? r.scoreA : r.scoreB;
        const loserScore = r.winner === 'A' ? r.scoreB : r.scoreA;
        expect(winnerScore).toBeGreaterThan(loserScore);
        expect(r.advancer).toBeNull();
        expect(r.drawReRollSeed).toBeNull();
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('decision: pemenang = skor tertinggi, tanpa KO time', () => {
    let found = 0;
    for (let seed = 0; seed < 5000; seed++) {
      const r = simulateFight(seed);
      if (r.method === 'decision') {
        found++;
        expect(r.koTimeSec).toBeNull();
        expect(r.scoreA).not.toBe(r.scoreB);
        expect(r.winner).toBe(r.scoreA > r.scoreB ? 'A' : 'B');
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('seri (draw): skor sama, winner null, advancer + drawReRollSeed terisi', () => {
    let found = 0;
    for (let seed = 0; seed < 50000; seed++) {
      const r = simulateFight(seed);
      if (r.method === 'draw') {
        found++;
        expect(r.winner).toBeNull();
        expect(r.scoreA).toBe(r.scoreB);
        expect(r.advancer === 'A' || r.advancer === 'B').toBe(true);
        expect(typeof r.drawReRollSeed).toBe('number');
        expect(r.drawReRollSeed!).toBeGreaterThanOrEqual(0);
        expect(r.koTimeSec).toBeNull();
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('skor tidak negatif dan rolls tercatat', () => {
    const r = simulateFight(7);
    expect(r.scoreA).toBeGreaterThanOrEqual(0);
    expect(r.scoreB).toBeGreaterThanOrEqual(0);
    expect(r.rolls.length).toBeGreaterThan(0);
    expect(r.rolls.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  describe('bias (opsional, untuk sim stat-aware)', () => {
    it('bias 0 = perilaku lama persis', () => {
      for (const seed of [0, 1, 7, 42, 1234]) {
        expect(simulateFight(seed, 0)).toEqual(simulateFight(seed));
      }
    });

    it('bias +0.5 → semua pemenang KO adalah A; -0.5 → semua B', () => {
      let koA = 0;
      let koB = 0;
      for (let seed = 0; seed < 2000; seed++) {
        const rPlus = simulateFight(seed, 0.5);
        if (rPlus.method === 'KO') {
          expect(rPlus.winner).toBe('A');
          koA++;
        }
        const rMinus = simulateFight(seed, -0.5);
        if (rMinus.method === 'KO') {
          expect(rMinus.winner).toBe('B');
          koB++;
        }
      }
      expect(koA).toBeGreaterThan(0);
      expect(koB).toBeGreaterThan(0);
    });

    it('bias dijepit ke [-0.5, 0.5]', () => {
      expect(simulateFight(42, 2)).toEqual(simulateFight(42, 0.5));
      expect(simulateFight(42, -2)).toEqual(simulateFight(42, -0.5));
    });

    it('bias positif menaikkan jumlah kemenangan KO A (bukan decision)', () => {
      let winsA0 = 0;
      let winsAPlus = 0;
      for (let seed = 0; seed < 5000; seed++) {
        if (simulateFight(seed, 0).winner === 'A') winsA0++;
        if (simulateFight(seed, 0.25).winner === 'A') winsAPlus++;
      }
      expect(winsAPlus).toBeGreaterThan(winsA0);
    });
  });
});
