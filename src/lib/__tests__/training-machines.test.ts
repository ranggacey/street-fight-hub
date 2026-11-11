import { describe, expect, it } from 'vitest';
import { LM, type Pt } from '../game/pose';
import {
  adaptiveSmooth,
  PushupMachine,
  SquatMachine,
  torsoPlankCheck,
} from '../game/training-machines';

function blankLandmarks(): Pt[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
}

/** Letakkan wrist/ankle supaya sudut di siku/lutut = `deg`. */
function limbEnd(joint: Pt, base: Pt, deg: number, len = 0.2): Pt {
  const rad = (deg * Math.PI) / 180;
  // Vektor joint→base menunjuk (0,-1); putar sebesar deg dari arah itu.
  return {
    x: joint.x + len * Math.sin(rad),
    y: joint.y - len * Math.cos(rad),
    visibility: 1,
  };
}

/** Landmark push-up: torso horizontal (plank samping), sudut siku = deg. */
function pushupLandmarks(elbowDeg: number): Pt[] {
  const lms = blankLandmarks();
  const shoulder = { x: 0.3, y: 0.5, visibility: 1 };
  const elbow = { x: 0.3, y: 0.7, visibility: 1 };
  const hip = { x: 0.6, y: 0.5, visibility: 1 };
  const ankle = { x: 0.9, y: 0.5, visibility: 1 };
  const wrist = limbEnd(elbow, shoulder, elbowDeg);
  for (const i of [LM.leftShoulder, LM.rightShoulder]) lms[i] = { ...shoulder };
  for (const i of [LM.leftElbow, LM.rightElbow]) lms[i] = { ...elbow };
  for (const i of [LM.leftWrist, LM.rightWrist]) lms[i] = { ...wrist };
  for (const i of [LM.leftHip, LM.rightHip]) lms[i] = { ...hip };
  for (const i of [LM.leftAnkle, LM.rightAnkle]) lms[i] = { ...ankle };
  for (const i of [LM.leftKnee, LM.rightKnee]) lms[i] = { x: 0.75, y: 0.5, visibility: 1 };
  return lms;
}

/** Letakkan wrist supaya sudut di siku persis `deg` (putar vektor siku→bahu). */
function wristFor(shoulder: Pt, elbow: Pt, deg: number, len = 0.22): Pt {
  const ux = shoulder.x - elbow.x;
  const uy = shoulder.y - elbow.y;
  const m = Math.hypot(ux, uy) || 1;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Dua arah putar; pilih yang mengarah ke bawah (tangan ke lantai).
  const r1x = (ux * cos - uy * sin) / m;
  const r1y = (ux * sin + uy * cos) / m;
  const r2x = (ux * cos + uy * sin) / m;
  const r2y = (-ux * sin + uy * cos) / m;
  const [wx, wy] = r1y >= r2y ? [r1x, r1y] : [r2x, r2y];
  return { x: elbow.x + len * wx, y: elbow.y + len * wy, visibility: 1 };
}

/**
 * Landmark push-up DARI DEPAN (kamera di depan user): bahu lebar di gambar,
 * torso vertikal (bahu di atas pinggul), kaki memendek menjauhi kamera.
 * Profil 'low-landscape' = geometri video user 2026-11-11 (angka dari
 * skeleton yang digambar aplikasi di frame f04: bahu (0,50, 0,385),
 * pinggul (0,50, 0,635), lutut ~(0,50, 0,72)); 'low-portrait' = adegan
 * yang sama setelah kamera jadi portrait 9:16; 'high-landscape' =
 * kamera lebih tinggi, kaki memanjang di gambar.
 */
type FrontProfile = 'low-landscape' | 'low-portrait' | 'high-landscape';
const FRONT_PROFILES: Record<
  FrontProfile,
  {
    shL: Pt; shR: Pt; elL: Pt; elR: Pt;
    hipL: Pt; hipR: Pt; kneeL: Pt; kneeR: Pt; ankL: Pt; ankR: Pt;
    aspect: number;
  }
> = {
  'low-landscape': {
    shL: { x: 0.22, y: 0.385, visibility: 1 }, shR: { x: 0.78, y: 0.385, visibility: 1 },
    elL: { x: 0.14, y: 0.6, visibility: 1 }, elR: { x: 0.86, y: 0.6, visibility: 1 },
    hipL: { x: 0.38, y: 0.635, visibility: 1 }, hipR: { x: 0.62, y: 0.635, visibility: 1 },
    kneeL: { x: 0.42, y: 0.72, visibility: 1 }, kneeR: { x: 0.58, y: 0.72, visibility: 1 },
    ankL: { x: 0.44, y: 0.8, visibility: 1 }, ankR: { x: 0.56, y: 0.8, visibility: 1 },
    aspect: 16 / 9,
  },
  'low-portrait': {
    shL: { x: 0.2, y: 0.3, visibility: 1 }, shR: { x: 0.8, y: 0.3, visibility: 1 },
    elL: { x: 0.14, y: 0.5, visibility: 1 }, elR: { x: 0.86, y: 0.5, visibility: 1 },
    hipL: { x: 0.38, y: 0.42, visibility: 1 }, hipR: { x: 0.62, y: 0.42, visibility: 1 },
    kneeL: { x: 0.42, y: 0.5, visibility: 1 }, kneeR: { x: 0.58, y: 0.5, visibility: 1 },
    ankL: { x: 0.44, y: 0.55, visibility: 1 }, ankR: { x: 0.56, y: 0.55, visibility: 1 },
    aspect: 9 / 16,
  },
  'high-landscape': {
    shL: { x: 0.3, y: 0.22, visibility: 1 }, shR: { x: 0.7, y: 0.22, visibility: 1 },
    elL: { x: 0.22, y: 0.48, visibility: 1 }, elR: { x: 0.78, y: 0.48, visibility: 1 },
    hipL: { x: 0.4, y: 0.42, visibility: 1 }, hipR: { x: 0.6, y: 0.42, visibility: 1 },
    kneeL: { x: 0.44, y: 0.66, visibility: 1 }, kneeR: { x: 0.56, y: 0.66, visibility: 1 },
    ankL: { x: 0.46, y: 0.92, visibility: 1 }, ankR: { x: 0.54, y: 0.92, visibility: 1 },
    aspect: 16 / 9,
  },
};

function frontPlankLandmarks(elbowDeg: number, profile: FrontProfile): Pt[] {
  const p = FRONT_PROFILES[profile];
  const lms = blankLandmarks();
  lms[LM.leftShoulder] = { ...p.shL };
  lms[LM.rightShoulder] = { ...p.shR };
  lms[LM.leftElbow] = { ...p.elL };
  lms[LM.rightElbow] = { ...p.elR };
  lms[LM.leftWrist] = wristFor(p.shL, p.elL, elbowDeg);
  lms[LM.rightWrist] = wristFor(p.shR, p.elR, elbowDeg);
  lms[LM.leftHip] = { ...p.hipL };
  lms[LM.rightHip] = { ...p.hipR };
  lms[LM.leftKnee] = { ...p.kneeL };
  lms[LM.rightKnee] = { ...p.kneeR };
  lms[LM.leftAnkle] = { ...p.ankL };
  lms[LM.rightAnkle] = { ...p.ankR };
  return lms;
}

/**
 * Landmark push-up sambil BERDIRI — ANATOMIS (tinggi ~1,7 m, badan penuh
 * masuk frame): bahu y=0,16, pinggul y=0,44, lutut y=0,71, pergelangan
 * y=0,95 → torso 0,28, badan 0,79, rasio 0,35, kaki/torso 1,82.
 * (Versi lama skematis: pinggul→pergelangan == torso, kaki/torso 1,0 —
 * tidak ada manusia berdiri seperti itu — dan klausul depan-rendah yang
 * baru akan salah menganggapnya plank.)
 */
function standingLandmarks(elbowDeg: number): Pt[] {
  const lms = blankLandmarks();
  const shoulderL = { x: 0.22, y: 0.16, visibility: 1 };
  const shoulderR = { x: 0.38, y: 0.16, visibility: 1 };
  const elbowL = { x: 0.22, y: 0.38, visibility: 1 };
  const elbowR = { x: 0.38, y: 0.38, visibility: 1 };
  lms[LM.leftShoulder] = { ...shoulderL };
  lms[LM.rightShoulder] = { ...shoulderR };
  lms[LM.leftElbow] = { ...elbowL };
  lms[LM.rightElbow] = { ...elbowR };
  lms[LM.leftWrist] = limbEnd(elbowL, shoulderL, elbowDeg);
  lms[LM.rightWrist] = limbEnd(elbowR, shoulderR, elbowDeg);
  for (const i of [LM.leftHip, LM.rightHip]) lms[i] = { x: i === LM.leftHip ? 0.26 : 0.34, y: 0.44, visibility: 1 };
  for (const i of [LM.leftKnee, LM.rightKnee]) lms[i] = { x: i === LM.leftKnee ? 0.26 : 0.34, y: 0.71, visibility: 1 };
  for (const i of [LM.leftAnkle, LM.rightAnkle]) lms[i] = { x: i === LM.leftAnkle ? 0.26 : 0.34, y: 0.95, visibility: 1 };
  return lms;
}

/** Landmark squat: sudut lutut = deg. */
function squatLandmarks(kneeDeg: number): Pt[] {
  const lms = blankLandmarks();
  const hip = { x: 0.3, y: 0.4, visibility: 1 };
  const knee = { x: 0.3, y: 0.6, visibility: 1 };
  const ankle = limbEnd(knee, hip, kneeDeg);
  for (const i of [LM.leftHip, LM.rightHip]) lms[i] = { ...hip };
  for (const i of [LM.leftKnee, LM.rightKnee]) lms[i] = { ...knee };
  for (const i of [LM.leftAnkle, LM.rightAnkle]) lms[i] = { ...ankle };
  for (const i of [LM.leftShoulder, LM.rightShoulder]) lms[i] = { x: 0.3, y: 0.2, visibility: 1 };
  for (const i of [LM.leftElbow, LM.rightElbow]) lms[i] = { x: 0.3, y: 0.3, visibility: 1 };
  for (const i of [LM.leftWrist, LM.rightWrist]) lms[i] = { x: 0.3, y: 0.35, visibility: 1 };
  return lms;
}

/** Jalankan N frame pose yang sama, tiap frame +100 ms. */
function feed(
  machine: PushupMachine | SquatMachine,
  lms: Pt[],
  frames: number,
  startMs: number,
): { counted: number; invalid: number; last: ReturnType<typeof machine.step> } {
  let counted = 0;
  let invalid = 0;
  let last: ReturnType<typeof machine.step> | undefined;
  for (let i = 0; i < frames; i++) {
    last = machine.step(lms, startMs + i * 100);
    if (last.counted) counted++;
    if (last.invalid) invalid++;
  }
  return { counted, invalid, last: last! };
}

describe('torsoPlankCheck', () => {
  it('plank samping (torso horizontal) → plank', () => {
    const r = torsoPlankCheck(pushupLandmarks(170));
    expect(r.plank).toBe(true);
    expect(r.torsoAngleDeg).toBeLessThan(50);
  });

  it('berdiri (torso vertikal + panjang penuh) → bukan plank', () => {
    const r = torsoPlankCheck(standingLandmarks(170));
    expect(r.plank).toBe(false);
    expect(r.torsoAngleDeg).toBeGreaterThan(80);
    expect(r.torsoLenRatio).toBeGreaterThan(0.25);
    // Anatomis: kaki panjang penuh terhadap torso — beda jauh dari plank depan.
    expect(r.legRatio).toBeGreaterThan(1.15);
    expect(r.legRatio).toBeCloseTo(1.82, 1);
  });

  it('berdiri (portrait, dengan aspek) → bukan plank; bahu/torso (px) jauh < 1,5', () => {
    const r = torsoPlankCheck(standingLandmarks(170), 9 / 16);
    expect(r.plank).toBe(false);
    expect(r.shoulderTorsoRatio).not.toBeNull();
    expect(r.shoulderTorsoRatio!).toBeLessThan(1.5);
  });

  it('berdiri DEKAT portrait (bahu memenuhi lebar frame) → tetap bukan plank', () => {
    // Bahu lebar saja tidak cukup: torso tetap panjang penuh (px).
    const lms = blankLandmarks();
    lms[LM.leftShoulder] = { x: 0.15, y: 0.1, visibility: 1 };
    lms[LM.rightShoulder] = { x: 0.55, y: 0.1, visibility: 1 };
    lms[LM.leftHip] = { x: 0.28, y: 0.4, visibility: 1 };
    lms[LM.rightHip] = { x: 0.42, y: 0.4, visibility: 1 };
    lms[LM.leftKnee] = { x: 0.28, y: 0.68, visibility: 1 };
    lms[LM.rightKnee] = { x: 0.42, y: 0.68, visibility: 1 };
    lms[LM.leftAnkle] = { x: 0.28, y: 0.96, visibility: 1 };
    lms[LM.rightAnkle] = { x: 0.42, y: 0.96, visibility: 1 };
    const r = torsoPlankCheck(lms, 9 / 16);
    expect(r.plank).toBe(false);
    expect(r.shoulderTorsoRatio!).toBeLessThan(1.5);
  });

  it('plank dari depan (torso memendek/foreshortening) → plank', () => {
    const lms = blankLandmarks();
    // Torso vertikal di gambar tapi SANGAT pendek (mengarah ke kamera).
    for (const i of [LM.leftShoulder, LM.rightShoulder]) lms[i] = { x: 0.5, y: 0.3, visibility: 1 };
    for (const i of [LM.leftHip, LM.rightHip]) lms[i] = { x: 0.5, y: 0.38, visibility: 1 };
    for (const i of [LM.leftAnkle, LM.rightAnkle]) lms[i] = { x: 0.5, y: 0.9, visibility: 1 };
    const r = torsoPlankCheck(lms);
    expect(r.torsoLenRatio).toBeLessThan(0.25);
    expect(r.plank).toBe(true);
  });

  it('plank dari depan sudut RENDAH landscape (video user 2026-11-11, kamera lantai) → plank', () => {
    // Geometri dari skeleton f04: bahu (0,50, 0,385), pinggul (0,50, 0,635),
    // lutut ~(0,50, 0,72). Gate LAMA gagal di sini (rasio 0,60, bukan < 0,25).
    const lms = frontPlankLandmarks(170, 'low-landscape');
    const r = torsoPlankCheck(lms, FRONT_PROFILES['low-landscape'].aspect);
    expect(r.torsoAngleDeg).toBeCloseTo(90, 0);
    expect(r.torsoLenRatio).toBeCloseTo(0.6, 1);
    expect(r.legRatio).toBeCloseTo(0.66, 1);
    expect(r.plank).toBe(true);
  });

  it('plank dari depan sudut RENDAH → plank JUGA tanpa aspek (klausul tanpa-aspek)', () => {
    // Perbaikan tidak boleh bergantung pada koordinator yang memasang aspek.
    const r = torsoPlankCheck(frontPlankLandmarks(170, 'low-landscape'));
    expect(r.shoulderTorsoRatio).toBeNull();
    expect(r.plank).toBe(true);
  });

  it('plank dari depan sudut RENDAH portrait 9:16 (pasca-fix kamera) → plank', () => {
    const lms = frontPlankLandmarks(170, 'low-portrait');
    const r = torsoPlankCheck(lms, FRONT_PROFILES['low-portrait'].aspect);
    expect(r.torsoLenRatio).toBeCloseTo(0.48, 1);
    expect(r.legRatio).toBeCloseTo(1.08, 1);
    expect(r.shoulderTorsoRatio).toBeGreaterThan(1.5);
    expect(r.plank).toBe(true);
  });

  it('plank dari depan sudut TINGGI (kamera lebih tinggi, kaki memanjang) → plank via bahu', () => {
    // Rasio 0,29 + kaki/torso 2,5 TIDAK lolos klausul tanpa-aspek — kasus ini
    // hanya terbedakan dari berdiri lewat lebar bahu, jadi BUTUH aspek.
    const lms = frontPlankLandmarks(170, 'high-landscape');
    const withAspect = torsoPlankCheck(lms, FRONT_PROFILES['high-landscape'].aspect);
    expect(withAspect.torsoLenRatio).toBeCloseTo(0.29, 1);
    expect(withAspect.legRatio).toBeCloseTo(2.5, 1);
    expect(withAspect.shoulderTorsoRatio).toBeGreaterThan(1.5);
    expect(withAspect.plank).toBe(true);
    expect(torsoPlankCheck(lms).plank).toBe(false);
  });
});

describe('adaptiveSmooth', () => {
  it('tanpa prev → nilai mentah', () => {
    expect(adaptiveSmooth(null, 120)).toBe(120);
  });

  it('perubahan kecil → alpha kecil (stabil)', () => {
    expect(adaptiveSmooth(100, 105)).toBeCloseTo(101.75, 2);
  });

  it('perubahan besar → alpha besar (ikuti gerakan cepat)', () => {
    expect(adaptiveSmooth(170, 90)).toBeCloseTo(114, 2);
  });
});

describe('PushupMachine (ambang tervalidasi 105°/150°, min rep 320 ms)', () => {
  it('rep penuh ATAS → BAWAH → ATAS dihitung', () => {
    const m = new PushupMachine();
    feed(m, pushupLandmarks(170), 5, 0);
    const down = feed(m, pushupLandmarks(90), 4, 500);
    expect(down.counted).toBe(0);
    const up = feed(m, pushupLandmarks(170), 4, 900);
    expect(up.counted).toBe(1);
    expect(up.invalid).toBe(0);
  });

  it('rep penuh dari DEPAN-RENDAH landscape (video user) dihitung', () => {
    const m = new PushupMachine();
    m.setVideoAspect(FRONT_PROFILES['low-landscape'].aspect);
    feed(m, frontPlankLandmarks(170, 'low-landscape'), 5, 0);
    feed(m, frontPlankLandmarks(90, 'low-landscape'), 4, 500);
    const up = feed(m, frontPlankLandmarks(170, 'low-landscape'), 4, 900);
    expect(up.counted).toBe(1);
    expect(up.invalid).toBe(0);
    expect(up.last.debug.plank).toBe(true);
  });

  it('rep penuh dari DEPAN-RENDAH dihitung JUGA tanpa aspek (klausul tanpa-aspek)', () => {
    const m = new PushupMachine();
    feed(m, frontPlankLandmarks(170, 'low-landscape'), 5, 0);
    feed(m, frontPlankLandmarks(90, 'low-landscape'), 4, 500);
    const up = feed(m, frontPlankLandmarks(170, 'low-landscape'), 4, 900);
    expect(up.counted).toBe(1);
    expect(up.invalid).toBe(0);
  });

  it('rep penuh dari DEPAN-RENDAH portrait 9:16 dihitung', () => {
    const m = new PushupMachine();
    m.setVideoAspect(FRONT_PROFILES['low-portrait'].aspect);
    feed(m, frontPlankLandmarks(170, 'low-portrait'), 5, 0);
    feed(m, frontPlankLandmarks(90, 'low-portrait'), 4, 500);
    const up = feed(m, frontPlankLandmarks(170, 'low-portrait'), 4, 900);
    expect(up.counted).toBe(1);
    expect(up.invalid).toBe(0);
  });

  it('rep penuh dari DEPAN-TINGGI dihitung kalau aspek dipasang', () => {
    const m = new PushupMachine();
    m.setVideoAspect(FRONT_PROFILES['high-landscape'].aspect);
    feed(m, frontPlankLandmarks(170, 'high-landscape'), 5, 0);
    feed(m, frontPlankLandmarks(90, 'high-landscape'), 4, 500);
    const up = feed(m, frontPlankLandmarks(170, 'high-landscape'), 4, 900);
    expect(up.counted).toBe(1);
    expect(up.invalid).toBe(0);
  });

  it('rep terlalu cepat (< 320 ms) TIDAK dihitung', () => {
    const m = new PushupMachine();
    feed(m, pushupLandmarks(170), 5, 0);
    feed(m, pushupLandmarks(90), 3, 500);
    const up = feed(m, pushupLandmarks(170), 3, 700);
    expect(up.counted).toBe(0);
    expect(up.invalid).toBeGreaterThan(0);
  });

  it('berdiri ikut gerak siku TIDAK dihitung (bukan plank)', () => {
    const m = new PushupMachine();
    m.setVideoAspect(9 / 16);
    feed(m, standingLandmarks(170), 5, 0);
    feed(m, standingLandmarks(90), 4, 500);
    const up = feed(m, standingLandmarks(170), 4, 900);
    expect(up.counted).toBe(0);
    expect(up.invalid).toBeGreaterThan(0);
    expect(up.last.feedback).toMatch(/plank/);
  });

  it('turun setengah (siku 130°) tidak masuk fase bawah', () => {
    const m = new PushupMachine();
    feed(m, pushupLandmarks(170), 5, 0);
    const r = feed(m, pushupLandmarks(130), 4, 500);
    expect(r.counted).toBe(0);
    expect(r.last.debug.phase).toBe('ATAS');
  });

  it('tanpa landmark → tidak terdeteksi', () => {
    const m = new PushupMachine();
    const r = m.step(null, 0);
    expect(r.counted).toBe(false);
    expect(r.debug.visible).toBe(false);
  });
});

describe('SquatMachine (ambang tervalidasi 112°/156°)', () => {
  it('rep penuh BERDIRI → JONGKOK → BERDIRI dihitung', () => {
    const m = new SquatMachine();
    feed(m, squatLandmarks(170), 5, 0);
    feed(m, squatLandmarks(90), 4, 500);
    const up = feed(m, squatLandmarks(170), 4, 900);
    expect(up.counted).toBe(1);
    expect(up.invalid).toBe(0);
  });

  it('jongkok dangkal (lutut 130°) tidak masuk fase bawah', () => {
    const m = new SquatMachine();
    feed(m, squatLandmarks(170), 5, 0);
    const r = feed(m, squatLandmarks(130), 4, 500);
    expect(r.counted).toBe(0);
    expect(r.last.debug.phase).toBe('BERDIRI');
  });

  it('rep terlalu cepat TIDAK dihitung', () => {
    const m = new SquatMachine();
    feed(m, squatLandmarks(170), 5, 0);
    feed(m, squatLandmarks(90), 3, 500);
    const up = feed(m, squatLandmarks(170), 3, 700);
    expect(up.counted).toBe(0);
    expect(up.invalid).toBeGreaterThan(0);
  });
});
