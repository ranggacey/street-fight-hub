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

/** Landmark push-up sambil BERDIRI (torso vertikal) — harus terblokir. */
function standingLandmarks(elbowDeg: number): Pt[] {
  const lms = blankLandmarks();
  const shoulder = { x: 0.3, y: 0.3, visibility: 1 };
  const elbow = { x: 0.3, y: 0.5, visibility: 1 };
  const hip = { x: 0.3, y: 0.6, visibility: 1 };
  const ankle = { x: 0.3, y: 0.9, visibility: 1 };
  const wrist = limbEnd(elbow, shoulder, elbowDeg);
  for (const i of [LM.leftShoulder, LM.rightShoulder]) lms[i] = { ...shoulder };
  for (const i of [LM.leftElbow, LM.rightElbow]) lms[i] = { ...elbow };
  for (const i of [LM.leftWrist, LM.rightWrist]) lms[i] = { ...wrist };
  for (const i of [LM.leftHip, LM.rightHip]) lms[i] = { ...hip };
  for (const i of [LM.leftAnkle, LM.rightAnkle]) lms[i] = { ...ankle };
  for (const i of [LM.leftKnee, LM.rightKnee]) lms[i] = { x: 0.3, y: 0.75, visibility: 1 };
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
