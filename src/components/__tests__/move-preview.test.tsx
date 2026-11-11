import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MovePreview from '../MovePreview';

/**
 * MovePreview: render lewat renderToStaticMarkup (node env, tanpa jsdom)
 * — effect/rAF tidak jalan di sini; yang dites: label + catatan +
 * info + fallback kind asing. Animasi geraknya dites di
 * move-preview-anim.test.ts (koordinat frame berubah antar waktu).
 */
describe('MovePreview', () => {
  it('menampilkan label + catatan teknik + info dari katalog', () => {
    const html = renderToStaticMarkup(<MovePreview kind="jab" />);
    expect(html).toContain('Jab');
    expect(html).toContain('Pukulan tercepat, ukur jarak.');
    expect(html).toContain('DMG 2');
    expect(html).toContain('Target: Kepala');
    expect(html).toContain('Tinju');
    expect(html).toContain('<canvas');
  });

  it('props menimpa katalog + badge spesial untuk signature', () => {
    const html = renderToStaticMarkup(
      <MovePreview kind="haymaker" label="Haymaker Brutal" signature />,
    );
    expect(html).toContain('Haymaker Brutal');
    expect(html).toContain('Spesial');
  });

  it('kind asing: pesan fallback, tidak crash, tanpa canvas', () => {
    const html = renderToStaticMarkup(<MovePreview kind="jurus_ngawur" />);
    expect(html).toContain('Preview belum tersedia untuk jurus ini');
    expect(html).not.toContain('<canvas');
  });

  it('showInfo=false menyembunyikan info, canvas tetap ada', () => {
    const html = renderToStaticMarkup(<MovePreview kind="jab" showInfo={false} />);
    expect(html).toContain('<canvas');
    expect(html).not.toContain('Pukulan tercepat');
  });

  it('mode loop (default): ada tombol Jeda + Ulangi, tanpa affordance main', () => {
    const html = renderToStaticMarkup(<MovePreview kind="jab" />);
    expect(html).toContain('Jeda preview');
    expect(html).toContain('Ulangi preview dari awal');
    expect(html).not.toContain('Mainkan preview');
  });

  it("mode tap: diam — affordance 'Ketuk untuk mainkan', tanpa tombol Jeda (tidak auto-play)", () => {
    const html = renderToStaticMarkup(<MovePreview kind="jab" mode="tap" />);
    expect(html).toContain('<canvas');
    expect(html).toContain('Mainkan preview Jab');
    expect(html).toContain('Ketuk untuk mainkan');
    expect(html).not.toContain('Jeda preview');
    expect(html).not.toContain('Putar preview');
  });

  it('mode tap, kind asing: pesan fallback, tidak crash, tanpa canvas', () => {
    const html = renderToStaticMarkup(<MovePreview kind="jurus_ngawur" mode="tap" />);
    expect(html).toContain('Preview belum tersedia untuk jurus ini');
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('Mainkan preview');
  });
});
