import { describe, expect, it } from 'vitest';
import {
  buildFight,
  RING_X_MIN,
  RING_X_MAX,
} from '../fight-engine/fight.js';
import type { EngineFighter } from '../fight-engine/verify';
import { DMG_BASE, BLOCK_CHIP } from '../fight-engine/damage.js';

// Statistik engine baru 2026-11-08 (cermin Arena tests/run.mjs §26):
// damage x0,25, rate hit 80% / guard 10% / dodge 10%, knockdown 10%
// per hit kena, aksi merata 60 dtk (tanpa zona mati), petarung di dalam
// ring. Engine harus md5-identik Arena = Hub, jadi angka di sini harus
// cocok dengan §26 Arena (toleransi statistik yang sama).
const LEFT = {
  name: 'Nopan',
  color: '#eab308',
  style: 'muaythai',
  tempo: 'seimbang',
} as unknown as EngineFighter;
const RIGHT = {
  name: 'Neonimus',
  color: '#3b82f6',
  style: 'gulat',
  tempo: 'seimbang',
  weapon: { kind: 'kayu' },
} as unknown as EngineFighter;
const DURATION = 60;
const N = 300;

const FINISHER = new Set(['finisher', 'flyknee', 'stickchop']);
const DODGES = new Set(['slip', 'duck', 'roll', 'sidestep', 'parry', 'flinch']);

type Atk = { t: number; by: string; kind: string; outcome: string; power: number; knockdown?: boolean };

function dmgOf(a: Atk): number {
  const base = (DMG_BASE as Record<string, number>)[a.kind] ?? 10;
  if (a.outcome === 'hit') return base * a.power * (FINISHER.has(a.kind) ? 1.5 : 1);
  if (a.outcome === 'block') return a.power >= 1.3 ? BLOCK_CHIP * a.power : BLOCK_CHIP;
  return 0;
}

function hpAt(fight: { attacks: Atk[] }, t: number): { hpR: number; hpB: number } {
  let hpR = 100;
  let hpB = 100;
  for (const a of fight.attacks) {
    if (a.t > t) break;
    if (a.kind === 'feint' || a.kind === 'ginga') continue;
    const d = dmgOf(a);
    if (a.by === 'R') hpB = Math.max(0, hpB - d);
    else hpR = Math.max(0, hpR - d);
  }
  return { hpR, hpB };
}

function runStats() {
  let nHit = 0;
  let nBlock = 0;
  let nDodge = 0;
  let nSched = 0;
  let nKD = 0;
  let nLanded = 0;
  const hpLow30: number[] = [];
  const hpLow40: number[] = [];
  const hitWin = [0, 0, 0, 0, 0, 0];
  let emptyWin = 0;
  let posOutside = 0;
  let posSamples = 0;
  let guardFired = 0;
  let koAlive = 0;
  for (let s = 1; s <= N; s++) {
    const f = buildFight(LEFT, RIGHT, DURATION, s) as unknown as {
      result: string;
      winner: string | null;
      hpFinal: { R: number; B: number };
      attacks: Atk[];
      knockdowns: unknown[];
      positions: { xR: number; xB: number }[];
    };
    const rec = hpAt(f, 60);
    if (Math.abs(rec.hpR - f.hpFinal.R) > 1.5 || Math.abs(rec.hpB - f.hpFinal.B) > 1.5) guardFired++;
    if (f.result === 'ko') {
      const loserHp = f.winner === 'R' ? f.hpFinal.B : f.hpFinal.R;
      if (loserHp > 0) koAlive++;
    }
    hpLow30.push(Math.min(hpAt(f, 30).hpR, hpAt(f, 30).hpB));
    hpLow40.push(Math.min(hpAt(f, 40).hpR, hpAt(f, 40).hpB));
    const hitInWin = [0, 0, 0, 0, 0, 0];
    for (const a of f.attacks) {
      if (a.kind === 'feint' || a.kind === 'ginga') continue;
      nSched++;
      const w = Math.min(5, Math.floor(a.t / 10));
      if (a.outcome === 'hit') {
        nHit++;
        hitWin[w]++;
        hitInWin[w]++;
        nLanded++;
      } else if (a.outcome === 'block') nBlock++;
      else if (DODGES.has(a.outcome)) nDodge++;
    }
    nKD += f.knockdowns.length;
    for (let w = 0; w < 6; w++) if (hitInWin[w] === 0) emptyWin++;
    for (const p of f.positions) {
      posSamples++;
      if (p.xR < RING_X_MIN || p.xR > RING_X_MAX || p.xB < RING_X_MIN || p.xB > RING_X_MAX) posOutside++;
    }
  }
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  return {
    hitPct: (nHit / nSched) * 100,
    blockPct: (nBlock / nSched) * 100,
    dodgePct: (nDodge / nSched) * 100,
    kdPct: (nKD / nLanded) * 100,
    nKD,
    nLanded,
    nSched,
    hpLow30: mean(hpLow30),
    hpLow40: mean(hpLow40),
    hitWinMean: hitWin.map((h) => h / N),
    emptyWin,
    posOutside,
    posSamples,
    guardFired,
    koAlive,
  };
}

describe('Statistik engine baru 2026-11-08 (cermin Arena §26)', () => {
  const st = runStats();

  it(`rate hit 68-82% (target ~80%): ${st.hitPct.toFixed(1)}%`, () => {
    expect(st.hitPct).toBeGreaterThanOrEqual(68);
    expect(st.hitPct).toBeLessThanOrEqual(82);
  });

  it(`rate guard/block 6-15% (target ~10%): ${st.blockPct.toFixed(1)}%`, () => {
    expect(st.blockPct).toBeGreaterThanOrEqual(6);
    expect(st.blockPct).toBeLessThanOrEqual(15);
  });

  it(`rate dodge 10-22% (target ~10%, steering penjamin hasil): ${st.dodgePct.toFixed(1)}%`, () => {
    expect(st.dodgePct).toBeGreaterThanOrEqual(10);
    expect(st.dodgePct).toBeLessThanOrEqual(22);
  });

  it(`knockdown 6-14% per hit kena (target 10%): ${st.kdPct.toFixed(1)}% (${st.nKD} KD / ${st.nLanded} hit)`, () => {
    expect(st.kdPct).toBeGreaterThanOrEqual(6);
    expect(st.kdPct).toBeLessThanOrEqual(14);
  });

  it(`HP terendah mean @30 dtk >= 35 (tidak hampir habis): ${st.hpLow30.toFixed(1)}`, () => {
    expect(st.hpLow30).toBeGreaterThanOrEqual(35);
  });

  it(`HP terendah mean @40 dtk >= 22 (tidak hampir habis): ${st.hpLow40.toFixed(1)}`, () => {
    expect(st.hpLow40).toBeGreaterThanOrEqual(22);
  });

  it(`tiap jendela 10 dtk rata-rata >= 4 hit (tanpa zona mati): ${st.hitWinMean.map((h) => h.toFixed(1)).join('/')}`, () => {
    for (const h of st.hitWinMean) expect(h).toBeGreaterThanOrEqual(4);
  });

  it(`jendela kosong (0 hit) <= 1% pasangan fight-jendela: ${st.emptyWin}/${N * 6}`, () => {
    expect(st.emptyWin).toBeLessThanOrEqual(N * 6 * 0.01);
  });

  it(`posisi petarung di dalam ring [380,900] (0 di luar): ${st.posOutside}/${st.posSamples}`, () => {
    expect(st.posOutside).toBe(0);
  });

  it(`guard decision tidak jalan (hpFinal konsisten dgn serangan): ${st.guardFired} fight`, () => {
    expect(st.guardFired).toBe(0);
  });

  it(`KO: pecundang HP 0 (tidak hidup): ${st.koAlive} fight`, () => {
    expect(st.koAlive).toBe(0);
  });
});
