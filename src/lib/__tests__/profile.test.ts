import { describe, expect, it } from 'vitest';
import type { Fighter, GameFight } from '@/components/types';
import { summarizeMyFight } from '../profile';

const ME = { _id: 'me', displayName: 'Saya' } as Fighter;
const FOE = { _id: 'lawan', displayName: 'Lawan' } as Fighter;

function fight(over: Partial<GameFight>): GameFight {
  return {
    _id: 'fight-1',
    fighterAId: ME,
    fighterBId: FOE,
    status: 'completed',
    result: {
      winnerFighterId: 'me',
      method: 'KO',
      score: { a: 40, b: 0 },
      koTimeSec: 27.9,
    },
    isTitleFight: false,
    completedAt: '2026-11-07T18:59:00.000Z',
    ...over,
  } as GameFight;
}

describe('summarizeMyFight (riwayat profil)', () => {
  it('menang KO di sisi A: lawan + skor apa adanya', () => {
    const s = summarizeMyFight(fight({}), 'me');
    expect(s.opponentName).toBe('Lawan');
    expect(s.result).toBe('win');
    expect(s.method).toBe('KO');
    expect(s.score).toEqual({ a: 40, b: 0 });
    expect(s.koTimeSec).toBe(27.9);
  });

  it('saya di sisi B: lawan jadi A dan skor dibalik', () => {
    const f = fight({
      fighterAId: FOE,
      fighterBId: ME,
      result: {
        winnerFighterId: 'lawan',
        method: 'decision',
        score: { a: 43, b: 11 },
        koTimeSec: null,
      },
    });
    const s = summarizeMyFight(f, 'me');
    expect(s.opponentName).toBe('Lawan');
    expect(s.result).toBe('loss');
    expect(s.score).toEqual({ a: 11, b: 43 });
  });

  it('draw: hasil seri walau winnerFighterId null', () => {
    const f = fight({
      result: {
        winnerFighterId: null,
        method: 'draw',
        score: { a: 20, b: 20 },
        koTimeSec: null,
      },
    });
    expect(summarizeMyFight(f, 'me').result).toBe('draw');
  });

  it('fight belum selesai: hasil null', () => {
    const f = fight({ status: 'playing', result: null });
    const s = summarizeMyFight(f, 'me');
    expect(s.result).toBeNull();
    expect(s.method).toBeNull();
  });

  it('fight perebutan gelar ditandai', () => {
    expect(summarizeMyFight(fight({ isTitleFight: true }), 'me').isTitleFight).toBe(true);
  });
});
