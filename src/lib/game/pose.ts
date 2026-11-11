// Pose helpers: landmark indices, angles, skeleton drawing.
// MediaPipe BlazePose has 33 landmarks (normalized x/y in [0,1]).

export interface Pt {
  x: number;
  y: number;
  visibility?: number;
}

export const LM = {
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

/** BlazePose skeleton connections (pairs of landmark indices). */
export const CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [17, 19], [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
];

/** Angle at point B formed by A-B-C, in degrees (0..180). Null if degenerate. */
export function angleAt(a: Pt, b: Pt, c: Pt): number | null {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 < 1e-6 || m2 < 1e-6) return null;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Signed perpendicular distance of point P from the line A->B, normalized by
 * |A-B|. In image coordinates (y grows downward), positive means P sits
 * below the line (toward larger y). Used to detect sagging vs piked hips
 * in a side-view push-up: hip below the shoulder-ankle line = sagging.
 */
export function signedLineDeviation(a: Pt, b: Pt, p: Pt): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  // Cross product (b-a) x (p-a), divided by |b-a| -> signed distance.
  return ((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Average visibility of a set of landmarks (0..1). */
export function avgVisibility(lms: Pt[], indices: number[]): number {
  let sum = 0;
  let n = 0;
  for (const i of indices) {
    const lm = lms[i];
    if (!lm) continue;
    sum += lm.visibility ?? 0.5;
    n++;
  }
  return n ? sum / n : 0;
}

/** Pick the better-visible side ('left' | 'right') for arm/leg angles. */
export function pickSide(
  lms: Pt[],
): 'left' | 'right' {
  const left = avgVisibility(lms, [LM.leftShoulder, LM.leftElbow, LM.leftWrist, LM.leftHip, LM.leftKnee, LM.leftAnkle]);
  const right = avgVisibility(lms, [LM.rightShoulder, LM.rightElbow, LM.rightWrist, LM.rightHip, LM.rightKnee, LM.rightAnkle]);
  return left >= right ? 'left' : 'right';
}

export function sideIndices(side: 'left' | 'right') {
  if (side === 'left') {
    return {
      shoulder: LM.leftShoulder,
      elbow: LM.leftElbow,
      wrist: LM.leftWrist,
      hip: LM.leftHip,
      knee: LM.leftKnee,
      ankle: LM.leftAnkle,
    };
  }
  return {
    shoulder: LM.rightShoulder,
    elbow: LM.rightElbow,
    wrist: LM.rightWrist,
    hip: LM.rightHip,
    knee: LM.rightKnee,
    ankle: LM.rightAnkle,
  };
}

/** Draw the skeleton on a canvas (landmarks in normalized coords). */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lms: Pt[],
  w: number,
  h: number,
  opts: { mirror: boolean; lineColor: string; jointColor: string },
) {
  const px = (p: Pt) => ({
    x: (opts.mirror ? 1 - p.x : p.x) * w,
    y: p.y * h,
  });
  ctx.lineWidth = Math.max(2, w / 320);
  ctx.strokeStyle = opts.lineColor;
  ctx.lineCap = 'round';
  for (const [a, b] of CONNECTIONS) {
    const pa = lms[a];
    const pb = lms[b];
    if (!pa || !pb) continue;
    if ((pa.visibility ?? 1) < 0.3 || (pb.visibility ?? 1) < 0.3) continue;
    const A = px(pa);
    const B = px(pb);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
  }
  ctx.fillStyle = opts.jointColor;
  for (const p of lms) {
    if (!p) continue;
    if ((p.visibility ?? 1) < 0.3) continue;
    const P = px(p);
    ctx.beginPath();
    ctx.arc(P.x, P.y, Math.max(3, w / 240), 0, Math.PI * 2);
    ctx.fill();
  }
}
