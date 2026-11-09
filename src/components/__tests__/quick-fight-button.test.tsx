import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuickFightFab } from '../QuickFightButton';

/**
 * QuickFightFab: tombol + panel Gas Tarung (presentasional).
 * Render lewat renderToStaticMarkup (node env, tanpa jsdom) — state
 * dipilih lewat prop, aksi lewat callback.
 */

const noop = () => {};

function render(state: Parameters<typeof QuickFightFab>[0]['state'], errorMessage?: string) {
  return renderToStaticMarkup(
    <QuickFightFab
      state={state}
      errorMessage={errorMessage}
      onGas={noop}
      onRetry={noop}
      onOpenChallenge={noop}
      onCreateFighter={noop}
      onClose={noop}
    />,
  );
}

describe('QuickFightFab', () => {
  it('idle: tombol besar GAS TARUNG', () => {
    const html = render('idle');
    expect(html).toContain('GAS TARUNG');
    expect(html).toContain('aria-label="Gas Tarung');
  });

  it('searching: tombol nonaktif "Mencari lawan…"', () => {
    const html = render('searching');
    expect(html).toContain('Mencari lawan');
    expect(html).toContain('disabled');
    expect(html).not.toContain('GAS TARUNG');
  });

  it('no_opponent: ajakan buat tantangan terbuka + coba lagi', () => {
    const html = render('no_opponent');
    expect(html).toContain('Belum ada lawan sekarang');
    expect(html).toContain('Buat Tantangan Terbuka');
    expect(html).toContain('Coba Lagi');
  });

  it('daily_limit: jatah habis, reset tengah malam WIB', () => {
    const html = render('daily_limit');
    expect(html).toContain('Jatah tarung hari ini habis');
    expect(html).toContain('reset tengah malam WIB');
  });

  it('no_fighter: ajakan buat fighter', () => {
    const html = render('no_fighter');
    expect(html).toContain('Buat fighter dulu');
    expect(html).toContain('Buat Fighter');
  });

  it('error: menampilkan pesan error + coba lagi', () => {
    const html = render('error', 'Server sibuk, coba sebentar lagi.');
    expect(html).toContain('Gagal mencari lawan');
    expect(html).toContain('Server sibuk, coba sebentar lagi.');
    expect(html).toContain('Coba Lagi');
  });
});
