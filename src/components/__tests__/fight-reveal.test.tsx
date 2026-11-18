import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FightReveal from '../FightReveal';
import type { Fighter } from '../types';

/**
 * FightReveal: render lewat renderToStaticMarkup (node env, tanpa jsdom)
 * — effect countdown tidak jalan di sini; yang dites: identitas lawan,
 * grid deck (6 kartu + signature ditandai), tombol MULAI TARUNG +
 * countdown awal, dan fallback fight lama tanpa deck. Countdown
 * auto-tutup + tombol skip dites manual lewat screenshot (bukan jsdom).
 */
const OPPONENT: Fighter = {
  id: 'f-esje',
  displayName: 'esje',
  igUsername: 'syfqhmdi',
  style: 'muay-thai',
  rating: 1010,
  record: { wins: 8, losses: 8, draws: 0, kos: 2 },
  signatureMove: 'flyknee',
  tempo: 'agresif',
  colors: {
    body: '#06B6D4',
    gloves: '#141210',
    shoes: '#FBF8F1',
    belt: '#EAB308',
    headband: '#8B5E34',
    weapon: '#8B5E34',
  },
};

const ME: Fighter = {
  id: 'f-wira',
  displayName: 'wira',
  igUsername: 'bntgwirapt_',
  style: 'muay-thai',
  rating: 1081,
  record: { wins: 17, losses: 9, draws: 2, kos: 9 },
};

const DECK = ['jab', 'cross', 'hook', 'uppercut', 'lowkick', 'headkick'];

function render(props?: Partial<React.ComponentProps<typeof FightReveal>>) {
  return renderToStaticMarkup(
    <FightReveal
      opponent={OPPONENT}
      me={ME}
      opponentDeck={DECK}
      opponentSignature="flyknee"
      onDone={vi.fn()}
      {...props}
    />,
  );
}

describe('FightReveal', () => {
  it('menampilkan identitas lawan (nama, gaya, rating, rekor, jurus khas)', () => {
    const html = render();
    expect(html).toContain('esje');
    expect(html).toContain('Muay Thai');
    expect(html).toContain('Rating 1010');
    expect(html).toContain('Rekor 8M–8K');
    expect(html).toContain('2 KO');
    expect(html).toContain('Jurus khas: Flying Knee');
    expect(html).toContain('@syfqhmdi');
  });

  it('baris VS kamu kecil — nama sendiri tampil, lawan tetap dominan', () => {
    const html = render();
    expect(html).toContain('kamu —');
    expect(html).toContain('wira');
    expect(html).toContain('Rating 1081');
  });

  it('grid deck: 6 kartu + signature ditandai badge ★ Signature', () => {
    const html = render();
    for (const label of ['Jab', 'Cross', 'Hook', 'Uppercut', 'Low Kick']) {
      expect(html).toContain(label);
    }
    // Signature = kartu ke-7, label Flying Knee + badge penanda.
    expect(html).toContain('Flying Knee');
    expect(html).toContain('★ Signature');
    expect(html).toContain('Mainkan Semua (1x)');
  });

  it('tombol MULAI TARUNG + countdown awal 5 detik tampil', () => {
    const html = render();
    expect(html).toContain('MULAI TARUNG');
    expect(html).toContain('5 detik');
  });

  it('countdownSeconds kustom dipakai sebagai angka awal', () => {
    const html = render({ countdownSeconds: 3 });
    expect(html).toContain('3 detik');
  });

  it('fight lama tanpa deck: pesan fallback, tanpa kartu, tombol tetap ada', () => {
    const html = render({ opponentDeck: [], opponentSignature: null });
    expect(html).toContain('tidak tercatat');
    expect(html).not.toContain('Mainkan Semua');
    expect(html).toContain('MULAI TARUNG');
  });

  it('me=null: baris VS kamu tidak tampil', () => {
    const html = render({ me: null });
    expect(html).not.toContain('kamu —');
    expect(html).toContain('esje');
  });
});
