import { describe, expect, it } from 'vitest';
import { ARENA_MAPS } from '../game/engine-config';
import { QUICK_FIGHT_RATING_WINDOW, pickRandomMap } from '../game/quick-fight';

describe('QUICK_FIGHT_RATING_WINDOW', () => {
  it('jendela preferensi rating ±100', () => {
    expect(QUICK_FIGHT_RATING_WINDOW).toBe(100);
  });
});

describe('pickRandomMap', () => {
  it('selalu mengembalikan map arena yang valid', () => {
    for (let i = 0; i < 100; i++) {
      expect(ARENA_MAPS).toContain(pickRandomMap());
    }
  });
});
