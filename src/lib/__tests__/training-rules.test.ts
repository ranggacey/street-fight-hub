import { describe, expect, it } from 'vitest';
import {
  dateWIB,
  MAX_POINTS_PER_DAY,
  pointsForDay,
  PUSHUP_CAP,
  PUSHUP_PER_POINT,
  SQUAT_CAP,
  SQUAT_PER_POINT,
  validateAllocation,
  validateSessionCounts,
} from '../game/training-rules';

describe('dateWIB', () => {
  it('tanggal WIB (UTC+7), bukan UTC', () => {
    // 2026-11-11 00:30 WIB = 2026-11-10 17:30 UTC
    expect(dateWIB(new Date('2026-11-10T17:30:00Z'))).toBe('2026-11-11');
    expect(dateWIB(new Date('2026-11-10T16:59:00Z'))).toBe('2026-11-10');
    expect(dateWIB(new Date('2026-11-11T12:00:00+07:00'))).toBe('2026-11-11');
  });
});

describe('pointsForDay', () => {
  it('25 push-up = 1, 15 squat = 1', () => {
    expect(pointsForDay(25, 0)).toBe(1);
    expect(pointsForDay(0, 15)).toBe(1);
    expect(pointsForDay(24, 0)).toBe(0);
    expect(pointsForDay(0, 14)).toBe(0);
  });

  it('kombinasi dijumlah', () => {
    expect(pointsForDay(50, 15)).toBe(3);
    expect(pointsForDay(25, 30)).toBe(3);
  });

  it('dibatasi 4/hari', () => {
    expect(pointsForDay(50, 30)).toBe(4);
    expect(MAX_POINTS_PER_DAY).toBe(4);
    expect(PUSHUP_CAP).toBe(50);
    expect(SQUAT_CAP).toBe(30);
    expect(PUSHUP_PER_POINT).toBe(25);
    expect(SQUAT_PER_POINT).toBe(15);
  });
});

describe('validateSessionCounts', () => {
  it('sesi valid dalam cap diterima', () => {
    expect(validateSessionCounts(10, 5, 0, 0)).toEqual({ pushups: 10, squats: 5 });
    expect(validateSessionCounts(50, 30, 0, 0)).toEqual({ pushups: 50, squats: 30 });
    expect(validateSessionCounts(0, 0, 0, 0)).toEqual({ pushups: 0, squats: 0 });
  });

  it('melebihi cap harian ditolak (dengan sisa)', () => {
    expect(() => validateSessionCounts(1, 0, 50, 0)).toThrow(/Cap push-up hari ini 50/);
    expect(() => validateSessionCounts(0, 1, 0, 30)).toThrow(/Cap squat hari ini 30/);
    expect(() => validateSessionCounts(51, 0, 0, 0)).toThrow(/Satu sesi maksimal/);
    expect(() => validateSessionCounts(0, 31, 0, 0)).toThrow(/Satu sesi maksimal/);
  });

  it('angka negatif / bukan bilangan bulat ditolak', () => {
    expect(() => validateSessionCounts(-1, 0, 0, 0)).toThrow(/bilangan bulat/);
    expect(() => validateSessionCounts(2.5, 0, 0, 0)).toThrow(/bilangan bulat/);
    expect(() => validateSessionCounts('10', 0, 0, 0)).toThrow(/bilangan bulat/);
  });
});

describe('validateAllocation', () => {
  it('alokasi valid', () => {
    expect(validateAllocation('power', 2, 3, 10)).toEqual({ stat: 'power', points: 2 });
  });

  it('poin melebihi yang tersedia ditolak', () => {
    expect(() => validateAllocation('power', 2, 1, 10)).toThrow(/Poin tersedia tinggal 1/);
  });

  it('melewati stat maks 100 ditolak', () => {
    expect(() => validateAllocation('power', 2, 5, 99)).toThrow(/maksimal 100/);
  });

  it('stat tidak dikenal / poin tidak valid ditolak', () => {
    expect(() => validateAllocation('kekuatan', 1, 5, 10)).toThrow(/tidak dikenal/);
    expect(() => validateAllocation('power', 0, 5, 10)).toThrow(/bilangan bulat/);
    expect(() => validateAllocation('power', 1.5, 5, 10)).toThrow(/bilangan bulat/);
  });
});
