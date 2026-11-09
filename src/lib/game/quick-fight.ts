/**
 * Gas Tarung (quick match): cari lawan yang tersedia untuk satu fighter.
 *
 * Lawan yang eligible: fighter aktif (bukan diri sendiri), masih punya
 * jatah tarung hari ini (3 fight/hari WIB), dan TIDAK sedang dalam
 * fight aktif (status pending/playing). Diprioritaskan yang ratingnya
 * dalam ±100 dari ratingku; kalau tidak ada, fallback ke lawan
 * tersedia yang ratingnya paling dekat.
 *
 * Race: pemilihan lawan di sini hanya MEMBACA — pengaman race yang
 * sebenarnya ada di route (klaim challenge atomik + verifikasi
 * satu-fight-aktif setelah GameFight dibuat + rollback). Dua
 * quick-fight bersamaan yang memilih lawan yang sama tidak bisa
 * menghasilkan dua fight aktif untuk lawan itu: yang kalah verifikasi
 * di-rollback dan dijawab 409 QUICK_FIGHT_CONFLICT (klien retry sekali).
 */
import { randomInt } from 'node:crypto';
import { Fighter } from '../../models/Fighter';
import { GameFight } from '../../models/GameFight';
import {
  ARENA_MAPS,
  type ArenaMap,
  type FighterLike,
} from './engine-config';
import { countFightsTodayByFighter, DAILY_FIGHT_LIMIT } from './daily-limit';

/** Lawan diprioritaskan kalau selisih rating ≤ 100; selebihnya fallback. */
export const QUICK_FIGHT_RATING_WINDOW = 100;

/** Kandidat lawan quick-fight (objek fighter engine + selisih rating). */
export interface QuickFightCandidate extends FighterLike {
  id: string;
  rating: number;
  ratingDiff: number;
}

/** Berapa fight aktif (pending/playing) yang melibatkan fighter ini? */
export async function countActiveFights(fighterId: string): Promise<number> {
  return GameFight.countDocuments({
    status: { $in: ['pending', 'playing'] },
    $or: [{ fighterAId: fighterId }, { fighterBId: fighterId }],
  });
}

/** Id semua fighter yang sedang dalam fight aktif (pending/playing). */
export async function busyFighterIds(): Promise<Set<string>> {
  const rows = await GameFight.find({ status: { $in: ['pending', 'playing'] } })
    .select('fighterAId fighterBId')
    .lean();
  const out = new Set<string>();
  for (const r of rows) {
    out.add(r.fighterAId.toString());
    out.add(r.fighterBId.toString());
  }
  return out;
}

/**
 * Cari lawan quick-fight untuk satu fighter. Mengembalikan kandidat
 * terbaik (selisih rating terkecil, prefer dalam ±100) atau null kalau
 * tidak ada lawan yang eligible saat ini.
 */
export async function findQuickFightOpponent(
  myFighterId: string,
  myRating: number,
): Promise<QuickFightCandidate | null> {
  const fighters = await Fighter.find({
    status: 'active',
    _id: { $ne: myFighterId },
  })
    .select('displayName style signatureMove tempo colors accessories rating createdAt')
    .sort({ createdAt: 1 })
    .lean();
  if (fighters.length === 0) return null;

  const [usedToday, busy] = await Promise.all([
    countFightsTodayByFighter(),
    busyFighterIds(),
  ]);

  const candidates: QuickFightCandidate[] = [];
  for (const f of fighters) {
    const id = f._id.toString();
    // Sibuk: sedang dalam fight yang belum selesai.
    if (busy.has(id)) continue;
    // Jatah habis: sudah 3 fight hari ini (WIB).
    if ((usedToday.get(id) ?? 0) >= DAILY_FIGHT_LIMIT) continue;
    const rating = f.rating ?? 1000;
    candidates.push({
      id,
      displayName: f.displayName,
      style: f.style,
      signatureMove: f.signatureMove ?? null,
      tempo: f.tempo ?? null,
      colors: (f.colors ?? null) as QuickFightCandidate['colors'],
      accessories: (f.accessories ?? null) as QuickFightCandidate['accessories'],
      rating,
      ratingDiff: Math.abs(rating - myRating),
    });
  }

  // Urut selisih rating terkecil dulu (yang paling seimbang duluan).
  candidates.sort((a, b) => a.ratingDiff - b.ratingDiff);
  // Prefer dalam jendela ±100; kalau tidak ada, fallback ke yang paling dekat.
  return (
    candidates.find((c) => c.ratingDiff <= QUICK_FIGHT_RATING_WINDOW) ??
    candidates[0] ??
    null
  );
}

/** Pilih map acak untuk quick fight (tanpa pilih arena). */
export function pickRandomMap(): ArenaMap {
  return ARENA_MAPS[randomInt(0, ARENA_MAPS.length)];
}
