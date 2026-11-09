/**
 * Service gelar (DB). Membungkus inti murni ./title.ts:
 * - getOrCreateTitle(): singleton "Juara Street Fight".
 * - ensureTitleCurrent(): pengecekan kekosongan 6 hari secara LAZY —
 *   dipanggil di awal GET /api/title, GET /api/title/history,
 *   challenge accept, dan result recording.
 * - applyTitleAfterFight(): terapkan hasil fight terverifikasi + tulis
 *   TitleHistory + notifikasi perubahan gelar.
 */
import { Types } from 'mongoose';
import { Fighter } from '../../models/Fighter';
import { GameFight } from '../../models/GameFight';
import { Title } from '../../models/Title';
import { TitleHistory } from '../../models/TitleHistory';
import {
  applyTitleResultPure,
  vacateTitlePure,
  type TitleEvent,
  type TitleState,
} from './title';
import { notifyFighterOwner } from './notify';

type TitleDoc = {
  _id: Types.ObjectId;
  holderFighterId: Types.ObjectId | null;
  wonAt: Date | null;
  lastFightAt: Date | null;
  defenses: number;
  raceTarget: number;
  raceStartAt: Date | null;
  everVacated: boolean;
  save: () => Promise<unknown>;
};

function toState(doc: TitleDoc): TitleState {
  return {
    holderFighterId: doc.holderFighterId ? doc.holderFighterId.toString() : null,
    wonAt: doc.wonAt,
    lastFightAt: doc.lastFightAt,
    defenses: doc.defenses,
    raceTarget: doc.raceTarget,
    raceStartAt: doc.raceStartAt,
    everVacated: doc.everVacated,
  };
}

async function writeState(doc: TitleDoc, state: TitleState): Promise<void> {
  doc.holderFighterId = state.holderFighterId
    ? new Types.ObjectId(state.holderFighterId)
    : null;
  doc.wonAt = state.wonAt;
  doc.lastFightAt = state.lastFightAt;
  doc.defenses = state.defenses;
  doc.raceTarget = state.raceTarget;
  doc.raceStartAt = state.raceStartAt;
  doc.everVacated = state.everVacated;
  await doc.save();
}

async function writeEvents(events: TitleEvent[]): Promise<void> {
  for (const e of events) {
    await TitleHistory.create({
      type: e.type,
      previousHolderFighterId: e.previousHolderFighterId
        ? new Types.ObjectId(e.previousHolderFighterId)
        : null,
      newHolderFighterId: e.newHolderFighterId
        ? new Types.ObjectId(e.newHolderFighterId)
        : null,
      at: e.at,
      fightId: e.fightId ? new Types.ObjectId(e.fightId) : null,
      score: e.score,
      defensesAtEnd: e.defensesAtEnd,
      raceStartAt: e.raceStartAt,
    });
  }
}

/**
 * Ambil dokumen Title (singleton slug 'juara-street-fight'), buat kalau
 * belum ada. ATOMIK via upsert: findOne lalu create rawan race — dua
 * request bersamaan (mis. dua quick-fight / dua accept) sama-sama
 * menemukan kosong lalu create ganda dan satu kena E11000 (slug unik).
 * findOneAndUpdate + $setOnInsert hanya membuat SATU dokumen.
 */
export async function getOrCreateTitle(): Promise<TitleDoc> {
  const doc = (await Title.findOneAndUpdate(
    { slug: 'juara-street-fight' },
    {
      $setOnInsert: {
        name: 'Juara Street Fight',
        slug: 'juara-street-fight',
        holderFighterId: null,
        wonAt: null,
        lastFightAt: null,
        defenses: 0,
        raceTarget: 10,
        raceStartAt: new Date(),
        everVacated: false,
      },
    },
    { upsert: true, returnDocument: 'after' },
  )) as unknown as TitleDoc;
  return doc;
}

/**
 * Lazy vacancy check. Kembalikan dokumen Title (sudah ter-update kalau
 * baru saja dikosongkan) + apakah ada event kekosongan yang ditulis.
 */
export async function ensureTitleCurrent(
  now: Date = new Date(),
): Promise<{ title: TitleDoc; vacated: boolean }> {
  const doc = await getOrCreateTitle();
  const { state, event } = vacateTitlePure(toState(doc), now);
  if (!event) return { title: doc, vacated: false };
  await writeState(doc, state);
  await writeEvents([event]);
  if (event.previousHolderFighterId) {
    await notifyFighterOwner(event.previousHolderFighterId, 'title_vacant', null);
  }
  return { title: doc, vacated: true };
}

/** Total kemenangan race satu fighter sejak raceStartAt (GameFight completed). */
export async function countRaceWins(
  fighterId: string,
  raceStartAt: Date,
): Promise<number> {
  return GameFight.countDocuments({
    status: 'completed',
    completedAt: { $gte: raceStartAt },
    'result.winnerFighterId': new Types.ObjectId(fighterId),
  });
}

export interface TitleApplyResult {
  events: TitleEvent[];
  isTitleFight: boolean;
}

/**
 * Terapkan hasil fight yang SUDAH completed + terverifikasi ke gelar.
 * Dipanggil dari POST /api/game-fights/[id]/result setelah fight disimpan.
 */
export async function applyTitleAfterFight(fight: {
  _id: Types.ObjectId | string;
  fighterAId: Types.ObjectId | string;
  fighterBId: Types.ObjectId | string;
  result: {
    winnerFighterId: Types.ObjectId | string | null;
    method: 'KO' | 'decision' | 'draw' | null;
  };
  completedAt: Date | null;
}): Promise<TitleApplyResult> {
  const { title } = await ensureTitleCurrent(
    fight.completedAt ? new Date(fight.completedAt) : new Date(),
  );
  const state = toState(title);
  const completedAt = fight.completedAt ? new Date(fight.completedAt) : new Date();
  const winnerId = fight.result.winnerFighterId
    ? fight.result.winnerFighterId.toString()
    : null;

  // Race wins hanya dihitung saat gelar kosong (hemat query).
  let raceWins: number | null = null;
  if (
    state.holderFighterId === null &&
    winnerId &&
    fight.result.method !== 'draw' &&
    state.raceStartAt
  ) {
    raceWins = await countRaceWins(winnerId, new Date(state.raceStartAt));
  }

  const outcome = applyTitleResultPure(state, {
    fighterAId: fight.fighterAId.toString(),
    fighterBId: fight.fighterBId.toString(),
    winnerFighterId: winnerId,
    method: fight.result.method ?? 'draw',
    completedAt,
    fightId: fight._id.toString(),
    raceWinsOfWinner: raceWins,
  });
  await writeState(title, outcome.state);
  await writeEvents(outcome.events);

  for (const e of outcome.events) {
    if (e.type === 'takeover' || e.type === 'race_10_win' || e.type === 'race_7_win') {
      if (e.newHolderFighterId) {
        await notifyFighterOwner(e.newHolderFighterId, 'title_won', fight._id.toString());
      }
      if (e.type === 'takeover' && e.previousHolderFighterId) {
        await notifyFighterOwner(
          e.previousHolderFighterId,
          'title_lost',
          fight._id.toString(),
        );
      }
    }
  }
  return { events: outcome.events, isTitleFight: outcome.isTitleFight };
}

/** Data publik GET /api/title: holder + progres race saat kosong. */
export async function getTitlePublic(now: Date = new Date()): Promise<{
  holder: Record<string, unknown> | null;
  wonAt: string | null;
  lastFightAt: string | null;
  defenses: number;
  raceTarget: number;
  raceStartAt: string | null;
  everVacated: boolean;
  vacant: boolean;
  vacatesAt: string | null;
  raceStandings: { fighterId: string; displayName: string; wins: number }[];
}> {
  const { title } = await ensureTitleCurrent(now);
  const state = toState(title);
  let holder: Record<string, unknown> | null = null;
  if (state.holderFighterId) {
    const f = await Fighter.findById(state.holderFighterId)
      .select('displayName igUsername style styleOther rating record')
      .lean();
    if (f) {
      holder = {
        id: f._id.toString(),
        displayName: f.displayName,
        igUsername: f.igUsername,
        style: f.style,
        styleOther: f.styleOther ?? null,
        rating: f.rating ?? 1000,
        record: f.record ?? { wins: 0, losses: 0, draws: 0, kos: 0 },
      };
    }
  }

  // Top 3 race saat gelar kosong (untuk progres di /gelar).
  let raceStandings: { fighterId: string; displayName: string; wins: number }[] = [];
  if (!state.holderFighterId && state.raceStartAt) {
    const agg = await GameFight.aggregate([
      {
        $match: {
          status: 'completed',
          completedAt: { $gte: new Date(state.raceStartAt) },
          'result.winnerFighterId': { $ne: null },
        },
      },
      { $group: { _id: '$result.winnerFighterId', wins: { $sum: 1 } } },
      { $sort: { wins: -1 } },
      { $limit: 3 },
    ]);
    raceStandings = await Promise.all(
      agg.map(async (row: { _id: Types.ObjectId; wins: number }) => {
        const f = await Fighter.findById(row._id).select('displayName').lean();
        return {
          fighterId: row._id.toString(),
          displayName: f?.displayName ?? '—',
          wins: row.wins,
        };
      }),
    );
  }

  const vacatesAt =
    state.holderFighterId && state.lastFightAt
      ? new Date(new Date(state.lastFightAt).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString()
      : null;
  return {
    holder,
    wonAt: state.wonAt ? new Date(state.wonAt).toISOString() : null,
    lastFightAt: state.lastFightAt ? new Date(state.lastFightAt).toISOString() : null,
    defenses: state.defenses,
    raceTarget: state.raceTarget,
    raceStartAt: state.raceStartAt ? new Date(state.raceStartAt).toISOString() : null,
    everVacated: state.everVacated,
    vacant: state.holderFighterId === null,
    vacatesAt,
    raceStandings,
  };
}
