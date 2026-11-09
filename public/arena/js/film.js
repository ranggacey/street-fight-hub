// film.js — Engine animasi Stickman Fight Arena (web app, real-time).
// Adaptasi dari film.js Night Fight 4 v2 (pipeline video frame-by-frame):
// rig v3 + IK + teknik keyframe + hit-stop + kamera dipertahankan, diubah:
//  1. Sim INKREMENTAL (bukan re-simulasi dari 0 tiap frame — wajib untuk rAF).
//  2. Scene dinamis dari SCENE (buildScene), bukan konstanta per episode.
//  3. Arena KERTAS + HUD kertas/tinta/merah (identitas Street Fight web).
//  4. Gear dari builder (glove per tangan, senjata kayu, sepatu, sabuk, headband).
//  5. Mulut komentator dari teks PBP (bukan vo-rms.json).
//  6. Event "weapon pickup": petarung berjalan ke tepi ring, ambil kayu.
// Prinsip animasi: CHATGPT-ANIMATION-PRINCIPLES.md + pacing CF2 §17.
// Semua acak memakai PRNG berseed -> frame yang sama selalu menghasilkan
// gambar sama (deterministik, seed bisa diulang identik).
import { PALETTE, shade, getMapPalette } from './palette.js';
import { COMMENTATOR_STYLE, drawCommentator } from './commentators.js';
import { ACCESSORY_IDS, ACCESSORY_DEFAULTS, normalizeGear, drawBodyGear, drawBeltGear, drawShoesGear, drawGlovesGear, drawWeaponGear, drawHeadGear } from './accessories.js';
import { SCENE as S, realTime, warp } from './scenes.js';
import { TECHNIQUE_KEYS, windupDurOf, totalDurOf, STRIKE_TRAVEL, techniquePose, mergePose, lerpPoseFull, lerpAngle } from './techniques.js';
import { fighterColors } from './moves.js';
import { buildPositions, positionAt, RING_X_MIN, RING_X_MAX } from './fight.js';

const W = S.W, H = S.H, FPS = S.FPS;
const GROUND = S.GROUND_Y, GRAV = S.GRAVITY;
const DT = 1 / FPS;

// Durasi blend kembalinya kaki tendang (follow-through, riset 2026-11-07):
// 0,2 dtk = 6 frame @ 30fps — sama dengan durasi recovery lerp serangan
// (ph 0.12 -> 0.32 di stepFighter). Easing sstep: mulai pelan (kaki masih
// punya momentum tendang), melambat saat mendarat.
const LEG_RETURN_DUR = 0.2;

// Land-squash (squash & stretch, riset 2026-11-09, MOTION-LOG §30):
// saat mendarat, crouch +0,25 di frame sentuhan lalu pulih sstep selama
// 0,15 dtk (4-5 frame @ 30fps) — deformasi puncak 1-3 frame, sesuai
// Thomas & Johnston (squash = serap benturan, sebanding kecepatan jatuh).
const LAND_SQUASH_DUR = 0.15;
const LAND_SQUASH_AMP = 0.25;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (p) => { p = clamp(p, 0, 1); return p * p * (3 - 2 * p); };
const easeOut = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);

// PRNG deterministik (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash01 = (n) => { const r = rng(Math.floor(n * 1000) + 7); return r(); };

// ---------------- timeline posisi engine (2026-11-08) ----------------
// Jarak gelud berasal dari ENGINE (fight.positions), bukan logika jaga-jarak
// lokal film.js (dulu: walk-in berhenti di gap 110px, guard hanya menjaga
// minimum 45px + clamp 50px — dada-ke-dada di semua frame).
// film.js memakai ulang buildPositions() Agen A dari data SCENE (serangan +
// event) — hasilnya identik dengan fight.positions karena buildPositions
// murni (tanpa rng). Kalau buildScene sudah menyalin cfg.positions ke
// SCENE.POSITIONS, pakai itu tanpa bangun ulang. Cache keyed pada array
// serangan + durasi (buildScene mengganti keduanya tiap fight baru).
// Posisi badan (x) mengikuti timeline; pose/IK/langkah/timing TIDAK berubah.
let POS_CACHE = { attacks: null, duration: 0, positions: null };
export function scenePositions() {
  if (Array.isArray(S.POSITIONS) && S.POSITIONS.length > 0) return S.POSITIONS;
  if (POS_CACHE.attacks === S.ATTACKS && POS_CACHE.duration === S.DURATION && POS_CACHE.positions) {
    return POS_CACHE.positions;
  }
  const pos = buildPositions({
    attacks: S.ATTACKS, knockdowns: S.KNOCKDOWNS, clinches: S.CLINCHES,
    retreats: S.RETREATS, weapon: S.WEAPON, duration: S.DURATION,
  });
  POS_CACHE = { attacks: S.ATTACKS, duration: S.DURATION, positions: pos };
  return pos;
}
// Posisi timeline pada detik t (interpolasi linear antar sampel 30fps;
// null kalau tidak ada timeline). t di-clamp ke durasi oleh positionAt.
export function timelinePos(t) {
  const pos = scenePositions();
  if (!pos || pos.length === 0) return null;
  return positionAt({ positions: pos, duration: S.DURATION }, t);
}

// ---------------- pose ----------------
function poseGuard(key) {
  if (key === 'B') {
    return {
      lean: 0.1, crouch: 0.12, head: 0,
      hipRot: 0, shRot: 0, sway: 0, stretch: 1,
      armF: { a: 1.0, b: 2.0 }, armB: { a: 0.9, b: 2.1 },
      legF: { a: 0.18, k: -0.14 }, legB: { a: -0.22, k: -0.3 },
      footF: { ang: 0, pivot: 0.6, lift: 0 }, footB: { ang: -0.15, pivot: 0.6, lift: 0 },
    };
  }
  return {
    lean: 0.12, crouch: 0.15, head: 0,
    hipRot: 0, shRot: 0, sway: 0, stretch: 1,
    armF: { a: 0.8, b: 2.4 }, armB: { a: 0.8, b: 2.4 },
    legF: { a: 0.16, k: -0.12 }, legB: { a: -0.2, k: -0.28 },
    footF: { ang: 0, pivot: 0.6, lift: 0 }, footB: { ang: -0.15, pivot: 0.6, lift: 0 },
  };
}
const POSE = {
  hit:       { lean: -0.3, crouch: 0.25, head: -0.2, stretch: 0.86, armF: { a: 0.45, b: 1.2 }, armB: { a: 0.25, b: 1.4 }, legF: { a: 0.3, k: -0.1 }, legB: { a: -0.35, k: -0.4 } },
  falling:   { lean: 0, crouch: 0.05, head: -0.2, armF: { a: 2.7, b: 0.4 }, armB: { a: 2.4, b: 0.6 }, legF: { a: 0.2, k: -0.3 }, legB: { a: -0.15, k: -0.5 } },
  down:      { lean: 0, crouch: 0, head: -0.1, armF: { a: 2.9, b: 0.2 }, armB: { a: 2.2, b: 0.9 }, legF: { a: 0.35, k: -0.25 }, legB: { a: -0.3, k: -0.45 } },
  win:       { lean: 0.06, crouch: 0.05, head: -0.05, armF: { a: 2.95, b: 0.15 }, armB: { a: 0.5, b: 1.9 }, legF: { a: 0.12, k: -0.1 }, legB: { a: -0.18, k: -0.25 } },
  blockPose: { lean: -0.06, crouch: 0.28, head: 0, armF: { a: 1.3, b: 1.4 }, armB: { a: 0.9, b: 1.8 }, legF: { a: 0.22, k: -0.2 }, legB: { a: -0.26, k: -0.38 } },
  slipPose:  { lean: -0.45, crouch: 0.25, head: -0.35, shRot: -0.3, sway: -6, armF: { a: 0.9, b: 1.8 }, armB: { a: 0.6, b: 2.0 }, legF: { a: 0.24, k: -0.2 }, legB: { a: -0.28, k: -0.4 } },
  duckPose:  { lean: -0.35, crouch: 1.0, head: -0.3, armF: { a: 1.2, b: 1.5 }, armB: { a: 0.8, b: 1.9 }, legF: { a: 0.45, k: -0.6 }, legB: { a: -0.35, k: -0.8 } },
  rollPose:  { lean: -0.2, crouch: 0.7, head: -0.15, hipRot: 0.5, shRot: 0.4, sway: -10, armF: { a: 1.2, b: 1.5 }, armB: { a: 0.8, b: 1.9 }, legF: { a: 0.4, k: -0.55 }, legB: { a: -0.3, k: -0.7 } },
  flinchPose:{ lean: -0.30, crouch: 0.3, head: -0.2, armF: { a: 1.3, b: 1.3 }, armB: { a: 0.9, b: 1.8 }, legF: { a: 0.2, k: -0.2 }, legB: { a: -0.24, k: -0.35 } },
  parryPose: { lean: 0.1, crouch: 0.2, head: 0, armF: { a: 1.2, b: 1.2 }, armB: { a: 0.7, b: 2.0 }, legF: { a: 0.2, k: -0.18 }, legB: { a: -0.24, k: -0.35 } },
  clinchPose:{ lean: 0.22, crouch: 0.22, head: 0.05, armF: { a: 1.3, b: 0.5 }, armB: { a: 1.1, b: 0.9 }, legF: { a: 0.28, k: -0.25 }, legB: { a: -0.2, k: -0.4 } },
  grabPose:  { lean: 0.25, crouch: 0.55, head: 0.1, armF: { a: 1.5, b: 0.4 }, armB: { a: 1.4, b: 0.6 }, legF: { a: 0.35, k: -0.5 }, legB: { a: -0.25, k: -0.55 } },
};

// ---------------- geometri sendi + IK ----------------
const ARM_L1 = 34, ARM_L2 = 32, LEG_L1 = 48, LEG_L2 = 46;
const HIP_HALF = 14, SH_HALF = 16;
const KNEE_MAX = 2.27; // 130°
const clampKnee = (k) => Math.max(-KNEE_MAX, Math.min(0, k));

function computeJointsWithPose(f, p) {
  const face = f.face;
  // Rotasi badan saat knockdown (bodyRot, dihitung stepFighter): 0 = tegak,
  // ±1,45 rad = terbaring. SEBELUM perbaikan ini bodyRot TIDAK PERNAH dibaca
  // di gambar — petarung yang knockdown tetap tegak berdiri (bug 2026-11-09:
  // "kena knockdown tetap berdiri"). Seluruh rangka dirotasi kaku mengelilingi
  // titik pijakan (f.x, f.y): persis seperti orang jatuh ke belakang — kaki
  // tetap di lantai, pinggul turun ke ~11px di atas lantai, kepala rebah ke
  // ~21px di atas lantai (bukan melayang, bukan menembus lantai).
  const bodyRot = f.bodyRot || 0;
  const hipY = -(90 - p.crouch * 16);
  const hip = { x: f.x + p.sway * face, y: f.y + hipY };
  const torsoLen = 62 * (p.stretch ?? 1);
  const lean = p.lean + f.lean * 0.6;
  const sh = { x: hip.x + Math.sin(lean) * face * torsoLen, y: hip.y - Math.cos(lean) * torsoLen };
  const head = { x: sh.x + Math.sin(lean + p.head) * face * 22, y: sh.y - Math.cos(lean + p.head) * 22 };
  const torso = { x: (hip.x + sh.x) / 2, y: (hip.y + sh.y) / 2 };
  const hipF = { x: hip.x + Math.cos(p.hipRot) * HIP_HALF * face, y: hip.y + Math.sin(p.hipRot) * HIP_HALF };
  const hipB = { x: hip.x - Math.cos(p.hipRot) * HIP_HALF * face, y: hip.y - Math.sin(p.hipRot) * HIP_HALF };
  const shF = { x: sh.x + Math.cos(p.shRot) * SH_HALF * face, y: sh.y + Math.sin(p.shRot) * SH_HALF };
  const shB = { x: sh.x - Math.cos(p.shRot) * SH_HALF * face, y: sh.y - Math.sin(p.shRot) * SH_HALF };
  const limb = (root, part, L1, L2) => {
    const a = p[part].a, b = p[part].b ?? p[part].k;
    const mid = { x: root.x + Math.sin(a) * face * L1, y: root.y + Math.cos(a) * L1 };
    const end = { x: mid.x + Math.sin(a + b) * face * L2, y: mid.y + Math.cos(a + b) * L2 };
    return { mid, end };
  };
  const armF = limb(shF, 'armF', ARM_L1, ARM_L2);
  const armB = limb(shB, 'armB', ARM_L1, ARM_L2);
  const legF = limb(hipF, 'legF', LEG_L1, LEG_L2);
  const legB = limb(hipB, 'legB', LEG_L1, LEG_L2);
  const joints = { hip, hipF, hipB, shoulder: sh, shF, shB, head, torso,
    elbowF: armF.mid, handF: armF.end, elbowB: armB.mid, handB: armB.end,
    kneeF: legF.mid, footF: legF.end, kneeB: legB.mid, footB: legB.end };
  if (bodyRot) {
    const cos = Math.cos(bodyRot), sin = Math.sin(bodyRot);
    const px = f.x, py = f.y; // titik pijakan (kaki) = poros rotasi jatuh
    for (const k of Object.keys(joints)) {
      const j = joints[k];
      const dx = j.x - px, dy = j.y - py;
      j.x = px + dx * cos - dy * sin;
      j.y = py + dx * sin + dy * cos;
    }
  }
  return joints;
}
export function computeJoints(f) { return computeJointsWithPose(f, f.pose); }

function ik2(root, target, L1, L2, face, elbowUp = false, isLeg = false) {
  const dx = face * (target.x - root.x);
  const dy = target.y - root.y;
  const d = Math.hypot(dx, dy) || 1;
  const dc = clamp(d, 8, L1 + L2 - 1);
  const ux = dx / d, uy = dy / d;
  const cosA = clamp((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1);
  const alpha = Math.acos(cosA);
  const s = Math.sin(alpha), c = Math.cos(alpha);
  const e1x = L1 * (c * ux + s * -uy), e1y = L1 * (c * uy + s * ux);
  const e2x = L1 * (c * ux + s * uy), e2y = L1 * (c * uy + s * -ux);
  const solve = (ex, ey) => {
    const a = Math.atan2(ex, ey);
    const elbowW = { x: root.x + face * ex, y: root.y + ey };
    let hdx = face * (target.x - elbowW.x), hdy = target.y - elbowW.y;
    const hl = Math.hypot(hdx, hdy) || 1;
    hdx /= hl; hdy /= hl;
    let b = Math.atan2(hdx, hdy) - a;
    while (b > Math.PI) b -= 2 * Math.PI;
    while (b < -Math.PI) b += 2 * Math.PI;
    return { a, b };
  };
  const s1 = solve(e1x, e1y), s2 = solve(e2x, e2y);
  let pickE1;
  if (isLeg) {
    // Lutut hanya menekuk satu arah (b<=0): bila hanya satu cabang yang
    // anatomis, pakai cabang itu. Kalau tidak, lutut yang menekuk ke
    // belakang di-clamp jadi kaki lurus ke arah yang salah — terukur: kaki
    // block osotogari meleset 78px karena cabang lutut terbalik tepat saat
    // target lurus di bawah pinggul (block kaki: lutut lawan - 26px).
    // Heuristik lama (elbowUp / e1x) hanya dipakai bila kedua cabang valid.
    const v1 = s1.b <= 0, v2 = s2.b <= 0;
    if (v1 !== v2) pickE1 = v1;
    else pickE1 = !elbowUp ? e1x >= e2x : e1y <= e2y;
  } else {
    pickE1 = elbowUp ? e1y <= e2y : e1y >= e2y;
  }
  return pickE1 ? s1 : s2;
}

function kindKey(kind) {
  if (kind === 'kick') return 'lowkick';
  if (kind === 'jabR') return 'jab';
  if (kind === 'hookR') return 'hook';
  if (kind === 'bodyshotR') return 'bodyshot';
  return kind;
}
function limbFor(kind) {
  if (kind === 'jabR' || kind === 'hookR' || kind === 'bodyshotR' || kind === 'elbow' || kind === 'elbowup' || kind === 'elbowspin') return 'armB';
  if (kind === 'stickswing' || kind === 'stickchop') return 'armB'; // tangan senjata (kanan)
  if (kind === 'sinawali' || kind === 'redonda' || kind === 'gyakuzuki' || kind === 'pilantik') return 'armB'; // tangan belakang
  // Grapple tangan (body lock, bantingan): tangan yang memegang.
  // anklepick/outsidetrip TIDAK di sini: yang mengait pergelangan/kaki
  // lawan adalah KAKI (lihat legB di bawah) — tangan tidak bisa mencapai
  // lutut lawan (bahu->lutut ~105px vs lengan 66px, clamp IK 65px).
  if (kind === 'takedown' || kind === 'clinch' || kind === 'seoinage' || kind === 'doubleleg' || kind === 'singleleg' || kind === 'suplex' || kind === 'bodyslam' || kind === 'armbar') return 'armF';
  const k = kindKey(kind);
  if (k === 'cross' || k === 'finisher' || k === 'uppercut' || k === 'overhand' || k === 'haymaker') return 'armB';
  if (k === 'lowkick' || k === 'bodykick' || k === 'headkick' || k === 'frontkick' || k === 'roundhouse' || k === 'spinkick' || k === 'axekick' || k === 'teep' || k === 'knee' || k === 'flyknee' || k === 'sweep' || k === 'osotogari' || k === 'uchimata' || k === 'yokogeri' || k === 'sidekick' || k === 'maegeri' || k === 'armada' || k === 'meialua' || k === 'queixada' || k === 'tornadokick' || k === 'butterflykick' || k === 'lotuskick' || k === 'kneediag' || k === 'spinhookkick' || k === 'meialuafrente' || k === 'anklepick' || k === 'outsidetrip') return 'legB';
  return 'armF';
}
function isKick(kind) { const k = kindKey(kind); return k === 'lowkick' || k === 'bodykick' || k === 'headkick' || k === 'frontkick' || k === 'roundhouse' || k === 'spinkick' || k === 'axekick' || k === 'teep' || k === 'knee' || k === 'flyknee' || k === 'sweep' || k === 'osotogari' || k === 'uchimata' || k === 'yokogeri' || k === 'sidekick' || k === 'maegeri' || k === 'armada' || k === 'meialua' || k === 'queixada' || k === 'tornadokick' || k === 'butterflykick' || k === 'lotuskick' || k === 'kneediag' || k === 'spinhookkick' || k === 'meialuafrente' || k === 'anklepick' || k === 'outsidetrip'; }
export { isKick };
export { strikeRange };
function strikeRange(kind) {
  if (kind === 'jabR') return 95;
  const k = kindKey(kind);
  if (k === 'headkick') return 52;
  if (k === 'bodykick') return 98;
  if (k === 'lowkick') return 70;
  if (k === 'hook') return 88;
  if (k === 'bodyshot') return 88;
  if (k === 'uppercut') return 70;
  if (k === 'overhand') return 92;
  if (k === 'haymaker') return 88;
  if (k === 'shove') return 95;
  if (k === 'frontkick') return 95;
  if (k === 'teep') return 95;
  if (k === 'knee') return 62;
  if (k === 'flyknee') return 62;
  if (k === 'elbow') return 50;
  if (k === 'roundhouse') return 98;
  if (k === 'spinkick') return 95;
  if (k === 'axekick') return 60;
  if (k === 'takedown') return 55; // clinch range: harus rapat
  if (k === 'clinch') return 55;
  if (k === 'sweep') return 70;
  if (k === 'stickswing') return 100; // tongkat memanjangkan jangkauan
  if (k === 'stickchop') return 90;
  if (k === 'cross' || k === 'finisher') return 90;
  if (k === 'feint') return 95;
  // Kind baru gaya Fase 1 Hub (2026-11-07).
  if (k === 'abaniko') return 70; // jentikan pergelangan, jarak dekat
  if (k === 'sinawali') return 95;
  if (k === 'redonda') return 95;
  if (k === 'seoinage') return 55; // bantingan: harus rapat
  if (k === 'osotogari') return 70; // sama seperti sweep: sabit rendah
  if (k === 'uchimata') return 60;
  if (k === 'headbutt') return 45; // sundulan: paling rapat
  if (k === 'yokogeri') return 95;
  if (k === 'straightlead') return 100; // pukulan lurus terjauh JKD
  if (k === 'sidekick') return 95;
  if (k === 'shuto') return 80;
  if (k === 'gyakuzuki') return 90;
  if (k === 'maegeri') return 95;
  // Tendangan ke KEPALA harus rapat (60px — sama seperti cabang walk di
  // stepFighter yang memakai rg=60 untuk head kick): kaki 93px tidak
  // sampai ke kepala (~120px dari pinggul) bila gap 85-98.
  if (k === 'armada') return 60;
  if (k === 'meialua') return 60; // putaran rendah, tangan ke tanah
  if (k === 'queixada') return 60;
  if (k === 'tornadokick') return 60;
  if (k === 'butterflykick') return 60;
  if (k === 'lotuskick') return 60;
  // Kind baru 2026-11-08 (cermin STRIKE_GAP_PX di fight.js).
  if (k === 'doubleleg') return 55; // grapple: harus rapat
  if (k === 'singleleg') return 55;
  if (k === 'suplex') return 55;
  if (k === 'bodyslam') return 55;
  if (k === 'anklepick') return 55;
  if (k === 'outsidetrip') return 55;
  if (k === 'armbar') return 55; // kuncian ground: harus rapat
  if (k === 'kneediag') return 62; // sama seperti knee
  if (k === 'elbowup') return 50; // sama seperti elbow
  if (k === 'elbowspin') return 55; // putar 180° butuh selangkah ruang
  if (k === 'spinhookkick') return 60; // tendangan kepala: harus rapat (lihat armada)
  if (k === 'meialuafrente') return 60; // sama seperti queixada
  if (k === 'ginga') return 95; // stance, bukan serangan — jarak jaga
  if (k === 'pilantik') return 70; // jarak grappling, seperti abaniko
  return 110;
}
function windupDur(atk) { return windupDurOf(kindKey(atk.kind)); }
function windupStart(atk) { return atk.t - windupDur(atk); }

function ghostPoint(defX, defFace, target) {
  if (target === 'head') return { x: defX + defFace * 10, y: GROUND - 166 };
  if (target === 'body') return { x: defX + defFace * 8, y: GROUND - 117 };
  return { x: defX + defFace * 6, y: GROUND - 46 };
}

function spawnDust(particles, t0, x, y, n, spd, up, life, size, seedSalt) {
  const r = rng(Math.floor(t0 * 1000) * 131 + seedSalt);
  for (let i = 0; i < n; i++) {
    const a = (r() - 0.5) * Math.PI * 1.2 - Math.PI / 2;
    const v = spd * (0.4 + r() * 0.8);
    particles.push({
      t0, x: x + (r() - 0.5) * 14, y: y - r() * 4,
      vx: Math.cos(a) * v * (r() < 0.5 ? -1 : 1) * 0.7, vy: -Math.abs(Math.sin(a)) * v * up - 10,
      life: life * (0.7 + r() * 0.6), size: size * (0.7 + r() * 0.6),
    });
  }
}

// Percikan terang saat kontak (VFX Langkah 1): ledakan radial singkat di
// titik kontak, hidup 0,25 dtk, mengecil + memudar — beda dari debu (naik
// pelan, membesar, warna tanah). Deterministik (rng berseed) seperti debu.
function spawnSparks(particles, t0, x, y, n, power, seedSalt) {
  const r = rng(Math.floor(t0 * 1000) * 131 + seedSalt);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const v = (140 + power * 120) * (0.5 + r() * 0.7);
    particles.push({
      t0, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
      life: 0.25 * (0.7 + r() * 0.6), size: 3 + r() * 2, spark: true,
    });
  }
}

// Sistem aksesoris (katalog + normalizeGear + gambar per bagian) tinggal
// di ./accessories.js — dipindah 2026-11-08 supaya file ini muat di batas
// argumen upload Vercel (125.000 byte, lihat scripts/deploy.mjs).
export { ACCESSORY_IDS, ACCESSORY_DEFAULTS, normalizeGear };

// ---------------- simulasi (INKREMENTAL untuk rAF) ----------------

function newFighter(key) {
  const cfg = S.FIGHTERS[key];
  return {
    key, color: cfg.color, colorDark: cfg.colorDark || shade(cfg.color, 0.55), role: cfg.role, face: cfg.face,
    gear: normalizeGear(cfg.gear || cfg),
    x: cfg.startX, y: GROUND, vx: 0, vy: 0, grounded: true,
    lean: 0.1, bodyRot: 0, mode: 'guard', hitUntil: -1,
    pose: poseGuard(key), bob: 0, slideDustAcc: 0,
    smear: 0, smearLimb: null, smearWind: null,
    hasWeapon: false, // kayu diambil di tengah fight (event WEAPON)
    feet: { F: { x: cfg.startX + 28 * cfg.face }, B: { x: cfg.startX - 22 * cfg.face } },
    stepDist: 0,
    steps: { F: null, B: null }, // langkah per kaki (bisa bersamaan)
    legReturn: null, // blend follow-through kaki tendang (lihat stepFighter)
    landSquash: null, // { t0, dur, amp } — squash sesaat setelah mendarat (lihat stepFighter)
    lastAtkKind: null, // kind serangan terakhir (untuk deteksi akhir tendangan)
    rampAtkT: null, // serangan terakhir yang sudah ramp-in antisipasi (lihat stepFighter)
    rampStep: 0, // langkah ramp-in serangan berjalan (1 = frame pertama, 2 = frame kedua berat)
    reactStep: 0, // langkah ramp-in masuk react/hit (1 = frame pertama, 2 = frame kedua)
    lunge: 0, // hentakan serang (px ke arah lawan, 0..27) — lihat stepFighter
  };
}

function attackEnd(atk) {
  const keys = TECHNIQUE_KEYS[kindKey(atk.kind)];
  return atk.t + (keys ? keys[keys.length - 1].t : 0.26);
}
function atkFor(s, who) {
  for (const atk of S.ATTACKS) {
    if (atk.by !== who) continue;
    if (s >= windupStart(atk) && s < attackEnd(atk)) return atk;
  }
  return null;
}
function upcomingAtk(s, who) {
  for (const atk of S.ATTACKS) {
    if (atk.by !== who) continue;
    if (s >= atk.t - 1.6 && s < windupStart(atk)) return atk;
  }
  return null;
}
function reactionAt(s, who) {
  const opp = who === 'R' ? 'B' : 'R';
  for (const atk of S.ATTACKS) {
    if (atk.by !== opp) continue;
    if (atk.outcome === 'hit') continue;
    if (atk.outcome === 'shadow') continue;
    if (atk.kind === 'feint') {
      if (s >= atk.t - 0.06 && s < atk.t + 0.3) return atk;
    } else if (s >= windupStart(atk) && s < atk.t + 0.25) {
      return atk;
    }
  }
  return null;
}
function clinchAt(s) {
  for (const cl of S.CLINCHES || []) if (s >= cl.t && s < cl.t + cl.dur) return cl;
  return null;
}
function retreatAt(s, who) {
  for (const rt of S.RETREATS || []) {
    if (rt.who === who && s >= rt.t && s < rt.t + rt.dur) return rt;
  }
  return null;
}
function cheerAt(s) {
  let p = 0;
  for (const ch of S.CHEERS || []) {
    if (s >= ch.t && s < ch.t + ch.dur) {
      const k = (s - ch.t) / ch.dur;
      const env = Math.min(1, (s - ch.t) / 0.15) * (1 - Math.max(0, (k - 0.7) / 0.3));
      p = Math.max(p, ch.power * env);
    }
  }
  return p;
}

function startStep(f, leg, toX, dur, s) {
  // Langkah per kaki (bukan satu langkah global): saat badan bergerak cepat
  // (lunge timeline 450px/dtk), KEDUA kaki harus bisa melangkah bersamaan
  // — kalau bergantian, kaki yang menunggu tertinggal 30px+/langkah dan
  // meluncur (slide). Dulu satu langkah cukup karena badan ≤220px/dtk.
  if (f.steps[leg]) return;
  f.steps[leg] = { leg, fromX: f.feet[leg].x, toX, t0: s, dur: Math.max(0.1, dur) };
}

// State sim yang dimajukan sedikit demi sedikit (bukan re-simulasi dari 0).
export function createSim() {
  return {
    R: newFighter('R'), B: newFighter('B'),
    particles: [], impacts: [], rings: [], stepLog: [],
    rt: { atk: new Map() },
    s: 0,
  };
}

// Satu langkah sim sebesar h detik (h <= DT biasanya).
function simStep(st, sNext, onFrame) {
  const s = st.s;
  const h = sNext - s;
  const { R, B, particles, impacts, rings, rt, stepLog } = st;
  stepFighter(R, B, s, h, particles, impacts, rings, rt, stepLog);
  stepFighter(B, R, s, h, particles, impacts, rings, rt, stepLog);
  for (const atk of S.ATTACKS) {
    if (s < atk.t && sNext >= atk.t) triggerAttack(atk, R, B, atk.t, particles, impacts);
  }
  for (const kd of S.KNOCKDOWNS) {
    if (s < kd.t && sNext >= kd.t) startFall(kd, R, B, kd.t, particles);
  }
  for (const cl of S.CLINCHES || []) {
    if (s < cl.t + cl.dur && sNext >= cl.t + cl.dur) {
      R.vx -= 260; B.vx += 260;
      spawnDust(particles, cl.t + cl.dur, (R.x + B.x) / 2, GROUND, 12, 100, 0.9, 0.6, 5, 61);
    }
  }
  if (Math.abs(R.x - B.x) < 50 && !timelinePos(sNext)) {
    // Fallback lama (tanpa timeline): jangan biarkan badan menembus.
    // Dengan timeline, gap minimum 45px (headbutt) berasal dari engine —
    // clamp ini justru melawan timeline, jadi dimatikan saat timeline aktif.
    const mid = (R.x + B.x) / 2;
    R.x = mid - 25; B.x = mid + 25;
  }
  // Batas dalam ring (2026-11-08, sama dengan timeline engine): petarung
  // tidak boleh keluar tali (dulu [80, 1200] — sampai ke tepi ring).
  R.x = clamp(R.x, RING_X_MIN, RING_X_MAX); B.x = clamp(B.x, RING_X_MIN, RING_X_MAX);
  if (onFrame) onFrame(s, R, B);
  st.s = sNext;
}

// Majukan state sim sampai sEnd (inkremental).
export function advanceSim(st, sEnd, onFrame) {
  while (st.s < sEnd - 1e-9) {
    const sNext = Math.min(st.s + DT, sEnd);
    simStep(st, sNext, onFrame);
  }
  return st;
}

// Wrapper lama (untuk test offline): sim segar 0 -> sEnd.
export function simulate(sEnd, onFrame) {
  const st = createSim();
  advanceSim(st, sEnd, onFrame);
  return st;
}

// Cache sim untuk render real-time: maju seperlunya, reset bila mundur.
let SIM_CACHE = null;
export function resetSim() { SIM_CACHE = null; }
export function getSim(sEnd) {
  if (!SIM_CACHE || sEnd < SIM_CACHE.s - 1e-9) SIM_CACHE = createSim();
  advanceSim(SIM_CACHE, sEnd);
  return SIM_CACHE;
}

function strikeTargetPoint(atk, att, def, rt) {
  const jD = computeJoints(def);
  const center = atk.target === 'head' ? jD.head
    : atk.target === 'body' ? jD.torso
    : jD.kneeF;
  if (atk.outcome === 'shadow') {
    const rg = atk.kind === 'lowkick' ? 78 : strikeRange(atk.kind) - 12;
    const y = atk.target === 'head' ? GROUND - 166 : atk.target === 'body' ? GROUND - 117 : GROUND - 46;
    return { x: att.x + att.face * rg, y };
  }
  if (atk.outcome === 'hit') {
    return { x: center.x - att.face * 6, y: center.y };
  }
  if (atk.outcome === 'block') {
    return { x: center.x - att.face * 26, y: center.y };
  }
  if (atk.outcome === 'parry') {
    const g = rt.ghost || ghostPoint(rt.ghostX ?? def.x, def.face, 'head');
    return { x: g.x, y: g.y + 38 };
  }
  return rt.ghost || ghostPoint(rt.ghostX ?? def.x, def.face, atk.target);
}

// ---------------- overlay visual lemparan (RENDER-ONLY) ----------------
// Lemparan (grapple) di sim TIDAK PERNAH mengangkat korban: director hanya
// memberi POSE.hit (mundur + tangan naik), jadi di frame impact seoi/
// takedown terbaca seperti pukulan badan — korban tertutup torso penyerang.
// Overlay KHUSUS GAMBAR (sim, timing, damage TIDAK disentuh): selama
// jendela kake (ph -0.05..0.30) korban digambar terangkat + melengkung di
// atas bahu penyerang, dan digambar SETELAH penyerang (di depan) supaya
// badannya terlihat. Di luar jendela, urutan + pose kembali normal.
const THROW_KINDS = { seoinage: 'over', osotogari: 'over', uchimata: 'over', takedown: 'lift',
  // Kind baru 2026-11-08: 'over' = korban lewat atas kepala/bahu (suplex);
  // 'lift' = korban terangkat lalu dibanting (doubleleg/singleleg seperti
  // takedown; bodyslam horizontal lalu banting vertikal; anklepick/
  // outsidetrip: trip + angkat kecil — overlay 'lift' paling dekat).
  // armbar TIDAK masuk: kuncian ground, korban tidak terlempar.
  doubleleg: 'lift', singleleg: 'lift', suplex: 'over', bodyslam: 'lift', anklepick: 'lift', outsidetrip: 'lift' };
export function throwOverlay(s) {
  for (const who of ['R', 'B']) {
    const atk = atkFor(s, who);
    if (!atk || !THROW_KINDS[atk.kind]) continue;
    const ph = s - atk.t;
    if (ph < -0.05 || ph > 0.35) continue;
    const up = ph < 0 ? 0 : Math.min(1, ph / 0.2); // naik 0 -> 0.2 dtk
    const down = ph > 0.2 ? Math.min(1, (ph - 0.2) / 0.15) : 0; // turun 0.2 -> 0.35
    const k = up * (1 - down);
    return { by: who, kind: atk.kind, variant: THROW_KINDS[atk.kind], ph, lift: 55 * k, k };
  }
  return null;
}
// Pose korban saat dilempar (di-lerp dari pose sim saat itu): badan
// melengkung ke arah penyerang (lean + = ke arah hadap), tangan
// terentang ke atas, kaki tertinggal menekuk ke belakang.
function thrownPose(def, variant, k) {
  const over = variant === 'over'
    ? { lean: 0.5, crouch: 0.35, head: 0.15, armF: { a: 2.5, b: 0.6 }, armB: { a: 2.2, b: 0.9 }, legF: { a: -0.55, k: -1.1 }, legB: { a: -0.35, k: -0.9 } }
    : { lean: 0.85, crouch: 0.2, head: 0.25, armF: { a: 2.6, b: 0.5 }, armB: { a: 2.4, b: 0.7 }, legF: { a: -0.9, k: -1.0 }, legB: { a: -0.7, k: -1.2 } };
  return lerpPoseFull(def.pose, mergePose(poseGuard(def.key), over), k);
}

function stepFighter(f, o, s, dt, particles, impacts, rings, rt, stepLog) {
  const prevMode = f.mode; // untuk deteksi transisi attack -> guard/walk/dll
  // Kecepatan badan menurut timeline engine (untuk durasi langkah + lean).
  // Diambil di awal langkah: posisi akhir langkah ini = timelinePos(s + dt).
  const tl = timelinePos(s + dt);
  const tlPrev = tl ? timelinePos(s) : null;
  const tlVx = tl && tlPrev
    ? ((f.key === 'R' ? tl.xR - tlPrev.xR : tl.xB - tlPrev.xB) / Math.max(1e-6, dt)) : 0;
  if (f.mode !== 'falling' && f.mode !== 'down' && f.mode !== 'getup') {
    f.face = o.x >= f.x ? 1 : -1;
  }
  const kd = [...S.KNOCKDOWNS].reverse().find((k) => k.who === f.key && s >= k.t);
  const myAtk = atkFor(s, f.key);
  const incoming = reactionAt(s, f.key);
  const cl = clinchAt(s);
  // Hentakan serang: di luar jendela hentak, lunge meluruh (90px/dtk, sama
  // seperti vx mundur lama). Di dalam jendela, cabang attack menaikkannya.
  const inStrikeWindow = !!myAtk && myAtk.kind !== 'feint'
    && (s - myAtk.t) >= -STRIKE_TRAVEL && (s - myAtk.t) < 0.12;
  if (!inStrikeWindow) f.lunge = Math.max(0, (f.lunge || 0) - 90 * dt);

  let mode = f.mode, rate = 8, target = null;
  let ikOverride = null;
  let poseDirect = null;
  f.smear = 0; f.smearLimb = null; f.smearWind = null;

  // --- WEAPON PICKUP (baru di web app): jalan ke tepi ring, ambil kayu ---
  // JANGAN bajak mode jatuh/bangkit (bug 2026-11-09, ketahuan saat perbaikan
  // knockdown): kalau petarung sedang falling/down/getup, cabang pickup
  // menimpa f.mode jadi 'pickup' dan bodyRot (±1,25 rad) MEMBEKU — selesai
  // jendela pickup, mode jadi 'guard' dengan bodyRot tetap 1,25: petarung
  // terbaring permanen sambil "guard" (terukur: capoeira vs kali seed
  // 123456, B mode guard + bodyRot 1,25 dari s=18,5 sampai KD berikut).
  // Petarung menyelesaikan bangkit dulu; jendela pickup 3 dtk biasanya
  // masih sempat (bangkit selesai ~1,4 dtk setelah getupStart).
  const fallingDown = f.mode === 'falling' || f.mode === 'down' || f.mode === 'getup';
  const wp = S.WEAPON;
  if (wp && !fallingDown && f.key === wp.who && !f.hasWeapon && s >= wp.t && s < wp.t + 3.0) {
    mode = 'pickup'; rate = 10;
    const dx = wp.x - f.x;
    if (Math.abs(dx) > 26) {
      f.vx = Math.sign(dx) * 220;
      target = poseGuard(f.key);
    } else {
      f.vx = 0;
      target = POSE.grabPose;
      if (s >= wp.t + 0.9) {
        if (!f.hasWeapon) f.weaponGrabT = s;
        f.hasWeapon = true;
      }
    }
  } else if (wp && !fallingDown && f.key === wp.who && f.hasWeapon && s < wp.t + 3.0) {
    // Kayu sudah di tangan: jangan diam di tepi ring — kembali ke jarak
    // tarung, kalau tidak serangan berikutnya meleset dari 170px (tes §5).
    mode = 'pickup'; rate = 10;
    if (f.weaponGrabT != null && s < f.weaponGrabT + 0.45) {
      f.vx = 0;
      target = POSE.grabPose; // biarkan pose ambil terbaca sebentar
    } else {
      const dx = o.x - f.x;
      f.vx = Math.abs(dx) > 60 ? Math.sign(dx) * 200 : 0;
      target = poseGuard(f.key);
      // Tetap bisa menangkis sambil mundur: kalau ada serangan masuk,
      // tangan block ikut ke titik block seperti di cabang react.
      const inc = reactionAt(s, f.key);
      if (inc && inc.outcome === 'block') {
        target = POSE.blockPose;
        const jD = computeJoints(f);
        const center = inc.target === 'head' ? jD.head
          : inc.target === 'body' ? jD.torso : jD.kneeF;
        const bp = { x: center.x - o.face * 26, y: center.y };
        ikOverride = { limb: 'armF', point: bp };
      }
    }
  } else if (f.mode === 'falling') {
    mode = 'falling'; rate = 12; target = POSE.falling;
    f.bodyRot = lerp(f.bodyRot, -f.face * 1.45, 1 - Math.exp(-6 * dt));
    if (f.grounded && Math.abs(f.bodyRot) > 1.25) {
      mode = 'down';
      spawnDust(particles, s, f.x - f.face * 60, GROUND, 16, 120, 0.8, 0.8, 6, 21);
      // Ring tanah (VFX Langkah 4): elips datar membesar di lantai saat
      // badan menghantam tanah — pasangan visual debu pendaratan.
      rings.push({ t: s, x: f.x - f.face * 60, y: GROUND });
    }
  } else if (f.mode === 'down') {
    mode = 'down'; rate = 6; target = POSE.down;
    if (kd && kd.getupStart !== null && s >= kd.getupStart) mode = 'getup';
  } else if (f.mode === 'getup') {
    mode = 'getup'; rate = 5;
    target = mergePose(poseGuard(f.key), { crouch: 0.6 });
    f.bodyRot = lerp(f.bodyRot, 0, 1 - Math.exp(-3.5 * dt));
    if (Math.abs(f.bodyRot) < 0.06) { f.bodyRot = 0; mode = 'guard'; }
  } else if (f.key === S.WINNER && s >= S.WIN_POSE_T) {
    mode = 'win'; rate = 8; target = POSE.win;
    f.bob = Math.abs(Math.sin(s * 4)) * 5;
  } else if (myAtk) {
    mode = 'attack';
    f.lastAtkKind = myAtk.kind;
    f.legReturn = null; // serangan baru membatalkan blend kembali kaki
    const kk = kindKey(myAtk.kind);
    const ph = s - myAtk.t;
    const limb = limbFor(myAtk.kind);
    let entry = rt.atk.get(myAtk.t);
    if (!entry) {
      entry = { limb, ghostX: o.x, ghost: ghostPoint(o.x, o.face, myAtk.target), fistStart: null, stepInDone: false, returnDone: false, jumped: false };
      rt.atk.set(myAtk.t, entry);
    }
    if ((kk === 'jab' || kk === 'cross') && !entry.stepInDone && ph > -windupDur(myAtk)) {
      entry.stepInDone = true;
      startStep(f, 'F', f.feet.F.x + 22 * f.face, Math.max(0.1, -ph), s);
    }
    poseDirect = techniquePose(kk, ph, poseGuard(f.key));
    if (kk === 'flyknee' && !entry.jumped && ph >= -0.35) {
      entry.jumped = true;
      f.vy = -380; f.grounded = false;
    }
    if (ph < -STRIKE_TRAVEL) f.vx = 0;
    if (myAtk.kind === 'feint' || myAtk.kind === 'ginga') f.vx = 0; // stance: tanpa lunge
    if (myAtk.kind !== 'feint' && myAtk.kind !== 'ginga' && ph >= -STRIKE_TRAVEL && ph < 0.12) {
      const isKnee = myAtk.kind === 'knee' || myAtk.kind === 'flyknee' || myAtk.kind === 'kneediag';
      const isElbow = myAtk.kind === 'elbow' || myAtk.kind === 'elbowup' || myAtk.kind === 'elbowspin';
      if (!entry.fistStart) {
        const j = computeJointsWithPose(f, poseDirect);
        entry.fistStart = isKnee ? j.kneeB : isElbow ? j.elbowB
          : limb === 'armF' ? j.handF : limb === 'armB' ? j.handB : j.footB;
      }
      const k = (ph + STRIKE_TRAVEL) / STRIKE_TRAVEL;
      const targetPt = strikeTargetPoint(myAtk, f, o, entry);
      const fistPt = k >= 0.9 ? targetPt : lerpPt(entry.fistStart, targetPt, easeOut(k));
      ikOverride = { limb, point: fistPt, elbowUp: kk === 'hook' || isKick(kk), isKnee, isElbow };
      if (ph >= -0.05 && ph <= -0.015) {
        f.smear = (myAtk.kind === 'finisher' || myAtk.kind === 'flyknee') ? 0.9 : 0.6;
        f.smearLimb = limb;
        f.smearWind = mergePose(poseGuard(f.key), TECHNIQUE_KEYS[kk][0].pose);
      }
      if (kk !== 'flyknee') f.vx = f.face * 150;
      // Hentakan serang (dulu vx=150 selama jendela ini): badan maju 27px
      // ke arah lawan selama jendela hentak — inilah yang membuat fist/kaki
      // BENAR-BENAR menyentuh target saat impact (timeline berhenti di
      // jarak serang, 45–110px, sementara jangkauan lengan cuma 66px dari
      // bahu). Di luar jendela, lunge meluruh (lihat atas). Jarak jaga
      // TIDAK berubah: lunge 0 di luar jendela hentak.
      f.lunge = Math.min(27, (f.lunge || 0) + 150 * dt);
    } else if (myAtk.kind !== 'feint' && myAtk.kind !== 'ginga' && ph >= 0.12) {
      const isKnee = myAtk.kind === 'knee' || myAtk.kind === 'flyknee' || myAtk.kind === 'kneediag';
      const isElbow = myAtk.kind === 'elbow' || myAtk.kind === 'elbowup' || myAtk.kind === 'elbowspin';
      const targetPt = strikeTargetPoint(myAtk, f, o, entry);
      const fistPt = lerpPt(targetPt, guardLimbPoint(f, limb, myAtk.kind), sstep((ph - 0.12) / 0.2));
      ikOverride = { limb, point: fistPt, elbowUp: kk === 'hook' || isKick(kk), isKnee, isElbow };
      f.vx = -f.face * 90;
      if (isKick(myAtk.kind) && !entry.returnDone) {
        entry.returnDone = true;
        startStep(f, 'B', f.x - 22 * f.face, 0.2, s);
      }
    }
  } else if (incoming) {
    const out = incoming.outcome;
    mode = 'react'; rate = 20;
    if (out === 'block') {
      target = POSE.blockPose;
      const jD = computeJoints(f);
      const center = incoming.target === 'head' ? jD.head
        : incoming.target === 'body' ? jD.torso
        : jD.kneeF;
      const bp = { x: center.x - o.face * 26, y: center.y };
      ikOverride = { limb: 'armF', point: bp };
    } else if (out === 'slip') {
      target = POSE.slipPose;
    } else if (out === 'duck') {
      target = POSE.duckPose;
    } else if (out === 'roll') {
      target = POSE.rollPose;
    } else if (out === 'sidestep') {
      target = mergePose(poseGuard(f.key), { lean: -0.15 });
      if (f.mode !== 'react') f.vx = -f.face * 320;
    } else if (out === 'parry') {
      target = POSE.parryPose;
      const jA = computeJoints(o);
      const alimb = limbFor(incoming.kind);
      // Serangan kaki diparry di TULANG KERING (tengah lutut->kaki).
      const isLegAtk = alimb === 'legF' || alimb === 'legB';
      const e1 = isLegAtk ? jA.kneeB : alimb === 'armF' ? jA.elbowF : jA.elbowB;
      const h1 = isLegAtk ? jA.footB : alimb === 'armF' ? jA.handF : jA.handB;
      ikOverride = { limb: 'armF', point: { x: (e1.x + h1.x) / 2, y: (e1.y + h1.y) / 2 } };
    } else if (out === 'flinch') {
      target = POSE.flinchPose; rate = 24;
    }
  } else if (s < f.hitUntil) {
    mode = 'hit'; rate = 20; target = POSE.hit;
  } else if (cl) {
    mode = 'clinch'; rate = 10; target = POSE.clinchPose;
    const gap = Math.abs(o.x - f.x);
    if (gap > 58) f.vx = (o.x > f.x ? 1 : -1) * 120;
    else f.vx = 0;
  } else {
    const upc = upcomingAtk(s, f.key);
    if (upc) {
      mode = 'walk'; rate = 12;
      target = poseGuard(f.key);
      const gap = Math.abs(o.x - f.x);
      let rg = strikeRange(upc.kind);
      if (isKick(upc.kind) && upc.target === 'head') rg = 60;
      if (gap > rg) f.vx = (o.x > f.x ? 1 : -1) * 180;
      else f.vx = 0;
    } else if (s >= S.WALK.start && s < S.WALK.end) {
      mode = 'walk'; rate = 12;
      target = poseGuard(f.key);
      const tgt = S.WALK[f.key];
      const dir = Math.sign(tgt - f.x) || 1;
      f.vx = dir * 150;
      if (Math.abs(tgt - f.x) < 4) f.vx = 0;
    } else {
      mode = 'guard'; rate = 8;
      target = poseGuard(f.key);
      f.bob = 0;
      const gap = Math.abs(o.x - f.x);
      let sep = 0;
      if (gap < 45) sep = (f.x < o.x ? -1 : 1) * 50;
      const mid = (f.x + o.x) / 2;
      let cen = 0;
      if (mid > 700) cen = -45;
      else if (mid < 580) cen = 45;
      f.vx = clamp(sep + cen, -120, 120);
      if (retreatAt(s, f.key)) f.vx = -f.face * 70;
    }
  }
  // Jaring pengaman invarian jatuh: bodyRot != 0 HANYA boleh hidup di mode
  // falling/down/getup (di situlah bodyRot di-lerp kembali ke 0). Kalau ada
  // jalur lain yang meninggalkan bodyRot membeku di mode biasa (dulu:
  // pickup senjata menimpa mode jatuh), paksa 'getup' supaya rotasi
  // terselesaikan dan petarung tidak terbaring permanen.
  if (f.bodyRot !== 0 && mode !== 'falling' && mode !== 'down' && mode !== 'getup') {
    mode = 'getup';
  }
  f.mode = mode;

  // REACT RAMP-IN (MOTION-LOG §31): masuk react/hit = pose target baru
  // (block/parry/slip/hit) yang tadinya ditugaskan penuh di frame pertama
  // — lerp eksponensial rate 20 ≈ 49% + IK block/parry menempel tangan
  // langsung ke titik blok — terukur 42,64 px/frame di frame pertama
  // react (7/10 transisi react > 30). Tangkap masuknya di sini; sebar
  // ke 2 frame di cabang pose + IK di bawah (pola yang sama dengan
  // ramp-in antisipasi §27/§29). Pacing CF2 tidak berubah — react mulai
  // di windup, jadi pose sudah di tempatnya sebelum impact.
  if ((mode === 'react' || mode === 'hit') && prevMode !== mode) f.reactStep = 1;
  else if (mode !== 'react' && mode !== 'hit') f.reactStep = 0;

  // --- LEG RETURN BLEND (follow-through, riset 2026-11-07) ---
  // Saat tendangan/lutut berakhir, kaki masih di udara: gap ke posisi
  // menapak sampai ~107px di sekuens uji (flyknee). Kalau langsung diserahkan
  // ke IK menapak, kaki "teleport" 1 frame. Sebaliknya: tangkap posisi kaki
  // saat ini (pose masih pose frame attack terakhir — pose lerp di bawah
  // belum jalan) lalu blend target IK ke posisi menapak selama
  // LEG_RETURN_DUR, supaya kaki "menyusul" badan seperti follow-through.
  // Ambang 12px: pukulan/gulat gap-nya cuma ~2,4px, tidak perlu blend.
  if (prevMode === 'attack' && mode !== 'attack' && f.lastAtkKind && isKick(f.lastAtkKind)) {
    const j = computeJoints(f);
    const gap = Math.hypot(j.footB.x - f.feet.B.x, j.footB.y - GROUND);
    if (gap > 12) {
      f.legReturn = { leg: 'B', from: { x: j.footB.x, y: j.footB.y }, t0: s, dur: LEG_RETURN_DUR };
    }
    // RETURN-STEP RE-SYNC (diagnosis anklepick t=14,23, MOTION-LOG §28):
    // langkah kembali kaki tendang dimulai di ph 0,12 (dur 0,2 dtk) tapi
    // selama serangan kaki dimiliki IK serangan, BUKAN langkah — saat
    // serangan berakhir (ph ~0,30) langkah sudah 81% jalan, sehingga kaki
    // "teleport" ke target langkah (terukur 32,16 px/frame; legReturn
    // tidak menutup karena gap cuma ~7px < ambang 12). Sinkronkan ulang
    // langkah dari posisi kaki SEBENARNYA saat serah terima: fromX =
    // posisi kaki kini, t0 = kini, toX/dur tetap — kaki meluncur 0,2 dtk
    // ke titik mendarat, bukan meloncat.
    // HANYA bila legReturn TIDAK aktif: kalau gap > 12, legReturn sudah
    // mem-blend target IK dari posisi kaki ke target langkah — me-reset
    // jam langkah juga akan menggandakan kecepatan (target langkah ikut
    // bergerak selama legReturn; terukur R.footB 31,98 px/frame setelah
    // kneediag). Saat legReturn aktif, langkah dibiarkan selesai sendiri
    // (sudah ~90% jalan, targetnya nyaris konstan).
    else if (f.steps.B) {
      f.steps.B.fromX = j.footB.x;
      f.steps.B.t0 = s;
    }
  }

  // Langkah ramp-in react/hit frame ini (dibaca cabang pose + IK di bawah,
  // dimajukan sekali per frame sesudah blok IK — bukan di tiap cabang,
  // supaya pose lerp dan IK memakai jadwal yang sama).
  const rStep = f.reactStep;
  if (poseDirect) {
    // ANTICIPATION RAMP-IN (riset anticipation 2026-11-08): pose serangan
    // langsung ditugaskan di frame pertama attack, jadi pose load (keyframe
    // 0/1) "muncul tiba-tiba" — terukur 42,43 px/frame di frame pertama
    // (B singleleg, handB; 11/28 onset > 30 px/frame). Frame pertama
    // attack: blend 50% dari pose sebelumnya menuju poseDirect
    // (lerpPoseFull, busur terpendek); frame kedua sudah tepat di
    // poseDirect. Keyframe, waktu impact, dan pacing CF2 tidak berubah —
    // hanya awal windup yang dilunakkan 1 frame, bukan digeser.
    // RAMP-IN BERSKALA POWER (2026-11-09, MOTION-LOG §29 — lanjutan
    // anticipation 2026-11-08): serangan berat (DMG_BASE >= 4: headkick,
    // finisher, suplex, flyknee, ...) butuh antisipasi lebih panjang
    // (MOCAP: serangan berat 8-12 frame antisipasi vs jab 2-3 frame) —
    // ramp 2 frame: 1/3 lalu 2/3 kumulatif (blend 1/2 lagi di frame ke-2),
    // poseDirect tepat di frame ke-3. Ringan tetap 1 frame x 0,5 (frame
    // ke-2 = poseDirect). Windup serangan berat >= 0,18 dtk (5,4 frame),
    // jadi ramp selesai jauh sebelum impact — pacing CF2 tidak berubah.
    const heavyAtk = (DMG_BASE[kindKey(myAtk.kind)] ?? 0) >= 4;
    if (f.rampAtkT !== myAtk.t) {
      f.rampAtkT = myAtk.t;
      f.rampStep = 1;
      f.pose = lerpPoseFull(f.pose, poseDirect, heavyAtk ? 1 / 3 : 0.5);
    } else if (heavyAtk && f.rampStep === 1) {
      f.rampStep = 2;
      f.pose = lerpPoseFull(f.pose, poseDirect, 0.5);
    } else {
      f.pose = poseDirect;
    }
  } else if (target) {
    const full = mergePose(poseGuard(f.key), target);
    let k = 1 - Math.exp(-rate * dt);
    // REACT RAMP-IN (lihat atas): 2 frame pertama masuk react/hit, sebar
    // menuju pose target — 1/3 lalu 1/2 (kumulatif 2/3) — supaya tangan/
    // kepala tidak meloncat 30+ px/frame di frame pertama (terukur 42,64
    // block, 37,92 slip). Frame ke-3 kembali ke lerp eksponensial biasa.
    if (rStep === 1) k = 1 / 3;
    else if (rStep === 2) k = 0.5;
    f.pose = lerpPoseFull(f.pose, full, k);
  }
  if (mode === 'guard' || mode === 'walk' || mode === 'pickup') {
    f.pose.crouch = clamp(f.pose.crouch + Math.sin(s * 6) * 0.015, 0, 1);
    f.bob = Math.sin(s * 2.2) * 1.5;
  }
  // LAND-SQUASH (squash & stretch, riset 2026-11-09, MOTION-LOG §30):
  // crouch tambahan saat mendarat — puncak di frame sentuhan, pulih sstep
  // 0,15 dtk. Aditif di atas pose mode (seperti bob guard di atas): di
  // attack poseDirect menimpa tiap frame (tanpa carryover), di guard/walk
  // lerp menyisakan sebagian (puncak efektif ~0,32 untuk amp 0,25 —
  // terukur, tetap < 1). Berlaku di semua mode termasuk 'falling'/'down'
  // (badan yang jatuh ikut memipih saat menghantam lantai — gate 'down'
  // awal sempat mematikan squash di pendaratan knockdown, terukur bump 0).
  if (f.landSquash) {
    const ph = clamp((s - f.landSquash.t0) / f.landSquash.dur, 0, 1);
    f.pose.crouch = clamp(f.pose.crouch + f.landSquash.amp * (1 - sstep(ph)), 0, 1);
    if (ph >= 1) f.landSquash = null;
  }

  if (ikOverride) {
    const j = computeJoints(f);
    if (ikOverride.isKnee) {
      const root = j.hipB;
      const a = Math.atan2(f.face * (ikOverride.point.x - root.x), ikOverride.point.y - root.y);
      f.pose.legB = { a, k: -1.9 };
    } else if (ikOverride.isElbow) {
      const root = j.shB;
      const a = Math.atan2(f.face * (ikOverride.point.x - root.x), ikOverride.point.y - root.y);
      f.pose.armB = { a, b: 1.7 };
    } else {
      const root = ikOverride.limb.startsWith('arm')
        ? (ikOverride.limb === 'armF' ? j.shF : j.shB)
        : (ikOverride.limb === 'legF' ? j.hipF : j.hipB);
      const L1 = ikOverride.limb.startsWith('arm') ? ARM_L1 : LEG_L1;
      const L2 = ikOverride.limb.startsWith('arm') ? ARM_L2 : LEG_L2;
      const sol = ik2(root, ikOverride.point, L1, L2, f.face, ikOverride.elbowUp === true, ikOverride.limb.startsWith('leg'));
      if (ikOverride.limb.startsWith('arm')) {
        // REACT RAMP-IN (lihat atas): IK block/parry menempel tangan
        // langsung ke titik blok dalam 1 frame (terukur handF 42,64
        // px/frame) — sebar seperti pose lerp: 1/3 lalu 1/2 (kumulatif
        // 2/3) dari sudut lengan kini menuju solusi IK (busur terpendek
        // via lerpAngle). Di luar react (mis. travel serangan) solusi IK
        // tetap dipakai penuh — rStep 0 di sana.
        if (rStep === 1 || rStep === 2) {
          const kIk = rStep === 1 ? 1 / 3 : 0.5;
          const cur = f.pose[ikOverride.limb];
          f.pose[ikOverride.limb] = { a: lerpAngle(cur.a, sol.a, kIk), b: lerpAngle(cur.b, sol.b, kIk) };
        } else {
          f.pose[ikOverride.limb] = { a: sol.a, b: sol.b };
        }
      } else {
        f.pose[ikOverride.limb] = { a: sol.a, k: clampKnee(sol.b) };
      }
    }
  }
  // Majukan jadwal ramp-in react/hit (sekali per frame, sesudah pose + IK).
  if (rStep === 1) f.reactStep = 2;
  else if (rStep === 2) f.reactStep = 0;

  // --- POSISI DARI TIMELINE ENGINE (2026-11-08) ---
  // Badan mengikuti timeline. Diterapkan SEBELUM langkah + IK kaki supaya
  // sendi dihitung untuk posisi badan AKHIR langkah ini (s+dt), bukan awal
  // (s): kalau IK dihitung untuk posisi awal lalu badan dipindah ~15px oleh
  // timeline (lunge 450px/dtk), kaki yang menapak ikut bergeser 15px dari
  // targetnya = slide. Pose, IK, langkah, timing, gerakan TIDAK berubah —
  // hanya posisi badan yang tadinya dada-ke-dada (~50px) kini berjarak
  // jaga engine. (Di akhir stepFighter, override diulang untuk mengoreksi
  // integrasi vx cabang — lihat bawah.)
  if (tl) {
    f.x = (f.key === 'R' ? tl.xR : tl.xB) + f.face * (f.lunge || 0);
    f.vx = tlVx;
  }

  const fkLegs = (mode === 'falling' || mode === 'down' || mode === 'getup');
  if (fkLegs) f.steps = { F: null, B: null };
  if (fkLegs) f.legReturn = null; // jatuh/terbaring: kaki tidak blend kembali
  if (!fkLegs) {
    for (const leg of ['F', 'B']) {
      const st = f.steps[leg];
      if (st && (s - st.t0) / st.dur >= 1) {
        f.feet[leg].x = st.toX;
        stepLog.push({ t: +s.toFixed(3), who: f.key, leg, toX: Math.round(st.toX) });
        spawnDust(particles, s, st.toX, GROUND, 4, 45, 0.7, 0.45, 4, 11);
        f.steps[leg] = null;
      }
    }
    // Langkah juga saat menyerang: lunge timeline (450px/dtk) bergerak
    // selama windup — tanpa langkah, kaki tumpu tertinggal dan meluncur
    // (dulu vx=0 saat windup, jadi tidak perlu; sekarang badan bergerak
    // lewat timeline). Kaki tendang (B) tidak pernah dilangkahkan saat
    // tendangannya sendiri (kakinya di udara, digerakkan IK serangan).
    // Tiap kaki yang tertinggal melangkah sendiri-sendiri (bisa bersamaan)
    // supaya tidak ada yang menunggu giliran saat badan melunge.
    const stepKickLeg = (mode === 'attack' && myAtk && isKick(myAtk.kind)) ? 'B' : null;
    if (mode === 'walk' || mode === 'guard' || mode === 'react' || mode === 'hit' || mode === 'pickup' || mode === 'attack') {
      // Kecepatan untuk durasi langkah: timeline (lunge 450px/dtk) ikut
      // dihitung, bukan hanya vx cabang — vx cabang 0 saat windup padahal
      // badan melunge.
      const spd = Math.max(Math.abs(f.vx), Math.abs(tlVx));
      const dur = spd > 90 ? Math.max(0.07, 0.14 * 90 / spd) : 0.14;
      // Cap jarak langkah (riset spacing & timing 2026-11-08): langkah
      // 3 frame (lantai startStep 0,1 dtk) menaruh 48% jarak di frame
      // tengah/terakhir, dan frame terakhir menambah turun busur 13,9px
      // (sin 16px) — jadi sqrt((0,48*D)^2 + 13,9^2) < 30 → D ≤ 55.
      // Lunge (spd > 200): cap 50 (terukur maks 28,51). Jalan normal:
      // cap 55 (dulu 64 — langkah 64px/3 frame memberi 30,81).
      // Dua kaki bergantian tetap mengejar badan (kapasitas ~40 px/frame
      // vs badan 15 px/frame saat lunge, 7 px/frame saat jalan).
      const capPx = spd > 200 ? 50 : 55;
      for (const leg of ['F', 'B']) {
        if (leg === stepKickLeg) continue;
        if (f.steps[leg]) continue; // kaki ini sedang melangkah
        const off = (leg === 'F' ? 28 : -28) * f.face;
        const home = f.x + off;
        const disp = Math.abs(home - f.feet[leg].x);
        if (disp <= 10) continue; // 10px (bukan 14): di jalan cepat kaki
        // harus melangkah sebelum IK kehabisan jangkauan, kalau tidak
        // kaki tampak meluncur.
        // Prediksi posisi badan saat langkah SELESAI (dur ke depan) memakai
        // kecepatan TIMELINE (bukan vx cabang — vx cabang 0 saat windup
        // padahal badan melunge 450px/dtk). Dulu 0,14 dtk: kaki mendarat
        // 30px+ DI DEPAN home (langkah cuma 0,07 dtk) — kaki di luar
        // jangkauan pinggul dan terseret = slide. Sekarang mendarat pas di
        // home saat langkah selesai.
        const predHome = f.x + tlVx * dur + off;
        const capped = f.feet[leg].x + clamp(predHome - f.feet[leg].x, -capPx, capPx);
        startStep(f, leg, capped, dur, s);
      }
    }
    const j = computeJoints(f);
    for (const leg of ['F', 'B']) {
      const limbName = 'leg' + leg;
      if (ikOverride && ikOverride.limb === limbName) continue;
      if (mode === 'attack' && myAtk && isKick(myAtk.kind) && limbName === 'legB' && (s - myAtk.t) < -STRIKE_TRAVEL) continue;
      let targetPt;
      if (f.steps[leg]) {
        const st = f.steps[leg];
        const phS = clamp((s - st.t0) / st.dur, 0, 1);
        // Easing langkah sstep (riset 2026-11-08): easeOut menaruh 70%
        // jarak di frame pertama (f'(0)=3) — kaki "meloncat". sstep
        // (f'(0)=f'(1)=0) menyebar 26%/48%/26% pada langkah 3 frame:
        // mulai pelan, cepat di tengah, mendarat pelan (cocok dengan
        // komponen y yang sudah memakai sin). Pukulan tetap easeOut
        // (snap anime disengaja, CF2 §17) — hanya langkah kaki yang diubah.
        targetPt = { x: lerp(st.fromX, st.toX, sstep(phS)), y: GROUND - Math.sin(phS * Math.PI) * 16 };
      } else {
        targetPt = { x: f.feet[leg].x, y: GROUND };
      }
      // Blend kembalinya kaki tendang (follow-through): target IK bergerak
      // dari posisi tendang ke posisi menapak selama LEG_RETURN_DUR, bukan
      // sekali lompat. Target bisa ikut bergerak (langkah menapak berjalan
      // paralel) — lerp memakai targetPt frame ini sebagai tujuan.
      if (f.legReturn && f.legReturn.leg === leg) {
        const lr = f.legReturn;
        const k = clamp((s - lr.t0) / lr.dur, 0, 1);
        targetPt = lerpPt(lr.from, targetPt, sstep(k));
        if (k >= 1) f.legReturn = null;
      }
      const root = leg === 'F' ? j.hipF : j.hipB;
      const sol = ik2(root, targetPt, LEG_L1, LEG_L2, f.face, false, true);
      f.pose[limbName] = { a: sol.a, k: clampKnee(sol.b) };
    }
  }

  if (!f.grounded) {
    f.vy += GRAV * dt;
    f.y += f.vy * dt;
    if (f.y >= GROUND) {
      f.y = GROUND;
      if (f.vy > 220) {
        spawnDust(particles, s, f.x, GROUND, 10, 110, 0.8, 0.6, 5, 31);
        f.vy = -f.vy * 0.22;
        // LAND-SQUASH keras: benturan > 220 = squash penuh (amp 0,25).
        // Squash yang masih aktif tidak ditimpa.
        if (!f.landSquash) f.landSquash = { t0: s, dur: LAND_SQUASH_DUR, amp: LAND_SQUASH_AMP };
      } else {
        const vyIn = f.vy;
        f.vy = 0; f.grounded = true;
        // LAND-SQUASH sebanding benturan (MOTION-LOG §30): vy kecil =
        // squash kecil, lantai 0,3x supaya lompatan kecil tetap terbaca;
        // vy < 40 = mikro-hop, tanpa squash. Pendaratan ulang setelah
        // pantulan keras tidak menimpa squash yang masih aktif.
        if (!f.landSquash && vyIn > 40) {
          f.landSquash = { t0: s, dur: LAND_SQUASH_DUR, amp: LAND_SQUASH_AMP * clamp(vyIn / 220, 0.3, 1) };
        }
      }
    }
  }
  // Kecepatan efektif untuk slide/lean: kecepatan timeline saat timeline
  // aktif (vx cabang 0 saat windup padahal badan melunge 450px/dtk).
  const vxEff = tl ? tlVx : f.vx;
  const sliding = f.grounded && Math.abs(vxEff) > 90;
  const fric = sliding ? 3.2 : 7;
  f.vx *= Math.exp(-fric * dt);
  if (Math.abs(f.vx) < 5) f.vx = 0;
  f.x += f.vx * dt;
  if (sliding) {
    f.slideDustAcc += dt;
    if (f.slideDustAcc > 0.05) {
      f.slideDustAcc = 0;
      spawnDust(particles, s, f.x - f.face * 10, GROUND, 2, 50, 0.6, 0.45, 4, 41);
    }
  }
  const leanT = clamp(vxEff * 0.0006, -0.22, 0.28) + (f.pose ? f.pose.lean * 0.4 : 0);
  f.lean = lerp(f.lean, leanT, 1 - Math.exp(-10 * dt));

  // --- POSISI DARI TIMELINE ENGINE (2026-11-08, koreksi akhir) ---
  // Integrasi vx cabang di atas menggeser f.x dari posisi timeline; tarik
  // kembali ke timeline (nilai yang sama seperti override sebelum IK).
  // Pose, IK, langkah, timing, dan gerakan TIDAK berubah — hanya posisi
  // badan yang tadinya dada-ke-dada (~50px) kini berjarak jaga engine.
  if (tl) {
    // + hentakan serang (f.lunge, 0 di luar jendela hentak): badan maju
    // sampai 27px ke arah lawan saat impact — lihat cabang attack.
    f.x = (f.key === 'R' ? tl.xR : tl.xB) + f.face * (f.lunge || 0);
    f.vx = tlVx;
  }
}

function lerpPt(a, b, k) { return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) }; }

function guardLimbPoint(f, limb, kind) {
  const j = computeJointsWithPose(f, poseGuard(f.key));
  if (kind === 'knee' || kind === 'flyknee') return j.kneeB;
  if (kind === 'elbow') return j.elbowB;
  if (limb === 'armF') return j.handF;
  if (limb === 'armB') return j.handB;
  return j.footB;
}

function triggerAttack(atk, R, B, t, particles, impacts) {
  if (atk.kind === 'feint') return;
  if (atk.outcome === 'shadow') return;
  const att = atk.by === 'R' ? R : B;
  const def = atk.by === 'R' ? B : R;
  const dir = att.face;
  // Power VISUAL di-clamp ke 2,2 (2026-11-08): power damage finisher KO
  // bisa > 2,2 (harus = sisa HP pecundang supaya KO bersih) — tanpa clamp
  // ini, dampak/debu/knockback finisher jadi 3-4x normal dan korban
  // terlempar keluar layar. Damage tetap memakai atk.power penuh (dmgOf).
  const vp = Math.min(atk.power, 2.2);
  const jD = computeJoints(def);
  const center = atk.target === 'head' ? jD.head
    : atk.target === 'body' ? jD.torso
    : jD.kneeF;
  if (atk.outcome === 'hit') {
    const cx = center.x - dir * 6, cy = center.y;
    impacts.push({ t, x: cx, y: cy, power: vp, kind: 'hit' });
    spawnDust(particles, t, cx, cy + 30, Math.round(6 + vp * 8), 90 + vp * 110, 1.0, 0.5, 5, 51);
    // Percikan terang hanya untuk pukulan/tendangan mid+ (tier, lihat
    // impactTier): light tetap debu saja supaya hierarki terbaca.
    if (vp >= 1.15) spawnSparks(particles, t, cx, cy, Math.round(4 + (vp - 1.15) * 10), vp, 52);
    if (def.mode === 'down' || def.mode === 'falling') return;
    def.vx += vp * 220 * dir;
    if (atk.kind === 'uppercut' || atk.kind === 'finisher' || kindKey(atk.kind) === 'headkick' || atk.power >= 1.3) {
      def.vy = -vp * 170;
      def.grounded = false;
    }
    def.hitUntil = t + 0.24;
    // Serangan yang menjatuhkan lawan (takedown / finisher KO): mulai jatuh.
    if (atk.knockdown) {
      startFall({ who: def.key, t: t + 0.4 }, R, B, t + 0.4, particles);
    }
  } else if (atk.outcome === 'block' || atk.outcome === 'parry') {
    const bx = center.x - dir * 26, by = center.y;
    impacts.push({ t, x: bx, y: by, power: atk.power * 0.45, kind: atk.outcome });
    spawnDust(particles, t, bx, by + 20, 4, 60, 0.8, 0.4, 4, 53);
    def.vx += atk.power * 70 * dir;
    att.vx -= atk.power * 50 * dir;
  }
}

function startFall(kd, R, B, t, particles) {
  const f = kd.who === 'R' ? R : B;
  if (f.mode === 'down' || f.mode === 'falling') return;
  f.mode = 'falling';
  f.vx += -f.face * 300;
  f.vy = -150; f.grounded = false;
  f.hitUntil = -1;
}

// ---------------- pengecekan otomatis (dipakai test) ----------------
export function contactReport() {
  const rows = [];
  for (const atk of S.ATTACKS) {
    let preDef = null;
    let preAttHist = []; // 2 sampel terakhir sendi penyerang pre-impact (untuk parry: tangan defender mengejar anggota penyerang yang bergerak ~1 frame di belakang karena R distep dulu baru B)
    const sim = simulate(atk.t + 0.02, (s, R, B) => {
      if (s < atk.t) {
        const d = atk.by === 'R' ? B : R;
        const j = computeJoints(d);
        preDef = { head: j.head, torso: j.torso, kneeF: j.kneeF, handF: j.handF, shF: j.shF };
        const at = atk.by === 'R' ? R : B;
        const ja = computeJoints(at);
        preAttHist.push({ elbowF: ja.elbowF, handF: ja.handF, elbowB: ja.elbowB, handB: ja.handB, kneeB: ja.kneeB, footB: ja.footB });
        if (preAttHist.length > 2) preAttHist.shift();
      }
    });
    const att = atk.by === 'R' ? sim.R : sim.B;
    const def = atk.by === 'R' ? sim.B : sim.R;
    const jA = computeJoints(att), jD = computeJoints(def);
    const limb = limbFor(atk.kind);
    const eff = atk.kind === 'knee' || atk.kind === 'flyknee' || atk.kind === 'kneediag' ? jA.kneeB
      : atk.kind === 'elbow' || atk.kind === 'elbowup' || atk.kind === 'elbowspin' ? jA.elbowB
      : limb === 'armF' ? jA.handF : limb === 'armB' ? jA.handB : jA.footB;
    const center = atk.target === 'head' ? jD.head
      : atk.target === 'body' ? jD.torso
      : jD.kneeF;
    const preCenter = preDef
      ? (atk.target === 'head' ? preDef.head : atk.target === 'body' ? preDef.torso : preDef.kneeF)
      : center;
    const entry = sim.rt.atk.get(atk.t);
    const ghost = entry?.ghost || ghostPoint(entry?.ghostX ?? def.x, def.face, atk.target);
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const row = { t: atk.t, by: atk.by, kind: atk.kind, target: atk.target, outcome: atk.outcome, power: atk.power };
    if (atk.outcome === 'shadow') {
      const y = atk.target === 'head' ? GROUND - 153 : atk.target === 'body' ? GROUND - 105 : GROUND - 34;
      const shadowPt = { x: att.x + att.face * (strikeRange(atk.kind) - 12), y };
      const d = dist(eff, shadowPt);
      row.dTarget = +d.toFixed(1);
      row.pass = d <= 12;
      row.note = `fist/kaki ke titik bayangan ${row.dTarget}px (ambang 12)`;
    } else if (atk.kind === 'feint') {
      const sim2 = simulate(atk.t - 0.02);
      const att2 = atk.by === 'R' ? sim2.R : sim2.B;
      const def2 = atk.by === 'R' ? sim2.B : sim2.R;
      const jA2 = computeJoints(att2);
      const eff2 = jA2.handF;
      const ghost2 = ghostPoint(def2.x, def2.face, atk.target);
      const dGhost = dist(eff2, ghost2);
      const guardHand = guardLimbPoint(att2, 'armF');
      const flick = dist(eff2, guardHand);
      const guardDist = dist(guardHand, ghost2);
      const ratio = guardDist > 0 ? dGhost / guardDist : 1;
      row.dGhost = +dGhost.toFixed(1);
      row.flick = +flick.toFixed(1);
      row.ratio = +ratio.toFixed(2);
      row.pass = flick >= 8 && ratio >= 0.35 && ratio <= 0.65;
      row.note = `fist ${row.dGhost}px dari kepala hantu (sisa ${row.ratio}), flick ${row.flick}px`;
    } else if (atk.kind === 'ginga') {
      // Stance, bukan serangan: tidak ada titik kontak yang dicek.
      // Keterbacaan siklus ginga dicek di tes §24 (sway bolak-balik,
      // crouch ringan, kaki tidak menendang), bukan di sini.
      row.pass = true;
      row.note = 'stance ginga — bukan serangan, tidak ada kontak';
    } else if (atk.outcome === 'hit') {
      // Target kaki: pakai lutut LIVE (seperti block) — lutut bergerak
      // karena langkah defender, dan kaki penyerang di-IK ke lutut live;
      // pre-impact menghukum kaki yang sebenarnya tepat di lutut.
      // Target kepala/badan: pakai pre-impact — defender flinch MENJAUH
      // setelah impact, jadi titik live bukan tempat pukulan mendarat.
      const hitCenter = atk.target === 'leg' ? jD.kneeF : preCenter;
      const d = dist(eff, hitCenter);
      // Lutut: posisi lutut terikat panjang paha (48px dari pinggul), jadi
      // tidak bisa tepat di target — ambang 15px, sama seperti cabang block.
      const thr = (atk.kind === 'knee' || atk.kind === 'flyknee' || atk.kind === 'kneediag') ? 15 : atk.target === 'leg' ? 10 : 12;
      row.dTarget = +d.toFixed(1);
      row.pass = d <= thr;
      row.note = `fist/kaki ke ${atk.target} pre-impact ${row.dTarget}px (ambang ${thr})`;
    } else if (atk.outcome === 'block') {
      // Titik block LIVE (lutut/kepala/torso defender saat ini), bukan
      // pre-impact: lutut defender bergerak ±15px antar frame karena langkah
      // saat block, sementara kaki/tangan penyerang di-IK ke titik live —
      // memakai preCenter menghukum serangan yang sebenarnya tepat di
      // sasaran (terukur: lowkick block dFist 16px padahal kaki 0,9px dari
      // lutut live).
      const liveCenter = atk.target === 'head' ? jD.head : atk.target === 'body' ? jD.torso : jD.kneeF;
      const bp = { x: liveCenter.x - att.face * 26, y: liveCenter.y };
      const dFist = dist(eff, bp);
      // Tangan block: titik block target kaki (lutut, ~105px dari bahu)
      // TIDAK terjangkau lengan 66px (clamp IK 65px) — yang dicek adalah
      // tangan sudah TERULUR MAKSIMAL ke arah titik block, bukan tepat di
      // titiknya. Posisi harapan = bahu + 65px ke arah bp (atau bp sendiri
      // bila sudah dalam jangkauan); tangan guard berjarak ~110px dari sana.
      const shF = jD.shF;
      const handRef = jD.handF;
      const dSh = dist(shF, bp);
      const exp = dSh > 65
        ? { x: shF.x + (bp.x - shF.x) * 65 / dSh, y: shF.y + (bp.y - shF.y) * 65 / dSh }
        : bp;
      const dHand = dist(handRef, exp);
      row.dFist = +dFist.toFixed(1); row.dHand = +dHand.toFixed(1);
      // Lutut: posisi lutut terikat panjang paha (48px dari pinggul), jadi
      // tidak bisa tepat di titik block — ambang 15px, bukan 10px.
      const thr = (atk.kind === 'knee' || atk.kind === 'flyknee' || atk.kind === 'kneediag') ? 15 : 10;
      row.pass = dFist <= thr && dHand <= 10;
      row.note = `fist ke titik block ${row.dFist}px (ambang ${thr}), tangan block ${row.dHand}px`;
    } else if (atk.outcome === 'parry') {
      const dGhost = dist(eff, ghost);
      const alimb = limbFor(atk.kind);
      // Serangan kaki diparry di TULANG KERING (tengah lutut->kaki), bukan
      // di tangan penyerang — cabang lama memakai siku/tangan penyerang
      // sehingga parry lowkick/osotogari selalu gagal.
      const isLegAtk = alimb === 'legF' || alimb === 'legB';
      const e1 = isLegAtk ? jA.kneeB : alimb === 'armF' ? jA.elbowF : jA.elbowB;
      const h1 = isLegAtk ? jA.footB : alimb === 'armF' ? jA.handF : jA.handB;
      const foreMid = { x: (e1.x + h1.x) / 2, y: (e1.y + h1.y) / 2 };
      // Sama seperti tangan block: titik parry di tulang kering lawan bisa
      // ~100px dari bahu defender (di luar lengan 66px) — yang dicek adalah
      // tangan sudah terulur maksimal ke arah titik parry.
      // Tangan defender mengejar anggota penyerang yang bergerak cepat dan
      // distep 1 frame lebih dulu (R dulu baru B): tangan bisa tertinggal
      // ~1 frame dari titik tengah anggota SAAT INI — jadi ukur juga ke
      // titik tengah anggota PRE-impact dan ambil yang terdekat.
      const expHand = (fm) => {
        const shP = jD.shF;
        const dShP = dist(shP, fm);
        return dShP > 65
          ? { x: shP.x + (fm.x - shP.x) * 65 / dShP, y: shP.y + (fm.y - shP.y) * 65 / dShP }
          : fm;
      };
      const fmOf = (ja) => isLegAtk ? { x: (ja.kneeB.x + ja.footB.x) / 2, y: (ja.kneeB.y + ja.footB.y) / 2 }
        : alimb === 'armF' ? { x: (ja.elbowF.x + ja.handF.x) / 2, y: (ja.elbowF.y + ja.handF.y) / 2 }
        : { x: (ja.elbowB.x + ja.handB.x) / 2, y: (ja.elbowB.y + ja.handB.y) / 2 };
      const dParry = Math.min(dist(jD.handF, expHand(foreMid)),
        ...preAttHist.map((pa) => dist(jD.handF, expHand(fmOf(pa)))));
      // Ujung serang ke titik parry (hantu + 38px ke bawah): bila titik itu
      // di luar jangkauan anggota serang, yang dicek adalah ujung sudah di
      // jangkauan maksimal ke arahnya (bukan jarak ke hantu yang mengecil
      // karena kaki berhenti 12px sebelum titik).
      const parryPt = { x: ghost.x, y: ghost.y + 38 };
      const isKneeAtk = atk.kind === 'knee' || atk.kind === 'flyknee' || atk.kind === 'kneediag';
      const isElbowAtk = atk.kind === 'elbow' || atk.kind === 'elbowup' || atk.kind === 'elbowspin';
      const rootA = isKneeAtk ? jA.hipB : isElbowAtk ? jA.shB : isLegAtk ? jA.hipB : alimb === 'armF' ? jA.shF : jA.shB;
      const reachA = isKneeAtk ? 48 : isElbowAtk ? 34 : isLegAtk ? 93 : 65;
      const dRootA = dist(rootA, parryPt);
      const expF = dRootA > reachA
        ? { x: rootA.x + (parryPt.x - rootA.x) * reachA / dRootA, y: rootA.y + (parryPt.y - rootA.y) * reachA / dRootA }
        : parryPt;
      const dFootExp = dist(eff, expF);
      row.dGhost = +dGhost.toFixed(1); row.dParry = +dParry.toFixed(1); row.dFootExp = +dFootExp.toFixed(1);
      row.pass = (dGhost >= 30 || dFootExp <= 10) && dParry <= 15;
      row.note = `fist lewat ${row.dGhost}px dari hantu (ambang 30 / maks-jangkau ${row.dFootExp}px), tangan parry ${row.dParry}px`;
    } else {
      const dGhost = dist(eff, ghost);
      const dLive = dist(eff, center);
      row.dGhost = +dGhost.toFixed(1); row.dLive = +dLive.toFixed(1);
      // Senjata pendek (siku/lutut) tidak bisa mencapai hantu yang bergeser
      // oleh sidestep — yang penting ayunan mengarah ke hantu dan MISS
      // jelas dari target hidup (>= 20px = radius glove 14 + lebar garis).
      const ghostThr = (atk.kind === 'elbow' || atk.kind === 'knee' || atk.kind === 'flyknee' || atk.kind === 'kneediag' || atk.kind === 'elbowup' || atk.kind === 'elbowspin') ? 25 : 10;
      // Grapple (clinch/takedown/lemparan judo): yang dicek hanya jangkauan
      // ke hantu — penyerang memang menutup jarak ke badan (grab attempt),
      // jadi "MISS jelas dari target hidup" tidak berlaku untuknya (dodge di
      // sini diekspresikan reaksi flinch/slip defender, bukan jarak).
      const GRAPPLE = new Set(['clinch', 'takedown', 'seoinage', 'osotogari', 'uchimata',
        'doubleleg', 'singleleg', 'suplex', 'bodyslam', 'anklepick', 'outsidetrip', 'armbar']);
      // Hantu bisa di luar jangkauan anggota serang (hantu = posisi defender
      // saat windup mulai; penyerang mendekat selama windup tapi hantu
      // tetap di posisi awal — kaki 93px / tangan 65px tidak sampai bila
      // hantu 100px+ dari pinggul/bahu). Yang dicek: ujung sudah di
      // jangkauan maksimal ke arah hantu (sama seperti parry).
      const isKneeD = atk.kind === 'knee' || atk.kind === 'flyknee' || atk.kind === 'kneediag';
      const isElbowD = atk.kind === 'elbow' || atk.kind === 'elbowup' || atk.kind === 'elbowspin';
      const limbD = limbFor(atk.kind);
      const rootD = isKneeD ? jA.hipB : isElbowD ? jA.shB : limbD === 'legF' ? jA.hipF : limbD === 'legB' ? jA.hipB : limbD === 'armF' ? jA.shF : jA.shB;
      const reachD = isKneeD ? 48 : isElbowD ? 34 : (limbD === 'legF' || limbD === 'legB') ? 93 : 65;
      const dRootD = dist(rootD, ghost);
      const expD = dRootD > reachD
        ? { x: rootD.x + (ghost.x - rootD.x) * reachD / dRootD, y: rootD.y + (ghost.y - rootD.y) * reachD / dRootD }
        : ghost;
      const dExpD = dist(eff, expD);
      row.dExp = +dExpD.toFixed(1);
      const hitGhost = dGhost <= ghostThr || dExpD <= 10;
      row.pass = GRAPPLE.has(atk.kind) ? hitGhost : (hitGhost && dLive >= 20);
      row.note = `fist ke titik hantu ${row.dGhost}px (ambang ${ghostThr} / maks-jangkau ${row.dExp}px), ke ${atk.target} kini ${row.dLive}px`;
    }
    rows.push(row);
  }
  return rows;
}

export function slideReport() {
  let maxDrift = 0, worst = null, samples = 0;
  const sim = simulate(S.DURATION, (s, R, B) => {
    for (const f of [R, B]) {
      if (f.mode === 'falling' || f.mode === 'down' || f.mode === 'getup') continue;
      const atk = atkFor(s, f.key);
      const kickLeg = atk && isKick(atk.kind) ? 'B' : null;
      const j = computeJoints(f);
      for (const leg of ['F', 'B']) {
        if (f.steps[leg]) continue; // kaki sedang melangkah
        if (kickLeg === leg) continue;
        if (f.legReturn && f.legReturn.leg === leg) continue; // kaki sedang blend kembali (follow-through) — bukan menapak, sama seperti langkah
        const vis = leg === 'F' ? j.footF : j.footB;
        if (vis.y < GROUND - 5) continue;
        const drift = Math.abs(vis.x - f.feet[leg].x);
        samples++;
        if (drift > maxDrift) { maxDrift = drift; worst = { t: +s.toFixed(2), who: f.key, leg, drift: +drift.toFixed(1) }; }
      }
    }
  });
  return { maxDrift: +maxDrift.toFixed(1), worst, samples, steps: sim.stepLog.length, stepLog: sim.stepLog };
}

export function kneeReport() {
  let maxK = -99, minK = 0, worstK = null, worstOff = null;
  let badK = 0, badOff = 0, samples = 0;
  simulate(S.DURATION, (s, R, B) => {
    for (const f of [R, B]) {
      const atk = atkFor(s, f.key);
      const kickLeg = atk && isKick(atk.kind) ? 'B' : null;
      const j = computeJoints(f);
      const falling = f.mode === 'falling' || f.mode === 'down' || f.mode === 'getup';
      for (const leg of ['F', 'B']) {
        const k = f.pose['leg' + leg].k;
        samples++;
        if (k > maxK) { maxK = k; worstK = { k: +k.toFixed(2), t: +s.toFixed(2), who: f.key, leg, mode: f.mode }; }
        if (k < minK) minK = k;
        if (k < -2.3 || k > 0.05) badK++;
        if (falling || kickLeg === leg || f.steps[leg]) continue;
        const hip = leg === 'F' ? j.hipF : j.hipB;
        const knee = leg === 'F' ? j.kneeF : j.kneeB;
        const foot = leg === 'F' ? j.footF : j.footB;
        const ux = foot.x - hip.x, uy = foot.y - hip.y;
        const len = Math.hypot(ux, uy) || 1;
        const rx = knee.x - hip.x, ry = knee.y - hip.y;
        const along = (rx * ux + ry * uy) / len;
        const px = rx - (along * ux) / len;
        const off = px * f.face;
        if (!worstOff || off < worstOff.off) worstOff = { off: +off.toFixed(1), t: +s.toFixed(2), who: f.key, leg, mode: f.mode };
        if (off < -1) badOff++;
      }
    }
  });
  return { maxK: +maxK.toFixed(2), minK: +minK.toFixed(2), worstK, worstOff, badK, badOff, samples };
}

// ---------------- Efek KO / knockdown (Langkah 4) ----------------
// Zoom KO: naik 0,8 dtk -> tahan 0,2 -> turun 1,0 dtk (total 2,0 dtk),
// puncak 1,12x, lalu kembali 1,0 JAUH sebelum layar juri (KO_END) supaya
// transisi tidak meloncat. TANPA slow-mo (pacing §17): KO dibaca lewat
// zoom + flash + shockwave + shake, bukan waktu melambat.
export function koZoomAt(tf) {
  if (S.RESULT !== 'ko') return 1;
  const start = S.INTRO_DUR + realTime(S.KO_T);
  const age = tf - start;
  if (age < 0 || age >= 2.0) return 1;
  if (age < 0.8) return 1 + 0.12 * sstep(age / 0.8);
  if (age < 1.0) return 1.12;
  return 1 + 0.12 * (1 - sstep((age - 1.0) / 1.0));
}

// Shockwave KO: cincin membesar dari kepala pecundang selama 0,6 dtk
// setelah KO (kilau + gelombang kejut, pasangan zoom). Fungsi MURNI dari
// waktu nyata + titik kepala saat itu.
export function koShockwaveAt(tf, x, y) {
  if (S.RESULT !== 'ko') return null;
  const start = S.INTRO_DUR + realTime(S.KO_T);
  const age = tf - start;
  if (age < 0 || age >= 0.6) return null;
  const k = age / 0.6;
  return { x, y, r: 20 + k * 140, alpha: 0.8 * (1 - k) };
}

// Ring tanah knockdown (bukan KO): elips datar di lantai, membesar 0,5 dtk.
const GROUND_RING_DUR = 0.5;
export function groundRingAt(s, rings) {
  const out = [];
  for (const rg of rings || []) {
    const k = (s - rg.t) / GROUND_RING_DUR;
    if (k < 0 || k > 1) continue;
    const rx = 20 + k * 70;
    out.push({ x: rg.x, y: rg.y, rx, ry: rx * 0.28, alpha: 0.5 * (1 - k) });
  }
  return out;
}

function drawGroundRings(c, s, rings) {
  const act = groundRingAt(s, rings);
  if (!act.length) return;
  c.save();
  for (const g of act) {
    // Cincin putih bertepi tinta — terbaca di lantai terang (ring) maupun
    // gelap (gudang/jalanan): outline gelap dulu, lalu putih di atasnya.
    c.globalAlpha = g.alpha * 0.8;
    c.strokeStyle = PALETTE.ink;
    c.lineWidth = 6;
    c.beginPath(); c.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = g.alpha;
    c.strokeStyle = PALETTE.paper;
    c.lineWidth = 3.5;
    c.beginPath(); c.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}

function drawKOFX(c, tf, sim) {
  if (S.RESULT !== 'ko') return;
  const loser = S.WINNER === 'R' ? sim.B : sim.R;
  const lj = computeJoints(loser);
  const sw = koShockwaveAt(tf, lj.head.x, lj.head.y);
  if (!sw) return;
  c.save();
  c.globalAlpha = sw.alpha;
  c.strokeStyle = PALETTE.paper;
  c.lineWidth = 5;
  c.beginPath(); c.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2); c.stroke();
  c.globalAlpha = sw.alpha * 0.7;
  c.strokeStyle = PALETTE.yellow;
  c.lineWidth = 2;
  c.beginPath(); c.arc(sw.x, sw.y, sw.r * 0.8, 0, Math.PI * 2); c.stroke();
  c.restore();
}

// ---------------- Aura / energi (Langkah 5, opsional) ----------------
// Angin ambient: 6 garis tipis melayang di latar arena (di belakang
// petarung, di atas dinding/penonton), alpha 0,08 — hadir terus tapi
// nyaris tak terasa, supaya fight tetap terbaca. Posisi deterministik
// dari waktu sim (hash01), bukan Math.random.
const WIND_STREAKS = 6;
export function windStreaksAt(s) {
  const out = [];
  const dark = getMapPalette(S.MAP).dark;
  for (let i = 0; i < WIND_STREAKS; i++) {
    const h1 = hash01(i * 7 + 1), h2 = hash01(i * 7 + 2), h3 = hash01(i * 7 + 3);
    const y = 180 + h1 * 620; // pita dinding + ring (bukan HUD)
    const spd = 60 + h2 * 90; // px/dtk
    const len = 60 + h3 * 60;
    const dir = h2 < 0.5 ? 1 : -1; // arah angin per garis (tetap)
    const span = 1400;
    let x = (h1 * 1200 + dir * spd * s) % span;
    if (x < 0) x += span;
    x -= 100;
    out.push({ x1: x, y1: y, x2: x + dir * len, y2: y, alpha: 0.08, width: 2, color: dark ? '#FFFFFF' : PALETTE.ink });
  }
  return out;
}

function drawWindStreaks(c, s) {
  const lines = windStreaksAt(s);
  c.save();
  c.lineCap = 'round';
  for (const ln of lines) {
    c.globalAlpha = ln.alpha;
    c.strokeStyle = ln.color;
    c.lineWidth = ln.width;
    c.beginPath();
    c.moveTo(ln.x1, ln.y1);
    c.lineTo(ln.x2, ln.y2);
    c.stroke();
  }
  c.restore();
}

// Aura petarung: kilau energi lembut di belakang penyerang selama 0,5 dtk
// setelah pukulan/tendangan HEAVY kena (bukan tiap pukulan — hanya momen
// besar). Radial gradient warna penyerang, alpha puncak 0,12, membesar +
// memudar. Digambar SEBELUM petarung (cahaya dari belakang, tidak
// menutupi badan). Fungsi MURNI.
export function auraAt(s, sim) {
  if (!sim) return null;
  let last = null;
  for (const atk of S.ATTACKS) {
    if (atk.outcome !== 'hit' || atk.power < 1.4) continue;
    if (s < atk.t || s > atk.t + 0.5) continue;
    if (!last || atk.t > last.t) last = atk;
  }
  if (!last) return null;
  const att = last.by === 'R' ? sim.R : sim.B;
  const j = computeJoints(att);
  const k = (s - last.t) / 0.5;
  return {
    x: j.torso.x, y: j.torso.y, r: 90 + k * 40,
    alpha: 0.12 * (1 - k), color: att.color, kind: last.kind,
  };
}

function drawAura(c, s, sim) {
  const a = auraAt(s, sim);
  if (!a) return;
  // Glow jatuh (falloff) — bukan cakram datar: tengah warna penyerang,
  // tepi transparan. Alpha puncak di auraAt (0,12).
  const r = parseInt(a.color.slice(1, 3), 16), g = parseInt(a.color.slice(3, 5), 16), b = parseInt(a.color.slice(5, 7), 16);
  c.save();
  const grad = c.createRadialGradient(a.x, a.y, 10, a.x, a.y, a.r);
  grad.addColorStop(0, `rgba(${r},${g},${b},${a.alpha})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  c.fillStyle = grad;
  c.beginPath(); c.arc(a.x, a.y, a.r, 0, Math.PI * 2); c.fill();
  c.restore();
}

// ---------------- kamera (pusat pada (camX, camY), seperti NF4) ----------------
// ---------------- Camera shake (trauma-based) ----------------
// Riset 2026-11-09 (MOTION-LOG §32): Eiserloh, GDC 2016 — trauma 0..1,
// naik per pukulan kena, meluruh linear, goyangan = trauma^2 x offset
// maks. Fungsi MURNI dari waktu nyata tf + SCENE (value noise
// deterministik dari hash01) supaya replay/poster/export identik untuk
// seed yang sama. Shake jalan di waktu NYATA (tetap bergerak saat
// hit-stop membekukan sim). Hanya dunia yang goyang: translate ini ada
// di dalam transform kamera render(); HUD (health bar, facecam, teks)
// digambar setelah c.restore() jadi tetap diam. Sim TIDAK disentuh.
const SHAKE_DUR = 0.3;      // durasi luruh trauma (riset: 0,1-0,3 dtk)
const SHAKE_MAX_PX = 5;     // offset maks layar (riset: 2-5 px)
const SHAKE_NOISE_HZ = 16;  // frekuensi grid value noise

function traumaOfKind(kind, knockdown) {
  if (knockdown) return 0.9;
  const dmg = DMG_BASE[kind] ?? 0;
  if (dmg >= 4.5) return 0.8;  // headkick, finisher, tornadokick, ...
  if (dmg >= 3) return 0.45;   // hook, knee, roundhouse, ...
  if (dmg > 0) return 0.25;    // jab, shove, teep, ...
  return 0;
}

// Value noise 1D deterministik: hash grid + smoothstep. Eiserloh: noise
// halus, bukan acak per frame — perubahan antar frame kecil (tidak ada
// teleport), dan otomatis konsisten dengan pause/slow-motion karena ia
// fungsi waktu, bukan nomor frame.
function shakeNoise(t, seed) {
  const x = t * SHAKE_NOISE_HZ;
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash01(i * 2 + seed), b = hash01((i + 1) * 2 + seed);
  return (a + (b - a) * u) * 2 - 1; // [-1, 1]
}

export function cameraShakeAt(tf) {
  const t = tf - S.INTRO_DUR; // waktu nyata sejak fight dimulai
  if (t < 0) return { x: 0, y: 0, trauma: 0 };
  let trauma = 0;
  for (const a of S.ATTACKS) {
    if (a.outcome !== 'hit') continue;
    const it = realTime(a.t); // waktu nyata impact (termasuk hit-stop)
    const age = t - it;
    if (age < 0 || age >= SHAKE_DUR) continue;
    trauma += traumaOfKind(a.kind, a.knockdown) * (1 - age / SHAKE_DUR);
  }
  trauma = Math.min(1, trauma);
  if (trauma <= 0) return { x: 0, y: 0, trauma: 0 };
  const amp = trauma * trauma * SHAKE_MAX_PX;
  return { x: amp * shakeNoise(tf, 1), y: amp * shakeNoise(tf, 2), trauma };
}

// ---------------- Hit-stop flash (Langkah 3) ----------------
// Kilau putih singkat di AWAL hit-stop (waktu NYATA — sim sedang beku,
// jadi kilau ini yang membuat freeze-nya "terasa" di layar, bukan sekadar
// frame yang diam). Alpha puncak ikut tier (light 0,10 / mid 0,16 /
// heavy-KO 0,22; block 0,05), meluruh dalam 0,08 dtk. Digambar di ruang
// dunia (sebelum restore) supaya HUD/komentator tidak ikut berkilau.
const HITSTOP_FLASH_DUR = 0.08;
export function hitStopFlashAt(tf) {
  const t = tf - S.INTRO_DUR;
  if (t < 0) return 0;
  let peak = 0;
  for (const hs of S.HITSTOPS) {
    const age = t - hs.realT;
    if (age < 0 || age >= HITSTOP_FLASH_DUR) continue;
    const atk = S.ATTACKS.find((a) => a.t === hs.simT);
    let p = 0.05; // default: block (1 frame hit-stop)
    if (atk && atk.outcome === 'hit') {
      const tier = impactTier(atk.power);
      p = tier === 'heavy' ? 0.22 : tier === 'mid' ? 0.16 : 0.10;
      if (atk.knockdown) p = 0.22;
    }
    peak = Math.max(peak, p * (1 - age / HITSTOP_FLASH_DUR));
  }
  return peak;
}

function cameraFor(R, B) {
  const ext = (f) => {
    const down = f.mode === 'falling' || f.mode === 'down' || f.mode === 'getup';
    // Terkapar: badan terbaring ~185 px dari titik tumpu + radius kepala —
    // margin 210 supaya kepala tidak terpotong.
    const m = down ? 210 : 60;
    return { lo: f.x - m, hi: f.x + m };
  };
  const eR = ext(R), eB = ext(B);
  const lo = Math.min(eR.lo, eB.lo), hi = Math.max(eR.hi, eB.hi);
  const span = hi - lo;
  const z = clamp(700 / span, 1.15, 1.9);
  const x = clamp((lo + hi) / 2, 380, 900);
  const y = 745;
  return { x, y, z };
}

// ---------------- HUD: HP + nama + VS + timer ----------------
// DMG_BASE + BLOCK_CHIP tinggal di js/damage.js (sumber kebenaran tunggal);
// film.js re-export supaya importir lama dari './film.js' tetap jalan.
export { DMG_BASE, BLOCK_CHIP } from './damage.js';
import { DMG_BASE, BLOCK_CHIP } from './damage.js';
const FINISHER_KINDS = { finisher: 1, flyknee: 1, stickchop: 1 };

export function hpAt(t) {
  let hpR = 100, hpB = 100;
  for (const atk of S.ATTACKS) {
    if (atk.t > t) break;
    if (atk.kind === 'feint') continue;
    const base = DMG_BASE[kindKey(atk.kind)] ?? 10;
    let dmg = 0;
    if (atk.outcome === 'hit') {
      dmg = base * atk.power * (FINISHER_KINDS[kindKey(atk.kind)] ? 1.5 : 1);
    } else if (atk.outcome === 'block') {
      dmg = atk.power >= 1.3 ? BLOCK_CHIP * atk.power : BLOCK_CHIP;
    }
    if (atk.by === 'R') hpB = Math.max(0, hpB - dmg);
    else hpR = Math.max(0, hpR - dmg);
  }
  return { hpR: Math.round(hpR), hpB: Math.round(hpB) };
}

export function hpDisplayAt(t) {
  let dispR = 100, dispB = 100, lastT = 0;
  for (const atk of S.ATTACKS) {
    if (atk.t > t) break;
    const r = 1 - Math.exp(-(atk.t - lastT) * 10);
    const t1 = hpAt(atk.t);
    dispR += (t1.hpR - dispR) * r;
    dispB += (t1.hpB - dispB) * r;
    lastT = atk.t;
  }
  const r = 1 - Math.exp(-(t - lastT) * 10);
  const tF = hpAt(t);
  dispR += (tF.hpR - dispR) * r;
  dispB += (tF.hpB - dispB) * r;
  return { hpR: Math.round(dispR), hpB: Math.round(dispB) };
}

export function timerLabel(tf) {
  const simT = warp(Math.max(0, tf - S.INTRO_DUR));
  const remain = Math.max(0, S.DURATION - simT);
  const m = Math.floor(remain / 60), sec = Math.floor(remain % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// Warna isi bar menurut HP (ala game fighting): hijau -> kuning -> merah.
function hpBarColor(hp) {
  if (hp > 50) return { a: '#16A34A', b: '#4ADE80' };
  if (hp > 25) return { a: '#CA8A04', b: '#FACC15' };
  return { a: '#B91C1C', b: '#EF4444' };
}
// Path bar miring: ujung luar tegak, ujung dalam (dekat VS) lancip.
// mirror=true -> lancip di kiri (bar kanan).
function skewedBarPath(c, x, y, w, h, slant, mirror) {
  c.beginPath();
  if (!mirror) {
    c.moveTo(x, y); c.lineTo(x + w, y);
    c.lineTo(x + w - slant, y + h); c.lineTo(x, y + h);
  } else {
    c.moveTo(x + slant, y); c.lineTo(x + w, y);
    c.lineTo(x + w, y + h); c.lineTo(x, y + h);
  }
  c.closePath();
}
// Satu sisi bar HP: backing gelap + isi gradient + chip damage
// (selisih HP tampil vs HP sebenarnya, warna pucat) + outline terang.
// Bar kiri berlabuh di kanan (menguras ke arah VS), bar kanan sebaliknya.
function drawHpSide(c, x, w, hpDisp, hpNow, mirror) {
  const barY = 34, barH = 24, slant = 16;
  // Bayangan jatuh + backing tinta.
  c.save();
  c.translate(0, 3);
  skewedBarPath(c, x, barY, w, barH, slant, mirror);
  c.fillStyle = 'rgba(20,18,16,0.35)'; c.fill();
  c.restore();
  skewedBarPath(c, x, barY, w, barH, slant, mirror);
  c.fillStyle = PALETTE.ink; c.fill();
  // Isi (clip ke bentuk miring bagian dalam).
  const ix = x + 3, iy = barY + 3, iw = w - 6, ih = barH - 6;
  c.save();
  skewedBarPath(c, ix, iy, iw, ih, Math.max(0, slant - 4), mirror);
  c.clip();
  const dispW = (iw * clamp(hpDisp, 0, 100)) / 100;
  const nowW = (iw * clamp(hpNow, 0, 100)) / 100;
  // Chip damage: porsi yang baru hilang (tampil > sebenarnya).
  if (dispW > nowW + 0.5) {
    c.fillStyle = '#FECACA';
    if (!mirror) c.fillRect(ix + iw - dispW, iy, dispW - nowW, ih);
    else c.fillRect(ix + nowW, iy, dispW - nowW, ih);
  }
  // Isi gradient sesuai HP sebenarnya.
  const col = hpBarColor(hpNow);
  const grad = c.createLinearGradient(ix, iy, ix + iw, iy);
  if (!mirror) { grad.addColorStop(0, col.b); grad.addColorStop(1, col.a); }
  else { grad.addColorStop(0, col.a); grad.addColorStop(1, col.b); }
  c.fillStyle = grad;
  if (!mirror) c.fillRect(ix + iw - nowW, iy, nowW, ih);
  else c.fillRect(ix, iy, nowW, ih);
  c.restore();
  // Outline terang.
  skewedBarPath(c, x, barY, w, barH, slant, mirror);
  c.lineWidth = 2; c.strokeStyle = PALETTE.paper; c.stroke();
}

function drawHealthBar(c, tf, sim) {
  const simT = warp(Math.max(0, tf - S.INTRO_DUR));
  const hp = hpDisplayAt(simT);
  const hpNow = hpAt(simT);
  const barY = 34, barH = 24;
  const left = { x: 30, w: 290 }, right = { x: 400, w: 290 };
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  drawHpSide(c, left.x, left.w, hp.hpR, hpNow.hpR, false);
  drawHpSide(c, right.x, right.w, hp.hpB, hpNow.hpB, true);
  // Nama + chip warna DI ATAS bar (bukan di bawah / menumpuk bar — keluhan
  // user 2026-11-08 "health bar ketutupan teks"). Bar di y 34..58; nama
  // di y 12..26, tidak ada teks apa pun yang menyentuh bar. Lebar nama
  // dijaga supaya tidak menyentuh medali VS (x 330..390): font mengecil
  // kalau nama terlalu panjang — di render 390px (skala 0,54) nama tetap
  // terbaca ~11px.
  const nameInk = getMapPalette(S.MAP).dark ? '#F3EDE2' : PALETTE.ink;
  const nameBase = barY - 8; // baseline teks nama
  const fitName = (name, maxW) => {
    let px = 22;
    c.font = `700 ${px}px Manrope, sans-serif`;
    while (c.measureText(name).width > maxW && px > 14) {
      px -= 2;
      c.font = `700 ${px}px Manrope, sans-serif`;
    }
    return px;
  };
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  fitName(S.NAMES.R, 260);
  c.fillStyle = S.FIGHTERS.R.color;
  c.fillRect(left.x, nameBase - 14, 14, 14);
  c.fillStyle = nameInk;
  c.fillText(S.NAMES.R, left.x + 20, nameBase);
  c.textAlign = 'right';
  fitName(S.NAMES.B, 260);
  c.fillText(S.NAMES.B, right.x + right.w - 20, nameBase);
  c.fillStyle = S.FIGHTERS.B.color;
  c.fillRect(right.x + right.w - 14, nameBase - 14, 14, 14);
  c.textAlign = 'left';
  // Medali VS: bayangan + cincin emas + merah.
  c.fillStyle = 'rgba(20,18,16,0.35)';
  c.beginPath(); c.arc(360, barY + barH / 2 + 3, 30, 0, Math.PI * 2); c.fill();
  c.fillStyle = PALETTE.yellow;
  c.beginPath(); c.arc(360, barY + barH / 2, 30, 0, Math.PI * 2); c.fill();
  c.lineWidth = 3; c.strokeStyle = PALETTE.ink; c.stroke();
  c.fillStyle = PALETTE.red;
  c.beginPath(); c.arc(360, barY + barH / 2, 24, 0, Math.PI * 2); c.fill();
  c.lineWidth = 2; c.strokeStyle = PALETTE.paper; c.stroke();
  c.fillStyle = PALETTE.paper;
  c.font = '700 28px "Teko", "Anton", "Arial Black", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('VS', 360, barY + barH / 2 + 1);
  // Timer di bawah VS.
  const label = timerLabel(tf);
  c.font = '700 26px Manrope, sans-serif';
  const tw = c.measureText(label).width + 28;
  c.fillStyle = PALETTE.ink;
  c.beginPath();
  c.roundRect(360 - tw / 2, barY + barH + 30, tw, 34, 17);
  c.fill();
  c.lineWidth = 2; c.strokeStyle = PALETTE.yellow; c.stroke();
  c.fillStyle = PALETTE.paper;
  c.fillText(label, 360, barY + barH + 48);
  c.textBaseline = 'alphabetic';
}

// ---------------- mulut komentator (dari teks PBP, bukan vo-rms) ----------------
// app.js memanggil setMouth(c1, c2) tiap frame: 0 = tutup, 1 = buka penuh.
let MOUTH = { c1: 0, c2: 0 };
export function setMouth(c1, c2) { MOUTH = { c1, c2 }; }

export function render(c, tf) {
  const INTRO = S.INTRO_DUR;
  const FIGHT_END = INTRO + S.FIGHT_REAL;
  const DEC_END = FIGHT_END + S.DECISION_DUR;
  const KO_END = FIGHT_END + S.KO_DUR;
  const OUT_END = DEC_END + S.OUTRO_DUR;

  if (tf < INTRO) {
    drawIntro(c, tf);
    return;
  }
  // Layar keputusan dipakai decision DAN draw (timing sama: 5 dtk
  // keputusan + 3 dtk outro). Draw sebelumnya tidak cocok ke cabang mana
  // pun dan jatuh ke render fight biasa (sim beku, tanpa layar keputusan).
  if (tf >= DEC_END && (S.RESULT === 'decision' || S.RESULT === 'draw')) {
    if (tf < OUT_END) drawDecision(c, tf);
    else drawOutro(c, tf);
    return;
  }
  if (tf >= KO_END && S.RESULT === 'ko') {
    if (tf < DEC_END) drawKOEnd(c, tf);
    else drawOutro(c, tf);
    return;
  }
  const s = warp(tf - INTRO);
  const sim = getSim(s);
  const { R, B } = sim;
  const cam = cameraFor(R, B);
  // Zoom KO (Langkah 4): kamera mendekat + bergeser ke pecundang selama
  // 2 dtk setelah KO; HUD/komentator tidak ikut zoom (di luar save/restore).
  const koZ = koZoomAt(tf);
  if (koZ > 1) {
    const loser = S.WINNER === 'R' ? B : R;
    cam.x = lerp(cam.x, clamp(loser.x, 380, 900), ((koZ - 1) / 0.12) * 0.6);
    cam.z *= koZ;
  }
  c.save();
  c.translate(W / 2, H / 2);
  // Camera shake (§32): di ruang LAYAR (sebelum scale) supaya offset
  // = px layar, tidak ikut zoom kamera; HUD di luar save/restore ini.
  const sh = cameraShakeAt(tf);
  c.translate(sh.x, sh.y);
  c.scale(cam.z, cam.z);
  c.translate(-cam.x, -cam.y);
  drawArena(c, s, sim, tf);
  drawWindStreaks(c, s);
  drawShadow(c, R);
  drawShadow(c, B);
  drawAura(c, s, sim);
  // Lemparan: korban digambar terangkat di atas bahu penyerang (overlay
  // visual — lihat throwOverlay; sim tidak disentuh, bayangan tetap di tanah).
  const ov = throwOverlay(s);
  if (ov && ov.lift > 1) {
    const att = ov.by === 'R' ? R : B;
    const def = ov.by === 'R' ? B : R;
    const defCopy = { ...def, y: def.y - ov.lift, pose: thrownPose(def, ov.variant, ov.k) };
    drawFighter(c, att, s, sim, ov.by === 'R');
    drawFighter(c, defCopy, s, sim, ov.by !== 'R');
  } else {
    drawFighter(c, B, s, sim, false);
    drawFighter(c, R, s, sim, true);
  }
  drawParticles(c, s, sim.particles);
  drawImpacts(c, s, sim.impacts);
  drawSpeedLines(c, s, sim);
  drawGroundRings(c, s, sim.rings);
  drawKOFX(c, tf, sim);
  // Kilau hit-stop (Langkah 3): overlay putih di area pandang kamera
  // (koordinat dunia), di atas dunia tapi di bawah HUD.
  const hsFlash = hitStopFlashAt(tf);
  if (hsFlash > 0.003) {
    c.save();
    c.globalAlpha = hsFlash;
    c.fillStyle = '#FFFFFF';
    c.fillRect(cam.x - W / 2 / cam.z - 10, cam.y - H / 2 / cam.z - 10, W / cam.z + 20, H / cam.z + 20);
    c.restore();
  }
  c.restore();
  drawHealthBar(c, tf, sim);
  drawFacecam(c, tf, s);
  if (S.RESULT === 'ko' && tf >= INTRO + S.KO_TEXT_T) drawKO(c, tf);
}

// Kecilkan font sampai teks muat dalam maxW (judul tidak boleh terpotong).
// weight: bobot eksplisit ('700 ' untuk display Teko — font variabel,
// tanpa bobot canvas memakai 400).
function fitFont(c, text, maxW, startPx, family, weight = '') {
  let px = startPx;
  c.font = `${weight}${px}px ${family}`;
  while (px > 20 && c.measureText(text).width > maxW) {
    px -= 4;
    c.font = `${weight}${px}px ${family}`;
  }
  return px;
}

function drawTitle(c, tf, big) {
  const P = getMapPalette(S.MAP);
  const ink = P.dark ? '#F3EDE2' : PALETTE.ink;
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const fam = '"Teko", "Anton", "Arial Black", sans-serif';
  const px1 = fitFont(c, 'STICKMAN FIGHT', 660, big ? 96 : 72, fam, '700 ');
  c.fillStyle = ink;
  c.font = `700 ${px1}px ${fam}`;
  c.fillText('STICKMAN FIGHT', 360, 300);
  const px2 = fitFont(c, 'ARENA', 660, big ? 120 : 88, fam, '700 ');
  c.fillStyle = PALETTE.red;
  c.font = `700 ${px2}px ${fam}`;
  c.fillText('ARENA', 360, 400);
  c.restore();
}

function drawIntro(c, tf) {
  const P = getMapPalette(S.MAP);
  const ink = P.dark ? '#F3EDE2' : PALETTE.ink;
  const inkSoft = P.dark ? '#B8AF9E' : PALETTE.inkSoft;
  c.fillStyle = P.dark ? P.wall : PALETTE.paper; c.fillRect(0, 0, W, H);
  c.fillStyle = P.dark ? P.wallDark : PALETTE.paper2; c.fillRect(0, 0, W, 560);
  c.fillStyle = PALETTE.red; c.fillRect(0, 556, W, 8);
  drawTitle(c, tf, true);
  const k = sstep(tf / 0.8);
  c.save();
  c.globalAlpha = k;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const fam = '"Teko", "Anton", "Arial Black", sans-serif';
  const pxN = Math.min(
    fitFont(c, S.NAMES.R, 300, 44, fam, '700 '),
    fitFont(c, S.NAMES.B, 300, 44, fam, '700 '),
  );
  c.font = `700 ${pxN}px ${fam}`;
  c.fillStyle = S.FIGHTERS.R.color;
  c.fillText(S.NAMES.R, 180, 500);
  c.fillStyle = S.FIGHTERS.B.color;
  c.fillText(S.NAMES.B, 540, 500);
  c.fillStyle = PALETTE.red;
  c.beginPath(); c.arc(360, 500, 34, 0, Math.PI * 2); c.fill();
  c.fillStyle = PALETTE.paper;
  c.font = '700 34px "Teko", "Anton", "Arial Black", sans-serif';
  c.fillText('VS', 360, 502);
  c.font = '700 24px Manrope, sans-serif';
  c.fillStyle = ink;
  c.fillText(`${S.DURATION} DETIK  •  ${S.RESULT === 'ko' ? 'KO ATAU ANGKA' : 'PENENTUAN ANGKA'}`, 360, 580);
  c.restore();
  drawCommentatorAt(c, 272, 700, 1.5, MOUTH.c1, '#EAB308', 'KOMENTATOR 1');
  drawCommentatorAt(c, 448, 700, 1.5, MOUTH.c2, '#22D3EE', 'KOMENTATOR 2');
  c.save();
  c.textAlign = 'center';
  c.font = '700 22px Manrope, sans-serif';
  c.fillStyle = inkSoft;
  c.fillText('Dua komentator siap. Tarung dimulai sebentar lagi!', 360, 900);
  c.restore();
}

function drawDecision(c, tf) {
  const s = S.DURATION;
  const sim = getSim(s);
  const { R, B } = sim;
  const cam = cameraFor(R, B);
  c.save();
  c.translate(W / 2, H / 2);
  c.scale(cam.z, cam.z);
  c.translate(-cam.x, -cam.y);
  drawArena(c, s, sim, tf);
  drawShadow(c, R);
  drawShadow(c, B);
  const isDraw = S.RESULT === 'draw';
  if (!isDraw) {
    // Pemenang berpose menang; yang kalah tetap guard.
    const w = S.WINNER === 'R' ? R : B;
    const l = S.WINNER === 'R' ? B : R;
    const winPose = POSE.win;
    w.pose = lerpPoseFull(w.pose, mergePose(poseGuard(w.key), winPose), 1);
    drawFighter(c, l, s, sim, false);
    drawFighter(c, w, s, sim, true);
  } else {
    // Seri: TIDAK ada pose pemenang (S.WINNER null — dulu kode memilih B
    // sebagai "pemenang" dan menampilkan namanya). Kedua petarung guard.
    drawFighter(c, B, s, sim, false);
    drawFighter(c, R, s, sim, true);
  }
  c.restore();
  drawJudge(c);
  const hp = hpAt(S.DURATION);
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  // Box keputusan diperbesar supaya verdict terbaca di HP 390px:
  // dulu 600x210 di (60,120) dengan headline 56px; kini 660x300 di
  // (30,80) dengan headline 76px (decision) / 96px (draw).
  c.fillStyle = PALETTE.paper;
  c.fillRect(30, 80, 660, 300);
  c.lineWidth = 4; c.strokeStyle = PALETTE.ink;
  c.strokeRect(30, 80, 660, 300);
  c.fillStyle = PALETTE.red;
  if (isDraw) {
    const px = fitFont(c, 'SERI!', 620, 96, '"Teko", "Anton", "Arial Black", sans-serif', '700 ');
    c.font = `700 ${px}px "Teko", "Anton", "Arial Black", sans-serif`;
    c.fillText('SERI!', 360, 165);
    c.fillStyle = PALETTE.ink;
    c.font = '700 34px Manrope, sans-serif';
    c.fillText(`${S.NAMES.R} ${hp.hpR}  –  ${hp.hpB} ${S.NAMES.B}`, 360, 250);
    c.font = '700 26px Manrope, sans-serif';
    c.fillStyle = PALETTE.inkSoft;
    c.fillText('Keputusan juri: skor imbang, tidak ada pemenang.', 360, 310);
  } else {
    const px = fitFont(c, 'MENANG ANGKA', 620, 76, '"Teko", "Anton", "Arial Black", sans-serif', '700 ');
    c.font = `700 ${px}px "Teko", "Anton", "Arial Black", sans-serif`;
    c.fillText('MENANG ANGKA', 360, 160);
    c.fillStyle = PALETTE.ink;
    c.font = '700 34px Manrope, sans-serif';
    const wName = S.NAMES[S.WINNER];
    c.fillText(`${wName} menang ${hp.hpR} – ${hp.hpB}`, 360, 245);
    c.font = '700 26px Manrope, sans-serif';
    c.fillStyle = PALETTE.inkSoft;
    c.fillText('Keputusan juri: pemenang HP terbanyak.', 360, 310);
  }
  c.restore();
}

function drawKOEnd(c, tf) {
  const s = S.DURATION;
  const sim = getSim(s);
  const { R, B } = sim;
  const cam = cameraFor(R, B);
  c.save();
  c.translate(W / 2, H / 2);
  c.scale(cam.z, cam.z);
  c.translate(-cam.x, -cam.y);
  drawArena(c, s, sim, tf);
  drawShadow(c, R);
  drawShadow(c, B);
  const w = S.WINNER === 'R' ? R : B;
  const l = S.WINNER === 'R' ? B : R;
  w.pose = lerpPoseFull(w.pose, mergePose(poseGuard(w.key), POSE.win), 1);
  drawFighter(c, l, s, sim, false);
  drawFighter(c, w, s, sim, true);
  c.restore();
  drawJudge(c);
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const k = sstep((tf - (S.INTRO_DUR + S.FIGHT_REAL)) / 0.5);
  c.globalAlpha = k;
  c.fillStyle = PALETTE.red;
  c.font = '700 120px "Teko", "Anton", "Arial Black", sans-serif';
  c.fillText('K.O.', 360, 220);
  c.fillStyle = getMapPalette(S.MAP).dark ? '#F3EDE2' : PALETTE.ink;
  c.font = '700 28px Manrope, sans-serif';
  c.fillText(`${S.NAMES[S.WINNER]} menang KO di detik ${S.KO_T.toFixed(1)}`, 360, 310);
  c.restore();
}

function drawOutro(c, tf) {
  const P = getMapPalette(S.MAP);
  const ink = P.dark ? '#F3EDE2' : PALETTE.ink;
  const inkSoft = P.dark ? '#B8AF9E' : PALETTE.inkSoft;
  c.fillStyle = P.dark ? P.wall : PALETTE.paper; c.fillRect(0, 0, W, H);
  c.fillStyle = P.dark ? P.wallDark : PALETTE.paper2; c.fillRect(0, 0, W, 560);
  c.fillStyle = PALETTE.red; c.fillRect(0, 556, W, 8);
  const hp = hpAt(S.DURATION);
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = ink;
  c.font = '700 64px "Teko", "Anton", "Arial Black", sans-serif';
  c.fillText('SKOR AKHIR', 360, 300);
  c.font = '700 34px Manrope, sans-serif';
  c.fillText(`${S.NAMES.R} ${hp.hpR}  –  ${hp.hpB} ${S.NAMES.B}`, 360, 380);
  c.font = '700 24px Manrope, sans-serif';
  c.fillStyle = inkSoft;
  c.fillText('Sampai jumpa di fight berikutnya!', 360, 440);
  c.restore();
  drawCommentatorAt(c, 272, 700, 1.5, MOUTH.c1, '#EAB308', 'KOMENTATOR 1');
  drawCommentatorAt(c, 448, 700, 1.5, MOUTH.c2, '#22D3EE', 'KOMENTATOR 2');
}

function drawJudge(c) {
  // Juri diperbesar ~1,4x dan naik ke y=470 (dulu r=20 di y=560, label
  // 18px) supaya sosoknya menonjol di bawah box keputusan yang membesar
  // (box berakhir y=380; kepala juri mulai y=442). Dipakai layar
  // keputusan dan layar KO.
  const x = 360, y = 470;
  const fg = getMapPalette(S.MAP).dark ? '#F3EDE2' : PALETTE.ink;
  c.save();
  c.strokeStyle = fg; c.lineWidth = 7; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, 28, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(x, y + 28); c.lineTo(x, y + 109); c.stroke();
  c.beginPath(); c.moveTo(x - 25, y + 62); c.lineTo(x + 25, y + 62); c.stroke();
  c.beginPath(); c.moveTo(x, y + 109); c.lineTo(x - 25, y + 171); c.stroke();
  c.beginPath(); c.moveTo(x, y + 109); c.lineTo(x + 25, y + 171); c.stroke();
  c.fillStyle = fg;
  c.font = '700 24px Manrope, sans-serif';
  c.textAlign = 'center';
  c.fillText('JURI', x, y + 207);
  c.restore();
}

function drawKO(c, tf) {
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const k = sstep((tf - (S.INTRO_DUR + S.KO_TEXT_T)) / 0.3);
  c.globalAlpha = Math.min(1, k);
  c.fillStyle = PALETTE.red;
  c.font = '700 140px "Teko", "Anton", "Arial Black", sans-serif';
  c.fillText('K.O.', 360, 260);
  c.restore();
}

// ---------------- komentator (facecam overlay) ----------------
// Gambar komentator UPGRADE (headband, headset + boom mic, ekspresi) —
// satu fungsi bersama dengan poster: js/commentators.js. Signature lama
// dipertahankan supaya pemanggil (drawFacecam, drawCommentatorAt) tidak berubah.
function drawFacecamHead(c, cx, cy, r, color, mouth, label, maxLabelW) {
  const style = color === COMMENTATOR_STYLE.c2.color ? COMMENTATOR_STYLE.c2 : COMMENTATOR_STYLE.c1;
  drawCommentator(c, cx, cy, r, {
    color,
    mouth,
    label,
    labelColor: getMapPalette(S.MAP).dark ? '#F3EDE2' : PALETTE.ink,
    brows: style.brows,
    mirror: style.mirror,
    ...(maxLabelW ? { maxLabelW } : {}),
  });
}

function drawCommentatorAt(c, x, y, scale, mouth, color, label) {
  drawFacecamHead(c, x, y, 52 * scale, color, mouth, label);
}

function drawFacecam(c, tf, s) {
  // Dua facecam berdampingan di tengah bawah (seperti NF2+).
  // r 58 (dulu 54), pusat direnggangkan 296/424 supaya dua bingkai
  // tidak bersentuhan (jarak pusat 128 px). Label dibatasi maxLabelW 100
  // (lihat commentators.js): 'KOMENTATOR 1/2' jadi 13px (98/100px lebar)
  // → celah antar label >= 28px kanvas (~15px di HP 390px).
  drawFacecamHead(c, 296, 1150, 58, '#EAB308', MOUTH.c1, 'KOMENTATOR 1', 100);
  drawFacecamHead(c, 424, 1150, 58, '#22D3EE', MOUTH.c2, 'KOMENTATOR 2', 100);
}

// ---------------- arena kertas ----------------
function drawArena(c, s, sim, tf) {
  const P = getMapPalette(S.MAP);
  // Dinding kertas.
  c.fillStyle = P.wall;
  c.fillRect(200, 100, 1000, 800);
  // Banner merah di dinding.
  c.fillStyle = P.red;
  c.fillRect(360, 235, 560, 64);
  c.fillStyle = PALETTE.paper;
  c.font = '700 44px "Teko", "Anton", "Arial Black", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('STREET FIGHT ARENA', 640, 268);
  c.textBaseline = 'alphabetic';
  // Penonton (3 baris).
  drawCrowd(c, s, tf);
  // Lantai.
  c.fillStyle = P.concrete;
  c.fillRect(200, GROUND, 1000, 500);
  // Lingkaran ring (cat merah di lantai).
  c.strokeStyle = P.ropeRed; c.lineWidth = 7;
  c.beginPath(); c.arc(640, GROUND, 330, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = PALETTE.ink; c.lineWidth = 2;
  c.beginPath(); c.arc(640, GROUND, 292, 0, Math.PI * 2); c.stroke();
  // Tali ring + tiang sudut.
  c.strokeStyle = P.ropeRed; c.lineWidth = 5;
  c.beginPath(); c.moveTo(330, 700); c.lineTo(950, 700); c.stroke();
  c.beginPath(); c.moveTo(330, 762); c.lineTo(950, 762); c.stroke();
  c.fillStyle = P.post;
  c.fillRect(326, 640, 10, 240);
  c.fillRect(944, 640, 10, 240);
  // Tongkat kayu di tepi ring (sebelum diambil) — warnanya warna senjata
  // pilihan pemiliknya (bukan cokelat tetap), supaya konsisten dengan tongkat
  // yang sama saat sudah di tangan.
  const wp = S.WEAPON;
  if (wp) {
    const taken = sim.R.hasWeapon || sim.B.hasWeapon;
    if (!taken) {
      const stickCol = sim[wp.who]?.gear?.weapon?.color || P.wood;
      c.save();
      c.strokeStyle = stickCol; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(wp.x, GROUND); c.lineTo(wp.x + 16, GROUND - 82); c.stroke();
      c.strokeStyle = P.woodDark; c.lineWidth = 3;
      c.beginPath(); c.moveTo(wp.x + 4, GROUND - 10); c.lineTo(wp.x + 18, GROUND - 70); c.stroke();
      c.restore();
    }
  }
}

// Penonton kecil yang terbaca: bahu/baju + kepala kulit + rambut/topi,
// sebagian mengangkat lengan saat cheer. Variasi deterministik per
// penonton (hash dari baris+kolom) — tidak berkedip ganti warna tiap frame.
const CROWD_SKIN = ['#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#FFDBAC'];
const CROWD_HAIR = ['#141210', '#3B2F2F', '#6B4423', '#9CA3AF', '#EAB308', '#7C3AED'];
const CROWD_HAT = ['#E10600', '#1D4ED8', '#15803D', '#EAB308', '#141210'];

function drawCrowd(c, s, tf) {
  const P = getMapPalette(S.MAP);
  const cheer = cheerAt(s);
  const rows = [
    { y: 470, n: 15, r: 16 },
    { y: 550, n: 17, r: 17 },
    { y: 640, n: 19, r: 18 },
  ];
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    for (let i = 0; i < row.n; i++) {
      const x = 350 + (i + 0.5) * (580 / row.n);
      // Variasi deterministik (hash01 = PRNG berseed, bukan Math.random).
      const h1 = hash01(ri * 1000 + i * 13 + 1);
      const h2 = hash01(ri * 1000 + i * 13 + 2);
      const h3 = hash01(ri * 1000 + i * 13 + 3);
      const h4 = hash01(ri * 1000 + i * 13 + 4);
      const shirt = P.crowd[Math.floor(h1 * P.crowd.length) % P.crowd.length];
      const skin = CROWD_SKIN[Math.floor(h2 * CROWD_SKIN.length)];
      const hair = CROWD_HAIR[Math.floor(h3 * CROWD_HAIR.length)];
      const hat = h4 < 0.35; // ~35% bertopi
      const hatCol = CROWD_HAT[Math.floor(h1 * CROWD_HAT.length) % CROWD_HAT.length];
      const armsUp = cheer > 0 && h2 < 0.55; // ~55% ikut mengangkat lengan saat cheer
      const bounce = cheer > 0 ? Math.abs(Math.sin(s * 9 + i * 1.7)) * 14 * cheer : Math.sin(s * 2 + i) * 1.5;
      const cy = row.y - bounce;
      const r = row.r;
      c.save();
      c.lineCap = 'round';
      // Lengan terangkat (di belakang badan).
      if (armsUp) {
        c.strokeStyle = shirt; c.lineWidth = 5;
        c.beginPath(); c.moveTo(x - r * 0.9, cy + r * 0.5); c.lineTo(x - r * 1.3, cy - r * 1.1); c.stroke();
        c.beginPath(); c.moveTo(x + r * 0.9, cy + r * 0.5); c.lineTo(x + r * 1.3, cy - r * 1.1); c.stroke();
      }
      // Bahu/baju.
      c.fillStyle = shirt;
      c.beginPath(); c.arc(x, cy + r * 0.9, r * 1.1, Math.PI, 0); c.fill();
      // Kepala (kulit).
      c.fillStyle = skin;
      c.beginPath(); c.arc(x, cy, r * 0.82, 0, Math.PI * 2); c.fill();
      // Rambut (tudung atas kepala) atau topi + brim.
      if (hat) {
        c.fillStyle = hatCol;
        c.beginPath(); c.arc(x, cy - r * 0.1, r * 0.85, Math.PI, 0); c.fill();
        c.fillRect(x - r * 0.95, cy - r * 0.25, r * 1.9, r * 0.28);
      } else {
        c.fillStyle = hair;
        c.beginPath(); c.arc(x, cy - r * 0.12, r * 0.84, Math.PI * 1.02, Math.PI * 1.98); c.fill();
      }
      c.restore();
    }
  }
}

// ---------------- petarung ----------------
function drawShadow(c, f) {
  // Bayangan lantai: elips utama lebih besar + elips kecil di bawah kaki
  // depan supaya kaki terbaca menapak, bukan melayang.
  c.fillStyle = 'rgba(20,18,16,0.16)';
  c.beginPath();
  c.ellipse(f.x, GROUND + 8, 56, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(20,18,16,0.10)';
  c.beginPath();
  c.ellipse(f.x + f.face * 12, GROUND + 8, 30, 6, 0, 0, Math.PI * 2);
  c.fill();
}


// Diekspor untuk smoke test render aksesoris (tests/run.mjs §20).
export function drawFighter(c, f, s, sim, front) {
  const j = computeJoints(f);
  const col = f.color, dark = f.colorDark;
  const gear = f.gear || {};
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  // Seed deterministik per petarung (dari warna badan — bukan Math.random):
  // dipakai untuk wobble ±0,8 px ala goresan tangan; frame yang sama
  // selalu menghasilkan gambar yang sama.
  const seedN = /^#[0-9a-fA-F]{6}$/.test(col || '') ? parseInt(col.slice(1), 16) : 0;
  // Ruas meruncing (taper): trapesium + ujung membulat, pangkal lebih
  // tebal dari ujung (70–80%), dengan wobble deterministik di tengah.
  // seedId berbeda per ruas supaya goyangannya tidak seragam.
  const taper = (a, b, wA, wB, fill, seedId) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, px = -uy, py = ux;
    const wob = (hash01(seedN + seedId) - 0.5) * 1.6;
    const m = { x: (a.x + b.x) / 2 + px * wob, y: (a.y + b.y) / 2 + py * wob };
    const wM = (wA + wB) / 2;
    const quad = (p, q, wP, wQ) => {
      c.fillStyle = fill;
      c.beginPath();
      c.moveTo(p.x + px * wP / 2, p.y + py * wP / 2);
      c.lineTo(q.x + px * wQ / 2, q.y + py * wQ / 2);
      c.lineTo(q.x - px * wQ / 2, q.y - py * wQ / 2);
      c.lineTo(p.x - px * wP / 2, p.y - py * wP / 2);
      c.closePath(); c.fill();
    };
    quad(a, m, wA, wM); quad(m, b, wM, wB);
    for (const [p, w] of [[a, wA], [m, wM], [b, wB]]) {
      c.fillStyle = fill;
      c.beginPath(); c.arc(p.x, p.y, w / 2, 0, Math.PI * 2); c.fill();
    }
  };
  // Quad datar (tanpa ujung bulat): torso, celana, leher — ujungnya tegas.
  const quadFill = (a, b, wA, wB, fill) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(a.x + px * wA / 2, a.y + py * wA / 2);
    c.lineTo(b.x + px * wB / 2, b.y + py * wB / 2);
    c.lineTo(b.x - px * wB / 2, b.y - py * wB / 2);
    c.lineTo(a.x - px * wA / 2, a.y - py * wA / 2);
    c.closePath(); c.fill();
  };
  // Poligon torso joint-based: sudut = titik sendi (bukan sumbu tengah).
  // Urutan sudut: hipF -> hipB -> shB -> shF (mengelilingi badan).
  // ex: perluasan radial dari centroid (rim tinta = 2 px).
  const torsoCenter = (jj) => ({
    x: (jj.hipF.x + jj.hipB.x + jj.shB.x + jj.shF.x) / 4,
    y: (jj.hipF.y + jj.hipB.y + jj.shB.y + jj.shF.y) / 4,
  });
  const torsoPoly = (jj, ex = 0) => {
    const pts = [jj.hipF, jj.hipB, jj.shB, jj.shF];
    if (!ex) return pts;
    const tc = torsoCenter(jj);
    return pts.map((p) => {
      const dx = p.x - tc.x, dy = p.y - tc.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / d) * ex, y: p.y + (dy / d) * ex };
    });
  };
  const fillPoly = (pts, fill) => {
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.closePath(); c.fill();
  };
  // Smear (gerakan cepat) — bayangan pose wind-up, setebal ruas yang
  // di-smear (lengan 8/6, kaki 9/7), bukan garis hantu 5 px.
  if (f.smear > 0 && f.smearWind) {
    const js = computeJointsWithPose(f, mergePose(poseGuard(f.key), f.smearWind));
    c.globalAlpha = f.smear * 0.3;
    const limb = f.smearLimb;
    if (limb === 'armF' || limb === 'armB') {
      const sh = limb === 'armF' ? js.shF : js.shB;
      const el = limb === 'armF' ? js.elbowF : js.elbowB;
      const hd = limb === 'armF' ? js.handF : js.handB;
      taper(sh, el, 8, 6, col, 11); taper(el, hd, 6, 6, col, 12);
    } else {
      const hp = limb === 'legF' ? js.hipF : js.hipB;
      const kn = limb === 'legF' ? js.kneeF : js.kneeB;
      const ft = limb === 'legF' ? js.footF : js.footB;
      taper(hp, kn, 9, 7, col, 31); taper(kn, ft, 7, 7, col, 32);
    }
    c.globalAlpha = 1;
  }
  // --- outline tinta petarung depan (pisahkan dari lawan saat clinch):
  // versi tinta yang 4 px lebih lebar di bawah semua segmen, lalu warna
  // menutup tengahnya — menyisakan rim gelap ~2 px di sekeliling badan.
  if (front) {
    taper(j.hipB, j.kneeB, 12, 10, PALETTE.ink, 41);
    taper(j.kneeB, j.footB, 10, 10, PALETTE.ink, 42);
    taper(j.shB, j.elbowB, 11, 9, PALETTE.ink, 21);
    taper(j.elbowB, j.handB, 9, 9, PALETTE.ink, 22);
    // Rim torso = poligon sendi yang sama, diperluas 2 px (bukan quad
    // tengah 13/16 — rim harus mengikuti sudut sendi).
    fillPoly(torsoPoly(j, 2), PALETTE.ink);
    quadFill(j.shoulder, j.head, 12, 10, PALETTE.ink);
    taper(j.hipF, j.kneeF, 13, 11, PALETTE.ink, 31);
    taper(j.kneeF, j.footF, 11, 11, PALETTE.ink, 32);
    taper(j.shF, j.elbowF, 12, 10, PALETTE.ink, 11);
    taper(j.elbowF, j.handF, 10, 10, PALETTE.ink, 12);
  }
  // --- kaki & tangan belakang (gelap, shade 0.55 — lebih gelap dari dulu
  // supaya depan/belakang terpisah saat clinch) ---
  taper(j.hipB, j.kneeB, 8, 6, dark, 41);
  taper(j.kneeB, j.footB, 6, 6, dark, 42);
  taper(j.shB, j.elbowB, 7, 5, dark, 21);
  taper(j.elbowB, j.handB, 5, 5, dark, 22);
  // --- torso sebagai POLIGON SENDI, bukan garis tengah: sudutnya PERSIS
  // titik sendi pinggul/bahu (hipF, hipB, shB, shF) — kaki berakar di
  // sudut bawah poligon, lengan di sudut atasnya, jadi tidak ada celah
  // latar antara torso dan anggota badan (cacat v3: quad tengah 9-12 px
  // sementara akar anggota ±14-16 px dari sumbu -> pinggul/bahu melayang,
  // hanya tertutup bila petarung pakai celana/sabuk). Garis volume menempel
  // di sisi dalam tepi poligon (2,5 px dari tepi), bukan di tengah badan.
  fillPoly(torsoPoly(j), col);
  {
    const tc = torsoCenter(j);
    const edgeLine = (a, b, stroke) => {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      let nx = tc.x - mx, ny = tc.y - my;
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const p0 = { x: a.x + (b.x - a.x) * 0.12 + nx * 2.5, y: a.y + (b.y - a.y) * 0.12 + ny * 2.5 };
      const p1 = { x: a.x + (b.x - a.x) * 0.88 + nx * 2.5, y: a.y + (b.y - a.y) * 0.88 + ny * 2.5 };
      c.strokeStyle = stroke; c.lineWidth = 2;
      c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
    };
    edgeLine(j.hipB, j.shB, shade(col, 0.75)); // bayangan sisi belakang
    edgeLine(j.hipF, j.shF, 'rgba(251,248,241,0.5)'); // sorot sisi depan
  }
  drawBodyGear({ c, j, f, gear, s, front, col, dark });
  drawBeltGear({ c, j, f, gear, s, front, col, dark });
  // --- celana/shorts (Muay Thai / brawler) ---
  // Hierarki diperbaiki: sabuk 8 px + penutup paha tapered quad 11 -> 8 px
  // (ujung butt, bukan membulat) — celana kini lebih ramping dari torso.
  if (gear.shorts) {
    const shortCol = gear.shorts.color || col;
    c.strokeStyle = shortCol; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(j.hipF.x, j.hipF.y); c.lineTo(j.hipB.x, j.hipB.y); c.stroke();
    c.strokeStyle = PALETTE.paper; c.lineWidth = 2;
    c.beginPath(); c.moveTo(j.hipF.x, j.hipF.y); c.lineTo(j.hipB.x, j.hipB.y); c.stroke();
    // Penutup paha belakang (digambar di sini, sebelum kaki depan).
    quadFill(j.hipB, {
      x: j.hipB.x + (j.kneeB.x - j.hipB.x) * 0.55,
      y: j.hipB.y + (j.kneeB.y - j.hipB.y) * 0.55,
    }, 11, 8, shade(shortCol, 0.7));
  }
  // --- kaki & tangan depan (bert tingkat: paha 9 / betis 7,
  // lengan atas 8 / bawah 6) ---
  taper(j.hipF, j.kneeF, 9, 7, col, 31);
  taper(j.kneeF, j.footF, 7, 7, col, 32);
  taper(j.shF, j.elbowF, 8, 6, col, 11);
  taper(j.elbowF, j.handF, 6, 6, col, 12);
  // Penutup paha depan (setelah kaki depan, sebelum sendi).
  if (gear.shorts) {
    const shortCol = gear.shorts.color || col;
    quadFill(j.hipF, {
      x: j.hipF.x + (j.kneeF.x - j.hipF.x) * 0.55,
      y: j.hipF.y + (j.kneeF.y - j.hipF.y) * 0.55,
    }, 11, 8, shortCol);
  }
  // --- sendi: diisi WARNA RUASNYA SENDIRI, tanpa cincin tinta kontras —
  // dot krem + cincin gelap terbaca seperti baut/rivet (riset §3.3).
  // Sendi ditandai oleh perubahan arah ruas + sedikit penebalan ini.
  const joint = (p, r, fill) => {
    c.fillStyle = fill;
    c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
  };
  joint(j.shB, 5, dark); joint(j.elbowB, 4.5, dark);
  joint(j.hipB, 5, dark); joint(j.kneeB, 4.5, dark);
  joint(j.shF, 5.5, col); joint(j.elbowF, 5, col);
  joint(j.hipF, 5.5, col); joint(j.kneeF, 5, col);
  drawShoesGear({ c, j, f, gear, s, front, col, dark });
  drawGlovesGear({ c, j, f, gear, s, front, col, dark });
  drawWeaponGear({ c, j, f, gear, s, front, col, dark });
  // --- leher: trapesium berisi (8 px di bahu -> 6 px di kepala) dengan
  // dua garis sisi tinta, supaya kepala tidak "menempel" di ujung garis.
  quadFill(j.shoulder, j.head, 8, 6, col);
  {
    const dx = j.head.x - j.shoulder.x, dy = j.head.y - j.shoulder.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    c.strokeStyle = PALETTE.ink; c.lineWidth = 2;
    c.beginPath();
    c.moveTo(j.shoulder.x + px * 4, j.shoulder.y + py * 4);
    c.lineTo(j.head.x + px * 3, j.head.y + py * 3);
    c.stroke();
    c.beginPath();
    c.moveTo(j.shoulder.x - px * 4, j.shoulder.y - py * 4);
    c.lineTo(j.head.x - px * 3, j.head.y - py * 3);
    c.stroke();
  }
  // --- kepala (r 16) + wajah minimal ---
  // Outline tinta 6 px untuk KEDUA petarung (belakang alpha 0.85);
  // petarung depan tambah cincin warna badan di dalam outline tinta.
  // Mata r 2.8 + alis + mulut; alis gaya Henry Stickmin: datar saat guard,
  // miring saat menyerang, membulat saat kena hit (mata jadi X).
  const hit = f.mode === 'hit' || s < f.hitUntil;
  const attacking = f.mode === 'attack';
  c.fillStyle = PALETTE.paper;
  c.beginPath(); c.arc(j.head.x, j.head.y, 16, 0, Math.PI * 2); c.fill();
  if (!front) c.globalAlpha = 0.85;
  c.strokeStyle = PALETTE.ink; c.lineWidth = 6; c.stroke();
  c.globalAlpha = 1;
  if (front) {
    c.strokeStyle = col; c.lineWidth = 2;
    c.beginPath(); c.arc(j.head.x, j.head.y, 13, 0, Math.PI * 2); c.stroke();
  }
  // Sorot kepala (kuadran atas-belakang) supaya kepala terbaca bulat/3D.
  c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2;
  c.beginPath();
  c.arc(j.head.x, j.head.y, 13, f.face === 1 ? Math.PI * 1.1 : Math.PI * 1.5,
    f.face === 1 ? Math.PI * 1.5 : Math.PI * 1.9);
  c.stroke();
  const eyeX = j.head.x + f.face * 5, eyeY = j.head.y - 2;
  const browX = j.head.x + f.face * 5, browY = j.head.y - 7;
  c.strokeStyle = PALETTE.ink; c.fillStyle = PALETTE.ink; c.lineWidth = 2;
  if (hit) {
    // Mata X kena pukul.
    c.beginPath();
    c.moveTo(eyeX - 2.5, eyeY - 2.5); c.lineTo(eyeX + 2.5, eyeY + 2.5);
    c.moveTo(eyeX + 2.5, eyeY - 2.5); c.lineTo(eyeX - 2.5, eyeY + 2.5);
    c.stroke();
    // Alis membulat (busur ke atas).
    c.beginPath(); c.arc(browX, browY + 1, 4, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  } else {
    c.beginPath(); c.arc(eyeX, eyeY, 2.8, 0, Math.PI * 2); c.fill();
    // Alis: datar saat guard, ujung dalam turun saat menyerang.
    c.beginPath();
    if (attacking) {
      c.moveTo(browX - f.face * 3.5, browY - 1.5);
      c.lineTo(browX + f.face * 3.5, browY + 1.5);
    } else {
      c.moveTo(browX - 3.5, browY); c.lineTo(browX + 3.5, browY);
    }
    c.stroke();
  }
  // Mulut: garis datar saat guard, elips terbuka saat menyerang/kena hit.
  const mouthX = j.head.x + f.face * 6, mouthY = j.head.y + 6;
  if (attacking || hit) {
    c.beginPath(); c.ellipse(mouthX, mouthY, 3, 4, 0, 0, Math.PI * 2); c.fill();
  } else {
    c.beginPath(); c.moveTo(mouthX - 2.5, mouthY); c.lineTo(mouthX + 2.5, mouthY); c.stroke();
  }
  drawHeadGear({ c, j, f, gear, s, front, col, dark });
  c.restore();
}

// ---------------- partikel & impact ----------------
function drawParticles(c, s, particles) {
  c.save();
  for (const p of particles) {
    const k = (s - p.t0) / p.life;
    if (k < 0 || k > 1) continue;
    const px = p.x + p.vx * (s - p.t0);
    const py = p.y + p.vy * (s - p.t0) + 0.5 * GRAV * 0.25 * (s - p.t0) * (s - p.t0);
    if (p.spark) {
      // Percikan kontak: kuning-putih terang, mengecil + memudar cepat.
      c.globalAlpha = 0.9 * (1 - k);
      c.fillStyle = '#FFE98A';
      c.beginPath(); c.arc(px, py, Math.max(0.5, p.size * (1 - k * 0.5)), 0, Math.PI * 2); c.fill();
      continue;
    }
    c.globalAlpha = 0.55 * (1 - k);
    c.fillStyle = PALETTE.dust;
    c.beginPath(); c.arc(px, py, p.size * (1 + k), 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

// ---------------- Impact VFX (Langkah 1) ----------------
// Tier power VISUAL (vp sudah di-clamp 2,2 di triggerAttack): light =
// jab/teep/shove, mid = cross/hook/kick biasa, heavy = headkick/finisher/KO.
// Dipakai flash/ring/partikel + shake (Langkah 3) + zoom KO (Langkah 4)
// supaya SATU skala power di semua efek.
export function impactTier(power) {
  if (power >= 1.4) return 'heavy';
  if (power >= 1.15) return 'mid';
  return 'light';
}

const IMPACT_DUR = { hit: 0.25, block: 0.18, parry: 0.18 };

// Visual impact AKTIF pada detik sim s — fungsi MURNI (dipakai test +
// drawImpacts), tanpa canvas. Hit = ring membesar + flash core terang +
// sinar; block/parry = ring kecil redup abu-abu, tanpa flash, sinar 4.
// Ring/flash TIDAK menutupi petarung: radius maks ~50 px di titik kontak
// (kepala ~30 px, badan ~90 px) dan alpha meluruh ke 0 dalam 0,25 dtk.
export function impactVisualAt(s, impacts) {
  const out = [];
  for (const im of impacts || []) {
    const kind = im.kind || 'hit';
    const dur = IMPACT_DUR[kind] || IMPACT_DUR.hit;
    const k = (s - im.t) / dur;
    if (k < 0 || k > 1) continue;
    const tier = impactTier(im.power);
    const isHit = kind === 'hit';
    out.push({
      x: im.x, y: im.y, power: im.power, kind, tier, k, dur,
      ringR: isHit ? (14 + im.power * 14) * (0.4 + k * 1.2) : (9 + im.power * 8) * (0.6 + k * 0.9),
      ringW: isHit ? (tier === 'heavy' ? 6 : tier === 'mid' ? 4.5 : 3) : 2.5,
      flashR: isHit ? (11 + im.power * 9) * (1 - k * 0.65) : 0,
      rayR: isHit ? (12 + im.power * 16) * (1 + k * 0.5) : (10 + im.power * 10) * (1 + k * 0.4),
      rays: isHit ? (tier === 'heavy' ? 12 : 8) : 4,
      alpha: (isHit ? 0.95 : 0.5) * (1 - k),
    });
  }
  return out;
}

function drawImpacts(c, s, impacts) {
  c.save();
  for (const v of impactVisualAt(s, impacts)) {
    const isHit = v.kind === 'hit';
    // Ring membesar (di belakang sinar + flash).
    c.globalAlpha = v.alpha;
    c.strokeStyle = isHit ? PALETTE.paper : PALETTE.gray;
    c.lineWidth = v.ringW;
    c.beginPath(); c.arc(v.x, v.y, v.ringR, 0, Math.PI * 2); c.stroke();
    // Ring luar kuning hanya untuk heavy (KO/finisher/headkick).
    if (isHit && v.tier === 'heavy') {
      c.globalAlpha = v.alpha * 0.7;
      c.strokeStyle = PALETTE.yellow; c.lineWidth = 2;
      c.beginPath(); c.arc(v.x, v.y, v.ringR * 1.3, 0, Math.PI * 2); c.stroke();
    }
    // Sinar kontak.
    c.globalAlpha = v.alpha;
    c.strokeStyle = isHit ? PALETTE.paper : PALETTE.gray;
    c.lineWidth = isHit ? 4 : 2.5;
    for (let i = 0; i < v.rays; i++) {
      const a = (i / v.rays) * Math.PI * 2;
      c.beginPath();
      c.moveTo(v.x + Math.cos(a) * v.rayR * 0.4, v.y + Math.sin(a) * v.rayR * 0.4);
      c.lineTo(v.x + Math.cos(a) * v.rayR, v.y + Math.sin(a) * v.rayR);
      c.stroke();
    }
    if (isHit) {
      // Flash core putih-kuning + titik merah (kontinuitas visual lama).
      c.globalAlpha = v.alpha;
      c.fillStyle = '#FFF3C4';
      c.beginPath(); c.arc(v.x, v.y, v.flashR, 0, Math.PI * 2); c.fill();
      c.fillStyle = PALETTE.red;
      c.beginPath(); c.arc(v.x, v.y, 5 + v.power * 3, 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
}

// ---------------- Speed lines (Langkah 2, pacing CF2 §17) ----------------
// Garis gerak di sepanjang lintasan serangan — 2–4 frame (STRIKE_TRAVEL
// 0,06 dtk + ekor 0,03 dtk setelah kontak), untuk SEMUA serangan (bukan
// feint/shadow). Garis tipis warna penyerang, alpha puncak 0,35, membuntuti
// ujung anggota penyerang ke arah target: tidak menutupi wajah/nama/HUD
// (garis di ruang dunia di antara kedua petarung, HUD digambar terpisah
// setelah restore). Fungsi MURNI (dipakai test + drawSpeedLines).
const SPEED_LINE_TAIL = 0.03;
export function speedLinesAt(s, sim) {
  const out = [];
  if (!sim) return out;
  for (const atk of S.ATTACKS) {
    if (atk.kind === 'feint' || atk.outcome === 'shadow') continue;
    const t0 = atk.t - STRIKE_TRAVEL, t1 = atk.t + SPEED_LINE_TAIL;
    if (s < t0 || s > t1) continue;
    const p = (s - t0) / (t1 - t0); // 0..1 sepanjang jendela garis
    const att = atk.by === 'R' ? sim.R : sim.B;
    const def = atk.by === 'R' ? sim.B : sim.R;
    const limb = limbFor(atk.kind);
    const jA = computeJoints(att);
    const jD = computeJoints(def);
    const tip = limb === 'armF' ? jA.handF : limb === 'armB' ? jA.handB : jA.footB;
    const target = atk.target === 'head' ? jD.head : atk.target === 'body' ? jD.torso : jD.kneeF;
    // Arah serang: pangkal (bahu/pinggul) -> target; garis sejajar arah ini.
    const base = limb === 'legB' ? jA.hipB : limb === 'armF' ? jA.shF : jA.shB;
    let dx = target.x - base.x, dy = target.y - base.y;
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const px = -dy, py = dx; // tegak lurus arah serang
    const tier = impactTier(atk.power);
    const n = tier === 'heavy' ? 4 : tier === 'mid' ? 3 : 2;
    const alpha = 0.5 * Math.sin(Math.PI * p);
    const L = 30 + atk.power * 12;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 15;
      const mx = tip.x + px * off - dx * (8 + i * 12);
      const my = tip.y + py * off - dy * (8 + i * 12);
      out.push({
        x1: mx - dx * L / 2, y1: my - dy * L / 2,
        x2: mx + dx * L / 2, y2: my + dy * L / 2,
        alpha, width: tier === 'heavy' ? 3.5 : 3, color: att.color, kind: atk.kind,
      });
    }
  }
  return out;
}

function drawSpeedLines(c, s, sim) {
  const lines = speedLinesAt(s, sim);
  if (!lines.length) return;
  c.save();
  c.lineCap = 'round';
  for (const ln of lines) {
    c.globalAlpha = ln.alpha;
    c.strokeStyle = ln.color;
    c.lineWidth = ln.width;
    c.beginPath();
    c.moveTo(ln.x1, ln.y1);
    c.lineTo(ln.x2, ln.y2);
    c.stroke();
  }
  c.restore();
}

