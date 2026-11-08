import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ArenaPicker, { ARENA_DESCRIPTIONS } from '../ArenaPicker';
import { ARENA_IMAGES } from '../arena-images';
import { MAP_LABELS } from '../api';

/**
 * ArenaPicker: pemilih arena bersama (/tantangan langkah 02 + /obrolan
 * tantangan terbuka). Render lewat renderToStaticMarkup (node env, tanpa
 * jsdom) — pilihan lewat prop value, nama grup lewat prop name.
 * Yang diuji: keempat preview tampil (data URI WebP), pilihan terpilih
 * ditandai, dan nilai radio = key map supaya submit tidak berubah.
 */

function srcUris(html: string): string[] {
  return [...html.matchAll(/src="(data:image\/webp;base64,[^"]+)"/g)].map(
    (m) => m[1],
  );
}

describe('ARENA_IMAGES', () => {
  it('mencakup semua key MAP_LABELS, masing-masing data URI WebP yang berbeda', () => {
    const mapKeys = Object.keys(MAP_LABELS).sort();
    expect(Object.keys(ARENA_IMAGES).sort()).toEqual(mapKeys);
    const uris = Object.values(ARENA_IMAGES);
    expect(new Set(uris).size).toBe(4);
    for (const uri of uris) {
      expect(uri.startsWith('data:image/webp;base64,')).toBe(true);
      expect(uri.length).toBeGreaterThan(10000);
    }
  });

  it('deskripsi 1 baris ada untuk semua arena', () => {
    for (const key of Object.keys(MAP_LABELS)) {
      expect(ARENA_DESCRIPTIONS[key]).toBeTruthy();
    }
  });
});

describe('ArenaPicker', () => {
  it('keempat preview tampil sebagai gambar', () => {
    const html = renderToStaticMarkup(
      <ArenaPicker value="ring" onChange={() => {}} />,
    );
    const uris = srcUris(html);
    expect(uris).toHaveLength(4);
    expect(new Set(uris).size).toBe(4);
    // Nama + deskripsi keempat arena tampil.
    for (const label of Object.values(MAP_LABELS)) {
      expect(html).toContain(label);
    }
    for (const desc of Object.values(ARENA_DESCRIPTIONS)) {
      expect(html).toContain(desc);
    }
  });

  it('arena terpilih ditandai (satu radio checked + border amber)', () => {
    const html = renderToStaticMarkup(
      <ArenaPicker value="gudang" onChange={() => {}} />,
    );
    expect(html.match(/checked=""/g)?.length).toBe(1);
    expect(html).toContain('value="gudang"');
    expect(html).toContain('border-amber-brand bg-amber-brand/10');
  });

  it('nilai radio = key map, nama grup default "map" (submit tidak berubah)', () => {
    const html = renderToStaticMarkup(
      <ArenaPicker value="jalanan" onChange={() => {}} />,
    );
    for (const key of Object.keys(MAP_LABELS)) {
      expect(html).toContain(`value="${key}"`);
    }
    expect(html).toContain('name="map"');
  });

  it('prop name dipakai untuk grup radio (dipakai /obrolan: "open-map")', () => {
    const html = renderToStaticMarkup(
      <ArenaPicker value="dojo" onChange={() => {}} name="open-map" />,
    );
    expect(html).toContain('name="open-map"');
    expect(html).not.toContain('name="map"');
    expect(html.match(/checked=""/g)?.length).toBe(1);
  });
});
