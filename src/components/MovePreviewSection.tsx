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
import { STYLE_LABELS, styleColor } from '@/components/api';
import MovePreview from '@/components/MovePreview';
import { TRAINING_STYLES } from '@/lib/game/training-config';
import { getMoveMeta, isFinisherMove, movesForStyle, targetLabel } from '@/lib/game/move-meta';

/** Angka kartu ala Indonesia: bulat tampil bulat, desimal 1 angka (2,5). */
function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {moves.map((m) => {
            // Kartu galeri = kartu TCG yang sama dengan DeckBuilder: art
            // 4/3 + pita nama + badge stat dari katalog engine, border
            // warna gaya, frame emas untuk finisher. Logika tap-to-play
            // tidak berubah (MovePreview mode 'tap', showInfo dimatikan
            // supaya nama/stat hanya tampil sekali, di pita kartu ini).
            const meta = getMoveMeta(m.kind);
            const accent = styleColor(m.style);
            const gold = isFinisherMove(m.kind);
            const borderColor = gold ? '#FDE047' : accent;
            return (
              <article
                key={m.kind}
                style={{ borderColor }}
                className={`relative flex flex-col overflow-hidden rounded-2xl border-2 bg-zinc-900 shadow-md shadow-black/40 ${
                  gold ? 'shadow-lg shadow-yellow-400/10 ring-1 ring-yellow-300/50' : ''
                }`}
              >
                <div className="relative m-2 mb-0 overflow-hidden rounded-lg ring-1 ring-white/15">
                  <MovePreview kind={m.kind} size="sm" mode="tap" showInfo={false} />
                </div>
                <div
                  className="mx-2 mt-2 rounded-lg border-l-4 bg-black/40 px-2.5 py-1.5 ring-1 ring-white/10"
                  style={{ borderLeftColor: borderColor }}
                >
                  <p className="font-display text-base font-semibold uppercase leading-tight tracking-wide text-white">
                    {m.label}
                  </p>
                  <p className="text-[11px] font-medium text-zinc-400">
                    {m.styleLabel}
                    {gold ? ' • ★ Finisher' : meta.isSpecial ? ' • ★ Spesial' : ''}
                  </p>
                </div>
                {meta.found && (meta.dmg > 0 || meta.target || meta.power > 0) && (
                  <div className="mt-1.5 flex flex-wrap gap-1 px-2">
                    {meta.dmg > 0 && (
                      <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-400">
                        DMG {fmtNum(meta.dmg)}
                      </span>
                    )}
                    {meta.target ? (
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-zinc-300">
                        🎯 {targetLabel(meta.target)}
                      </span>
                    ) : null}
                    {meta.power > 0 && (
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-zinc-300">
                        STA {fmtNum(meta.power * 6)}
                      </span>
                    )}
                  </div>
                )}
                {m.note ? (
                  <p className="mt-1.5 line-clamp-2 px-2 pb-3 text-xs leading-relaxed text-zinc-400">
                    {m.note}
                  </p>
                ) : null}
              </article>
            );
          })}
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
