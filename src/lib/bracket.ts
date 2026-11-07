/**
 * Bracket single-elimination — fungsi murni (CONTRACT §5).
 * - target = pangkat 2 terbesar ≤ n (min 4)
 * - n === target → 0 bye
 * - n > target → matchesR1 = n - target, byes = 2*target - n
 * - Ronde berikut dibuat hanya saat kedua pemenang diketahui (advanceWinners di lib/draw.ts)
 */

export type RoundName = 'R32' | 'R16' | 'QF' | 'SF' | 'F';

export function largestPowerOfTwo(n: number): number {
  if (!Number.isInteger(n) || n < 4) {
    throw new Error('Turnamen butuh min 4 peserta');
  }
  let p = 4;
  while (p * 2 <= n) p *= 2;
  return p;
}

export function roundNameForTarget(target: number): RoundName[] {
  if (target === 32) return ['R32', 'R16', 'QF', 'SF', 'F'];
  if (target === 16) return ['R16', 'QF', 'SF', 'F'];
  if (target === 8) return ['QF', 'SF', 'F'];
  if (target === 4) return ['SF', 'F'];
  throw new Error('Target bracket tidak valid');
}

export function nextRound(round: RoundName): RoundName | null {
  const map: Record<RoundName, RoundName | null> = {
    R32: 'R16',
    R16: 'QF',
    QF: 'SF',
    SF: 'F',
    F: null,
  };
  return map[round] ?? null;
}

/** mulberry32 — PRNG kecil untuk shuffle yang bisa di-seed (duplikat dari lib/draw.ts agar modul ini tetap murni tanpa import DB). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleSeeded<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface BracketMatchInput {
  fighterAId: string;
  fighterBId: string | null;
  isBye: boolean;
  winnerId: string | null;
  method: 'bye' | null;
  status: 'scheduled' | 'decided';
}

/**
 * Bolehkan acak ulang bracket? Hanya jika bracket SUDAH dibuat tapi BELUM
 * ada pertandingan sungguhan yang diundi: semua match masih di satu ronde
 * yang sama (ronde pertama) dan tidak ada match non-bye yang decided.
 * Bye boleh decided (bye diputuskan otomatis saat bracket dibuat).
 * Setelah satu ronde diundi, ronde berikut sudah terbentuk → tidak boleh.
 */
export function canReshuffle(
  matches: { round: string; isBye?: boolean; status?: string }[],
): boolean {
  if (matches.length === 0) return false;
  const rounds = new Set(matches.map((m) => m.round));
  if (rounds.size !== 1) return false;
  return matches.every((m) => m.isBye === true || m.status === 'scheduled');
}

/**
 * Urutan match dalam satu ronde untuk tampilan pohon: sama seperti yang
 * dipakai advanceWinners (createdAt, lalu id) — pemenang match ke-i ronde
 * ini dipasangkan ke match ke-floor(i/2) ronde berikut.
 */
export function sortMatchesForTree<T extends { createdAt?: string; id?: string; _id?: string }>(
  matches: T[],
): T[] {
  return [...matches].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return String(a.id ?? a._id ?? '').localeCompare(String(b.id ?? b._id ?? ''));
  });
}

/**
 * Path SVG siku (elbow) dari sisi kanan match asal ke sisi kiri match
 * tujuan: horizontal → vertikal → horizontal. Kalau y sama, garis lurus.
 */
export function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  if (y1 === y2) return `M ${x1} ${y1} H ${x2}`;
  return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
}

export interface BuildBracketResult {
  target: number;
  rounds: RoundName[];
  firstRound: RoundName;
  matches: BracketMatchInput[];
  byes: string[];
  bracketSeed: number;
  /** Urutan fighter setelah shuffle (dipakai untuk mengisi seed entry). */
  order: string[];
}

export function buildBracket(entries: string[], seed?: number): BuildBracketResult {
  const n = entries.length;
  const target = largestPowerOfTwo(n);
  const bracketSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  const shuffled = shuffleSeeded(entries, bracketSeed);
  const rounds = roundNameForTarget(target);
  const firstRound = rounds[0];
  const matches: BracketMatchInput[] = [];
  const byes: string[] = [];

  if (n === target) {
    for (let i = 0; i < n; i += 2) {
      matches.push({
        fighterAId: shuffled[i],
        fighterBId: shuffled[i + 1],
        isBye: false,
        winnerId: null,
        method: null,
        status: 'scheduled',
      });
    }
  } else {
    const matchesR1 = n - target;
    const byeCount = 2 * target - n;
    for (let i = 0; i < matchesR1; i++) {
      matches.push({
        fighterAId: shuffled[i * 2],
        fighterBId: shuffled[i * 2 + 1],
        isBye: false,
        winnerId: null,
        method: null,
        status: 'scheduled',
      });
    }
    for (let i = 0; i < byeCount; i++) {
      const fighter = shuffled[matchesR1 * 2 + i];
      byes.push(fighter);
      matches.push({
        fighterAId: fighter,
        fighterBId: null,
        isBye: true,
        winnerId: fighter,
        method: 'bye',
        status: 'decided',
      });
    }
  }

  return { target, rounds, firstRound, matches, byes, bracketSeed, order: shuffled };
}
