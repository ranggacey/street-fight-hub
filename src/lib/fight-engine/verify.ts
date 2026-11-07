/**
 * Verifikasi hasil fight di server (Fase 1 integrasi game).
 *
 * Prinsip: server adalah otoritas. Klien (iframe arena) hanya
 * mempertunjukkan fight; hasil yang dilaporkan klien TIDAK dipercaya
 * untuk ranking sebelum dicocokkan dengan jalankan ulang `buildFight`
 * dari seed + config tersimpan (engine yang di-vendor di folder ini).
 *
 * KEPUTUSAN `opts` (ambiguitas EMBED-CONTRACT §3/§6, diselesaikan dari
 * kode arena `js/app.js` + `js/fight.js`):
 * - Hub TIDAK mengirim `opts` di `sfa-config` (tanpa forcedResult, tanpa
 *   weights/tempo eksplisit) — sesuai kontrak "Fase 1: jangan kirim opts".
 * - `tempo` + `signatureMove` BUKAN pilihan klien: keduanya adalah atribut
 *   fighter yang ditentukan server (disimpan di dokumen Fighter) dan
 *   dikirim sebagai bagian dari objek fighter di `sfa-config`.
 * - `buildFight` membaca keduanya langsung dari objek fighter
 *   (`tempoOf` + bobot 2.5x untuk `signatureMove` di `fight.js`), jadi
 *   server memverifikasi dengan memanggil `buildFight` memakai objek
 *   fighter yang PERSIS SAMA dengan yang dikirim ke iframe (disimpan di
 *   `GameFight.config`), tanpa `opts` (di `app.js`, `embed.fightOpts`
 *   bernilai `null` saat tidak ada opts — dan `buildFight` memperlakukan
 *   `null` sama dengan `{}` karena semua akses memakai `opts?.`).
 * - Warna (`colors`/`color`) dan nama TIDAK memengaruhi hasil buildFight
 *   (hanya dipakai render), tapi tetap disimpan di config supaya replay
 *   Fase 2 menampilkan petarung yang identik.
 */
import { buildFight, fightStats, keyMoments } from './fight.js';

export type EngineSide = 'R' | 'B';

export interface EngineFighter {
  name: string;
  color: string;
  style: string;
  colors?: {
    body: string;
    gloves: string;
    shoes: string;
    belt: string;
    headband: string;
    weapon: string;
  };
  signatureMove?: string;
  tempo?: 'agresif' | 'seimbang' | 'bertahan';
  weapon?: { kind: string; hand?: string; color?: string };
  [key: string]: unknown;
}

export interface FightStats {
  accuracyA: number;
  accuracyB: number;
  damageDealtA: number;
  damageDealtB: number;
  strikesThrownA: number;
  strikesThrownB: number;
  strikesLandedA: number;
  strikesLandedB: number;
  knockdowns: number;
}

export interface KeyMomentHit {
  by: 'L' | 'R';
  move: string;
  damage?: number;
  timeSec: number;
}

export interface KeyMoments {
  biggestHit: KeyMomentHit | null;
  finisher: { by: 'L' | 'R'; move: string; timeSec: number } | null;
  knockdowns: { by: 'L' | 'R'; timeSec: number }[];
  leadChange: { timeSec: number; by: 'L' | 'R' } | null;
}

/** Bentuk hasil yang dilaporkan klien (`sfa-result`, EMBED-CONTRACT §8). */
export interface ClientResult {
  winner: EngineSide | null;
  method: 'KO' | 'decision' | 'draw';
  score: { a: number; b: number };
  koTimeSec: number | null;
  stats: FightStats | null;
  keyMoments?: KeyMoments | null;
  seed?: number;
  posterDataUrl?: string | null;
}

/** Hasil yang diharapkan menurut jalankan ulang server. */
export interface ExpectedResult {
  winner: EngineSide | null;
  method: 'KO' | 'decision' | 'draw';
  score: { a: number; b: number };
  koTimeSec: number | null;
  stats: FightStats;
  keyMoments: KeyMoments;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

function close(a: number, b: number, eps = 0.0015): boolean {
  return Math.abs(a - b) <= eps;
}

/**
 * Jalankan ulang fight dari seed + config tersimpan, kembalikan hasil
 * yang diharapkan (bentuk yang sama dengan `sfa-result`).
 */
export function expectedResult(
  left: EngineFighter,
  right: EngineFighter,
  durationSec: number,
  seed: number,
): ExpectedResult {
  const fight = buildFight(left, right, durationSec, seed);
  const isDraw =
    fight.result === 'decision' && fight.hpFinal.R === fight.hpFinal.B;
  return {
    winner: isDraw ? null : (fight.winner as EngineSide),
    method:
      fight.result === 'ko' ? 'KO' : isDraw ? 'draw' : 'decision',
    score: { a: fight.hpFinal.R, b: fight.hpFinal.B },
    koTimeSec: fight.result === 'ko' ? round2(fight.koT) : null,
    stats: fightStats(fight) as FightStats,
    keyMoments: keyMoments(fight) as KeyMoments,
  };
}

export type VerifyFailureReason =
  | 'seed_mismatch'
  | 'winner_mismatch'
  | 'method_mismatch'
  | 'score_mismatch'
  | 'ko_time_mismatch'
  | 'stats_mismatch'
  | 'invalid_payload';

export interface VerifyOutcome {
  ok: boolean;
  expected: ExpectedResult;
  reason?: VerifyFailureReason;
  detail?: string;
}

/**
 * Cocokkan hasil laporan klien dengan jalankan ulang server.
 * winner/method/score/koTimeSec/stats harus cocok — kalau tidak, fight
 * berstatus `disputed` dan ranking TIDAK berubah.
 * `keyMoments` TIDAK dipakai untuk verifikasi (versi server yang disimpan
 * sebagai otoritatif); klien bisa mengirimnya apa adanya.
 */
export function verifyFightResult(
  left: EngineFighter,
  right: EngineFighter,
  durationSec: number,
  seed: number,
  client: ClientResult | null | undefined,
): VerifyOutcome {
  const expected = expectedResult(left, right, durationSec, seed);
  if (!client || typeof client !== 'object') {
    return { ok: false, expected, reason: 'invalid_payload' };
  }
  if (typeof client.seed === 'number' && client.seed !== seed) {
    return {
      ok: false,
      expected,
      reason: 'seed_mismatch',
      detail: `seed laporan ${client.seed} != seed fight ${seed}`,
    };
  }
  if (client.winner !== expected.winner) {
    return {
      ok: false,
      expected,
      reason: 'winner_mismatch',
      detail: `winner laporan ${String(client.winner)} != ${String(expected.winner)}`,
    };
  }
  if (client.method !== expected.method) {
    return {
      ok: false,
      expected,
      reason: 'method_mismatch',
      detail: `method laporan ${client.method} != ${expected.method}`,
    };
  }
  if (
    !client.score ||
    client.score.a !== expected.score.a ||
    client.score.b !== expected.score.b
  ) {
    return {
      ok: false,
      expected,
      reason: 'score_mismatch',
      detail: `score laporan ${JSON.stringify(client.score)} != ${JSON.stringify(expected.score)}`,
    };
  }
  const clientKo =
    client.koTimeSec === null || client.koTimeSec === undefined
      ? null
      : client.koTimeSec;
  if (
    (clientKo === null) !== (expected.koTimeSec === null) ||
    (clientKo !== null &&
      expected.koTimeSec !== null &&
      !close(clientKo, expected.koTimeSec, 0.011))
  ) {
    return {
      ok: false,
      expected,
      reason: 'ko_time_mismatch',
      detail: `koTimeSec laporan ${String(clientKo)} != ${String(expected.koTimeSec)}`,
    };
  }
  const s = client.stats;
  const e = expected.stats;
  if (
    !s ||
    !close(s.accuracyA, e.accuracyA) ||
    !close(s.accuracyB, e.accuracyB) ||
    !close(s.damageDealtA, e.damageDealtA) ||
    !close(s.damageDealtB, e.damageDealtB) ||
    s.strikesThrownA !== e.strikesThrownA ||
    s.strikesThrownB !== e.strikesThrownB ||
    s.strikesLandedA !== e.strikesLandedA ||
    s.strikesLandedB !== e.strikesLandedB ||
    s.knockdowns !== e.knockdowns
  ) {
    return {
      ok: false,
      expected,
      reason: 'stats_mismatch',
      detail: 'stats laporan tidak sama dengan jalankan ulang server',
    };
  }
  return { ok: true, expected };
}
