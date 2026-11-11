/**
 * Mesin hitung rep latihan via kamera (port dari prototipe
 * ~/workspace/street-fight-training — src/lib/training.ts — dengan
 * perbaikan tervalidasi dari artifact 'Latihan Kamera' 2026-11-11).
 *
 * Angka tervalidasi (JANGAN ubah tanpa tes ulang di HP user):
 * - Push-up: bawah siku <= 105°, atas siku >= 150°.
 * - Squat:   bawah lutut <= 112°, atas lutut >= 156°.
 * - Jeda rep minimum 320 ms (gerakan terlalu cepat tidak dihitung).
 * - Smoothing ADAPTIF di aplikasi (EMA sudut; alpha kecil saat gerak
 *   pelan, besar saat gerak cepat) — smoothing bawaan MediaPipe
 *   dimatikan (landmarker dibuat tanpa smoothLandmarks) supaya gerakan
 *   cepat tidak tertahan filter.
 * - Cek PLANK berbasis TORSO (vektor bahu→pinggul): plank lolos dari
 *   samping (torso nyaris horizontal) maupun dari depan (torso
 *   memendek karena foreshortening); BERDIRI tetap terblokir (torso
 *   vertikal + panjang penuh). Cek lama berbasis sudut badan
 *   bahu–pinggul–pergelangan kaki SUDAH TIDAK dipakai sebagai gate
 *   (tetap ada di debug).
 *
 * Mesin ini MURNI (tanpa DOM/MediaPipe) — bisa dites dengan landmark
 * sintetis. `nowMs` di-inject supaya tes deterministik (default
 * Date.now()).
 */
import {
  angleAt,
  dist,
  LM,
  pickSide,
  sideIndices,
  signedLineDeviation,
  type Pt,
} from './pose';

export type Mode = 'pushup' | 'squat';

/** Ambang tervalidasi — lihat header file. */
export const PUSHUP_DOWN_DEG = 105;
export const PUSHUP_UP_DEG = 150;
export const SQUAT_DOWN_DEG = 112;
export const SQUAT_UP_DEG = 156;
/** Rep yang lebih cepat dari ini dianggap getar/noise, tidak dihitung. */
export const MIN_REP_MS = 320;

export interface FrameDebug {
  mode: Mode;
  phase: string;
  elbow: number | null;
  knee: number | null;
  bodyAngle: number | null;
  hipDev: number | null;
  torsoAngleDeg: number | null;
  torsoLenRatio: number | null;
  plank: boolean;
  minElbow: number | null;
  minKnee: number | null;
  side: 'left' | 'right';
  landmarks: number;
  visible: boolean;
}

export interface MachineResult {
  counted: boolean;
  invalid: boolean;
  feedback: string;
  debug: FrameDebug;
}

const NO_LANDMARKS = (mode: Mode): FrameDebug => ({
  mode,
  phase: 'tidak terdeteksi',
  elbow: null,
  knee: null,
  bodyAngle: null,
  hipDev: null,
  torsoAngleDeg: null,
  torsoLenRatio: null,
  plank: false,
  minElbow: null,
  minKnee: null,
  side: 'left',
  landmarks: 0,
  visible: false,
});

/**
 * Smoothing adaptif (EMA): perubahan kecil = sinyal pelan → alpha kecil
 * (stabil); perubahan besar = gerakan cepat → alpha besar (ikuti).
 * Menggantikan smoothing bawaan MediaPipe yang menahan gerakan cepat.
 */
export function adaptiveSmooth(prev: number | null, raw: number): number {
  if (prev === null || Number.isNaN(prev)) return raw;
  const diff = Math.abs(raw - prev);
  const alpha = diff < 10 ? 0.35 : 0.7;
  return prev + alpha * (raw - prev);
}

/** Titik tengah dua landmark. */
function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Cek plank berbasis TORSO (bahu→pinggul).
 * - Dari samping: torso nyaris horizontal → sudut terhadap horizontal kecil.
 * - Dari depan: torso mengarah menjauhi kamera → panjang proyeksinya
 *   jauh lebih pendek dari panjang badan.
 * - Berdiri: torso vertikal (sudut ~90°) DAN panjang penuh (rasio
 *   ~0,36) → bukan plank.
 */
export function torsoPlankCheck(lms: Pt[]): {
  plank: boolean;
  torsoAngleDeg: number | null;
  torsoLenRatio: number | null;
} {
  const shoulderMid = mid(lms[LM.leftShoulder], lms[LM.rightShoulder]);
  const hipMid = mid(lms[LM.leftHip], lms[LM.rightHip]);
  const ankleMid = mid(lms[LM.leftAnkle], lms[LM.rightAnkle]);
  const dx = hipMid.x - shoulderMid.x;
  const dy = hipMid.y - shoulderMid.y;
  const torsoLen = Math.hypot(dx, dy);
  const bodyLen = dist(shoulderMid, ankleMid);
  if (torsoLen < 1e-6 || bodyLen < 1e-6) {
    return { plank: false, torsoAngleDeg: null, torsoLenRatio: null };
  }
  // Sudut torso terhadap horizontal (0° = horizontal, 90° = vertikal).
  const torsoAngleDeg = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
  const torsoLenRatio = torsoLen / bodyLen;
  const plank = torsoAngleDeg <= 50 || torsoLenRatio < 0.25;
  return { plank, torsoAngleDeg, torsoLenRatio };
}

/** Push-up: ATAS siku >150° + plank, BAWAH siku <=105°, rep saat kembali ke ATAS. */
export class PushupMachine {
  private state: 'top' | 'down' = 'top';
  private minElbow = 180;
  private downAt = 0;
  private prevElbow: number | null = null;

  reset(): void {
    this.state = 'top';
    this.minElbow = 180;
    this.downAt = 0;
    this.prevElbow = null;
  }

  step(lms: Pt[] | null, nowMs: number = Date.now()): MachineResult {
    if (!lms || lms.length < 33) {
      return {
        counted: false,
        invalid: false,
        feedback: 'Badan tidak terdeteksi — masuk ke frame',
        debug: NO_LANDMARKS('pushup'),
      };
    }
    const side = pickSide(lms);
    const ix = sideIndices(side);
    const rawElbow = angleAt(lms[ix.shoulder], lms[ix.elbow], lms[ix.wrist]);
    const elbow = rawElbow === null ? null : adaptiveSmooth(this.prevElbow, rawElbow);
    if (elbow !== null) this.prevElbow = elbow;
    const bodyAngle = angleAt(lms[ix.shoulder], lms[ix.hip], lms[ix.ankle]);
    const hipDev = signedLineDeviation(lms[ix.shoulder], lms[ix.ankle], lms[ix.hip]);
    const bodyLen = dist(lms[ix.shoulder], lms[ix.ankle]);
    const hipDevNorm = hipDev === null || bodyLen < 1e-6 ? null : hipDev / bodyLen;
    const { plank, torsoAngleDeg, torsoLenRatio } = torsoPlankCheck(lms);

    let counted = false;
    let invalid = false;
    let feedback = '';

    if (elbow === null) {
      feedback = 'Siku tidak terlihat — putar badan ke samping';
    } else if (this.state === 'top') {
      if (elbow <= PUSHUP_DOWN_DEG) {
        this.state = 'down';
        this.minElbow = elbow;
        this.downAt = nowMs;
        feedback = plank ? 'Bagus, terus turun' : 'Punggung lurus dulu (posisi plank)';
      } else if (elbow < PUSHUP_UP_DEG) {
        feedback = 'Turun lagi dikit — belum cukup dalam';
      } else {
        feedback = plank
          ? 'Siap — turun'
          : 'Bukan plank — atur posisi push-up dulu (badan lurus, bukan berdiri)';
      }
    } else {
      // state === 'down'
      this.minElbow = Math.min(this.minElbow, elbow);
      if (elbow >= PUSHUP_UP_DEG) {
        const deepEnough = this.minElbow <= PUSHUP_DOWN_DEG + 5;
        const slowEnough = nowMs - this.downAt >= MIN_REP_MS;
        if (!plank) {
          invalid = true;
          feedback = 'Rep tidak dihitung — bukan posisi plank';
        } else if (!deepEnough) {
          invalid = true;
          feedback = 'Turun lagi dikit — kurang dalam';
        } else if (!slowEnough) {
          invalid = true;
          feedback = 'Terlalu cepat — gerakan pelan dan penuh';
        } else {
          counted = true;
          feedback = 'Rep masuk!';
        }
        this.state = 'top';
        this.minElbow = 180;
        this.downAt = 0;
      } else if (elbow < 100) {
        feedback = plank ? 'Bagus, naik!' : 'Punggung lurus dulu (posisi plank)';
      } else {
        feedback = 'Naik sampai lengan lurus';
      }
    }

    return {
      counted,
      invalid,
      feedback,
      debug: {
        mode: 'pushup',
        phase: this.state === 'top' ? 'ATAS' : 'TURUN',
        elbow,
        knee: null,
        bodyAngle,
        hipDev: hipDevNorm,
        torsoAngleDeg,
        torsoLenRatio,
        plank,
        minElbow: this.state === 'down' ? this.minElbow : null,
        minKnee: null,
        side,
        landmarks: lms.length,
        visible: true,
      },
    };
  }
}

/** Squat: BERDIRI lutut >=156°, JONGKOK lutut <=112°, rep saat kembali berdiri. */
export class SquatMachine {
  private state: 'stand' | 'down' = 'stand';
  private minKnee = 180;
  private downAt = 0;
  private prevKnee: number | null = null;

  reset(): void {
    this.state = 'stand';
    this.minKnee = 180;
    this.downAt = 0;
    this.prevKnee = null;
  }

  step(lms: Pt[] | null, nowMs: number = Date.now()): MachineResult {
    if (!lms || lms.length < 33) {
      return {
        counted: false,
        invalid: false,
        feedback: 'Badan tidak terdeteksi — masuk ke frame',
        debug: NO_LANDMARKS('squat'),
      };
    }
    const side = pickSide(lms);
    const ix = sideIndices(side);
    const rawKnee = angleAt(lms[ix.hip], lms[ix.knee], lms[ix.ankle]);
    const knee = rawKnee === null ? null : adaptiveSmooth(this.prevKnee, rawKnee);
    if (knee !== null) this.prevKnee = knee;
    const hip = lms[ix.hip];
    const kneePt = lms[ix.knee];
    const hipDrop = hip && kneePt ? kneePt.y - hip.y : null;

    let counted = false;
    let invalid = false;
    let feedback = '';

    if (knee === null) {
      feedback = 'Lutut tidak terlihat — mundur dikit biar badan penuh masuk frame';
    } else if (this.state === 'stand') {
      if (knee <= SQUAT_DOWN_DEG) {
        this.state = 'down';
        this.minKnee = knee;
        this.downAt = nowMs;
        feedback = 'Turun terus';
      } else if (knee < SQUAT_UP_DEG) {
        feedback = 'Turun lagi — kurang dalam';
      } else {
        feedback = 'Siap — jongkok';
      }
    } else {
      this.minKnee = Math.min(this.minKnee, knee);
      if (knee >= SQUAT_UP_DEG) {
        const deepEnough = this.minKnee <= SQUAT_DOWN_DEG + 5;
        const slowEnough = nowMs - this.downAt >= MIN_REP_MS;
        if (!deepEnough) {
          invalid = true;
          feedback = 'Turun lagi — kurang dalam';
        } else if (!slowEnough) {
          invalid = true;
          feedback = 'Terlalu cepat — gerakan pelan dan penuh';
        } else {
          counted = true;
          feedback = 'Rep masuk!';
        }
        this.state = 'stand';
        this.minKnee = 180;
        this.downAt = 0;
      } else if (knee < 95) {
        feedback = 'Bagus, berdiri!';
      } else {
        feedback = 'Turun lagi dikit';
      }
    }

    return {
      counted,
      invalid,
      feedback,
      debug: {
        mode: 'squat',
        phase: this.state === 'stand' ? 'BERDIRI' : 'JONGKOK',
        elbow: null,
        knee,
        bodyAngle: null,
        hipDev: hipDrop,
        torsoAngleDeg: null,
        torsoLenRatio: null,
        plank: false,
        minElbow: null,
        minKnee: this.state === 'down' ? this.minKnee : null,
        side,
        landmarks: lms.length,
        visible: true,
      },
    };
  }
}
