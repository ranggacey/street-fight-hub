import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FINISHER_KINDS,
  SPECIAL_FX,
  SPECIAL_KINDS,
  isValidHexColor,
  normalizeKind,
  specialForAttack,
  specialProfileFor,
} from '../../../public/arena/js/special-fx.js';
import {
  FINISHER_KINDS as MOVES_FINISHER_KINDS,
  STYLES,
} from '../../../public/arena/js/moves.js';
import { signatureMoveOptions } from '../game/engine-config';
import { impactVisualAt } from '../../../public/arena/js/film.js';

// Bundle SFX dibaca dari disk (bukan import JSON — vitest node env).
const bundle = JSON.parse(
  readFileSync(
    new URL(
      '../../../public/arena/audio/sfx-bundle.json',
      import.meta.url,
    ),
    'utf-8',
  ),
) as Record<string, string>;

// Kind yang bisa jadi jurus khas = gabungan signatureMoveOptions semua gaya
// (movesFor, tanpa senjata, minus feint) + semua kind finisher —
// moves.js (finisher/flyknee/headkick) + film.js (stickchop).
function expectedSpecialKinds(): Set<string> {
  const kinds = new Set<string>();
  for (const style of Object.keys(STYLES)) {
    for (const o of signatureMoveOptions(style)) kinds.add(o.kind);
  }
  for (const k of MOVES_FINISHER_KINDS) kinds.add(k);
  for (const k of ['finisher', 'flyknee', 'headkick', 'stickchop']) {
    kinds.add(k);
  }
  return kinds;
}

describe('special-fx: profil jurus spesial', () => {
  it('setiap kind jurus khas + finisher punya profil', () => {
    const expected = expectedSpecialKinds();
    expect(expected.size).toBeGreaterThan(40);
    const missing = [...expected].filter(
      (k) => !(SPECIAL_FX as Record<string, unknown>)[k],
    );
    expect(missing).toEqual([]);
    // Tidak ada profil yatim (kind di map tapi bukan jurus spesial).
    const extra = SPECIAL_KINDS.filter((k) => !expected.has(k));
    expect(extra).toEqual([]);
  });

  it('warna cincin unik dan hex valid', () => {
    const colors = Object.values(SPECIAL_FX).map((p) => p.ringColor);
    expect(colors.every(isValidHexColor)).toBe(true);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('bentuk profil valid (ukuran/shake/zoom/burst/preEffect)', () => {
    const bursts = new Set(['starburst', 'rays', 'shockwave', 'sparks']);
    const pres = new Set(['dust', 'ice-lines', 'wind', 'none']);
    for (const [kind, p] of Object.entries(SPECIAL_FX)) {
      expect(p.ringSize, `${kind} ringSize`).toBeGreaterThanOrEqual(1);
      expect(p.shake, `${kind} shake`).toBeGreaterThanOrEqual(0);
      expect(p.shake, `${kind} shake`).toBeLessThanOrEqual(1);
      expect(p.zoom, `${kind} zoom`).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(p.speedLines), `${kind} speedLines`).toBe(true);
      expect(p.speedLines, `${kind} speedLines`).toBeGreaterThanOrEqual(0);
      expect(bursts.has(p.burst), `${kind} burst`).toBe(true);
      expect(pres.has(p.preEffect), `${kind} preEffect`).toBe(true);
      expect(typeof p.airDash, `${kind} airDash`).toBe('boolean');
    }
  });

  it('semua kunci SFX profil ada di sfx-bundle.json', () => {
    const missing: string[] = [];
    for (const [kind, p] of Object.entries(SPECIAL_FX)) {
      for (const key of [p.sfxKey, p.whooshKey]) {
        if (typeof bundle[key] !== 'string' || bundle[key].length < 100) {
          missing.push(`${kind}:${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('tidak ada file special-* di bundle yang tak dipakai profil', () => {
    const used = new Set(
      Object.values(SPECIAL_FX).flatMap((p) => [p.sfxKey, p.whooshKey]),
    );
    const orphan = Object.keys(bundle).filter(
      (k) => k.startsWith('special-') && !used.has(k),
    );
    expect(orphan).toEqual([]);
  });

  it('anchor CF40 v4: haymaker = Superman punch, flyknee oranye', () => {
    const hay = SPECIAL_FX.haymaker;
    expect(hay.ringColor).toBe('#7DD3FC');
    expect(hay.preEffect).toBe('ice-lines');
    expect(hay.airDash).toBe(true);
    expect(hay.burst).toBe('starburst');
    expect(hay.ringSize).toBe(2.2);
    expect(SPECIAL_FX.flyknee.ringColor).toBe('#F97316');
    expect(SPECIAL_FX.finisher.ringColor).not.toBe('#7DD3FC');
    expect(SPECIAL_FX.finisher.ringColor).not.toBe('#F97316');
  });

  it('specialForAttack: finisher ATAU jurus khas yang kena saja', () => {
    expect(
      specialForAttack({ kind: 'finisher', outcome: 'hit' }, null),
    ).toBe(SPECIAL_FX.finisher);
    expect(
      specialForAttack({ kind: 'flyknee', outcome: 'hit' }, 'jab'),
    ).toBe(SPECIAL_FX.flyknee);
    expect(
      specialForAttack({ kind: 'roundhouse', outcome: 'hit' }, 'roundhouse'),
    ).toBe(SPECIAL_FX.roundhouse);
    // Bukan jurus khas penyerang -> bukan spesial.
    expect(
      specialForAttack({ kind: 'roundhouse', outcome: 'hit' }, 'jab'),
    ).toBeNull();
    expect(
      specialForAttack({ kind: 'jab', outcome: 'hit' }, null),
    ).toBeNull();
    // Block / miss / kind tak dikenal -> bukan spesial.
    expect(
      specialForAttack({ kind: 'haymaker', outcome: 'block' }, 'haymaker'),
    ).toBeNull();
    expect(
      specialForAttack({ kind: 'jurus-aneh', outcome: 'hit' }, 'jurus-aneh'),
    ).toBeNull();
    expect(specialProfileFor('tidak-ada')).toBeNull();
  });

  it('normalizeKind memetakan varian tangan kanan + alias kick', () => {
    expect(normalizeKind('jabR')).toBe('jab');
    expect(normalizeKind('hookR')).toBe('hook');
    expect(normalizeKind('bodyshotR')).toBe('bodyshot');
    expect(normalizeKind('kick')).toBe('lowkick');
    expect(normalizeKind('haymaker')).toBe('haymaker');
  });

  it('FINISHER_KINDS mencakup finisher moves.js + film.js', () => {
    for (const k of MOVES_FINISHER_KINDS) {
      expect(FINISHER_KINDS).toContain(k);
    }
    expect(FINISHER_KINDS).toContain('stickchop');
  });
});

describe('special-fx: integrasi film.js (impactVisualAt)', () => {
  it('impact spesial memakai cincin profil + radius lebih besar', () => {
    const base = impactVisualAt(0.1, [
      { t: 0, x: 100, y: 100, power: 1.0, kind: 'hit' },
    ]);
    const sp = impactVisualAt(0.1, [
      { t: 0, x: 100, y: 100, power: 1.0, kind: 'hit', special: 'haymaker' },
    ]);
    expect(base).toHaveLength(1);
    expect(sp).toHaveLength(1);
    expect(sp[0].ringColor).toBe('#7DD3FC');
    expect(sp[0].burst).toBe('starburst');
    expect(sp[0].ringR).toBeGreaterThan(base[0].ringR);
    expect(sp[0].rays).toBeGreaterThan(base[0].rays);
  });

  it('impact tanpa special tetap memakai VFX dasar (tanpa warna profil)', () => {
    const v = impactVisualAt(0.1, [
      { t: 0, x: 100, y: 100, power: 1.0, kind: 'hit' },
    ]);
    expect(v[0].ringColor).toBeNull();
    expect(v[0].special).toBeNull();
  });
});
