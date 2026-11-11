'use client';

/**
 * MovePreviewSection — Galeri preview jurus di /testing-training.
 *
 * Menampilkan daftar jurus dua gaya pilihan, masing-masing dengan
 * animasi gerakannya (MovePreview) + catatan teknik + info damage.
 * Pemilih gaya di sini BERDIRI SENDIRI (state lokal, default sama
 * dengan TrainingArena: Muay Thai vs Taekwondo) — sengaja tidak
 * mengangkat state TrainingArena supaya halaman itu tidak berubah.
 *
 * Kartu galeri memakai MovePreview mode 'tap': diam di frame impact
 * sampai diketuk, lalu main satu putaran dan diam lagi. Puluhan kartu
 * tidak menganimasikan terus-menerus — jauh lebih ringan daripada
 * mode loop (tanpa rAF saat diam), dan galeri tidak terasa ramai.
 */
import { useState } from 'react';
import { STYLE_LABELS } from '@/components/api';
import MovePreview from '@/components/MovePreview';
import { TRAINING_STYLES } from '@/lib/game/training-config';
import { movesForStyle } from '@/lib/game/move-meta';

export default function MovePreviewSection() {
  const [leftStyle, setLeftStyle] = useState('muay-thai');
  const [rightStyle, setRightStyle] = useState('taekwondo');

  const renderColumn = (side: 'Kiri' | 'Kanan', style: string) => {
    const moves = movesForStyle(style);
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white">
          {side} — {STYLE_LABELS[style] ?? style} ({moves.length} jurus)
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {moves.map((m) => (
            <MovePreview key={m.kind} kind={m.kind} size="sm" mode="tap" />
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-zinc-900/60 p-4">
      <div>
        <h2 className="text-base font-bold text-white">
          Preview Gerakan Jurus
        </h2>
        <p className="text-xs leading-relaxed text-zinc-400">
          Tiap jurus ditampilkan gerakannya (bukan cuma nama) — gambar diam
          di momen impact, ketuk untuk memainkan satu putaran animasinya
          dari keyframe teknik Arena, lengkap dengan catatan teknik,
          damage, dan target. Jurus bertanda ★ Spesial menampilkan cincin
          impact khasnya.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-300">
          Gaya kiri
          <select
            value={leftStyle}
            onChange={(e) => setLeftStyle(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white"
          >
            {TRAINING_STYLES.map((s) => (
              <option key={s} value={s}>
                {STYLE_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-300">
          Gaya kanan
          <select
            value={rightStyle}
            onChange={(e) => setRightStyle(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white"
          >
            {TRAINING_STYLES.map((s) => (
              <option key={s} value={s}>
                {STYLE_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {renderColumn('Kiri', leftStyle)}
      {renderColumn('Kanan', rightStyle)}
    </section>
  );
}
