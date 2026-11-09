// scenes.js — Scene factory untuk Stickman Fight Arena (web app).
// Beda dari scenes.js video (konstanta hard-code per episode): di sini satu
// objek SCENE yang bisa dibangun ulang tiap fight oleh fight director
// (buildScene). film.js membaca SCENE.* saat runtime — jadi mengganti scene
// = panggil buildScene() lalu resetSim().
// Semua waktu koreografi = SIM TIME (detik). Hit-stop membekukan sim, jadi
// waktu NYATA = sim + akumulasi freeze (realTime / warp, rumus CF2).

export const W = 720;
export const H = 1280;
export const FPS = 30;
export const GROUND_Y = 880;
export const GRAVITY = 980;

// Map/arena yang bisa dipilih — SKIN VISUAL SAJA. Geometri 720x1280,
// GROUND_Y, dan posisi petarung TIDAK berubah antar map; yang berubah
// hanya background, warna crowd, lantai, dan lighting (di film.js via
// getMapPalette + drawArena per-map).
export const MAPS = [
  { id: 'ring', name: 'Ring Tinju', tagline: 'Arena klasik, terang.' },
  { id: 'gudang', name: 'Gudang Underground', tagline: 'Gelap dan moody, ala Night Fight 4.' },
  { id: 'jalanan', name: 'Jalanan Malam', tagline: 'Neon kota di malam hari.' },
  { id: 'dojo', name: 'Dojo', tagline: 'Sasana tenang, kayu dan kertas.' },
];

// Singleton scene — nilai default (fight Nopan vs Neonimus, 30 dtk).
export const SCENE = {
  W, H, FPS, DURATION: 60, GROUND_Y, GRAVITY,
  FIGHTERS: {
    R: { color: '#C8102E', colorDark: '#7F1D1D', role: 'muaythai', startX: 440, face: 1, gear: null },
    B: { color: '#1D4ED8', colorDark: '#1E3A8A', role: 'gulat', startX: 840, face: -1, gear: null },
  },
  NAMES: { R: 'Nopan', B: 'Neonimus' },
  WINNER: 'R', RESULT: 'decision', KO_T: 99,
  WALK: { start: 0.0, end: 1.0, R: 585, B: 695 },
  STEPS: [], RETREATS: [], CHEERS: [], ATTACKS: [], CLINCHES: [], KNOCKDOWNS: [],
  HITSTOPS: [], FIGHT_REAL: 30, BELL_T: 30,
  INTRO_DUR: 3.0, DECISION_DUR: 5.0, KO_DUR: 5.0, OUTRO_DUR: 3.0,
  TITLE: { start: 0.2, end: 2.4 },
  KO_TEXT_T: 999, WIN_POSE_T: 99,
  WEAPON: null, // {who:'R'|'B', t, x} — tongkat kayu di tepi ring
  SEED: 0,
  MAP: 'ring', // id map aktif (lihat MAPS) — skin visual saja
};

// Hit-stop CF2 (§17): frame @30fps per kind/outcome.
const HITSTOP_FRAMES = {
  jab: 1, jabR: 1, cross: 2, hook: 2, hookR: 2, uppercut: 2,
  bodyshot: 2, bodyshotR: 2, teep: 1, lowkick: 2, roundhouse: 2,
  bodykick: 2, headkick: 4, knee: 2, elbow: 2, flyknee: 4, finisher: 4,
  frontkick: 2, spinkick: 2, axekick: 3, overhand: 2, haymaker: 3,
  shove: 1, feint: 0, takedown: 3, clinch: 1, sweep: 2,
  stickswing: 2, stickchop: 3,
};

// Bangun scene baru dari konfigurasi director. cfg:
// { duration, left, right, attacks, knockdowns, cheers, retreats,
//   clinches, winner, result, koT, weapon, seed }
export function buildScene(cfg) {
  SCENE.DURATION = cfg.duration;
  SCENE.FIGHTERS = {
    R: { color: cfg.left.color, colorDark: cfg.left.colorDark, role: cfg.left.style, startX: 440, face: 1, gear: cfg.left },
    B: { color: cfg.right.color, colorDark: cfg.right.colorDark, role: cfg.right.style, startX: 840, face: -1, gear: cfg.right },
  };
  SCENE.NAMES = { R: cfg.left.name, B: cfg.right.name };
  SCENE.WINNER = cfg.winner; // 'R' | 'B'
  SCENE.RESULT = cfg.result; // 'ko' | 'decision'
  SCENE.KO_T = cfg.koT ?? 99;
  SCENE.ATTACKS = cfg.attacks;
  SCENE.KNOCKDOWNS = cfg.knockdowns || [];
  SCENE.CHEERS = cfg.cheers || [];
  SCENE.RETREATS = cfg.retreats || [];
  SCENE.CLINCHES = cfg.clinches || [];
  SCENE.WEAPON = cfg.weapon || null;
  SCENE.SEED = cfg.seed || 0;
  SCENE.MAP = cfg.map || SCENE.MAP || 'ring';
  SCENE.WALK = { start: 0.0, end: 1.0, R: 585, B: 695 };

  // Hit-stop turunan dari ATTACKS (seperti scenes.js video).
  const kds = new Set(SCENE.KNOCKDOWNS.map((k) => k.t));
  SCENE.HITSTOPS = SCENE.ATTACKS
    .filter((a) => a.outcome === 'hit' || a.outcome === 'block' || a.outcome === 'parry')
    .map((a) => {
      let frames = a.outcome === 'hit' ? (HITSTOP_FRAMES[a.kind] ?? 2) : 1;
      // Serangan yang menjatuhkan lawan = momen besar, 4 frame.
      if (a.outcome === 'hit' && a.knockdown) frames = 4;
      return { simT: a.t, dur: frames / FPS };
    });
  {
    let acc = 0;
    for (const hs of SCENE.HITSTOPS) { hs.realT = hs.simT + acc; acc += hs.dur; }
  }
  SCENE.FIGHT_REAL = realTime(SCENE.DURATION);
  SCENE.BELL_T = SCENE.FIGHT_REAL;
  SCENE.KO_TEXT_T = SCENE.RESULT === 'ko' ? realTime(SCENE.KO_T) + 0.3 : 999;
  SCENE.WIN_POSE_T = 99;
  return SCENE;
}

// sim time -> real time (untuk sinkron SFX & teks KO)
export function realTime(simT) {
  let extra = 0;
  for (const hs of SCENE.HITSTOPS) if (simT >= hs.simT) extra += hs.dur;
  return simT + extra;
}
// real time -> sim time (dipakai render per frame)
export function warp(t) {
  let s = t;
  for (const hs of SCENE.HITSTOPS) {
    if (t > hs.realT) s -= Math.min(hs.dur, t - hs.realT);
  }
  return Math.max(0, s);
}
