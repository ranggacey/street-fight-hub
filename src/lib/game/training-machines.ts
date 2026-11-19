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
 * - Cek PLANK berbasis TORSO (bahu→pinggul) + KAKI + LEBAR BAHU.
 *   Lolos kalau SALAH SATU: (1) SAMPING — torso nyaris horizontal
 *   (sudut terhadap horizontal <= 50°); (2) DEPAN-TINGGI — torso
 *   memendek karena foreshortening, rasio torso/badan < 0,25;
 *   (3) DEPAN-RENDAH — torso vertikal di gambar (sudut >= 70°) TAPI
 *   torso relatif panjang (rasio >= 0,45) DAN kaki memendek terhadap
 *   torso (pinggul→pergelangan / torso <= 1,15); (4) DEPAN (butuh
 *   aspek video W/H, lihat setVideoAspect) — lebar bahu : panjang
 *   torso dalam piksel >= 1,5 (bahu tidak ikut memendek saat badan
 *   mengarah ke kamera). BERDIRI tetap terblokir: rasio ~0,35,
 *   kaki/torso ~1,8, bahu/torso (px) ~0,3–0,9.
 *   Bukti video user 2026-11-11 (kamera di lantai DEPAN user,
 *   1080x2400 portrait, 11 dtk): bahu (0,50, 0,385), pinggul
 *   (0,50, 0,635), lutut ~(0,50, 0,72) → sudut 90°, rasio 0,60,
 *   kaki/torso 0,66 — GAGAL di gate lama (butuh rasio < 0,25),
 *   lolos di klausul (3). Landmark BERDIRI di tes diperbaiki jadi
 *   anatomis — yang lama skematis (pinggul→pergelangan == torso,
 *   kaki/torso 1,0; tidak ada manusia berdiri seperti itu; kini
 *   1,82). Cek lama berbasis sudut badan bahu–pinggul–pergelangan
 *   kaki SUDAH TIDAK dipakai sebagai gate (tetap ada di debug).
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

/**
 * Ambang gate plank — lihat header file. Klausul (3) dan (4) adalah
 * perbaikan 2026-11-11 untuk kamera lantai di depan user.
 */
export const PLANK_SIDE_MAX_DEG = 50;
export const PLANK_FRONT_HIGH_MAX_RATIO = 0.25;
export const PLANK_FRONT_LOW_MIN_ANGLE_DEG = 70;
export const PLANK_FRONT_LOW_MIN_RATIO = 0.45;
export const PLANK_FRONT_LOW_MAX_LEG_RATIO = 1.15;
export const PLANK_FRONT_MIN_SHOULDER_RATIO_PX = 1.5;

export interface FrameDebug {
  mode: Mode;
  phase: string;
  elbow: number | null;
  knee: number | null;
  bodyAngle: number | null;
  hipDev: number | null;
  torsoAngleDeg: number | null;
  torsoLenRatio: number | null;
  /** |pinggul→pergelangan| / |bahu→pinggul| (kaki memendek = plank depan). */
  legRatio: number | null;
  /** Lebar bahu : panjang torso dalam piksel (butuh `aspect`); null tanpa aspek. */
  shoulderTorsoRatio: number | null;
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
  legRatio: null,
  shoulderTorsoRatio: null,
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
 * Cek plank berbasis TORSO (bahu→pinggul) + KAKI + LEBAR BAHU.
 * - Dari samping: torso nyaris horizontal → sudut terhadap horizontal kecil.
 * - Dari depan-tinggi: torso mengarah menjauhi kamera → panjang proyeksinya
 *   jauh lebih pendek dari panjang badan (rasio < 0,25).
 * - Dari depan-rendah (kamera di lantai depan user, kasus video 2026-11-11):
 *   torso TEGAK di gambar (sudut ~90°) dan rasio torso/badan BESAR (~0,6)
 *   karena kaki yang jauh ikut memendek — tapi kaki memendek JAUH LEBIH
 *   (pinggul→pergelangan hanya ~0,66x torso) dibanding BERDIRI (~1,8x).
 *   Klausul ini TIDAK butuh aspek video.
 * - Dari depan (butuh `aspect` = lebar/tinggi video): lebar bahu TIDAK ikut
 *   memendek saat badan mengarah ke kamera, jadi bahu : torso (piksel)
 *   >= 1,5 menandakan plank; BERDIRI ~0,3–0,9 berapa pun jaraknya.
 * - Berdiri: torso vertikal (sudut ~90°) DAN panjang penuh (rasio ~0,35)
 *   DAN kaki panjang penuh → bukan plank.
 *
 * @param aspect rasio lebar/tinggi frame video (mis. 16/9 landscape,
 *   9/16 portrait). Tanpa aspek, klausul lebar-bahu dilewati — tiga
 *   klausul lain tetap jalan.
 */
export function torsoPlankCheck(lms: Pt[], aspect?: number | null): {
  plank: boolean;
  torsoAngleDeg: number | null;
  torsoLenRatio: number | null;
  legRatio: number | null;
  shoulderTorsoRatio: number | null;
} {
  const shoulderMid = mid(lms[LM.leftShoulder], lms[LM.rightShoulder]);
  const hipMid = mid(lms[LM.leftHip], lms[LM.rightHip]);
  const ankleMid = mid(lms[LM.leftAnkle], lms[LM.rightAnkle]);
  const dx = hipMid.x - shoulderMid.x;
  const dy = hipMid.y - shoulderMid.y;
  const torsoLen = Math.hypot(dx, dy);
  const bodyLen = dist(shoulderMid, ankleMid);
  if (torsoLen < 1e-6 || bodyLen < 1e-6) {
    return {
      plank: false,
      torsoAngleDeg: null,
      torsoLenRatio: null,
      legRatio: null,
      shoulderTorsoRatio: null,
    };
  }
  // Sudut torso terhadap horizontal (0° = horizontal, 90° = vertikal).
  const torsoAngleDeg = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
  const torsoLenRatio = torsoLen / bodyLen;
  // Kaki memendek terhadap torso saat badan mengarah ke kamera.
  const legRatio = dist(hipMid, ankleMid) / torsoLen;
  // Lebar bahu : panjang torso dalam satuan piksel. Koordinat landmark
  // ternormalisasi per sumbu, jadi x dikali aspek agar jarak sebanding.
  let shoulderTorsoRatio: number | null = null;
  if (aspect != null && aspect > 0) {
    const shoulderW = dist(lms[LM.leftShoulder], lms[LM.rightShoulder]);
    const torsoLenPx = Math.hypot(dx * aspect, dy);
    shoulderTorsoRatio =
      torsoLenPx < 1e-6 ? null : (shoulderW * aspect) / torsoLenPx;
  }
  const sidePlank = torsoAngleDeg <= PLANK_SIDE_MAX_DEG;
  const frontHigh = torsoLenRatio < PLANK_FRONT_HIGH_MAX_RATIO;
  const frontLow =
    torsoAngleDeg >= PLANK_FRONT_LOW_MIN_ANGLE_DEG &&
    torsoLenRatio >= PLANK_FRONT_LOW_MIN_RATIO &&
    legRatio <= PLANK_FRONT_LOW_MAX_LEG_RATIO;
  const frontLowWide =
    shoulderTorsoRatio !== null &&
    torsoAngleDeg >= PLANK_FRONT_LOW_MIN_ANGLE_DEG &&
    shoulderTorsoRatio >= PLANK_FRONT_MIN_SHOULDER_RATIO_PX;
  const plank = sidePlank || frontHigh || frontLow || frontLowWide;
  return { plank, torsoAngleDeg, torsoLenRatio, legRatio, shoulderTorsoRatio };
}

/** Push-up: ATAS siku >150° + plank, BAWAH siku <=105°, rep saat kembali ke ATAS. */
export class PushupMachine {
  private state: 'top' | 'down' = 'top';
  private minElbow = 180;
  private downAt = 0;
  private prevElbow: number | null = null;
  /** Rasio lebar/tinggi frame video (16/9 landscape, 9/16 portrait). */
  private videoAspect: number | null = null;

  reset(): void {
    this.state = 'top';
    this.minElbow = 180;
    this.downAt = 0;
    this.prevElbow = null;
  }

  /**
   * Pasang aspek frame video SEKALI saat kamera menyala (dan setiap kali
   * mesin baru dibuat, mis. ganti mode) — dipakai klausul lebar-bahu di
   * torsoPlankCheck. Tanpa ini gate tetap jalan via tiga klausul lain,
   * tapi plank depan sudut menengah/tinggi jadi kurang tertangkap.
   */
  setVideoAspect(aspect: number | null): void {
    this.videoAspect = aspect != null && aspect > 0 ? aspect : null;
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
    const { plank, torsoAngleDeg, torsoLenRatio, legRatio, shoulderTorsoRatio } =
      torsoPlankCheck(lms, this.videoAspect);

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
        legRatio,
        shoulderTorsoRatio,
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
        legRatio: null,
        shoulderTorsoRatio: null,
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
