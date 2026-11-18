/**
 * Simulasi sekali pakai: wira vs esje, 1000 fight per level stat.
 *
 * Jalankan: SIM_N=1000 npx tsx scripts/simulate-wira-esje.ts
 *   (default N=1000; durasi 60 dtk; seed berbeda tiap fight)
 *
 * Mengimpor engine vendor (src/lib/fight-engine/fight.js) + modul
 * stat-effects — angka di sini = angka yang dipakai fight nyata.
 * TIDAK menyentuh database/API: buildFight fungsi murni, semua
 * perhitungan in-memory di proses ini.
 *
 * ASUMSI (stat + deck asli wira/esje TIDAK bisa dibaca publik —
 * /api/fighters tidak mengembalikan stat/deck, /api/deck butuh login):
 * - Matchup SIMETRIS di tiga level stat: 10, 30, 50 (kelima stat —
 *   power, speed, stamina, defense, accuracy — sama di level itu
 *   untuk kedua petarung).
 * - Keduanya gaya muay-thai, tempo agresif, deck kuat yang sama
 *   (DECK_KUAT: headkick, roundhouse, uppercut, hook, bodykick,
 *   lowkick; signature flyknee) — sesuai data publik (keduanya
 *   muay-thai, agresif, signature flyknee).
 * - Rating Elo (1081 vs 1010) BUKAN input engine — tidak dipakai.
 * Dengan stat/deck simetris, skor matchup v2 = 0: pemenang dari form
 * noise seed — 50/50 di antara fight non-draw (decision 60% / KO 30%
 * / draw 10%).
 */
import { buildFight } from '../src/lib/fight-engine/fight.js';
import {
  buildFightOpts,
  type Gameplan,
  type Stats,
} from '../src/lib/game/stat-effects';

const N = Number(process.env.SIM_N ?? 1000);
const DURATION = 60;

function statsAt(level: number): Stats {
  return { power: level, speed: level, stamina: level, defense: level, accuracy: level };
}

// wira = kiri (R), esje = kanan (B). fighters = { R: left, B: right }.
const WIRA = { name: 'wira', color: '#ef4444', style: 'muaythai', tempo: 'agresif' };
const ESJE = { name: 'esje', color: '#3b82f6', style: 'muaythai', tempo: 'agresif' };

const DECK_KUAT = {
  cards: ['headkick', 'roundhouse', 'uppercut', 'hook', 'bodykick', 'lowkick'],
  signature: 'flyknee',
};
const AGRESIF: Gameplan = { tempo: 'agresif', focus: 'balanced' };

const LEVELS = [10, 30, 50];

interface Row {
  level: number;
  matchupScore: number;
  winWira: number;
  winEsje: number;
  draw: number;
  ko: number;
  kdPerFight: number;
  kdByWira: number;
  kdByEsje: number;
}

function run(level: number, baseSeed: number): Row {
  const stats = statsAt(level);
  const opts = buildFightOpts(stats, stats, DECK_KUAT, DECK_KUAT, AGRESIF, AGRESIF);
  let winWira = 0;
  let winEsje = 0;
  let draw = 0;
  let ko = 0;
  let kd = 0;
  let kdByWira = 0;
  let kdByEsje = 0;
  for (let i = 0; i < N; i++) {
    const f = buildFight(WIRA, ESJE, DURATION, baseSeed + i, opts);
    if (f.result === 'draw') draw++;
    else if (f.winner === 'R') winWira++;
    else winEsje++;
    if (f.result === 'ko') ko++;
    kd += f.knockdowns.length;
    for (const k of f.knockdowns) {
      // k.who = yang JATUH; wira menjatuhkan esje => who === 'B'.
      if (k.who === 'B') kdByWira++;
      else kdByEsje++;
    }
  }
  // Sanity: semua fight harus terhitung.
  if (winWira + winEsje + draw !== N) {
    throw new Error(
      `level ${level}: total tidak cocok (${winWira}+${winEsje}+${draw} != ${N})`,
    );
  }
  const pct = (x: number) => Math.round((x / N) * 1000) / 10;
  return {
    level,
    matchupScore: opts.matchupScore,
    winWira: pct(winWira),
    winEsje: pct(winEsje),
    draw: pct(draw),
    ko: pct(ko),
    kdPerFight: Math.round((kd / N) * 100) / 100,
    kdByWira: Math.round((kdByWira / N) * 100) / 100,
    kdByEsje: Math.round((kdByEsje / N) * 100) / 100,
  };
}

const rows: Row[] = LEVELS.map((lv, idx) => run(lv, 2_000_000 + idx * 100_000));

const pad = (s: string, n: number) => s.padEnd(n);
console.log(`\nSimulasi wira vs esje — ${N} fight/level, durasi ${DURATION} dtk`);
console.log(
  'Asumsi: stat simetris (10/30/50), muay-thai, tempo agresif, deck kuat + signature flyknee untuk keduanya.',
);
console.log(
  `${pad('Level', 8)} ${pad('Skor', 9)} ${pad('Wira menang', 12)} ${pad('Esje menang', 12)} ${pad('Draw', 7)} ${pad('KO', 7)} ${pad('KD/fight', 10)} ${pad('KD oleh wira', 13)} ${pad('KD oleh esje', 13)}`,
);
for (const r of rows) {
  console.log(
    `${pad(String(r.level), 8)} ${pad(String(r.matchupScore), 9)} ${pad(`${r.winWira}%`, 12)} ${pad(`${r.winEsje}%`, 12)} ${pad(`${r.draw}%`, 7)} ${pad(`${r.ko}%`, 7)} ${pad(String(r.kdPerFight), 10)} ${pad(String(r.kdByWira), 13)} ${pad(String(r.kdByEsje), 13)}`,
  );
}
