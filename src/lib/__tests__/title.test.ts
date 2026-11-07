import { describe, expect, it } from 'vitest';
import {
  TITLE_RACE_AFTER_VACANCY_TARGET,
  TITLE_RACE_FIRST_TARGET,
  TITLE_VACANCY_MS,
  applyTitleResultPure,
  isVacantDueToInactivity,
  vacateTitlePure,
  type TitleState,
} from '../game/title';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-11-07T12:00:00+07:00');

function vacantState(overrides: Partial<TitleState> = {}): TitleState {
  return {
    holderFighterId: null,
    wonAt: null,
    lastFightAt: null,
    defenses: 0,
    raceTarget: TITLE_RACE_FIRST_TARGET,
    raceStartAt: T0,
    everVacated: false,
    ...overrides,
  };
}

function heldState(overrides: Partial<TitleState> = {}): TitleState {
  return vacantState({
    holderFighterId: 'fighter-holder',
    wonAt: T0,
    lastFightAt: T0,
    defenses: 3,
    raceTarget: TITLE_RACE_FIRST_TARGET,
    raceStartAt: null,
    ...overrides,
  });
}

describe('Gelar: kekosongan 6 hari', () => {
  it('tepat 6 hari → belum kosong (batas: > 6 hari)', () => {
    const state = heldState();
    expect(
      isVacantDueToInactivity(state, new Date(T0.getTime() + TITLE_VACANCY_MS)),
    ).toBe(false);
  });

  it('6 hari + 1 detik → kosong', () => {
    const state = heldState();
    expect(
      isVacantDueToInactivity(state, new Date(T0.getTime() + TITLE_VACANCY_MS + 1000)),
    ).toBe(true);
  });

  it('7 hari → kosong', () => {
    expect(isVacantDueToInactivity(heldState(), new Date(T0.getTime() + 7 * DAY))).toBe(true);
  });

  it('gelar sudah kosong → tidak vacant lagi', () => {
    expect(isVacantDueToInactivity(vacantState(), new Date(T0.getTime() + 30 * DAY))).toBe(false);
  });

  it('vacateTitlePure: event + snapshot defenses + race berikutnya target 7', () => {
    const { state, event } = vacateTitlePure(
      heldState({ defenses: 4 }),
      new Date(T0.getTime() + 7 * DAY),
    );
    expect(event).not.toBeNull();
    expect(event?.type).toBe('vacated_inactivity');
    expect(event?.previousHolderFighterId).toBe('fighter-holder');
    expect(event?.newHolderFighterId).toBeNull();
    expect(event?.defensesAtEnd).toBe(4);
    expect(state.holderFighterId).toBeNull();
    expect(state.defenses).toBe(0);
    expect(state.raceTarget).toBe(TITLE_RACE_AFTER_VACANCY_TARGET);
    expect(state.everVacated).toBe(true);
    expect(state.raceStartAt?.getTime()).toBe(T0.getTime() + 7 * DAY);
  });

  it('vacateTitlePure sebelum waktunya → event null, state tidak berubah', () => {
    const state = heldState();
    const { state: next, event } = vacateTitlePure(state, new Date(T0.getTime() + 3 * DAY));
    expect(event).toBeNull();
    expect(next).toEqual(state);
  });
});

describe('Gelar: race', () => {
  it('race pertama: 9 kemenangan belum jadi juara, 10 → race_10_win', () => {
    const base = vacantState();
    const fight = (wins: number) => ({
      fighterAId: 'fighter-a',
      fighterBId: 'fighter-b',
      winnerFighterId: 'fighter-a',
      method: 'decision' as const,
      completedAt: new Date(T0.getTime() + DAY),
      fightId: 'fight-1',
      raceWinsOfWinner: wins,
    });
    const nine = applyTitleResultPure(base, fight(9));
    expect(nine.events).toHaveLength(0);
    expect(nine.state.holderFighterId).toBeNull();
    expect(nine.isTitleFight).toBe(false);

    const ten = applyTitleResultPure(base, fight(10));
    expect(ten.events).toHaveLength(1);
    expect(ten.events[0].type).toBe('race_10_win');
    expect(ten.events[0].newHolderFighterId).toBe('fighter-a');
    expect(ten.events[0].score).toBe(10);
    expect(ten.state.holderFighterId).toBe('fighter-a');
    expect(ten.state.lastFightAt?.getTime()).toBe(T0.getTime() + DAY);
    expect(ten.isTitleFight).toBe(true);
  });

  it('setelah gelar pernah kosong: race berikutnya target 7 → race_7_win', () => {
    const vacated = vacateTitlePure(heldState(), new Date(T0.getTime() + 7 * DAY)).state;
    expect(vacated.raceTarget).toBe(7);
    const six = applyTitleResultPure(vacated, {
      fighterAId: 'fighter-a',
      fighterBId: 'fighter-b',
      winnerFighterId: 'fighter-a',
      method: 'KO' as const,
      completedAt: new Date(T0.getTime() + 8 * DAY),
      fightId: 'fight-2',
      raceWinsOfWinner: 6,
    });
    expect(six.events).toHaveLength(0);
    const seven = applyTitleResultPure(vacated, {
      fighterAId: 'fighter-a',
      fighterBId: 'fighter-b',
      winnerFighterId: 'fighter-a',
      method: 'KO' as const,
      completedAt: new Date(T0.getTime() + 8 * DAY),
      fightId: 'fight-3',
      raceWinsOfWinner: 7,
    });
    expect(seven.events).toHaveLength(1);
    expect(seven.events[0].type).toBe('race_7_win');
    expect(seven.state.holderFighterId).toBe('fighter-a');
  });
});

describe('Gelar: takeover & defense', () => {
  it('holder kalah → takeover, defenses lama di-snapshot, holder baru defenses 0', () => {
    const out = applyTitleResultPure(heldState({ defenses: 5 }), {
      fighterAId: 'fighter-holder',
      fighterBId: 'fighter-b',
      winnerFighterId: 'fighter-b',
      method: 'decision',
      completedAt: new Date(T0.getTime() + DAY),
      fightId: 'fight-4',
      raceWinsOfWinner: null,
    });
    expect(out.events).toHaveLength(1);
    expect(out.events[0].type).toBe('takeover');
    expect(out.events[0].previousHolderFighterId).toBe('fighter-holder');
    expect(out.events[0].newHolderFighterId).toBe('fighter-b');
    expect(out.events[0].defensesAtEnd).toBe(5);
    expect(out.state.holderFighterId).toBe('fighter-b');
    expect(out.state.defenses).toBe(0);
    expect(out.isTitleFight).toBe(true);
  });

  it('holder menang → defenses +1, lastFightAt diupdate, tanpa event', () => {
    const out = applyTitleResultPure(heldState({ defenses: 2 }), {
      fighterAId: 'fighter-holder',
      fighterBId: 'fighter-b',
      winnerFighterId: 'fighter-holder',
      method: 'KO',
      completedAt: new Date(T0.getTime() + 2 * DAY),
      fightId: 'fight-5',
      raceWinsOfWinner: null,
    });
    expect(out.events).toHaveLength(0);
    expect(out.state.defenses).toBe(3);
    expect(out.state.lastFightAt?.getTime()).toBe(T0.getTime() + 2 * DAY);
    expect(out.isTitleFight).toBe(true);
  });

  it('DRAW holder vs penantang → gelar TIDAK pindah, lastFightAt tetap diupdate', () => {
    const out = applyTitleResultPure(heldState({ defenses: 2 }), {
      fighterAId: 'fighter-holder',
      fighterBId: 'fighter-b',
      winnerFighterId: null,
      method: 'draw',
      completedAt: new Date(T0.getTime() + 2 * DAY),
      fightId: 'fight-6',
      raceWinsOfWinner: null,
    });
    expect(out.events).toHaveLength(0);
    expect(out.state.holderFighterId).toBe('fighter-holder');
    expect(out.state.defenses).toBe(2);
    expect(out.state.lastFightAt?.getTime()).toBe(T0.getTime() + 2 * DAY);
    expect(out.isTitleFight).toBe(true);
  });

  it('DRAW dua non-holder saat gelar kosong → tidak ada perubahan', () => {
    const out = applyTitleResultPure(vacantState(), {
      fighterAId: 'fighter-a',
      fighterBId: 'fighter-b',
      winnerFighterId: null,
      method: 'draw',
      completedAt: new Date(T0.getTime() + DAY),
      fightId: 'fight-7',
      raceWinsOfWinner: null,
    });
    expect(out.events).toHaveLength(0);
    expect(out.state.holderFighterId).toBeNull();
    expect(out.isTitleFight).toBe(false);
  });

  it('fight dua non-holder saat gelar dipegang orang lain → gelar tidak berubah', () => {
    const out = applyTitleResultPure(heldState(), {
      fighterAId: 'fighter-a',
      fighterBId: 'fighter-b',
      winnerFighterId: 'fighter-a',
      method: 'decision',
      completedAt: new Date(T0.getTime() + DAY),
      fightId: 'fight-8',
      raceWinsOfWinner: 3,
    });
    expect(out.events).toHaveLength(0);
    expect(out.state.holderFighterId).toBe('fighter-holder');
    expect(out.isTitleFight).toBe(false);
  });
});
