import { describe, expect, it } from 'vitest';
import {
  ELO_INITIAL_RATING,
  ELO_K_FACTOR,
  expectedScore,
  updateRatings,
  winPercent,
} from '../game/elo';

describe('Elo (ranking kasual game)', () => {
  it('rating sama → peluang 50%', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 6);
    expect(winPercent(1000, 1000)).toBe(50);
  });

  it('selisih 100 poin → ~64% vs ~36%', () => {
    expect(winPercent(1100, 1000)).toBe(64);
    expect(winPercent(1000, 1100)).toBe(36);
  });

  it('menang lawan rating sama → +16 / -16 (K=32)', () => {
    expect(updateRatings(1000, 1000, 1)).toEqual([1016, 984]);
  });

  it('seri → rating tidak berubah', () => {
    expect(updateRatings(1000, 1000, 0.5)).toEqual([1000, 1000]);
  });

  it('menang lawan rating lebih tinggi → naik lebih banyak', () => {
    const [a, b] = updateRatings(1000, 1200, 1);
    expect(a).toBeGreaterThan(1016);
    expect(b).toBeLessThan(1200);
  });

  it('konstanta awal', () => {
    expect(ELO_INITIAL_RATING).toBe(1000);
    expect(ELO_K_FACTOR).toBe(32);
  });
});
