import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FightLoader from '../FightLoader';
import RootLoading from '../../app/loading';
import KlasemenLoading from '../../app/klasemen/loading';

/**
 * FightLoader: GIF stickman gelud (data URI, bukan file biner) + teks.
 * Render lewat renderToStaticMarkup (node env, tanpa jsdom) — komponen
 * ini presentasional murni, tanpa hook/effect.
 */

describe('FightLoader', () => {
  it('merender GIF sebagai data URI + label default', () => {
    const html = renderToStaticMarkup(<FightLoader />);
    // GIF ter-inline (pola BELT_IMAGE): bukan <img src="/..."> eksternal.
    expect(html).toContain('data:image/gif;base64,');
    expect(html).toContain('Dua stickman sedang bertarung');
    expect(html).toContain('Memuat…');
    expect(html).toContain('role="status"');
  });

  it('label kustom tampil sebagai teks + aria-label', () => {
    const html = renderToStaticMarkup(
      <FightLoader label="Memuat klasemen…" />,
    );
    expect(html).toContain('Memuat klasemen…');
    expect(html).toContain('aria-label="Memuat klasemen…"');
  });

  it('ukuran sm/md/lg mengubah lebar GIF tanpa merusak layout', () => {
    const sm = renderToStaticMarkup(<FightLoader size="sm" />);
    const md = renderToStaticMarkup(<FightLoader size="md" />);
    const lg = renderToStaticMarkup(<FightLoader size="lg" />);
    expect(sm).toContain('w-[140px]');
    expect(md).toContain('w-[220px]');
    expect(lg).toContain('w-[280px]');
    // Wadah tetap flex terpusat + GIF tidak pernah meluber (max-w-full).
    for (const html of [sm, md, lg]) {
      expect(html).toContain('flex flex-col items-center justify-center');
      expect(html).toContain('max-w-full');
    }
  });

  it('loading.tsx root memakai FightLoader', () => {
    const html = renderToStaticMarkup(<RootLoading />);
    expect(html).toContain('data:image/gif;base64,');
    expect(html).toContain('Memuat…');
  });

  it('loading.tsx klasemen memakai FightLoader dengan label klasemen', () => {
    const html = renderToStaticMarkup(<KlasemenLoading />);
    expect(html).toContain('data:image/gif;base64,');
    expect(html).toContain('Memuat klasemen…');
  });
});
