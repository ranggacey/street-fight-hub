import { describe, expect, it } from 'vitest';
import { STYLE_LABELS } from '@/components/api';
import { normalizeStyle } from '../fight-engine/moves.js';
import {
  buildTrainingConfig,
  buildTrainingFighter,
  engineKeyForStyle,
  isValidTrainingMap,
  isValidTrainingStyle,
  isValidTrainingTempo,
  parseTrainingSeed,
  resolveTrainingSeed,
  TRAINING_STYLES,
  type TrainingSetup,
} from '../game/training-config';

function baseSetup(overrides: Partial<TrainingSetup> = {}): TrainingSetup {
  return {
    left: { style: 'muay-thai', tempo: 'seimbang' },
    right: { style: 'taekwondo', tempo: 'agresif' },
    map: 'ring',
    seedInput: '',
    ...overrides,
  };
}

describe('TRAINING_STYLES', () => {
  it('sama persis dengan daftar gaya form fighter (STYLE_LABELS)', () => {
    expect([...TRAINING_STYLES].sort()).toEqual(
      Object.keys(STYLE_LABELS).sort(),
    );
  });
});

describe('parseTrainingSeed', () => {
  it('kosong / spasi saja → null (acak)', () => {
    expect(parseTrainingSeed('')).toBeNull();
    expect(parseTrainingSeed('   ')).toBeNull();
  });

  it('bilangan bulat → nilainya', () => {
    expect(parseTrainingSeed('123')).toBe(123);
    expect(parseTrainingSeed('007')).toBe(7);
    expect(parseTrainingSeed('0')).toBe(0);
  });

  it('bilangan negatif → nilai absolut', () => {
    expect(parseTrainingSeed('-5')).toBe(5);
  });

  it('teks → hash deterministik (teks sama = seed sama)', () => {
    const a = parseTrainingSeed('lawan-latihan');
    const b = parseTrainingSeed('lawan-latihan');
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(parseTrainingSeed('teks-lain')).not.toBe(a);
  });

  it('hasil selalu uint32', () => {
    for (const input of ['1', '-99', 'abc', '99999999999999999999']) {
      const seed = parseTrainingSeed(input);
      expect(seed).not.toBeNull();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed! >= 0 && seed! < 0x100000000).toBe(true);
    }
  });
});

describe('resolveTrainingSeed', () => {
  it('input kosong → pakai random yang di-inject', () => {
    expect(resolveTrainingSeed('', () => 42)).toBe(42);
  });

  it('input terisi → random diabaikan', () => {
    expect(resolveTrainingSeed('777', () => 42)).toBe(777);
  });
});

describe('buildTrainingFighter', () => {
  it('kiri = Merah, warna badan default gaya (muay-thai → #ef4444)', () => {
    const f = buildTrainingFighter('left', 'muay-thai', 'agresif');
    expect(f.name).toBe('Merah');
    expect(f.style).toBe('muay-thai');
    expect(f.color).toBe('#ef4444');
    expect(f.colors?.body).toBe('#ef4444');
    expect(f.tempo).toBe('agresif');
    // Tanpa jurus khas — engine memakai bobot default.
    expect(f.signatureMove).toBeUndefined();
  });

  it('kanan = Biru, warna badan default gaya (boxing → #f5a623)', () => {
    const f = buildTrainingFighter('right', 'boxing', 'bertahan');
    expect(f.name).toBe('Biru');
    expect(f.style).toBe('boxing');
    expect(f.color).toBe('#f5a623');
    expect(f.tempo).toBe('bertahan');
  });

  it('mirror match dibolehkan: gaya sama, warna sama, nama tetap beda', () => {
    const left = buildTrainingFighter('left', 'taekwondo', 'seimbang');
    const right = buildTrainingFighter('right', 'taekwondo', 'seimbang');
    expect(left.style).toBe('taekwondo');
    expect(right.style).toBe('taekwondo');
    expect(left.color).toBe(right.color);
    expect(left.name).toBe('Merah');
    expect(right.name).toBe('Biru');
  });
});

describe('buildTrainingConfig', () => {
  it('fightId sintetis training-<seed>, durasi 60, tanpa opts', () => {
    const cfg = buildTrainingConfig(baseSetup(), 12345);
    expect(cfg.type).toBe('sfa-config');
    expect(cfg.fightId).toBe('training-12345');
    expect(cfg.seed).toBe(12345);
    expect(cfg.map).toBe('ring');
    expect(cfg.duration).toBe(60);
    expect('opts' in cfg).toBe(false);
    expect(cfg.fighters.left.name).toBe('Merah');
    expect(cfg.fighters.right.name).toBe('Biru');
    expect(cfg.fighters.left.style).toBe('muay-thai');
    expect(cfg.fighters.right.style).toBe('taekwondo');
  });

  it('map lain diteruskan apa adanya', () => {
    const cfg = buildTrainingConfig(
      baseSetup({ map: 'dojo' }),
      7,
    );
    expect(cfg.map).toBe('dojo');
    expect(cfg.fightId).toBe('training-7');
  });
});

describe('style → engine mapping (normalizeStyle)', () => {
  it('alias yang terdaftar dipetakan ke engine-key', () => {
    expect(engineKeyForStyle('kali-arnis')).toBe('kali');
    expect(engineKeyForStyle('jeet-kune-do')).toBe('jkd');
    expect(engineKeyForStyle('kung-fu')).toBe('wushu');
    expect(engineKeyForStyle('taekwondo')).toBe('taekwondo');
    expect(engineKeyForStyle('tinju')).toBe('tinju');
    expect(engineKeyForStyle('silat')).toBe('silat');
    expect(engineKeyForStyle('judo')).toBe('judo');
    expect(engineKeyForStyle('kudo')).toBe('kudo');
    expect(engineKeyForStyle('karate')).toBe('karate');
    expect(engineKeyForStyle('capoeira')).toBe('capoeira');
    expect(engineKeyForStyle('wushu')).toBe('wushu');
  });

  it('gaya tak dikenal → brawler (fallback engine)', () => {
    expect(engineKeyForStyle('nope')).toBe('brawler');
    expect(engineKeyForStyle('')).toBe('brawler');
  });

  it('PERILAKU TERDOKUMENTASI (bukan harapan): Hub-enum tanpa alias di tabel jatuh ke brawler — sama seperti fight produksi', () => {
    // EMBED-CONTRACT §5 menulis muay-thai → muaythai, tapi tabel
    // STYLE_ALIASES di moves.js (vendored, md5-identik dengan Arena)
    // tidak memuat alias ini — jadi engine memakai brawler. Training
    // mereproduksi perilaku produksi persis; kalau alias diperbaiki,
    // tes ini WAJIB ikut diperbarui.
    expect(normalizeStyle('muay-thai')).toBe('brawler');
    expect(normalizeStyle('boxing')).toBe('brawler');
    expect(normalizeStyle('wrestling')).toBe('brawler');
    expect(normalizeStyle('street')).toBe('brawler');
    expect(normalizeStyle('other')).toBe('brawler');
  });
});

describe('guards', () => {
  it('isValidTrainingStyle', () => {
    expect(isValidTrainingStyle('muay-thai')).toBe(true);
    expect(isValidTrainingStyle('kung-fu')).toBe(true);
    expect(isValidTrainingStyle('karate-do')).toBe(false);
    expect(isValidTrainingStyle('')).toBe(false);
  });

  it('isValidTrainingMap', () => {
    for (const m of ['ring', 'gudang', 'jalanan', 'dojo']) {
      expect(isValidTrainingMap(m)).toBe(true);
    }
    expect(isValidTrainingMap('pantai')).toBe(false);
  });

  it('isValidTrainingTempo', () => {
    for (const t of ['agresif', 'seimbang', 'bertahan']) {
      expect(isValidTrainingTempo(t)).toBe(true);
    }
    expect(isValidTrainingTempo('cepat')).toBe(false);
  });
});
