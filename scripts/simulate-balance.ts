/**
 * Simulasi balance Training+Stat+Deck (Node, via tsx).
 *
 * Jalankan: npm run simulate-balance  (N default 2000/matchup)
 *   SIM_N=500 npm run simulate-balance  (cepat, untuk iterasi tuning)
 *
 * Mengimpor engine vendor (src/lib/fight-engine/fight.js) + modul
 * stat-effects — jadi angka di sini = angka yang dipakai fight nyata.
 * Tiap matchup: N fight dengan seed berbeda; win rate dihitung dari
 * hasil buildFight (bukan dari teori winBias saja — damage, stamina,
 * dan knockdown ikut bermain).
 *
 * Syarat yang dicek (perintah user 2026-11-10/11):
 * - Stat sama → win rate 40–60% (tidak ada yang diuntungkan).
 * - Keunggulan stat jelas → >60% (keunggulan harus terasa) tapi <100%.
 * - Knockdown/fight harus BERVARIASI dengan stat (bukan angka tetap).
 */
import { buildFight } from '../src/lib/fight-engine/fight.js';
import {
  buildFightOpts,
  type Gameplan,
  type Stats,
} from '../src/lib/game/stat-effects';

const N = Number(process.env.SIM_N ?? 2000);
const DURATION = 60;

function statsAt(level: number): Stats {
  return { power: level, speed: level, stamina: level, defense: level, accuracy: level };
}

const LEFT = { name: 'Merah', color: '#ef4444', style: 'tinju', tempo: 'seimbang' };
const RIGHT = { name: 'Biru', color: '#3b82f6', style: 'muaythai', tempo: 'seimbang' };

interface Matchup {
  name: string;
  leftStats: Stats;
  rightStats: Stats;
  leftDeck?: { cards: string[]; signature?: string | null };
  rightDeck?: { cards: string[]; signature?: string | null };
  leftGameplan?: Gameplan;
  rightGameplan?: Gameplan;
}

const DECK_KUAT = {
  cards: ['headkick', 'roundhouse', 'uppercut', 'hook', 'bodykick', 'lowkick'],
  signature: 'flyknee',
};
const NO_DECK = { cards: [], signature: null };
const SEIMBANG: Gameplan = { tempo: 'seimbang', focus: 'balanced' };
const AGRESIF: Gameplan = { tempo: 'agresif', focus: 'balanced' };
const BERTAHAN: Gameplan = { tempo: 'bertahan', focus: 'balanced' };

const MATCHUPS: Matchup[] = [
  { name: '10v10 (netral)', leftStats: statsAt(10), rightStats: statsAt(10) },
  { name: '30v10', leftStats: statsAt(30), rightStats: statsAt(10) },
  { name: '50v10', leftStats: statsAt(50), rightStats: statsAt(10) },
  { name: '80v80', leftStats: statsAt(80), rightStats: statsAt(80) },
  { name: '100v10', leftStats: statsAt(100), rightStats: statsAt(10) },
  { name: '100v100', leftStats: statsAt(100), rightStats: statsAt(100) },
  {
    name: 'deck vs tanpa deck (30v30)',
    leftStats: statsAt(30),
    rightStats: statsAt(30),
    leftDeck: DECK_KUAT,
    rightDeck: NO_DECK,
  },
  {
    name: 'agresif vs bertahan (30v30)',
    leftStats: statsAt(30),
    rightStats: statsAt(30),
    leftGameplan: AGRESIF,
    rightGameplan: BERTAHAN,
  },
];

interface Row {
  name: string;
  winR: number;
  winB: number;
  draw: number;
  ko: number;
  kdPerFight: number;
  kdR: number;
  kdB: number;
}

function run(m: Matchup, baseSeed: number): Row {
  const opts = buildFightOpts(
    m.leftStats,
    m.rightStats,
    m.leftDeck ?? NO_DECK,
    m.rightDeck ?? NO_DECK,
    m.leftGameplan ?? SEIMBANG,
    m.rightGameplan ?? SEIMBANG,
  );
  let winR = 0;
  let winB = 0;
  let draw = 0;
  let ko = 0;
  let kd = 0;
  let kdR = 0;
  let kdB = 0;
  for (let i = 0; i < N; i++) {
    const f = buildFight(LEFT, RIGHT, DURATION, baseSeed + i, opts);
    if (f.result === 'draw') draw++;
    else if (f.winner === 'R') winR++;
    else winB++;
    if (f.result === 'ko') ko++;
    kd += f.knockdowns.length;
    for (const k of f.knockdowns) {
      if (k.who === 'B') kdR++;
      else kdB++;
    }
  }
  const pct = (x: number) => Math.round((x / N) * 1000) / 10;
  return {
    name: m.name,
    winR: pct(winR),
    winB: pct(winB),
    draw: pct(draw),
    ko: pct(ko),
    kdPerFight: Math.round((kd / N) * 100) / 100,
    kdR: Math.round((kdR / N) * 100) / 100,
    kdB: Math.round((kdB / N) * 100) / 100,
  };
}

const rows: Row[] = MATCHUPS.map((m, idx) => run(m, 1_000_000 + idx * 100_000));

const pad = (s: string, n: number) => s.padEnd(n);
console.log(`\nSimulasi balance — ${N} fight/matchup, durasi ${DURATION} dtk`);
console.log(
  `${pad('Matchup', 32)} ${pad('Menang R', 9)} ${pad('Menang B', 9)} ${pad('Draw', 7)} ${pad('KO', 7)} ${pad('KD/fight', 9)} ${pad('KD oleh R', 9)} ${pad('KD oleh B', 9)}`,
);
for (const r of rows) {
  console.log(
    `${pad(r.name, 32)} ${pad(`${r.winR}%`, 9)} ${pad(`${r.winB}%`, 9)} ${pad(`${r.draw}%`, 7)} ${pad(`${r.ko}%`, 7)} ${pad(String(r.kdPerFight), 9)} ${pad(String(r.kdR), 9)} ${pad(String(r.kdB), 9)}`,
  );
}

console.log('\nCek syarat:');
const checks: { label: string; ok: boolean; detail: string }[] = [];
const eq = rows[0];
checks.push({
  label: '10v10 win rate 40–60%',
  ok: eq.winR >= 40 && eq.winR <= 60,
  detail: `R menang ${eq.winR}%`,
});
const adv30 = rows[1];
checks.push({
  label: '30v10 jelas >60% tapi <100%',
  ok: adv30.winR > 60 && adv30.winR < 100,
  detail: `R menang ${adv30.winR}%`,
});
const adv100 = rows[4];
checks.push({
  label: '100v10 >60% tapi <100%',
  ok: adv100.winR > 60 && adv100.winR < 100,
  detail: `R menang ${adv100.winR}%`,
});
const kdVaries =
  Math.max(...rows.map((r) => r.kdPerFight)) - Math.min(...rows.map((r) => r.kdPerFight)) > 0.5;
checks.push({
  label: 'Knockdown/fight bervariasi dengan stat',
  ok: kdVaries,
  detail: `min ${Math.min(...rows.map((r) => r.kdPerFight))} – maks ${Math.max(...rows.map((r) => r.kdPerFight))} KD/fight`,
});
const kdAsym = rows[4].kdR > rows[4].kdB * 1.5;
checks.push({
  label: '100v10: penyerang kuat menjatuhkan jauh lebih sering',
  ok: kdAsym,
  detail: `KD oleh R ${rows[4].kdR}/fight vs oleh B ${rows[4].kdB}/fight`,
});
let allOk = true;
for (const c of checks) {
  console.log(`  ${c.ok ? 'OK  ' : 'GAGAL'} ${c.label} (${c.detail})`);
  if (!c.ok) allOk = false;
}
if (!allOk) {
  console.log('\nAda syarat yang GAGAL — tune winBias/damage di stat-effects.ts lalu ulangi.');
  process.exitCode = 1;
} else {
  console.log('\nSemua syarat balance terpenuhi.');
}
