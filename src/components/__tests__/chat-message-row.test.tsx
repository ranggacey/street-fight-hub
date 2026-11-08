import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChatMessageRow from '../ChatMessageRow';
import type { ChatMessageItem } from '../types';

/**
 * ChatMessageRow: baris pesan chat — nama fighter tampil, username
 * TIDAK tampil kalau ada fighter; username hanya fallback.
 * Render lewat renderToStaticMarkup (node env, tanpa jsdom).
 */

const withFighter: ChatMessageItem = {
  id: 'm1',
  userId: 'u1',
  text: 'Siapa berani lawan aku?',
  createdAt: '2026-11-08T05:00:00.000Z',
  username: 'rangga',
  fighter: {
    displayName: 'NOPE BOY',
    style: 'muay-thai',
    colors: {
      body: '#E10600',
      gloves: '#141210',
      shoes: '#FBF8F1',
      belt: 'none',
      headband: 'none',
      weapon: '#8B5E34',
    },
    accessories: {
      head: 'none',
      hands: 'boxing',
      feet: 'sneakers',
      body: 'none',
      belt: 'none',
      weapon: 'none',
    },
  },
};

const withoutFighter: ChatMessageItem = {
  id: 'm2',
  userId: 'u2',
  text: 'Halo semua!',
  createdAt: '2026-11-08T05:01:00.000Z',
  username: 'penonton99',
  fighter: null,
};

describe('ChatMessageRow', () => {
  it('pengirim ber-fighter: nama fighter tampil, username tidak tampil', () => {
    const html = renderToStaticMarkup(
      <ChatMessageRow message={withFighter} isOwn={false} />,
    );
    expect(html).toContain('NOPE BOY');
    expect(html).toContain('Siapa berani lawan aku?');
    expect(html).not.toContain('@rangga');
    expect(html).not.toContain('rangga');
    // Gaya fighter tampil sebagai konteks.
    expect(html).toContain('Muay Thai');
  });

  it('pengirim tanpa fighter: username tampil sebagai fallback', () => {
    const html = renderToStaticMarkup(
      <ChatMessageRow message={withoutFighter} isOwn={false} />,
    );
    expect(html).toContain('@penonton99');
    expect(html).toContain('Halo semua!');
  });

  it('pesan sendiri: bubble amber, pesan orang lain: bubble kaca gelap', () => {
    const own = renderToStaticMarkup(
      <ChatMessageRow message={withFighter} isOwn />,
    );
    const other = renderToStaticMarkup(
      <ChatMessageRow message={withFighter} isOwn={false} />,
    );
    expect(own).toContain('bg-amber-brand');
    expect(own).toContain('flex-row-reverse');
    expect(other).toContain('bg-white/5');
    expect(other).not.toContain('bg-amber-brand');
  });
});
