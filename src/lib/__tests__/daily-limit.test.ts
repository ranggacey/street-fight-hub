import { describe, expect, it } from 'vitest';
import { wibDayWindow } from '../game/daily-limit';

// WIB = UTC+7, tanpa DST. 2026-11-07 23:59 WIB = 2026-11-07 16:59 UTC.
// 2026-11-08 00:01 WIB = 2026-11-07 17:01 UTC.

describe('Limit harian: jendela hari WIB', () => {
  it('23:59 WIB dan 00:01 WIB (2 menit berselang) masuk hari berbeda', () => {
    const beforeMidnight = new Date('2026-11-07T16:59:00Z'); // 23:59 WIB 7 Nov
    const afterMidnight = new Date('2026-11-07T17:01:00Z'); // 00:01 WIB 8 Nov
    const a = wibDayWindow(beforeMidnight);
    const b = wibDayWindow(afterMidnight);
    expect(a.start.getTime()).not.toBe(b.start.getTime());
    expect(b.start.getTime()).toBe(a.end.getTime());
  });

  it('jendela 7 Nov WIB = 2026-11-06 17:00 UTC s/d 2026-11-07 17:00 UTC', () => {
    const w = wibDayWindow(new Date('2026-11-07T10:00:00Z')); // 17:00 WIB 7 Nov
    expect(w.start.toISOString()).toBe('2026-11-06T17:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-11-07T17:00:00.000Z');
  });

  it('dua waktu di hari WIB yang sama → jendela sama', () => {
    const a = wibDayWindow(new Date('2026-11-07T17:00:00Z')); // 00:00 WIB 8 Nov
    const b = wibDayWindow(new Date('2026-11-08T16:59:00Z')); // 23:59 WIB 8 Nov
    expect(a.start.getTime()).toBe(b.start.getTime());
    expect(a.end.getTime()).toBe(b.end.getTime());
  });

  it('tepat tengah malam WIB (00:00) masuk hari baru', () => {
    const w = wibDayWindow(new Date('2026-11-07T17:00:00Z'));
    expect(w.start.toISOString()).toBe('2026-11-07T17:00:00.000Z');
  });
});
