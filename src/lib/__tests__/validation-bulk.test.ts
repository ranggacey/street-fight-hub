import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import {
  MAX_BULK_OPPONENTS,
  validateBulkChallengeBody,
} from '../validation';

/**
 * Batas tantang-banyak-orang: "Tantang Semua" harus muat seluruh roster
 * (saat ini ~20 fighter) dan tetap ada batas wajar anti-spam.
 */
function makeIds(n: number): string[] {
  return Array.from({ length: n }, () => new Types.ObjectId().toString());
}

describe('MAX_BULK_OPPONENTS', () => {
  it('50 — cukup untuk "Tantang Semua" saat roster tumbuh', () => {
    expect(MAX_BULK_OPPONENTS).toBe(50);
  });
});

describe('validateBulkChallengeBody', () => {
  it('menerima 50 lawan (batas atas)', () => {
    const out = validateBulkChallengeBody({
      opponentIds: makeIds(50),
      map: 'ring',
    });
    expect(out.opponentIds).toHaveLength(50);
    expect(out.map).toBe('ring');
  });

  it('menolak 51 lawan', () => {
    expect(() =>
      validateBulkChallengeBody({ opponentIds: makeIds(51), map: 'ring' }),
    ).toThrow('Maksimal 50 lawan sekali kirim');
  });

  it('tetap menolak daftar kosong', () => {
    expect(() =>
      validateBulkChallengeBody({ opponentIds: [], map: 'ring' }),
    ).toThrow('Pilih minimal 1 lawan untuk ditantang');
  });
});
