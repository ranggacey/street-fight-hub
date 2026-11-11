import { describe, expect, it } from 'vitest';
import {
  GUARD_POSE,
  PREVIEW_ATTACKER_X,
  PREVIEW_GROUND_Y,
  RING_DURATION_SEC,
  computePreviewJoints,
  drawPreviewFrame,
  hasPreviewKeys,
  moveLoopDurationSec,
  previewTotalSec,
  sampleMoveFrame,
  strikePointAt,
  type PreviewCtx,
} from '../fight-engine/move-preview-anim';

/**
 * Bukti animasi (bukan gambar statis): pose + titik pukul pada
 * wind-up vs impact harus BERBEDA secara terukur, dan frame yang
 * digambar ke ctx stub harus menghasilkan koordinat berbeda.
 */

// --- ctx stub: merekam semua pemanggilan gambar ---
function makeRecordingCtx() {
  const calls: { m: string; a: number[] }[] = [];
  const ctx = {
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    lineCap: '',
    lineJoin: '',
    globalAlpha: 1,
    save() {},
    restore() {},
    clearRect() {},
    beginPath() {},
    closePath() {},
    stroke() {},
    fill() {},
    setLineDash() {},
    moveTo(x: number, y: number) {
      calls.push({ m: 'moveTo', a: [x, y] });
    },
    lineTo(x: number, y: number) {
      calls.push({ m: 'lineTo', a: [x, y] });
    },
    arc(x: number, y: number, r: number) {
      calls.push({ m: 'arc', a: [x, y, r] });
    },
    ellipse(x: number, y: number, rx: number, ry: number) {
      calls.push({ m: 'ellipse', a: [x, y, rx, ry] });
    },
  } as unknown as PreviewCtx;
  return { ctx, calls };
}

describe('moveLoopDurationSec / sampleMoveFrame', () => {
  it('durasi loop positif dan sesuai pacing CF2 (jab ~0,26 dtk + jeda)', () => {
    expect(previewTotalSec('jab')).toBeCloseTo(0.26, 1);
    expect(moveLoopDurationSec('jab')).toBeCloseTo(0.26 + 0.55, 1);
    expect(moveLoopDurationSec('headkick')).toBeGreaterThan(
      moveLoopDurationSec('jab'),
    );
    // Kind asing: fallback aman, tetap bisa di-loop.
    expect(moveLoopDurationSec('jurus_ngawur')).toBeGreaterThan(0);
    expect(hasPreviewKeys('jurus_ngawur')).toBe(false);
    expect(hasPreviewKeys('jab')).toBe(true);
  });

  it('pose berubah sepanjang gerakan: wind-up ≠ impact ≠ guard', () => {
    const windup = sampleMoveFrame('jab', 0.02);
    const impact = sampleMoveFrame('jab', 0.09); // windup jab ~0,088 dtk
    const hold = sampleMoveFrame('jab', 0.5);
    expect(windup.phase).toBe('windup');
    expect(impact.phase).toBe('strike');
    expect(impact.impactT).not.toBeNull();
    expect(hold.phase).toBe('hold');
    expect(hold.pose).toEqual(GUARD_POSE);
    // Lengan depan menjulur saat impact (a ≈ 1,62, hampir lurus).
    expect(impact.pose.armF.a).toBeGreaterThan(1.4);
    expect(windup.pose.armF.a).toBeLessThan(impact.pose.armF.a);
  });

  it('kind asing selalu guard (tidak crash)', () => {
    const f = sampleMoveFrame('jurus_ngawur', 0.1);
    expect(f.pose).toEqual(GUARD_POSE);
    expect(f.phase).toBe('hold');
  });
});

describe('computePreviewJoints / strikePointAt', () => {
  it('tangan jab bergerak maju >30px dari guard ke impact', () => {
    const guardJ = computePreviewJoints(
      GUARD_POSE,
      PREVIEW_ATTACKER_X,
      PREVIEW_GROUND_Y,
      1,
    );
    const impact = strikePointAt('jab', 0.09);
    expect(impact.x - guardJ.handF.x).toBeGreaterThan(30);
  });

  it('kaki headkick terangkat tinggi saat impact', () => {
    const guardJ = computePreviewJoints(
      GUARD_POSE,
      PREVIEW_ATTACKER_X,
      PREVIEW_GROUND_Y,
      1,
    );
    const impact = strikePointAt('headkick', 0.26); // windup headkick ~0,25 dtk
    expect(guardJ.footB.y - impact.y).toBeGreaterThan(40);
    expect(impact.x).toBeGreaterThan(PREVIEW_ATTACKER_X + 40);
  });

  it('lutut flying knee memakai titik lutut, bukan kaki', () => {
    const atImpact = strikePointAt('flyknee', 0.31);
    const frame = sampleMoveFrame('flyknee', 0.31);
    const j = computePreviewJoints(
      frame.pose,
      PREVIEW_ATTACKER_X,
      PREVIEW_GROUND_Y,
      1,
    );
    expect(atImpact).toEqual(j.kneeB);
    expect(atImpact.y).toBeLessThan(j.footB.y);
  });
});

describe('drawPreviewFrame', () => {
  it('menggambar frame berbeda antar waktu loop (piksel/koordinat berubah)', () => {
    const base = {
      width: 360,
      height: 270,
      kind: 'jab',
      colors: { body: '#C8102E', gloves: '#141210', shoes: '#FBF8F1' },
      showRing: false,
      ringColor: '#7DD3FC',
      ringSize: 1,
    };
    const r1 = makeRecordingCtx();
    drawPreviewFrame({ ...base, ctx: r1.ctx, loopT: 0.02 });
    const r2 = makeRecordingCtx();
    drawPreviewFrame({ ...base, ctx: r2.ctx, loopT: 0.09 });
    const coords = (calls: { a: number[] }[]) =>
      calls.flatMap((c) => c.a).join(',');
    expect(r1.calls.length).toBeGreaterThan(20);
    expect(r2.calls.length).toBeGreaterThan(20);
    // Koordinat gambar wind-up vs impact HARUS berbeda (animasi nyata).
    expect(coords(r2.calls)).not.toBe(coords(r1.calls));
  });

  it('cincin spesial hanya muncul di jendela impact saat showRing', () => {
    const base = {
      width: 360,
      height: 270,
      kind: 'haymaker',
      colors: { body: '#C8102E', gloves: '#141210', shoes: '#FBF8F1' },
      showRing: true,
      ringColor: '#7DD3FC',
      ringSize: 2.2,
    };
    const countRings = (loopT: number) => {
      const r = makeRecordingCtx();
      drawPreviewFrame({ ...base, ctx: r.ctx, loopT });
      // Cincin = arc ber-radius besar di sekitar titik pukul.
      return r.calls.filter((c) => c.m === 'arc' && c.a[2] > 20).length;
    };
    // Wind-up haymaker ~0,21 dtk → belum ada cincin di 0,02.
    expect(countRings(0.02)).toBe(0);
    // Di dalam jendela impact (dt 0..0,45) cincin muncul.
    expect(countRings(0.22)).toBeGreaterThan(0);
    // Setelah jendela cincin lewat (dt > 0,45 → loopT > 0,66) hilang lagi.
    expect(countRings(0.22 + RING_DURATION_SEC + 0.1)).toBe(0);
    // showRing=false → tidak pernah ada cincin meski di impact.
    const r = makeRecordingCtx();
    drawPreviewFrame({ ...base, ctx: r.ctx, loopT: 0.22, showRing: false });
    expect(
      r.calls.filter((c) => c.m === 'arc' && c.a[2] > 20).length,
    ).toBe(0);
  });
});
