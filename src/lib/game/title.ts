/**
 * Logika gelar — INTI MURNI (tanpa DB, bisa unit-test dengan fake timer).
 *
 * Aturan persis user (2026-11-07):
 * - Race: kemenangan dihitung dari GameFight TERVERIFIKASI (completed)
 *   dengan completedAt >= raceStartAt. Yang dihitung TOTAL kemenangan,
 *   BUKAN beruntun (keputusan sementara — catat di laporan Fase 1).
 * - Race pertama target 10 (event race_10_win). Setelah gelar pernah
 *   kosong, semua race berikutnya target 7 (event race_7_win).
 * - Transfer: holder KALAH fight 1v1 terverifikasi lawan petarung lain →
 *   pemenang jadi holder baru (event takeover; defenses holder lama
 *   di-snapshot di defensesAtEnd). DRAW tidak memindahkan gelar.
 * - Defense: holder MENANG saat memegang gelar → defenses += 1.
 *   lastFightAt holder diupdate di SETIAP fight holder (menang/kalah/seri).
 * - Kekosongan 6 hari: now - holder.lastFightAt > 6 hari → gelar kosong
 *   (event vacated_inactivity + snapshot defenses reign yang berakhir).
 *   Pengecekan LAZY via ensureTitleCurrent() (tanpa cron di Fase 1).
 *
 * Service DB-nya ada di ./title-service.ts; file ini hanya memutuskan
 * state berikutnya dari state sekarang + satu hasil fight.
 */

export const TITLE_VACANCY_MS = 6 * 24 * 60 * 60 * 1000; // 6 hari
export const TITLE_RACE_FIRST_TARGET = 10;
export const TITLE_RACE_AFTER_VACANCY_TARGET = 7;

export interface TitleState {
  holderFighterId: string | null;
  wonAt: Date | null;
  lastFightAt: Date | null;
  defenses: number;
  raceTarget: number;
  raceStartAt: Date | null;
  everVacated: boolean;
}

export type TitleEventType =
  | 'race_10_win'
  | 'race_7_win'
  | 'takeover'
  | 'vacated_inactivity';

export interface TitleEvent {
  type: TitleEventType;
  previousHolderFighterId: string | null;
  newHolderFighterId: string | null;
  at: Date;
  fightId: string | null;
  score: number | null;
  defensesAtEnd: number | null;
  raceStartAt: Date | null;
}

/** Apakah gelar harus dikosongkan karena holder 6 hari tidak bertarung? */
export function isVacantDueToInactivity(state: TitleState, now: Date): boolean {
  if (!state.holderFighterId) return false;
  const last = state.lastFightAt ?? state.wonAt;
  if (!last) return false;
  return now.getTime() - new Date(last).getTime() > TITLE_VACANCY_MS;
}

/**
 * Kosongkan gelar karena inaktivitas (pure). Kembalikan state baru +
 * event (atau null kalau belum waktunya kosong).
 */
export function vacateTitlePure(
  state: TitleState,
  now: Date,
): { state: TitleState; event: TitleEvent | null } {
  if (!isVacantDueToInactivity(state, now)) return { state, event: null };
  const event: TitleEvent = {
    type: 'vacated_inactivity',
    previousHolderFighterId: state.holderFighterId,
    newHolderFighterId: null,
    at: now,
    fightId: null,
    score: null,
    defensesAtEnd: state.defenses,
    raceStartAt: null,
  };
  return {
    state: {
      ...state,
      holderFighterId: null,
      wonAt: null,
      lastFightAt: null,
      defenses: 0,
      raceTarget: TITLE_RACE_AFTER_VACANCY_TARGET,
      raceStartAt: now,
      everVacated: true,
    },
    event,
  };
}

export interface TitleFightInput {
  fighterAId: string;
  fighterBId: string;
  winnerFighterId: string | null; // null = draw
  method: 'KO' | 'decision' | 'draw';
  completedAt: Date;
  fightId: string;
  /** Total kemenangan race pemenang sejak raceStartAt (dihitung service, hanya saat gelar kosong). */
  raceWinsOfWinner: number | null;
}

export interface TitleApplyOutcome {
  state: TitleState;
  events: TitleEvent[];
  /** Fight ini menentukan/mempertahankan gelar → buat VideoTask. */
  isTitleFight: boolean;
}

/**
 * Terapkan SATU hasil fight terverifikasi ke state gelar.
 * Dipanggil SETELAH fight berstatus completed (raceWinsOfWinner sudah
 * termasuk fight ini).
 */
export function applyTitleResultPure(
  state: TitleState,
  input: TitleFightInput,
): TitleApplyOutcome {
  const holderId = state.holderFighterId;
  const holderParticipated =
    holderId !== null &&
    (input.fighterAId === holderId || input.fighterBId === holderId);
  const holderWon = holderId !== null && input.winnerFighterId === holderId;
  const holderLost =
    holderParticipated && input.winnerFighterId !== null && !holderWon;
  const events: TitleEvent[] = [];
  let next: TitleState = { ...state };
  let isTitleFight = false;

  if (input.method === 'draw') {
    // Seri: gelar tidak pindah; lastFightAt holder tetap diupdate.
    if (holderParticipated) {
      next = { ...next, lastFightAt: input.completedAt };
      isTitleFight = true;
    }
    return { state: next, events, isTitleFight };
  }

  if (holderWon) {
    next = {
      ...next,
      defenses: next.defenses + 1,
      lastFightAt: input.completedAt,
    };
    isTitleFight = true;
    return { state: next, events, isTitleFight };
  }

  if (holderLost && input.winnerFighterId) {
    events.push({
      type: 'takeover',
      previousHolderFighterId: holderId,
      newHolderFighterId: input.winnerFighterId,
      at: input.completedAt,
      fightId: input.fightId,
      score: null,
      defensesAtEnd: state.defenses,
      raceStartAt: null,
    });
    next = {
      ...next,
      holderFighterId: input.winnerFighterId,
      wonAt: input.completedAt,
      lastFightAt: input.completedAt,
      defenses: 0,
      raceStartAt: null,
    };
    isTitleFight = true;
    return { state: next, events, isTitleFight };
  }

  // Gelar kosong: cek apakah pemenang menyelesaikan race.
  if (
    holderId === null &&
    input.winnerFighterId &&
    input.raceWinsOfWinner !== null &&
    input.raceWinsOfWinner >= state.raceTarget
  ) {
    const type: TitleEventType =
      state.raceTarget === TITLE_RACE_FIRST_TARGET ? 'race_10_win' : 'race_7_win';
    events.push({
      type,
      previousHolderFighterId: null,
      newHolderFighterId: input.winnerFighterId,
      at: input.completedAt,
      fightId: input.fightId,
      score: input.raceWinsOfWinner,
      defensesAtEnd: null,
      raceStartAt: state.raceStartAt,
    });
    next = {
      ...next,
      holderFighterId: input.winnerFighterId,
      wonAt: input.completedAt,
      lastFightAt: input.completedAt,
      defenses: 0,
      raceStartAt: null,
    };
    isTitleFight = true;
    return { state: next, events, isTitleFight };
  }

  return { state: next, events, isTitleFight };
}
