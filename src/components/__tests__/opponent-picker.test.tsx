import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OpponentPicker, {
  OPPONENTS_PER_PAGE,
  pageWindow,
} from '../OpponentPicker';
import type { Fighter } from '../types';

/**
 * OpponentPicker: pagination daftar lawan 6/halaman.
 * Render lewat renderToStaticMarkup (node env, tanpa jsdom) — halaman
 * dipilih lewat prop initialPage, pilihan lewat prop selectedId.
 * Nama dibuat zero-padded ("Lawan 01") supaya tidak ada tabrakan
 * substring ("Lawan 1" adalah substring "Lawan 10").
 */

function makeFighter(i: number, fightsLeftToday?: number): Fighter {
  const n = String(i).padStart(2, '0');
  return {
    id: `fighter-${n}`,
    displayName: `Lawan ${n}`,
    igUsername: `lawan${n}`,
    style: 'boxing',
    record: { wins: i, losses: 0, draws: 0, kos: 0 },
    ...(fightsLeftToday !== undefined ? { fightsLeftToday } : {}),
  };
}

function makeFighters(count: number): Fighter[] {
  return Array.from({ length: count }, (_, i) => makeFighter(i + 1));
}

describe('OPPONENTS_PER_PAGE', () => {
  it('6 fighter per halaman', () => {
    expect(OPPONENTS_PER_PAGE).toBe(6);
  });
});

describe('pageWindow', () => {
  it('<= 7 halaman: semua nomor tampil', () => {
    expect(pageWindow(3, 1)).toEqual([1, 2, 3]);
    expect(pageWindow(7, 4)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('> 7 halaman: jendela 1 … kini±1 … akhir', () => {
    expect(pageWindow(10, 1)).toEqual([1, 2, '…', 10]);
    expect(pageWindow(10, 5)).toEqual([1, '…', 4, 5, 6, '…', 10]);
    expect(pageWindow(10, 10)).toEqual([1, '…', 9, 10]);
  });
});

describe('OpponentPicker pagination', () => {
  it('13 fighter → 3 halaman; halaman 1 menampilkan Lawan 01–06', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={makeFighters(13)}
        selectedId=""
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('Halaman 1 dari 3');
    expect(html).toContain('13 fighter');
    for (let i = 1; i <= 6; i++) {
      expect(html).toContain(`>Lawan ${String(i).padStart(2, '0')}<`);
    }
    expect(html).not.toContain('>Lawan 07<');
    expect(html).not.toContain('>Lawan 13<');
  });

  it('halaman 2 menampilkan Lawan 07–12', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={makeFighters(13)}
        selectedId=""
        onSelect={() => {}}
        initialPage={2}
      />,
    );
    expect(html).toContain('Halaman 2 dari 3');
    for (let i = 7; i <= 12; i++) {
      expect(html).toContain(`>Lawan ${String(i).padStart(2, '0')}<`);
    }
    expect(html).not.toContain('>Lawan 01<');
    expect(html).not.toContain('>Lawan 13<');
  });

  it('halaman terakhir tidak penuh: halaman 3 hanya Lawan 13', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={makeFighters(13)}
        selectedId=""
        onSelect={() => {}}
        initialPage={3}
      />,
    );
    expect(html).toContain('Halaman 3 dari 3');
    expect(html).toContain('>Lawan 13<');
    expect(html).not.toContain('>Lawan 12<');
  });

  it('12 fighter → tepat 2 halaman penuh', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={makeFighters(12)}
        selectedId=""
        onSelect={() => {}}
        initialPage={2}
      />,
    );
    expect(html).toContain('Halaman 2 dari 2');
    expect(html).toContain('>Lawan 12<');
  });

  it('halaman di luar jangkauan di-clamp ke halaman terakhir', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={makeFighters(13)}
        selectedId=""
        onSelect={() => {}}
        initialPage={99}
      />,
    );
    expect(html).toContain('Halaman 3 dari 3');
    expect(html).toContain('>Lawan 13<');
  });

  it('daftar kosong: pesan kosong, tanpa kontrol halaman', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker fighters={[]} selectedId="" onSelect={() => {}} />,
    );
    expect(html).toContain('Belum ada fighter lain yang bisa ditantang.');
    expect(html).not.toContain('Halaman');
  });
});

describe('OpponentPicker sisa jatah tarung', () => {
  it('kartu menampilkan "Sisa tarung: X/3" dari API', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={[makeFighter(1, 2), makeFighter(2, 3)]}
        selectedId=""
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('Sisa tarung: 2/3');
    expect(html).toContain('Sisa tarung: 3/3');
  });

  it('0/3 tetap bisa dipilih: ada radio-nya + catatan "bisa tarung besok"', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={[makeFighter(1, 0), makeFighter(2, 1)]}
        selectedId=""
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('Sisa tarung: 0/3');
    expect(html).toContain('habis hari ini, bisa tarung besok');
    // Radio lawan 0/3 tetap ada (tidak di-disable / disembunyikan).
    expect(html).toContain('value="fighter-01"');
    expect(html).toContain('>Lawan 01<');
  });

  it('tanpa fightsLeftToday (data lama): tidak ada baris sisa tarung', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={[makeFighter(1)]}
        selectedId=""
        onSelect={() => {}}
      />,
    );
    expect(html).not.toContain('Sisa tarung');
  });
});

describe('OpponentPicker pilihan bertahan pindah halaman', () => {
  it('pilihan di halaman lain: chip "Lawan terpilih" tampil di halaman 1', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={makeFighters(13)}
        selectedId="fighter-08"
        onSelect={() => {}}
        initialPage={1}
      />,
    );
    expect(html).toContain('Lawan terpilih');
    expect(html).toContain('Lawan 08');
    expect(html).toContain('(halaman 2)');
    expect(html).toContain('Lihat');
    // Halaman 1 tetap menampilkan Lawan 01–06; baris Lawan 08 tidak ada
    // (namanya hanya muncul di chip, bukan sebagai baris radio).
    expect(html).toContain('>Lawan 01<');
    expect(html).not.toContain('value="fighter-08"');
  });

  it('kembali ke halaman pilihan: barisnya terpilih (checked)', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={makeFighters(13)}
        selectedId="fighter-08"
        onSelect={() => {}}
        initialPage={2}
      />,
    );
    expect(html).toContain('>Lawan 08<');
    // Tepat satu radio checked, dan chip tidak tampil (pilihan sudah di halaman ini).
    expect(html.match(/checked=""/g)?.length).toBe(1);
    expect(html).not.toContain('Lawan terpilih');
    expect(html).toContain('border-amber-brand bg-amber-brand/10');
  });

  it('pilihan di halaman yang sama langsung terlihat terpilih', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={makeFighters(13)}
        selectedId="fighter-02"
        onSelect={() => {}}
        initialPage={1}
      />,
    );
    expect(html.match(/checked=""/g)?.length).toBe(1);
    expect(html).not.toContain('Lawan terpilih');
  });
});

describe('OpponentPicker mode multi-select (tantang banyak orang)', () => {
  it('mode multi: checkbox (bukan radio), chip "N lawan dipilih"', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={makeFighters(13)}
        multi
        selectedIds={['fighter-02', 'fighter-05']}
        onToggle={() => {}}
      />,
    );
    // Tidak ada radio sama sekali di mode multi.
    expect(html).not.toContain('type="radio"');
    expect(html).toContain('type="checkbox"');
    // Tepat 2 checkbox checked.
    expect(html.match(/checked=""/g)?.length).toBe(2);
    expect(html).toContain('2 lawan dipilih');
    expect(html).toContain('Lawan 02');
    expect(html).toContain('Lawan 05');
  });

  it('pilihan multi di halaman lain: chip menampilkan nama + halaman', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={makeFighters(13)}
        multi
        selectedIds={['fighter-08', 'fighter-09']}
        onToggle={() => {}}
        initialPage={1}
      />,
    );
    expect(html).toContain('2 lawan dipilih');
    expect(html).toContain('Lawan 08');
    expect(html).toContain('Lawan 09');
    expect(html).toContain('(halaman 2)');
    expect(html).toContain('Lihat');
    // Baris Lawan 08/09 tidak ada di halaman 1 (hanya di chip).
    expect(html).not.toContain('value="fighter-08"');
    expect(html).not.toContain('value="fighter-09"');
  });

  it('mode multi tanpa pilihan: tidak ada chip', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={makeFighters(13)}
        multi
        selectedIds={[]}
        onToggle={() => {}}
      />,
    );
    expect(html).not.toContain('lawan dipilih');
    expect(html).toContain('type="checkbox"');
  });

  it('mode single tidak kena pengaruh multi: radio + tanpa chip "lawan dipilih"', () => {
    const html = renderToStaticMarkup(
      <OpponentPicker
        fighters={makeFighters(13)}
        selectedId="fighter-02"
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('type="radio"');
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('lawan dipilih');
  });
});
