/**
 * move-preview-anim.ts — Mesin animasi preview SATU jurus (tanpa DOM).
 *
 * Cara kerja:
 * 1. Keyframe diambil LANGSUNG dari TECHNIQUE_KEYS lewat `techniquePose`
 *    (src/lib/fight-engine/techniques.js — salinan teknik Arena v3,
 *    sudah terkompres CF2_TIME_SCALE: jab 0,26 dtk, headkick 0,73 dtk).
 * 2. Pose (rig v3: lean/crouch/armF/armB/legF/legB/...) diubah jadi
 *    titik sendi dengan rumus yang SAMA dengan `computeJointsWithPose`
 *    di public/arena/js/film.js (konstanta lengan/kaki identik).
 * 3. Stickman digambar di canvas 2D: outline tinta + garis tebal
 *    berwarna (depan) / gelap (belakang), torso garis tebal, kepala
 *    lingkaran, sarung tangan + sepatu sebagai penanda.
 * 4. Loop = durasi total teknik + jeda 0,55 dtk di guard, lalu ulang.
 *    Saat impact (dt = 0) dan `showRing`, digambar cincin membesar +
 *    garis sinar dengan warna ring dari special-fx.js.
 *
 * Modul ini TIDAK memakai `window`/`document`/`requestAnimationFrame`
 * — komponen React yang mengatur loop; fungsi di sini murni sehingga
 * bisa dites di vitest (node) dengan ctx stub.
 */
import {
  TECHNIQUE_KEYS,
  techniquePose,
  totalDurOf,
  windupDurOf,
} from './techniques.js';

// ---- Pose rig v3 (cermin film.js) ----
export interface LimbAB {
  a: number;
  b: number;
}
export interface LimbAK {
  a: number;
  k: number;
}
export interface FootPose {
  ang: number;
  pivot: number;
  lift: number;
}
export interface Pose {
  lean: number;
  crouch: number;
  head: number;
  hipRot: number;
  shRot: number;
  sway: number;
  stretch: number;
  armF: LimbAB;
  armB: LimbAB;
  legF: LimbAK;
  legB: LimbAK;
  footF: FootPose;
  footB: FootPose;
}

/** Pose guard — salinan `poseGuard('R')` di film.js. */
export const GUARD_POSE: Pose = {
  lean: 0.12,
  crouch: 0.15,
  head: 0,
  hipRot: 0,
  shRot: 0,
  sway: 0,
  stretch: 1,
  armF: { a: 0.8, b: 2.4 },
  armB: { a: 0.8, b: 2.4 },
  legF: { a: 0.16, k: -0.12 },
  legB: { a: -0.2, k: -0.28 },
  footF: { ang: 0, pivot: 0.6, lift: 0 },
  footB: { ang: -0.15, pivot: 0.6, lift: 0 },
};

// ---- Geometri sendi (konstanta film.js, verbatim) ----
const ARM_L1 = 34;
const ARM_L2 = 32;
const LEG_L1 = 48;
const LEG_L2 = 46;
const HIP_HALF = 6;
const SH_HALF = 11;

export interface Pt {
  x: number;
  y: number;
}
export interface PreviewJoints {
  hip: Pt;
  shoulder: Pt;
  head: Pt;
  torso: Pt;
  shF: Pt;
  shB: Pt;
  hipF: Pt;
  hipB: Pt;
  elbowF: Pt;
  handF: Pt;
  elbowB: Pt;
  handB: Pt;
  kneeF: Pt;
  footF: Pt;
  kneeB: Pt;
  footB: Pt;
}

/**
 * Pose → titik sendi. Port `computeJointsWithPose` film.js tanpa
 * bodyRot (preview tidak pernah knockdown) dan tanpa f.lean ekstra.
 * originX = titik pijakan di tanah, groundY = garis tanah (y naik
 * ke atas = negatif, sama seperti film.js).
 */
export function computePreviewJoints(
  p: Pose,
  originX: number,
  groundY: number,
  face: 1 | -1,
): PreviewJoints {
  const hipY = -(90 - p.crouch * 16);
  const hip: Pt = { x: originX + p.sway * face, y: groundY + hipY };
  const torsoLen = 62 * (p.stretch ?? 1);
  const lean = p.lean;
  const sh: Pt = {
    x: hip.x + Math.sin(lean) * face * torsoLen,
    y: hip.y - Math.cos(lean) * torsoLen,
  };
  const head: Pt = {
    x: sh.x + Math.sin(lean + p.head) * face * 22,
    y: sh.y - Math.cos(lean + p.head) * 22,
  };
  const torso: Pt = { x: (hip.x + sh.x) / 2, y: (hip.y + sh.y) / 2 };
  const hipF: Pt = {
    x: hip.x + Math.cos(p.hipRot) * HIP_HALF * face,
    y: hip.y + Math.sin(p.hipRot) * HIP_HALF,
  };
  const hipB: Pt = {
    x: hip.x - Math.cos(p.hipRot) * HIP_HALF * face,
    y: hip.y - Math.sin(p.hipRot) * HIP_HALF,
  };
  const shF: Pt = {
    x: sh.x + Math.cos(p.shRot) * SH_HALF * face,
    y: sh.y + Math.sin(p.shRot) * SH_HALF,
  };
  const shB: Pt = {
    x: sh.x - Math.cos(p.shRot) * SH_HALF * face,
    y: sh.y - Math.sin(p.shRot) * SH_HALF,
  };
  const limb = (
    root: Pt,
    part: LimbAB | LimbAK,
    L1: number,
    L2: number,
  ): { mid: Pt; end: Pt } => {
    const a = part.a;
    const b = (part as LimbAB).b ?? (part as LimbAK).k;
    const mid: Pt = {
      x: root.x + Math.sin(a) * face * L1,
      y: root.y + Math.cos(a) * L1,
    };
    const end: Pt = {
      x: mid.x + Math.sin(a + b) * face * L2,
      y: mid.y + Math.cos(a + b) * L2,
    };
    return { mid, end };
  };
  const armF = limb(shF, p.armF, ARM_L1, ARM_L2);
  const armB = limb(shB, p.armB, ARM_L1, ARM_L2);
  const legF = limb(hipF, p.legF, LEG_L1, LEG_L2);
  const legB = limb(hipB, p.legB, LEG_L1, LEG_L2);
  return {
    hip,
    shoulder: sh,
    head,
    torso,
    shF,
    shB,
    hipF,
    hipB,
    elbowF: armF.mid,
    handF: armF.end,
    elbowB: armB.mid,
    handB: armB.end,
    kneeF: legF.mid,
    footF: legF.end,
    kneeB: legB.mid,
    footB: legB.end,
  };
}

// ---- Loop waktu ----
/** Jeda diam di guard di akhir tiap putaran loop (detik). */
export const PREVIEW_HOLD_SEC = 0.55;
/** Durasi efek cincin impact sejak dt = 0 (detik). */
export const RING_DURATION_SEC = 0.45;

export function hasPreviewKeys(kind: unknown): boolean {
  if (typeof kind !== 'string' || !kind) return false;
  return Boolean(
    (TECHNIQUE_KEYS as unknown as Record<string, unknown>)[kind],
  );
}

/** Durasi wind-up (key pertama → impact) per kind; fallback 0,16 dtk. */
export function previewWindupSec(kind: string): number {
  const v = windupDurOf(kind) as unknown as number;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0.16;
}

/** Durasi total teknik (key pertama → kembali guard); fallback 0,5 dtk. */
export function previewTotalSec(kind: string): number {
  const v = totalDurOf(kind) as unknown as number;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0.5;
}

/** Durasi satu putaran loop (teknik + jeda guard). */
export function moveLoopDurationSec(kind: string): number {
  return previewTotalSec(kind) + PREVIEW_HOLD_SEC;
}

export type MovePhase = 'windup' | 'strike' | 'recover' | 'hold';

export interface SampledFrame {
  pose: Pose;
  phase: MovePhase;
  /** Detik relatif terhadap impact (0 = momen kontak). */
  dt: number;
  /** Detik sejak impact (null kalau di luar jendela cincin). */
  impactT: number | null;
  /** Waktu di dalam loop (0..loopDuration). */
  loopT: number;
  loopDuration: number;
}

/**
 * Pose pada waktu loop `loopT` (detik, boleh > durasi loop — di-mod).
 * Di luar rentang keyframe, techniquePose mengembalikan guard.
 */
export function sampleMoveFrame(kind: string, loopT: number): SampledFrame {
  const loopDuration = moveLoopDurationSec(kind);
  const t = ((loopT % loopDuration) + loopDuration) % loopDuration;
  const total = previewTotalSec(kind);
  const windup = previewWindupSec(kind);
  const dt = t - windup;
  // Kind tanpa keyframe: selalu guard (bukan windup/strike — tidak ada
  // gerakan yang bisa dianimasikan).
  if (!hasPreviewKeys(kind) || t >= total) {
    return {
      pose: GUARD_POSE,
      phase: 'hold',
      dt: total - windup,
      impactT: null,
      loopT: t,
      loopDuration,
    };
  }
  const pose = techniquePose(kind, dt, GUARD_POSE) as Pose;
  const impactT = dt >= 0 && dt <= RING_DURATION_SEC ? dt : null;
  const phase: MovePhase =
    dt < -0.06 ? 'windup' : dt <= 0.06 ? 'strike' : 'recover';
  return { pose, phase, dt, impactT, loopT: t, loopDuration };
}

// ---- Titik impact ----
// Cermin `limbFor` film.js: anggota gerak mana yang memukul.
const KNEE_KINDS = new Set(['knee', 'flyknee', 'kneediag']);
const ELBOW_KINDS = new Set(['elbow', 'elbowup', 'elbowspin']);
const GRAPPLE_KINDS = new Set([
  'takedown',
  'doubleleg',
  'singleleg',
  'suplex',
  'bodyslam',
  'seoinage',
  'armbar',
  'clinch',
]);
const REAR_HAND_KINDS = new Set([
  'cross',
  'finisher',
  'uppercut',
  'overhand',
  'haymaker',
  'jabR',
  'hookR',
  'bodyshotR',
  'gyakuzuki',
  'stickswing',
  'stickchop',
  'redonda',
  'sinawali',
  'pilantik',
]);
const KICK_KINDS = new Set([
  'lowkick',
  'bodykick',
  'headkick',
  'frontkick',
  'roundhouse',
  'spinkick',
  'axekick',
  'teep',
  'sweep',
  'osotogari',
  'uchimata',
  'yokogeri',
  'sidekick',
  'maegeri',
  'armada',
  'meialua',
  'queixada',
  'tornadokick',
  'butterflykick',
  'lotuskick',
  'spinhookkick',
  'meialuafrente',
  'anklepick',
  'outsidetrip',
]);

/** Titik tubuh penyerang yang memukul pada pose ini (untuk cincin). */
export function strikePointFor(kind: string, j: PreviewJoints): Pt {
  if (KNEE_KINDS.has(kind)) return j.kneeB;
  if (ELBOW_KINDS.has(kind)) return j.elbowB;
  if (GRAPPLE_KINDS.has(kind)) return j.handF;
  if (REAR_HAND_KINDS.has(kind)) return j.handB;
  if (KICK_KINDS.has(kind)) return j.footB;
  return j.handF;
}

/** Titik impact pada waktu loop tertentu (dipakai tes + cincin). */
export function strikePointAt(kind: string, loopT: number): Pt {
  const frame = sampleMoveFrame(kind, loopT);
  const j = computePreviewJoints(
    frame.pose,
    PREVIEW_ATTACKER_X,
    PREVIEW_GROUND_Y,
    1,
  );
  return strikePointFor(kind, j);
}

// ---- Gambar ----
export const PREVIEW_W = 360;
export const PREVIEW_H = 270;
export const PREVIEW_GROUND_Y = 235;
export const PREVIEW_ATTACKER_X = 110;
export const PREVIEW_DEFENDER_X = 218;

const INK = '#141210';
const PAPER = '#FBF8F1';
const DUMMY_BODY = '#9AA0A6';
const DUMMY_DARK = '#6B7280';

/** Sub-himpunan ctx 2D yang dipakai — CanvasRenderingContext2D memenuhinya. */
export interface PreviewCtx {
  save(): void;
  restore(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rot: number,
    a0: number,
    a1: number,
  ): void;
  stroke(): void;
  fill(): void;
  setLineDash(d: number[]): void;
  lineWidth: number;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineCap: string;
  lineJoin: string;
  globalAlpha: number;
}

export interface PreviewColors {
  body: string;
  gloves: string;
  shoes: string;
}

export interface DrawPreviewOptions {
  ctx: PreviewCtx;
  width: number;
  height: number;
  kind: string;
  loopT: number;
  colors: PreviewColors;
  showRing: boolean;
  ringColor: string;
  ringSize: number;
  showDefender?: boolean;
}

/** Gelapkan hex #RRGGBB dengan faktor 0..1. */
export function shadeHex(hex: string, f: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 0xff) * f);
  const g = Math.round(((n >> 8) & 0xff) * f);
  const b = Math.round((n & 0xff) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function drawStickman(
  ctx: PreviewCtx,
  j: PreviewJoints,
  face: 1 | -1,
  body: string,
  dark: string,
  glove: string,
  shoe: string,
) {
  const limb = (a: Pt, b: Pt, w: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  // Outline tinta: tiap ruas digambar lebih tebal dulu, lalu warna.
  const limb2 = (a: Pt, b: Pt, w: number, color: string) => {
    limb(a, b, w + 3, INK);
    limb(a, b, w, color);
  };
  // Kaki + lengan belakang (gelap), lalu torso, lalu depan (terang).
  limb2(j.hipB, j.kneeB, 8, dark);
  limb2(j.kneeB, j.footB, 6, dark);
  limb2(j.shB, j.elbowB, 7, dark);
  limb2(j.elbowB, j.handB, 5.5, dark);
  limb2(j.hip, j.shoulder, 12, body);
  limb2(j.hipF, j.kneeF, 8.5, body);
  limb2(j.kneeF, j.footF, 6.5, body);
  limb2(j.shF, j.elbowF, 7.5, body);
  limb2(j.elbowF, j.handF, 6, body);
  // Sendi.
  const dot = (p: Pt, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(j.elbowB, 3.5, dark);
  dot(j.kneeB, 3.5, dark);
  dot(j.elbowF, 4, body);
  dot(j.kneeF, 4, body);
  // Kepala: lingkaran kertas + outline tinta + mata.
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(j.head.x, j.head.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(j.head.x, j.head.y, 13, 0, Math.PI * 2);
  ctx.stroke();
  dot({ x: j.head.x + face * 5, y: j.head.y - 2 }, 1.8, INK);
  // Sarung tangan (lingkaran di tangan) + sepatu (garis pendek di kaki).
  dot(j.handB, 6, glove);
  dot(j.handF, 6.5, glove);
  limb(j.footB, { x: j.footB.x + face * 9, y: j.footB.y }, 5, shoe);
  limb(j.footF, { x: j.footF.x + face * 9, y: j.footF.y }, 5, shoe);
}

/**
 * Gambar satu frame preview ke canvas. `loopT` detik di dalam loop
 * (komponen yang memajukannya lewat requestAnimationFrame).
 */
export function drawPreviewFrame(o: DrawPreviewOptions): void {
  const { ctx, width, height } = o;
  const frame = sampleMoveFrame(o.kind, o.loopT);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.clearRect(0, 0, width, height);

  // Garis tanah + bayangan.
  ctx.strokeStyle = 'rgba(20,18,16,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, PREVIEW_GROUND_Y + 2);
  ctx.lineTo(width - 16, PREVIEW_GROUND_Y + 2);
  ctx.stroke();
  const shadow = (x: number) => {
    ctx.fillStyle = 'rgba(20,18,16,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, PREVIEW_GROUND_Y + 4, 42, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  shadow(PREVIEW_ATTACKER_X);
  if (o.showDefender !== false) shadow(PREVIEW_DEFENDER_X);

  // Lawan dummy (guard statis, abu-abu, menghadap kiri).
  if (o.showDefender !== false) {
    ctx.globalAlpha = 0.55;
    const dj = computePreviewJoints(
      GUARD_POSE,
      PREVIEW_DEFENDER_X,
      PREVIEW_GROUND_Y,
      -1,
    );
    drawStickman(ctx, dj, -1, DUMMY_BODY, DUMMY_DARK, DUMMY_DARK, DUMMY_DARK);
    ctx.globalAlpha = 1;
  }

  // Penyerang.
  const j = computePreviewJoints(
    frame.pose,
    PREVIEW_ATTACKER_X,
    PREVIEW_GROUND_Y,
    1,
  );
  const dark = shadeHex(o.colors.body, 0.62);
  drawStickman(ctx, j, 1, o.colors.body, dark, o.colors.gloves, o.colors.shoes);

  // Garis gerak saat strike (dt -0,06..0,10): 3 garis di belakang titik pukul.
  if (frame.dt >= -0.06 && frame.dt <= 0.1) {
    const sp = strikePointFor(o.kind, j);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      const yOff = (i - 1) * 10;
      ctx.beginPath();
      ctx.moveTo(sp.x - 34 - i * 6, sp.y + yOff);
      ctx.lineTo(sp.x - 12, sp.y + yOff);
      ctx.stroke();
    }
  }

  // Cincin impact (hanya jurus spesial/finisher): membesar + memudar.
  if (o.showRing && frame.impactT !== null) {
    const p = frame.impactT / RING_DURATION_SEC;
    const sp = strikePointFor(o.kind, j);
    const baseR = 16 * (o.ringSize || 1);
    const r = baseR + p * 52 * (o.ringSize || 1);
    ctx.globalAlpha = Math.max(0, (1 - p) * 0.95);
    ctx.strokeStyle = o.ringColor;
    ctx.lineWidth = Math.max(1, 5 * (1 - p));
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Sinar bintang di dalam cincin.
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r0 = r * 0.35;
      const r1 = r * 0.75;
      ctx.beginPath();
      ctx.moveTo(sp.x + Math.cos(a) * r0, sp.y + Math.sin(a) * r0);
      ctx.lineTo(sp.x + Math.cos(a) * r1, sp.y + Math.sin(a) * r1);
      ctx.stroke();
    }
    // Flash putih di titik kontak.
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = Math.max(0, (1 - p) * 0.5);
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 8 * (1 - p) + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
