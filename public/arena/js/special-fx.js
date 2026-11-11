// special-fx.js — Profil FX jurus spesial Arena (visual/audio SAJA).
// Jurus spesial = jurus khas (Fighter.signatureMove, bobot 2.5x di engine)
// ATAU finisher (kind 'finisher' + finisher tiap gaya: flyknee, headkick,
// stickchop). File ini TIDAK mengubah simulasi: tidak ada dmg/range/power
// di sini — hanya warna cincin, burst, shake/zoom, garis gerak, SFX, dan
// pre-effect (debu / garis es / angin saat wind-up) + regang udara.
//
// Standar acuan (CF40 v4): Superman punch = haymaker — back-step dengan debu
// + garis es, dash udara horizontal meregang, starburst OVERSIZED + cincin
// biru es #7DD3FC. Flying knee = cincin oranye #F97316 (CF40 v4). Tiap jurus
// punya SATU warna cincin yang unik (tidak ada dua jurus berbagi warna).
//
// Warna cincin dibuat dari golden-angle hue (137.508 derajat) dengan tiga
// anchor tetap di atas; sisanya deterministik dari daftar kind terurut.
// SFX: kunci = nama file di audio/sfx-bundle.json (base64, lihat sfx.js).
//   punch-heavy-01/04 = Mixkit, kick-01/knee-clinch-01/bodyslam-01 = Mixkit,
//   ko-sting-03 = Animax, wood-staff-01 = Mixkit, whoosh-fast-02 = Mixkit,
//   whoosh-heavy-03 = Animax. punch-anime-01 (inti, disetujui user) tetap
//   dilapis di bawah tiap special hit oleh sfx.js — bukan kunci di sini.

// Kind finisher (cermin FINISHER_KINDS di moves.js + film.js).
export const FINISHER_KINDS = ['finisher', 'flyknee', 'headkick', 'stickchop'];

// Normalisasi kind serangan (cermin kindKey di film.js): varian tangan kanan
// ('jabR'/'hookR'/'bodyshotR') dan alias 'kick' dipetakan ke kind dasar.
export function normalizeKind(kind) {
  if (kind === 'kick') return 'lowkick';
  if (kind === 'jabR') return 'jab';
  if (kind === 'hookR') return 'hook';
  if (kind === 'bodyshotR') return 'bodyshot';
  return kind;
}

// Satu profil per jurus spesial. Bentuk:
//   ringColor  hex unik per kind (cincin impact + garis gerak spesial)
//   ringSize   pengali radius cincin dasar (1.0 = normal; 2.2 = oversized)
//   burst      'starburst' | 'rays' | 'shockwave' | 'sparks'
//   shake      trauma kamera tambahan 0..1 (shake layar cap 5px, film.js)
//   zoom       pengali zoom kamera sesaat (1.0 = tanpa zoom)
//   speedLines garis gerak ekstra di atas garis dasar film.js
//   sfxKey     file impact di sfx-bundle.json
//   whooshKey  file whoosh di sfx-bundle.json (puncak sebelum kontak)
//   preEffect  'dust' | 'ice-lines' | 'wind' | 'none' (saat wind-up)
//   airDash    true = regang horizontal saat melayang/menerjang
export const SPECIAL_FX = {
  abaniko: { ringColor: '#68F391', ringSize: 1.3, burst: 'sparks', shake: 0.4, zoom: 1.02, speedLines: 2, sfxKey: 'special-wood-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'none', airDash: false },
  anklepick: { ringColor: '#8C12E2', ringSize: 1.4, burst: 'rays', shake: 0.5, zoom: 1.04, speedLines: 3, sfxKey: 'special-slam-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  armada: { ringColor: '#EFD839', ringSize: 1.9, burst: 'shockwave', shake: 0.9, zoom: 1.08, speedLines: 5, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: true },
  armbar: { ringColor: '#E21283', ringSize: 1.5, burst: 'sparks', shake: 0.6, zoom: 1.04, speedLines: 3, sfxKey: 'special-knee-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  axekick: { ringColor: '#66EF39', ringSize: 1.7, burst: 'rays', shake: 0.7, zoom: 1.06, speedLines: 4, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: false },
  bodykick: { ringColor: '#6E68F3', ringSize: 1.7, burst: 'rays', shake: 0.7, zoom: 1.06, speedLines: 4, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: false },
  bodyshot: { ringColor: '#39EFAB', ringSize: 1.5, burst: 'starburst', shake: 0.5, zoom: 1.04, speedLines: 3, sfxKey: 'special-punch-heavy-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  bodyslam: { ringColor: '#E768F3', ringSize: 2.0, burst: 'shockwave', shake: 1.0, zoom: 1.1, speedLines: 5, sfxKey: 'special-slam-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: false },
  butterflykick: { ringColor: '#B7E212', ringSize: 2.0, burst: 'shockwave', shake: 0.9, zoom: 1.1, speedLines: 6, sfxKey: 'special-ko-sting-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: true },
  clinch: { ringColor: '#12E224', ringSize: 1.2, burst: 'sparks', shake: 0.3, zoom: 1.02, speedLines: 2, sfxKey: 'special-knee-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'none', airDash: false },
  cross: { ringColor: '#7E39EF', ringSize: 1.3, burst: 'starburst', shake: 0.35, zoom: 1.02, speedLines: 2, sfxKey: 'special-punch-heavy-04.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'none', airDash: false },
  doubleleg: { ringColor: '#F3C568', ringSize: 1.7, burst: 'shockwave', shake: 0.8, zoom: 1.06, speedLines: 4, sfxKey: 'special-slam-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: false },
  elbow: { ringColor: '#12E2DA', ringSize: 1.5, burst: 'sparks', shake: 0.6, zoom: 1.05, speedLines: 3, sfxKey: 'special-knee-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  elbowspin: { ringColor: '#EF39C1', ringSize: 1.7, burst: 'sparks', shake: 0.7, zoom: 1.06, speedLines: 4, sfxKey: 'special-knee-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: false },
  elbowup: { ringColor: '#A7F368', ringSize: 1.5, burst: 'sparks', shake: 0.6, zoom: 1.05, speedLines: 3, sfxKey: 'special-knee-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  finisher: { ringColor: '#EF4444', ringSize: 2.2, burst: 'shockwave', shake: 1.0, zoom: 1.12, speedLines: 6, sfxKey: 'special-ko-sting-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: true },
  flyknee: { ringColor: '#F97316', ringSize: 2.0, burst: 'starburst', shake: 1.0, zoom: 1.1, speedLines: 6, sfxKey: 'special-ko-sting-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: true },
  frontkick: { ringColor: '#1234E2', ringSize: 1.5, burst: 'rays', shake: 0.5, zoom: 1.04, speedLines: 3, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  ginga: { ringColor: '#68F3A2', ringSize: 1.0, burst: 'sparks', shake: 0.1, zoom: 1.0, speedLines: 0, sfxKey: 'special-punch-heavy-04.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'none', airDash: false },
  gyakuzuki: { ringColor: '#A612E2', ringSize: 1.4, burst: 'starburst', shake: 0.4, zoom: 1.02, speedLines: 2, sfxKey: 'special-punch-heavy-04.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'none', airDash: false },
  haymaker: { ringColor: '#7DD3FC', ringSize: 2.2, burst: 'starburst', shake: 1.0, zoom: 1.12, speedLines: 6, sfxKey: 'special-punch-heavy-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'ice-lines', airDash: true },
  headbutt: { ringColor: '#EEEF39', ringSize: 1.5, burst: 'starburst', shake: 0.6, zoom: 1.04, speedLines: 3, sfxKey: 'special-punch-heavy-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  headkick: { ringColor: '#E21268', ringSize: 1.9, burst: 'shockwave', shake: 0.9, zoom: 1.08, speedLines: 5, sfxKey: 'special-ko-sting-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: false },
  hook: { ringColor: '#4FEF39', ringSize: 1.5, burst: 'starburst', shake: 0.5, zoom: 1.04, speedLines: 3, sfxKey: 'special-punch-heavy-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  jab: { ringColor: '#8068F3', ringSize: 1.3, burst: 'starburst', shake: 0.35, zoom: 1.02, speedLines: 2, sfxKey: 'special-punch-heavy-04.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'none', airDash: false },
  knee: { ringColor: '#39EFC2', ringSize: 1.5, burst: 'sparks', shake: 0.6, zoom: 1.05, speedLines: 3, sfxKey: 'special-knee-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  kneediag: { ringColor: '#F368EC', ringSize: 1.5, burst: 'sparks', shake: 0.6, zoom: 1.05, speedLines: 3, sfxKey: 'special-knee-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  lotuskick: { ringColor: '#9CE212', ringSize: 1.9, burst: 'shockwave', shake: 0.9, zoom: 1.08, speedLines: 5, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: true },
  lowkick: { ringColor: '#397CEF', ringSize: 1.4, burst: 'rays', shake: 0.5, zoom: 1.04, speedLines: 3, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  maegeri: { ringColor: '#12E23F', ringSize: 1.5, burst: 'rays', shake: 0.5, zoom: 1.04, speedLines: 3, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  meialua: { ringColor: '#9539EF', ringSize: 1.8, burst: 'shockwave', shake: 0.8, zoom: 1.08, speedLines: 5, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: false },
  meialuafrente: { ringColor: '#F3D768', ringSize: 1.8, burst: 'shockwave', shake: 0.8, zoom: 1.08, speedLines: 5, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: false },
  osotogari: { ringColor: '#EF39AA', ringSize: 1.7, burst: 'shockwave', shake: 0.8, zoom: 1.06, speedLines: 4, sfxKey: 'special-slam-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: false },
  outsidetrip: { ringColor: '#96F368', ringSize: 1.4, burst: 'rays', shake: 0.5, zoom: 1.04, speedLines: 3, sfxKey: 'special-slam-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  overhand: { ringColor: '#121AE2', ringSize: 1.8, burst: 'starburst', shake: 0.9, zoom: 1.08, speedLines: 5, sfxKey: 'special-punch-heavy-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: true },
  pilantik: { ringColor: '#68F3B4', ringSize: 1.7, burst: 'shockwave', shake: 0.7, zoom: 1.06, speedLines: 4, sfxKey: 'special-wood-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: false },
  queixada: { ringColor: '#C112E2', ringSize: 1.8, burst: 'shockwave', shake: 0.8, zoom: 1.08, speedLines: 5, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: false },
  redonda: { ringColor: '#D7EF39', ringSize: 1.6, burst: 'rays', shake: 0.6, zoom: 1.05, speedLines: 4, sfxKey: 'special-wood-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: false },
  roundhouse: { ringColor: '#E2124E', ringSize: 1.7, burst: 'rays', shake: 0.7, zoom: 1.06, speedLines: 4, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: false },
  seoinage: { ringColor: '#39EF3A', ringSize: 1.7, burst: 'shockwave', shake: 0.8, zoom: 1.06, speedLines: 4, sfxKey: 'special-slam-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: false },
  shove: { ringColor: '#9168F3', ringSize: 1.2, burst: 'rays', shake: 0.3, zoom: 1.02, speedLines: 2, sfxKey: 'special-punch-heavy-04.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'wind', airDash: false },
  shuto: { ringColor: '#39EFD9', ringSize: 1.5, burst: 'starburst', shake: 0.5, zoom: 1.04, speedLines: 3, sfxKey: 'special-punch-heavy-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  sidekick: { ringColor: '#F368DB', ringSize: 1.5, burst: 'rays', shake: 0.6, zoom: 1.04, speedLines: 3, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: false },
  sinawali: { ringColor: '#82E212', ringSize: 1.6, burst: 'sparks', shake: 0.6, zoom: 1.05, speedLines: 4, sfxKey: 'special-wood-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'wind', airDash: false },
  singleleg: { ringColor: '#3965EF', ringSize: 1.7, burst: 'shockwave', shake: 0.8, zoom: 1.06, speedLines: 4, sfxKey: 'special-slam-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: false },
  spinhookkick: { ringColor: '#12E259', ringSize: 1.8, burst: 'shockwave', shake: 0.8, zoom: 1.08, speedLines: 5, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: false },
  spinkick: { ringColor: '#AC39EF', ringSize: 1.8, burst: 'shockwave', shake: 0.8, zoom: 1.08, speedLines: 5, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: false },
  stickchop: { ringColor: '#F3E868', ringSize: 2.0, burst: 'shockwave', shake: 1.0, zoom: 1.1, speedLines: 5, sfxKey: 'special-wood-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: false },
  straightlead: { ringColor: '#EF3992', ringSize: 1.3, burst: 'starburst', shake: 0.35, zoom: 1.02, speedLines: 2, sfxKey: 'special-punch-heavy-04.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'none', airDash: false },
  suplex: { ringColor: '#84F368', ringSize: 2.0, burst: 'shockwave', shake: 1.0, zoom: 1.1, speedLines: 5, sfxKey: 'special-slam-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: false },
  sweep: { ringColor: '#2512E2', ringSize: 1.4, burst: 'rays', shake: 0.5, zoom: 1.04, speedLines: 3, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
  takedown: { ringColor: '#68F3C6', ringSize: 1.7, burst: 'shockwave', shake: 0.8, zoom: 1.06, speedLines: 4, sfxKey: 'special-slam-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: false },
  teep: { ringColor: '#DC12E2', ringSize: 1.4, burst: 'rays', shake: 0.4, zoom: 1.02, speedLines: 2, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'none', airDash: false },
  tornadokick: { ringColor: '#C0EF39', ringSize: 2.0, burst: 'shockwave', shake: 0.9, zoom: 1.1, speedLines: 6, sfxKey: 'special-ko-sting-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'wind', airDash: true },
  uchimata: { ringColor: '#39EF51', ringSize: 1.8, burst: 'shockwave', shake: 0.8, zoom: 1.08, speedLines: 5, sfxKey: 'special-slam-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: false },
  uppercut: { ringColor: '#A368F3', ringSize: 1.7, burst: 'starburst', shake: 0.7, zoom: 1.06, speedLines: 4, sfxKey: 'special-punch-heavy-01.mp3', whooshKey: 'special-whoosh-heavy-01.mp3', preEffect: 'dust', airDash: false },
  yokogeri: { ringColor: '#E2A812', ringSize: 1.5, burst: 'rays', shake: 0.5, zoom: 1.04, speedLines: 3, sfxKey: 'special-kick-01.mp3', whooshKey: 'special-whoosh-fast-01.mp3', preEffect: 'dust', airDash: false },
};

export const SPECIAL_KINDS = Object.keys(SPECIAL_FX);

export function isFinisherKind(kind) {
  return FINISHER_KINDS.includes(normalizeKind(kind));
}

export function specialProfileFor(kind) {
  if (typeof kind !== 'string') return null;
  return SPECIAL_FX[normalizeKind(kind)] || null;
}

// Profil spesial untuk satu serangan — atau null kalau serangan ini bukan
// jurus spesial. Syarat: outcome 'hit' DAN (kind finisher ATAU kind ==
// signatureMove penyerang). Dipakai film.js (VFX), app.js (event SFX), dan
// sfx.js (pemilihan lapisan suara) dari SATU sumber kebenaran ini.
export function specialForAttack(atk, signatureMove) {
  if (!atk || atk.outcome !== 'hit') return null;
  const kind = normalizeKind(atk.kind);
  if (isFinisherKind(kind)) return SPECIAL_FX[kind] || null;
  if (typeof signatureMove === 'string' && normalizeKind(signatureMove) === kind) {
    return SPECIAL_FX[kind] || null;
  }
  return null;
}

export function isValidHexColor(v) {
  return typeof v === 'string' && /^#[0-9A-F]{6}$/.test(v);
}
