import { describe, expect, it } from 'vitest';
import {
  adminTournamentActions,
  defaultDrawRound,
  filterAdminTournaments,
} from '../api';
import type { MatchItem, Tournament } from '../types';

/**
 * Admin turnamen (Tugas 5): tab/filter, aksi per status, dan default
 * ronde undi. Semua helper murni — dites tanpa DOM.
 */

function tournament(
  slug: string,
  status: Tournament['status'],
  participantCount = 4,
): Tournament {
  return {
    id: slug,
    name: slug,
    slug,
    bracketSize: 32,
    regOpenAt: '2026-11-07T00:00:00.000Z',
    regCloseAt: '2026-11-14T00:00:00.000Z',
    status,
    participantCount,
  };
}

function match(round: MatchItem['round'], status: MatchItem['status'], isBye = false): MatchItem {
  return {
    id: `${round}-${status}-${Math.random()}`,
    round,
    fighterAId: 'a',
    fighterBId: isBye ? null : 'b',
    isBye,
    status,
  };
}

describe('filterAdminTournaments', () => {
  const all = [
    tournament('t-upcoming', 'upcoming'),
    tournament('t-closed', 'closed'),
    tournament('t-progress', 'in_progress'),
    tournament('t-done', 'completed'),
    tournament('t-cancel', 'cancelled'),
  ];

  it('Kelola: hanya upcoming + closed (yang masih bisa dikelola)', () => {
    expect(filterAdminTournaments(all, 'kelola').map((t) => t.slug)).toEqual([
      't-upcoming',
      't-closed',
    ]);
  });

  it('Berlangsung: upcoming + closed + in_progress', () => {
    expect(filterAdminTournaments(all, 'berlangsung').map((t) => t.slug)).toEqual([
      't-upcoming',
      't-closed',
      't-progress',
    ]);
  });

  it('Selesai: hanya completed + cancelled', () => {
    expect(filterAdminTournaments(all, 'selesai').map((t) => t.slug)).toEqual([
      't-done',
      't-cancel',
    ]);
  });
});

describe('adminTournamentActions', () => {
  it('upcoming: edit + tutup + batalkan + generate bracket', () => {
    expect(adminTournamentActions('upcoming')).toEqual([
      'edit',
      'close',
      'cancel',
      'generate-bracket',
      'view-public',
    ]);
  });

  it('closed: tanpa tombol tutup (pendaftaran sudah ditutup)', () => {
    const actions = adminTournamentActions('closed');
    expect(actions).toContain('generate-bracket');
    expect(actions).not.toContain('close');
    expect(actions).not.toContain('draw-match');
    expect(actions).not.toContain('draw-round');
  });

  it('in_progress: ada undi per-match + per-ronde, tanpa edit/tutup/batalkan', () => {
    const actions = adminTournamentActions('in_progress');
    expect(actions).toContain('draw-match');
    expect(actions).toContain('draw-round');
    expect(actions).toContain('reshuffle');
    expect(actions).not.toContain('edit');
    expect(actions).not.toContain('close');
    expect(actions).not.toContain('cancel');
    expect(actions).not.toContain('generate-bracket');
  });

  it('completed/cancelled: TIDAK ADA aksi undi/generate — hanya lihat', () => {
    for (const status of ['completed', 'cancelled'] as const) {
      const actions = adminTournamentActions(status);
      expect(actions).toEqual(['view-bracket', 'view-public']);
      expect(actions).not.toContain('draw-match');
      expect(actions).not.toContain('draw-round');
      expect(actions).not.toContain('generate-bracket');
    }
  });
});

describe('defaultDrawRound', () => {
  it('4 peserta, bracket SF → default SF (bukan R16 hardcode)', () => {
    const t = tournament('t4', 'in_progress', 4);
    expect(
      defaultDrawRound(t, [match('SF', 'scheduled'), match('SF', 'scheduled')]),
    ).toBe('SF');
  });

  it('ronde pertama sudah habis → default ronde berikut yang masih terjadwal', () => {
    const t = tournament('t8', 'in_progress', 8);
    expect(
      defaultDrawRound(t, [
        match('QF', 'decided'),
        match('QF', 'decided'),
        match('SF', 'scheduled'),
      ]),
    ).toBe('SF');
  });

  it('tanpa bracket: 7 peserta → QF (target 8), 12 peserta → R16, 20 → R32', () => {
    expect(defaultDrawRound(tournament('t7', 'in_progress', 7), [])).toBe('QF');
    expect(defaultDrawRound(tournament('t12', 'in_progress', 12), [])).toBe('R16');
    expect(defaultDrawRound(tournament('t20', 'in_progress', 20), [])).toBe('R32');
  });

  it('bye tidak dihitung sebagai match yang bisa diundi', () => {
    const t = tournament('t5', 'in_progress', 5);
    // 5 peserta → 1 match QF + 3 bye (bye decided). Default tetap QF dari
    // match scheduled, bukan dari bye.
    expect(
      defaultDrawRound(t, [
        match('QF', 'scheduled'),
        match('QF', 'decided', true),
        match('QF', 'decided', true),
        match('QF', 'decided', true),
      ]),
    ).toBe('QF');
  });
});
