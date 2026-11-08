import { describe, expect, it } from 'vitest';
import {
  parseFighterAccessories,
  validateFighterBody,
  parseFighterPatch,
} from '../validation';
import {
  resolveFighterAccessories,
  toEngineFighter,
} from '../game/engine-config';

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    displayName: 'Si Jagoan',
    igUsername: 'jagoan.smg',
    style: 'boxing',
    selfDescription: 'Anak Semarang.',
    ...overrides,
  };
}

describe('parseFighterAccessories (validasi katalog)', () => {
  it('menerima partial yang valid (sebagian bagian saja)', () => {
    expect(parseFighterAccessories({ head: 'crown', weapon: 'nunchaku' })).toEqual({
      head: 'crown',
      weapon: 'nunchaku',
    });
  });

  it('undefined/null → objek kosong (fighter lama / tanpa aksesoris)', () => {
    expect(parseFighterAccessories(undefined)).toEqual({});
    expect(parseFighterAccessories(null)).toEqual({});
  });

  it('menolak key bagian tak dikenal', () => {
    expect(() => parseFighterAccessories({ sayap: 'besar' })).toThrow(
      /Bagian aksesoris tidak dikenal: sayap/,
    );
  });

  it('menolak ID varian tak dikenal dengan pesan yang menyebut pilihan', () => {
    expect(() => parseFighterAccessories({ head: 'topi-koboi' })).toThrow(
      /Aksesoris head tidak dikenal: topi-koboi/,
    );
    expect(() => parseFighterAccessories({ head: 'topi-koboi' })).toThrow(
      /bandana/,
    );
  });

  it('menolak nilai bukan string dan bukan objek', () => {
    expect(() => parseFighterAccessories({ head: 7 })).toThrow(/harus berupa string/);
    expect(() => parseFighterAccessories('crown')).toThrow(/harus berupa objek/);
    expect(() => parseFighterAccessories(['crown'])).toThrow(/harus berupa objek/);
  });

  it('menerima SEMUA id katalog (tidak ada varian yang tertolak)', () => {
    expect(
      parseFighterAccessories({
        head: 'topknot',
        hands: 'fingerless',
        feet: 'martial',
        body: 'gi',
        belt: 'champion',
        weapon: 'wooden-sword',
      }),
    ).toEqual({
      head: 'topknot',
      hands: 'fingerless',
      feet: 'martial',
      body: 'gi',
      belt: 'champion',
      weapon: 'wooden-sword',
    });
  });
});

describe('validateFighterBody / parseFighterPatch + accessories', () => {
  it('POST menyertakan accessories di game', () => {
    const input = validateFighterBody(
      baseBody({ accessories: { head: 'cap', body: 'jacket' } }),
    );
    expect(input.game.accessories).toEqual({ head: 'cap', body: 'jacket' });
  });

  it('POST tanpa accessories → game.accessories kosong', () => {
    const input = validateFighterBody(baseBody());
    expect(input.game.accessories).toEqual({});
  });

  it('POST menolak varian tak dikenal', () => {
    expect(() => validateFighterBody(baseBody({ accessories: { feet: 'sepatu-roda' } }))).toThrow(
      /Aksesoris feet tidak dikenal/,
    );
  });

  it('PATCH menyertakan accessories partial', () => {
    const patch = parseFighterPatch({ accessories: { belt: 'rope' } });
    expect(patch.top.accessories).toEqual({ belt: 'rope' });
  });

  it('PATCH menolak varian tak dikenal', () => {
    expect(() => parseFighterPatch({ accessories: { hands: 'sarung-besi' } })).toThrow(
      /Aksesoris hands tidak dikenal/,
    );
  });
});

describe('resolveFighterAccessories (fallback turunan warna)', () => {
  it('fighter lama tanpa accessories: default turunan warna', () => {
    // headband + belt terpasang, weapon warna kayu (default skema) → stick.
    const resolved = resolveFighterAccessories({
      displayName: 'Lama',
      style: 'boxing',
      colors: { headband: '#E10600', belt: '#141210', weapon: '#8B5E34' },
    });
    expect(resolved).toEqual({
      head: 'headband',
      hands: 'boxing',
      feet: 'sneakers',
      body: 'none',
      belt: 'belt',
      weapon: 'stick',
    });
  });

  it('warna none semua → kepala/sabuk/senjata none', () => {
    const resolved = resolveFighterAccessories({
      displayName: 'Polos',
      style: 'street',
      colors: { headband: 'none', belt: 'none', weapon: 'none' },
    });
    expect(resolved).toEqual({
      head: 'none',
      hands: 'boxing',
      feet: 'sneakers',
      body: 'none',
      belt: 'none',
      weapon: 'none',
    });
  });

  it('pilihan tersimpan menang atas fallback; bagian kosong tetap fallback', () => {
    const resolved = resolveFighterAccessories({
      displayName: 'Mix',
      style: 'karate',
      colors: { headband: '#E10600', belt: 'none', weapon: 'none' },
      accessories: { head: 'crown', body: 'gi' },
    });
    expect(resolved.head).toBe('crown');
    expect(resolved.body).toBe('gi');
    expect(resolved.belt).toBe('none');
    expect(resolved.weapon).toBe('none');
    expect(resolved.hands).toBe('boxing');
    expect(resolved.feet).toBe('sneakers');
  });

  it('ID tak dikenal di dokumen lama → default bagian itu', () => {
    const resolved = resolveFighterAccessories({
      displayName: 'Rusak',
      style: 'boxing',
      colors: {},
      accessories: { head: 'topi-koboi', hands: 'boxing' } as never,
    });
    expect(resolved.head).toBe('none');
    expect(resolved.hands).toBe('boxing');
  });
});

describe('toEngineFighter + accessories', () => {
  it('menyertakan accessories lengkap + mapping legacy gloves/shoes', () => {
    const engine = toEngineFighter({
      displayName: 'Si Jagoan',
      style: 'boxing',
      colors: { body: '#ef4444', gloves: '#141210', shoes: '#FBF8F1' },
      accessories: {
        head: 'bandana',
        hands: 'wraps',
        feet: 'boots',
        body: 'shirt',
        belt: 'champion',
        weapon: 'nunchaku',
      },
    });
    expect(engine.accessories).toEqual({
      head: 'bandana',
      hands: 'wraps',
      feet: 'boots',
      body: 'shirt',
      belt: 'champion',
      weapon: 'nunchaku',
    });
    expect(engine.gloves).toEqual({ type: 'wraps' });
    expect(engine.shoes).toEqual({ model: 'boots' });
  });

  it('mapping legacy: semua varian tangan/kaki terpetakan', () => {
    const cases: [string, string][] = [
      ['none', 'none'],
      ['boxing', 'boxing'],
      ['big', 'big'],
      ['mma', 'mma'],
      ['wraps', 'wraps'],
      ['fingerless', 'fingerless'],
    ];
    for (const [hands, type] of cases) {
      const engine = toEngineFighter({
        displayName: 'T',
        style: 'boxing',
        accessories: { hands },
      });
      expect(engine.gloves).toEqual({ type });
    }
    const feetCases: [string, string][] = [
      ['barefoot', 'barefoot'],
      ['sneakers', 'sneakers'],
      ['boots', 'boots'],
      ['sandals', 'sandals'],
      ['martial', 'martial'],
    ];
    for (const [feet, model] of feetCases) {
      const engine = toEngineFighter({
        displayName: 'T',
        style: 'boxing',
        accessories: { feet },
      });
      expect(engine.shoes).toEqual({ model });
    }
  });

  it('weapon.kind TETAP none apapun aksesoris senjatanya', () => {
    for (const weapon of ['stick', 'short-stick', 'wooden-sword', 'nunchaku']) {
      const engine = toEngineFighter({
        displayName: 'T',
        style: 'kali-arnis',
        colors: { weapon: '#8B5E34' },
        accessories: { weapon },
      });
      expect(engine.weapon).toEqual({ kind: 'none', hand: 'right', color: '#8B5E34' });
    }
  });

  it('fighter lama tanpa accessories mendapat default turunan di engine', () => {
    const engine = toEngineFighter({
      displayName: 'Lama',
      style: 'muay-thai',
      colors: { headband: 'none', belt: '#EAB308', weapon: 'none' },
    });
    expect(engine.accessories).toEqual({
      head: 'none',
      hands: 'boxing',
      feet: 'sneakers',
      body: 'none',
      belt: 'belt',
      weapon: 'none',
    });
    expect(engine.gloves).toEqual({ type: 'boxing' });
    expect(engine.shoes).toEqual({ model: 'sneakers' });
    expect(engine.weapon?.kind).toBe('none');
  });
});
