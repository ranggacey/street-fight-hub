import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DeckBuilder, { type DeckBuilderData } from '../DeckBuilder';

/**
 * DeckBuilder: kartu jurus per gaya + strip deck + signature + slot preview.
 * Render lewat renderToStaticMarkup (node env, tanpa jsdom) — state dipilih
 * lewat prop, aksi lewat callback (pola yang sama dengan tes komponen lain).
 */

const noop = () => {};

const deck: DeckBuilderData = {
  cards: ['jab', 'lowkick'],
  signature: null,
  style: 'tinju',
  availableKinds: [
    { kind: 'jab', label: 'Jab', style: 'tinju', styleLabel: 'Tinju', note: 'Pukulan tercepat, ukur jarak.' },
    { kind: 'cross', label: 'Cross', style: 'tinju', styleLabel: 'Tinju', note: 'Pukulan tenaga.' },
    { kind: 'uppercut', label: 'Uppercut', style: 'tinju', styleLabel: 'Tinju', note: 'Dari bawah.' },
    { kind: 'lowkick', label: 'Low Kick', style: 'muaythai', styleLabel: 'Muay Thai', note: 'Tebas paha luar.' },
    { kind: 'teep', label: 'Teep', style: 'muaythai', styleLabel: 'Muay Thai' },
  ],
  signatureOptions: [
    { kind: 'jab', label: 'Jab' },
    { kind: 'cross', label: 'Cross' },
    { kind: 'uppercut', label: 'Uppercut' },
  ],
};

function render(props: Partial<Parameters<typeof DeckBuilder>[0]> = {}) {
  return renderToStaticMarkup(
    <DeckBuilder
      deck={deck}
      deckCards={deck.cards}
      onToggleCard={noop}
      deckSignature={null}
      onSignatureChange={noop}
      onSave={noop}
      saving={false}
      deckMsg=""
      {...props}
    />,
  );
}

describe('DeckBuilder', () => {
  it('header deck + jumlah terpilih + progress bar', () => {
    const html = render();
    expect(html).toContain('Deck jurus');
    expect(html).toContain('2 / 6');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="2"');
  });

  it('kartu dikelompokkan per gaya, gaya fighter paling atas', () => {
    const html = render();
    expect(html).toContain('Tinju');
    expect(html).toContain('Muay Thai');
    expect(html).toContain('Gaya kamu');
    // Gaya fighter (Tinju) muncul sebelum Muay Thai.
    expect(html.indexOf('Tinju')).toBeLessThan(html.indexOf('Muay Thai'));
  });

  it('kartu terpilih bertanda jelas + nomor urut + strip deck', () => {
    const html = render();
    expect(html).toContain('Dipilih');
    expect(html).toContain('Deck saya');
    expect(html).toContain('aria-pressed="true"');
    // Nomor urut 1 (jab) dan 2 (lowkick) ada di badge/strip.
    expect(html).toContain('aria-label="Hapus Jab dari deck (urutan 1)"');
    expect(html).toContain('aria-label="Hapus Low Kick dari deck (urutan 2)"');
  });

  it('note jurus tampil satu baris di kartu', () => {
    const html = render();
    expect(html).toContain('Pukulan tercepat, ukur jarak.');
  });

  it('deck penuh: kartu belum dipilih non-aktif + ada penjelasan', () => {
    const full = ['jab', 'lowkick', 'cross', 'teep', 'hook', 'knee'];
    const html = render({ deckCards: full });
    expect(html).toContain('6 / 6');
    expect(html).toContain('Deck penuh');
    expect(html).toContain('Deck penuh — batalkan salah satu kartu');
    expect(html).toContain('deck sudah penuh (6/6)');
  });

  it('tanpa renderPreview: placeholder preview rapi di tiap kartu', () => {
    const html = render();
    expect(html).toContain('Ketuk untuk lihat gerakan');
  });

  it('dengan renderPreview: hasil prop dipakai di area preview, mode tap di kartu grid', () => {
    const html = render({
      renderPreview: (kind, opts) => <span>{`PREVIEW-${kind}-${opts?.mode}`}</span>,
    });
    expect(html).toContain('PREVIEW-jab-tap');
    expect(html).toContain('PREVIEW-lowkick-tap');
    expect(html).not.toContain('Ketuk untuk lihat gerakan');
  });

  it('kartu grid punya tombol perbesar ⤢ terpisah (bukan area preview sebagai tombol panel)', () => {
    const html = render({ renderPreview: (kind) => <span>{`PREVIEW-${kind}`}</span> });
    expect(html).toContain('aria-label="Perbesar preview Jab"');
    expect(html).toContain('aria-label="Perbesar preview Low Kick"');
    // "Lihat gerakan Jab" hanya muncul 1x — dari baris signature, bukan
    // lagi dari area preview kartu grid (area preview bukan tombol panel).
    expect(html.split('aria-label="Lihat gerakan Jab"').length - 1).toBe(1);
  });

  it('signature: opsi "Tanpa signature" + opsi gaya; yang sudah di deck non-aktif', () => {
    const html = render();
    expect(html).toContain('Tanpa signature');
    expect(html).toContain('Jurus khas (signature)');
    expect(html).toContain('1x/fight');
    // Jab ada di deck → tidak bisa jadi signature.
    expect(html).toContain('Jab sudah ada di kartu deck');
    expect(html).toContain('Sudah di deck — pilih jurus lain');
  });

  it('info dmg/target tampil di kartu kalau datanya ada', () => {
    const html = render({
      deck: {
        ...deck,
        availableKinds: deck.availableKinds.map((k) =>
          k.kind === 'jab' ? { ...k, dmg: 2, target: 'head' } : k,
        ),
      },
    });
    expect(html).toContain('DMG 2');
    expect(html).toContain('Target: Kepala');
  });

  it('tombol simpan + pesan hasil simpan', () => {
    const html = render({ deckMsg: 'Deck tersimpan.' });
    expect(html).toContain('Simpan deck');
    expect(html).toContain('Deck tersimpan.');
  });

  it('deck null: pesan memuat, bukan crash', () => {
    const html = render({ deck: null });
    expect(html).toContain('Memuat daftar jurus');
  });
});
