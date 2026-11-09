import { describe, expect, it } from 'vitest';
import {
  buildBracket,
  canReshuffle,
  elbowPath,
  largestPowerOfTwo,
  nextRound,
  roundNameForTarget,
  smallestPowerOfTwoAtLeast,
  sortMatchesForTree,
} from '../bracket';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `fighter-${i + 1}`);

describe('largestPowerOfTwo', () => {
  it('mengembalikan pangkat 2 terbesar ≤ n', () => {
    expect(largestPowerOfTwo(4)).toBe(4);
    expect(largestPowerOfTwo(5)).toBe(4);
    expect(largestPowerOfTwo(8)).toBe(8);
    expect(largestPowerOfTwo(10)).toBe(8);
    expect(largestPowerOfTwo(16)).toBe(16);
    expect(largestPowerOfTwo(17)).toBe(16);
    expect(largestPowerOfTwo(32)).toBe(32);
  });

  it('throw jika n < 4', () => {
    expect(() => largestPowerOfTwo(3)).toThrow('Turnamen butuh min 4 peserta');
    expect(() => largestPowerOfTwo(0)).toThrow('Turnamen butuh min 4 peserta');
  });
});

describe('smallestPowerOfTwoAtLeast', () => {
  it('mengembalikan pangkat 2 terkecil ≥ n', () => {
    expect(smallestPowerOfTwoAtLeast(4)).toBe(4);
    expect(smallestPowerOfTwoAtLeast(5)).toBe(8);
    expect(smallestPowerOfTwoAtLeast(7)).toBe(8);
    expect(smallestPowerOfTwoAtLeast(8)).toBe(8);
    expect(smallestPowerOfTwoAtLeast(9)).toBe(16);
    expect(smallestPowerOfTwoAtLeast(16)).toBe(16);
    expect(smallestPowerOfTwoAtLeast(17)).toBe(32);
    expect(smallestPowerOfTwoAtLeast(32)).toBe(32);
  });

  it('throw jika n < 4', () => {
    expect(() => smallestPowerOfTwoAtLeast(3)).toThrow('Turnamen butuh min 4 peserta');
    expect(() => smallestPowerOfTwoAtLeast(0)).toThrow('Turnamen butuh min 4 peserta');
  });

  it('throw jika n > 32 (di luar ukuran bracket maksimal)', () => {
    expect(() => smallestPowerOfTwoAtLeast(33)).toThrow('Turnamen maksimal 32 peserta');
  });
});

describe('buildBracket', () => {
  it('n == target: 0 bye, semua masuk ronde pertama', () => {
    const r = buildBracket(ids(8), 42);
    expect(r.target).toBe(8);
    expect(r.byes).toHaveLength(0);
    expect(r.matches).toHaveLength(4);
    expect(r.firstRound).toBe('QF');
    expect(r.matches.every((m) => !m.isBye && m.status === 'scheduled')).toBe(true);
    expect(r.matches.every((m) => m.fighterBId !== null)).toBe(true);
  });

  it('n=7 (kasus user): bracket 8, 1 bye acak, 3 match QF — 6 lawan, 1 lolos', () => {
    const r = buildBracket(ids(7), 42);
    expect(r.target).toBe(8);
    expect(r.byes).toHaveLength(1);
    expect(r.matches.filter((m) => m.isBye)).toHaveLength(1);
    expect(r.matches.filter((m) => !m.isBye)).toHaveLength(3);
    expect(r.firstRound).toBe('QF');
    expect(r.rounds).toEqual(['QF', 'SF', 'F']);
    // Semua fighter terpakai tepat 1x
    const used = r.matches.flatMap((m) => [m.fighterAId, m.fighterBId]).filter(Boolean);
    expect(new Set(used).size).toBe(7);
    // Bye: langsung decided, winner = fighterA, method 'bye'
    const bye = r.matches.find((m) => m.isBye)!;
    expect(bye.status).toBe('decided');
    expect(bye.winnerId).toBe(bye.fighterAId);
    expect(bye.method).toBe('bye');
    expect(bye.fighterBId).toBeNull();
  });

  it('n=6: bracket 8, 2 bye, 2 match QF', () => {
    const r = buildBracket(ids(6), 42);
    expect(r.target).toBe(8);
    expect(r.byes).toHaveLength(2);
    expect(r.matches.filter((m) => !m.isBye)).toHaveLength(2);
    expect(r.firstRound).toBe('QF');
  });

  it('n=5: bracket 8, 3 bye, 1 match QF', () => {
    const r = buildBracket(ids(5), 99);
    expect(r.target).toBe(8);
    expect(r.byes).toHaveLength(3);
    expect(r.matches.filter((m) => !m.isBye)).toHaveLength(1);
    expect(r.firstRound).toBe('QF');
  });

  it('n=4: bracket 4, 0 bye, 2 match SF', () => {
    const r = buildBracket(ids(4), 42);
    expect(r.target).toBe(4);
    expect(r.byes).toHaveLength(0);
    expect(r.matches).toHaveLength(2);
    expect(r.firstRound).toBe('SF');
  });

  it('n=9: bracket 16, 7 bye, 1 match R16', () => {
    const r = buildBracket(ids(9), 42);
    expect(r.target).toBe(16);
    expect(r.byes).toHaveLength(7);
    expect(r.matches.filter((m) => !m.isBye)).toHaveLength(1);
    expect(r.firstRound).toBe('R16');
  });

  it('n=10: bracket 16, 6 bye, 2 match R16', () => {
    const r = buildBracket(ids(10), 7);
    expect(r.target).toBe(16);
    expect(r.byes).toHaveLength(6);
    expect(r.matches.filter((m) => m.isBye)).toHaveLength(6);
    expect(r.matches.filter((m) => !m.isBye)).toHaveLength(2);
    expect(r.firstRound).toBe('R16');
    // Semua fighter terpakai tepat 1x
    const used = r.matches.flatMap((m) => [m.fighterAId, m.fighterBId]).filter(Boolean);
    expect(new Set(used).size).toBe(10);
  });

  it('invarian struktur: pemenang ronde pertama = target/2 (pas untuk ronde berikut)', () => {
    for (const n of [4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 32]) {
      const r = buildBracket(ids(n), 1234);
      const advancers = r.matches.filter((m) => !m.isBye).length + r.byes.length;
      expect(advancers).toBe(r.target / 2);
    }
  });

  it('n=16: 0 bye, ronde pertama R16', () => {
    const r = buildBracket(ids(16), 1);
    expect(r.target).toBe(16);
    expect(r.byes).toHaveLength(0);
    expect(r.matches).toHaveLength(8);
    expect(r.firstRound).toBe('R16');
  });

  it('seed sama → hasil sama; seed beda → (kemungkinan besar) hasil beda', () => {
    expect(buildBracket(ids(10), 123)).toEqual(buildBracket(ids(10), 123));
    expect(buildBracket(ids(10), 123).order).not.toEqual(buildBracket(ids(10), 456).order);
  });

  it('throw jika peserta < 4', () => {
    expect(() => buildBracket(ids(3))).toThrow('Turnamen butuh min 4 peserta');
  });
});

describe('roundNameForTarget / nextRound', () => {
  it('nama ronde sesuai target', () => {
    expect(roundNameForTarget(32)).toEqual(['R32', 'R16', 'QF', 'SF', 'F']);
    expect(roundNameForTarget(16)).toEqual(['R16', 'QF', 'SF', 'F']);
    expect(roundNameForTarget(8)).toEqual(['QF', 'SF', 'F']);
    expect(roundNameForTarget(4)).toEqual(['SF', 'F']);
  });

  it('nextRound berurutan sampai F → null', () => {
    expect(nextRound('R32')).toBe('R16');
    expect(nextRound('R16')).toBe('QF');
    expect(nextRound('QF')).toBe('SF');
    expect(nextRound('SF')).toBe('F');
    expect(nextRound('F')).toBeNull();
  });
});

describe('canReshuffle', () => {
  const sched = (round: string) => ({ round, isBye: false, status: 'scheduled' });
  const bye = (round: string) => ({ round, isBye: true, status: 'decided' });
  const decided = (round: string) => ({ round, isBye: false, status: 'decided' });

  it('boleh: semua match di ronde pertama, belum ada yang decided', () => {
    expect(canReshuffle([sched('QF'), sched('QF'), sched('QF'), sched('QF')])).toBe(true);
  });

  it('boleh: ada bye (decided otomatis) tapi belum ada match sungguhan yang decided', () => {
    expect(canReshuffle([sched('QF'), sched('QF'), bye('QF'), bye('QF')])).toBe(true);
  });

  it('tidak boleh: sudah ada match non-bye yang decided', () => {
    expect(canReshuffle([decided('QF'), sched('QF')])).toBe(false);
  });

  it('tidak boleh: sudah ada match di ronde berikut', () => {
    expect(canReshuffle([sched('QF'), sched('SF')])).toBe(false);
  });

  it('tidak boleh: belum ada match sama sekali', () => {
    expect(canReshuffle([])).toBe(false);
  });
});

describe('sortMatchesForTree', () => {
  it('urut createdAt, lalu id — sama seperti advanceWinners', () => {
    const ms = [
      { id: 'c', createdAt: '2026-11-07T10:00:02Z' },
      { id: 'a', createdAt: '2026-11-07T10:00:00Z' },
      { id: 'b', createdAt: '2026-11-07T10:00:01Z' },
    ];
    expect(sortMatchesForTree(ms).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('tanpa createdAt: urutan asal dipertahankan (stabil)', () => {
    const ms = [{ id: 'x' }, { id: 'y' }];
    expect(sortMatchesForTree(ms).map((m) => m.id)).toEqual(['x', 'y']);
  });
});

describe('elbowPath', () => {
  it('garis lurus kalau y sama', () => {
    expect(elbowPath(0, 50, 100, 50)).toBe('M 0 50 H 100');
  });

  it('siku: horizontal → vertikal → horizontal lewat titik tengah', () => {
    expect(elbowPath(0, 10, 100, 90)).toBe('M 0 10 H 50 V 90 H 100');
  });
});
