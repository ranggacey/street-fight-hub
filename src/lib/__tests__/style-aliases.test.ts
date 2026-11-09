import { describe, expect, it } from 'vitest';
import { movesFor, normalizeStyle } from '../fight-engine/moves.js';

// Perbaikan alias 2026-11-09: enum Hub 'muay-thai'/'boxing'/'wrestling'
// dulu jatuh ke 'brawler' karena tidak ada di STYLE_ALIASES — padahal
// toEngineFighter mengirim style Hub mentah. Sejak perbaikan ini, tiap
// gaya memakai pool gerakannya sendiri. 'street'/'other' tetap brawler
// (disengaja, keputusan Fase 1).

const PUNCHES = ['jab', 'cross', 'hook', 'uppercut', 'bodyshot', 'overhand', 'haymaker'];
const KICKS = [
  'lowkick',
  'bodykick',
  'headkick',
  'teep',
  'roundhouse',
  'frontkick',
  'spinkick',
  'spinhookkick',
  'axekick',
  'sweep',
];

function kinds(style: string): string[] {
  return movesFor({ style, weapon: { kind: 'none' } }).map((m: { kind: string }) => m.kind);
}

describe('normalizeStyle — alias Hub-enum', () => {
  it("muay-thai → muaythai", () => {
    expect(normalizeStyle('muay-thai')).toBe('muaythai');
  });

  it("boxing → tinju", () => {
    expect(normalizeStyle('boxing')).toBe('tinju');
  });

  it("wrestling → gulat", () => {
    expect(normalizeStyle('wrestling')).toBe('gulat');
  });

  it('engine-key lama tetap dipetakan', () => {
    expect(normalizeStyle('muaythai')).toBe('muaythai');
    expect(normalizeStyle('tinju')).toBe('tinju');
    expect(normalizeStyle('gulat')).toBe('gulat');
  });

  it('street/other tetap brawler (disengaja)', () => {
    expect(normalizeStyle('street')).toBe('brawler');
    expect(normalizeStyle('other')).toBe('brawler');
    expect(normalizeStyle('tidak-ada')).toBe('brawler');
  });
});

describe('movesFor — pool gerakan per gaya', () => {
  it('muay-thai: tendangan + lutut + siku, bukan jurus brawler', () => {
    const k = kinds('muay-thai');
    for (const must of ['knee', 'lowkick', 'bodykick', 'elbow', 'teep']) {
      expect(k).toContain(must);
    }
    expect(k).not.toContain('overhand');
    expect(k).not.toContain('haymaker');
  });

  it('boxing: pool tinju murni — tanpa overhand/haymaker dan tanpa tendangan', () => {
    const k = kinds('boxing');
    for (const must of ['jab', 'cross', 'hook', 'uppercut', 'bodyshot']) {
      expect(k).toContain(must);
    }
    expect(k).not.toContain('overhand');
    expect(k).not.toContain('haymaker');
    for (const kick of KICKS) {
      expect(k).not.toContain(kick);
    }
  });

  it('wrestling: bantingan/grapple saja — tanpa pukulan dan tanpa tendangan', () => {
    const k = kinds('wrestling');
    for (const must of ['takedown', 'doubleleg', 'suplex']) {
      expect(k).toContain(must);
    }
    for (const punch of PUNCHES) {
      expect(k).not.toContain(punch);
    }
    for (const kick of KICKS) {
      expect(k).not.toContain(kick);
    }
  });
});
