import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FighterAvatar from '../FighterAvatar';

/**
 * FighterAvatar: PP bust karakter petarung di chat.
 * Render lewat renderToStaticMarkup (node env, tanpa jsdom) — komponen
 * ini murni SVG + props, tanpa hook/effect.
 */

const fighter = {
  displayName: 'NOPE BOY',
  style: 'muay-thai',
  colors: {
    body: '#E10600',
    gloves: '#141210',
    shoes: '#FBF8F1',
    belt: 'none',
    headband: '#F5A623',
    weapon: '#8B5E34',
  },
  accessories: {
    head: 'crown',
    hands: 'boxing',
    feet: 'sneakers',
    body: 'none',
    belt: 'none',
    weapon: 'none',
  },
};

describe('FighterAvatar', () => {
  it('menggambar warna badan + aksesoris kepala fighter', () => {
    const html = renderToStaticMarkup(<FighterAvatar fighter={fighter} />);
    // Warna badan merah di bahu, warna ikat kepala di mahkota.
    expect(html).toContain('#E10600');
    expect(html).toContain('#F5A623');
    // Label aksesibel memakai nama fighter.
    expect(html).toContain('Foto profil NOPE BOY');
  });

  it('fighter tanpa aksesoris kepala: tidak menggambar mahkota/ikat kepala', () => {
    const plain = {
      ...fighter,
      colors: { ...fighter.colors, headband: 'none' },
      accessories: { ...fighter.accessories, head: 'none' },
    };
    const html = renderToStaticMarkup(<FighterAvatar fighter={plain} />);
    expect(html).toContain('#E10600');
    expect(html).not.toContain('#F5A623');
  });

  it('tanpa fighter: fallback siluet abu-abu + label username', () => {
    const html = renderToStaticMarkup(
      <FighterAvatar fighter={null} username="rangga" />,
    );
    // Siluet generik abu-abu, bukan warna fighter.
    expect(html).toContain('#6b655c');
    expect(html).not.toContain('#E10600');
    expect(html).toContain('Foto profil @rangga');
  });

  it('ukuran mengikuti prop size', () => {
    const html = renderToStaticMarkup(<FighterAvatar fighter={fighter} size={56} />);
    expect(html).toContain('width:56px');
    expect(html).toContain('height:56px');
  });
});
