import { describe, expect, it } from 'vitest';
import {
  allDeckKinds,
  DECK_MAX_CARDS,
  hasDeck,
  isDeckCardKind,
  validateDeckCards,
  validateDeckWithSignature,
} from '../game/deck';

describe('hasDeck', () => {
  it('deck kosong = belum punya deck', () => {
    expect(hasDeck([])).toBe(false);
  });

  it('satu kartu atau lebih = punya deck', () => {
    expect(hasDeck(['jab'])).toBe(true);
    expect(hasDeck(['jab', 'headkick'])).toBe(true);
  });

  it('null/undefined/bukan array = belum punya deck', () => {
    expect(hasDeck(null)).toBe(false);
    expect(hasDeck(undefined)).toBe(false);
    expect(hasDeck('jab')).toBe(false);
    expect(hasDeck({})).toBe(false);
  });
});

describe('allDeckKinds', () => {
  it('tidak kosong, unik, tanpa finisher/feint/ginga/senjata', () => {
    const kinds = allDeckKinds();
    expect(kinds.length).toBeGreaterThan(20);
    const names = kinds.map((k) => k.kind);
    expect(new Set(names).size).toBe(names.length);
    for (const banned of ['finisher', 'feint', 'ginga', 'stickswing', 'stickchop']) {
      expect(names).not.toContain(banned);
    }
    for (const k of kinds) {
      expect(k.label.length).toBeGreaterThan(0);
      expect(k.style.length).toBeGreaterThan(0);
    }
  });

  it('jurus dari gaya apa pun ada (bukan hanya satu gaya)', () => {
    const names = new Set(allDeckKinds().map((k) => k.kind));
    // Tinju, Muay Thai, Taekwondo, Gulat, Karate, Capoeira
    for (const kind of ['jab', 'headkick', 'roundhouse', 'suplex', 'maegeri', 'armada']) {
      expect(names.has(kind)).toBe(true);
    }
  });
});

describe('isDeckCardKind', () => {
  it('jurus biasa dari gaya apa pun diterima', () => {
    expect(isDeckCardKind('jab')).toBe(true);
    expect(isDeckCardKind('headkick')).toBe(true);
    expect(isDeckCardKind('suplex')).toBe(true);
    expect(isDeckCardKind('tornadokick')).toBe(true);
  });

  it('finisher/feint/ginga/senjata/ngawur ditolak', () => {
    expect(isDeckCardKind('finisher')).toBe(false);
    expect(isDeckCardKind('feint')).toBe(false);
    expect(isDeckCardKind('ginga')).toBe(false);
    expect(isDeckCardKind('stickchop')).toBe(false);
    expect(isDeckCardKind('jurus_ngawur')).toBe(false);
    expect(isDeckCardKind('')).toBe(false);
    expect(isDeckCardKind(null)).toBe(false);
  });
});

describe('validateDeckCards', () => {
  it('deck valid (maks 6) diterima', () => {
    expect(validateDeckCards(['jab', 'headkick'])).toEqual(['jab', 'headkick']);
    expect(validateDeckCards(['jab', 'cross', 'hook', 'uppercut', 'lowkick', 'bodykick'])).toHaveLength(6);
    expect(validateDeckCards([])).toEqual([]);
  });

  it('lebih dari 6 kartu ditolak', () => {
    expect(() =>
      validateDeckCards(['jab', 'cross', 'hook', 'uppercut', 'lowkick', 'bodykick', 'knee']),
    ).toThrow(/maksimal 6/);
    expect(DECK_MAX_CARDS).toBe(6);
  });

  it('duplikat ditolak', () => {
    expect(() => validateDeckCards(['jab', 'jab'])).toThrow(/duplikat/);
  });

  it('jurus tidak valid ditolak', () => {
    expect(() => validateDeckCards(['jurus_ngawur'])).toThrow(/tidak dikenal/);
    expect(() => validateDeckCards(['finisher'])).toThrow(/tidak dikenal/);
  });

  it('bukan array ditolak', () => {
    expect(() => validateDeckCards('jab')).toThrow(/daftar jurus/);
    expect(() => validateDeckCards(null)).toThrow(/daftar jurus/);
  });
});

describe('validateDeckWithSignature', () => {
  it('signature di luar deck = boleh beda kind', () => {
    expect(() => validateDeckWithSignature(['jab'], 'flyknee')).not.toThrow();
    expect(() => validateDeckWithSignature([], null)).not.toThrow();
  });

  it('signature yang juga ada di kartu ditolak', () => {
    expect(() => validateDeckWithSignature(['jab', 'cross'], 'jab')).toThrow(/tidak boleh juga ada di kartu deck/);
  });
});
