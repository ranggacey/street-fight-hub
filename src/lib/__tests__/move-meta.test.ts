import { describe, expect, it } from 'vitest';
import {
  fallbackMoveMeta,
  getMoveMeta,
  getSpecialRing,
  hasTechniqueKeys,
  isFinisherMove,
  isSpecialKind,
  movesForStyle,
  targetLabel,
} from '../game/move-meta';

describe('getMoveMeta', () => {
  it('kind yang ada ketemu + note tidak kosong', () => {
    const jab = getMoveMeta('jab');
    expect(jab.found).toBe(true);
    expect(jab.label).toBe('Jab');
    expect(jab.style).toBe('tinju');
    expect(jab.styleLabel).toBe('Tinju');
    expect(jab.note.length).toBeGreaterThan(0);
    expect(jab.dmg).toBe(2);
    expect(jab.target).toBe('head');
  });

  it('kind yang sama di banyak gaya diambil dari gaya pertama', () => {
    // 'cross' ada di tinju dulu, baru muaythai/silat/dll.
    expect(getMoveMeta('cross').style).toBe('tinju');
    expect(getMoveMeta('headkick').style).toBe('muaythai');
    expect(getMoveMeta('suplex').style).toBe('gulat');
    expect(getMoveMeta('armada').style).toBe('capoeira');
  });

  it('kind asing mengembalikan fallback yang aman (tidak throw)', () => {
    const m = getMoveMeta('jurus_ngawur');
    expect(m.found).toBe(false);
    expect(m.label).toBe('jurus_ngawur');
    expect(m.note).toBe('');
    expect(m.dmg).toBe(0);
    expect(m.isSpecial).toBe(false);
  });

  it('input bukan string mengembalikan fallback aman', () => {
    expect(getMoveMeta('').found).toBe(false);
    expect(getMoveMeta(null).found).toBe(false);
    expect(getMoveMeta(undefined).found).toBe(false);
    expect(fallbackMoveMeta('x').found).toBe(false);
  });
});

describe('isSpecialKind / isFinisherMove / getSpecialRing', () => {
  it('finisher + haymaker + flyknee adalah spesial dengan warna cincin acuan', () => {
    expect(isSpecialKind('finisher')).toBe(true);
    expect(isFinisherMove('finisher')).toBe(true);
    expect(isFinisherMove('flyknee')).toBe(true);
    expect(isFinisherMove('jab')).toBe(false);
    // Warna acuan CF40 v4 (special-fx.js): haymaker biru es, flyknee oranye.
    expect(getSpecialRing('haymaker')?.ringColor).toBe('#7DD3FC');
    expect(getSpecialRing('flyknee')?.ringColor).toBe('#F97316');
    expect(getSpecialRing('finisher')?.ringColor).toBe('#EF4444');
  });

  it('jurus biasa yang ada di SPECIAL_FX tetap spesial, yang ngawur tidak', () => {
    expect(isSpecialKind('jab')).toBe(true);
    expect(getSpecialRing('jab')?.ringColor).toMatch(/^#[0-9A-F]{6}$/);
    expect(isSpecialKind('jurus_ngawur')).toBe(false);
    expect(getSpecialRing('jurus_ngawur')).toBeNull();
    expect(getSpecialRing(null)).toBeNull();
  });
});

describe('hasTechniqueKeys', () => {
  it('kind dengan keyframe bisa dianimasikan, kind asing tidak', () => {
    expect(hasTechniqueKeys('jab')).toBe(true);
    expect(hasTechniqueKeys('headkick')).toBe(true);
    expect(hasTechniqueKeys('tornadokick')).toBe(true);
    expect(hasTechniqueKeys('jurus_ngawur')).toBe(false);
    expect(hasTechniqueKeys('')).toBe(false);
  });
});

describe('movesForStyle / targetLabel', () => {
  it('gaya Hub (muay-thai) dipetakan ke engine + berisi jurus khasnya', () => {
    const moves = movesForStyle('muay-thai');
    const kinds = moves.map((m) => m.kind);
    expect(kinds).toContain('headkick');
    expect(kinds).toContain('flyknee');
    expect(kinds).toContain('lowkick');
    for (const m of moves) expect(m.found).toBe(true);
  });

  it('gaya tak dikenal jatuh ke brawler (bukan kosong)', () => {
    expect(movesForStyle('ngawur').length).toBeGreaterThan(0);
  });

  it('label target Bahasa Indonesia', () => {
    expect(targetLabel('head')).toBe('Kepala');
    expect(targetLabel('body')).toBe('Badan');
    expect(targetLabel('leg')).toBe('Kaki');
  });
});
