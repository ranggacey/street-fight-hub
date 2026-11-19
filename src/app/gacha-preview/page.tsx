'use client';

import { useState } from 'react';
import GachaMoveCard from '@/components/GachaMoveCard';
import MovePreview from '@/components/MovePreview';
import DeckBuilder, { type DeckBuilderData, type DeckKindOption } from '@/components/DeckBuilder';
import OpponentPicker from '@/components/OpponentPicker';
import KlasemenList from '@/components/KlasemenList';
import { getMoveMeta } from '@/lib/game/move-meta';
import type { Fighter, LeaderboardEntry } from '@/components/types';

/**
 * /gacha-preview — SHOWCASE revisi kartu gacha + search + Mainkan Semua.
 *
 * Bukan bagian deck produksi; halaman ini dipakai untuk mengecek
 * tampilan sebelum dipasang ke DeckBuilder/Tantangan/Klasemen.
 *
 * Isi halaman (semua data dari katalog engine / data mock mirip API):
 * 1. Kartu jurus — 2 TIER SAJA: Biasa (jab, cross) vs Special Move
 *    (flyknee, haymaker) + tombol "Mainkan Semua (1x)".
 * 2. DeckBuilder — kartu gacha yang sama, lengkap dengan pencarian
 *    jurus + Mainkan Semua + pilih/batal pilih (mock, tidak disimpan).
 * 3. Tantangan — OpponentPicker dengan kolom pencarian; contoh kedua
 *    memakai kata kunci "wira" yang sudah diketik (hasil terfilter).
 * 4. Klasemen — KlasemenList dengan kolom pencarian.
 *
 * Kartu diam di frame impact; ketuk gambar (atau tombol Mainkan Semua)
 * untuk memainkan gerakan satu putaran (MovePreview mode 'tap').
 */

const DEMO_CARDS = [
  { kind: 'jab' },
  { kind: 'cross' },
  { kind: 'flyknee' },
  { kind: 'haymaker' },
] as const;

const DECK_KINDS = [
  'jab', 'cross', 'hook', 'uppercut',
  'lowkick', 'teep', 'headkick', 'flyknee', 'knee',
  'haymaker', 'overhand', 'elbow',
];

function deckKinds(kinds: string[]): DeckKindOption[] {
  return kinds.map((kind) => {
    const m = getMoveMeta(kind);
    return { kind, label: m.label, style: m.style, styleLabel: m.styleLabel, note: m.note };
  });
}

const MOCK_FIGHTERS: Fighter[] = [
  { id: 'f-wira', displayName: 'wira', igUsername: 'bntgwirapt_', style: 'muay-thai', record: { wins: 17, losses: 9, draws: 2, kos: 9 }, fightsLeftToday: 3 },
  { id: 'f-esje', displayName: 'esje', igUsername: 'syfqhmdi', style: 'muay-thai', record: { wins: 8, losses: 8, draws: 0, kos: 2 }, fightsLeftToday: 5 },
  { id: 'f-batam', displayName: 'orang batam', igUsername: 'orangsigma', style: 'wrestling', record: { wins: 6, losses: 3, draws: 0, kos: 2 }, fightsLeftToday: 0 },
  { id: 'f-samson', displayName: 'samson', igUsername: 'samson666', style: 'silat', record: { wins: 0, losses: 0, draws: 1, kos: 0 }, fightsLeftToday: 4 },
  { id: 'f-kolama', displayName: 'kolama', igUsername: 'kolama', style: 'capoeira', record: { wins: 1, losses: 6, draws: 2, kos: 0 }, fightsLeftToday: 2 },
  { id: 'f-marbot', displayName: 'si marbot masjid', igUsername: 'ggonichol', style: 'muay-thai', record: { wins: 1, losses: 1, draws: 0, kos: 0 }, fightsLeftToday: 5 },
  { id: 'f-rey', displayName: 'Bg Rey', igUsername: 'reyfansimamora', style: 'boxing', record: { wins: 2, losses: 4, draws: 1, kos: 1 }, fightsLeftToday: 1 },
  { id: 'f-preman', displayName: 'Preman medan', igUsername: 'premanmedan', style: 'street', record: { wins: 1, losses: 1, draws: 0, kos: 0 }, fightsLeftToday: 5 },
];

const MOCK_KLASEMEN: LeaderboardEntry[] = [
  { rank: 1, fighterId: 'f-wira', displayName: 'wira', igUsername: 'bntgwirapt_', style: 'muay-thai', rating: 1081, record: { wins: 17, losses: 9, draws: 2, kos: 9 } },
  { rank: 2, fighterId: 'f-batam', displayName: 'orang batam', igUsername: 'orangsigma', style: 'wrestling', rating: 1061, record: { wins: 6, losses: 3, draws: 0, kos: 2 } },
  { rank: 3, fighterId: 'f-esje', displayName: 'esje', igUsername: 'syfqhmdi', style: 'muay-thai', rating: 1010, record: { wins: 8, losses: 8, draws: 0, kos: 2 } },
  { rank: 4, fighterId: 'f-samson', displayName: 'samson', igUsername: 'samson666', style: 'silat', rating: 997, record: { wins: 0, losses: 0, draws: 1, kos: 0 } },
  { rank: 5, fighterId: 'f-kolama', displayName: 'kolama', igUsername: 'kolama', style: 'capoeira', rating: 940, record: { wins: 1, losses: 6, draws: 2, kos: 0 } },
];

export default function GachaPreviewPage() {
  const [playAllSignal, setPlayAllSignal] = useState(0);
  const [deckCards, setDeckCards] = useState<string[]>(['jab', 'lowkick']);
  const [deckSignature, setDeckSignature] = useState<string | null>(null);

  // Demo: buka dengan ?mainkan=1 untuk langsung memainkan semua kartu
  // bagian 1 satu putaran (dipakai untuk screenshot keadaan "sedang
  // main"). Pola adjusting-state-during-render — BUKAN effect — supaya
  // tidak melanggar react-hooks/set-state-in-effect.
  const [autoPlayed, setAutoPlayed] = useState(false);
  if (
    !autoPlayed &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mainkan') === '1'
  ) {
    setAutoPlayed(true);
    setPlayAllSignal(1);
  }

  const deckData: DeckBuilderData = {
    cards: deckCards,
    signature: deckSignature,
    style: 'muay-thai',
    availableKinds: deckKinds(DECK_KINDS),
    signatureOptions: [
      { kind: 'haymaker', label: 'Haymaker' },
      { kind: 'flyknee', label: 'Flying Knee' },
    ],
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-3 py-6 sm:px-6">
      <header className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-brand">
          Showcase revisi — bukan bagian deck produksi
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-wide text-paper sm:text-4xl">
          Kartu jurus gaya gacha
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-paper-dim">
          Frame kartu dibuat dari CSS/SVG saja — tanpa gambar, tanpa GIF.
          Gerakan di dalam kartu tetap preview live dari engine Arena:
          kartu diam di frame impact, ketuk gambar untuk memainkan
          gerakannya satu putaran. Kartu jurus cuma ada DUA jenis: Biasa
          (frame slate, polos) dan Special Move (frame emas + ★ Spesial).
        </p>
      </header>

      {/* 1 — Kartu jurus: 2 tier + Mainkan Semua */}
      <section aria-labelledby="demo-cards-heading" className="mt-8">
        <h2 id="demo-cards-heading" className="font-display text-xl font-semibold uppercase tracking-wide text-paper">
          1. Kartu jurus — Biasa vs Special Move
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPlayAllSignal((s) => s + 1)}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-amber-brand px-4 text-sm font-bold text-[#1a1206] shadow-md shadow-black/40 transition-colors hover:bg-amber-300"
          >
            <span aria-hidden="true">▶</span> Mainkan Semua (1x)
          </button>
          <span className="text-xs leading-relaxed text-paper-mute">
            Memainkan semua gerakan di bawah sekaligus, masing-masing satu putaran.
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {DEMO_CARDS.map((c) => (
            <GachaMoveCard key={c.kind} kind={c.kind} playSignal={playAllSignal} />
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-paper-mute">
          Special Move = finisher (flyknee, headkick, finisher, stickchop)
          atau haymaker (Superman punch). Semua jurus lain = Biasa.
        </p>
      </section>

      {/* 2 — DeckBuilder dengan kartu gacha */}
      <section aria-labelledby="demo-deck-heading" className="mt-10">
        <h2 id="demo-deck-heading" className="font-display text-xl font-semibold uppercase tracking-wide text-paper">
          2. DeckBuilder — kartu gacha + pencarian + Mainkan Semua
        </h2>
        <p className="mt-1 text-sm text-paper-dim">
          Demo interaktif (mock, tidak disimpan): ketuk name plate untuk
          pilih/batal pilih, ketik di kolom pencarian untuk memfilter jurus.
        </p>
        <div className="mt-4">
          <DeckBuilder
            deck={deckData}
            deckCards={deckCards}
            onToggleCard={(kind) =>
              setDeckCards((prev) =>
                prev.includes(kind)
                  ? prev.filter((k) => k !== kind)
                  : prev.length >= 6
                    ? prev
                    : [...prev, kind],
              )
            }
            deckSignature={deckSignature}
            onSignatureChange={setDeckSignature}
            onSave={() => {}}
            saving={false}
            deckMsg=""
            renderPreview={(kind, opts) => (
              <MovePreview
                kind={kind}
                mode={opts?.mode ?? 'loop'}
                showInfo={false}
                size="sm"
                isSpecial={opts?.isSpecial}
                playSignal={opts?.playSignal}
              />
            )}
          />
        </div>
      </section>

      {/* 3 — Tantangan: pencarian lawan */}
      <section aria-labelledby="demo-tantangan-heading" className="mt-10">
        <h2 id="demo-tantangan-heading" className="font-display text-xl font-semibold uppercase tracking-wide text-paper">
          3. Tantangan — cari lawan
        </h2>
        <p className="mt-1 text-sm text-paper-dim">
          Kolom pencarian di atas daftar lawan (nama, gaya, atau username
          IG). Contoh kedua sudah diketik “wira” — hasilnya terfilter.
        </p>
        <div className="mt-4 space-y-6">
          <div className="glass p-4">
            <p className="mb-3 text-sm font-semibold text-paper">Daftar lawan (kosong)</p>
            <OpponentPicker fighters={MOCK_FIGHTERS} />
          </div>
          <div className="glass p-4">
            <p className="mb-3 text-sm font-semibold text-paper">Daftar lawan — kata kunci “wira”</p>
            <OpponentPicker fighters={MOCK_FIGHTERS} initialQuery="wira" />
          </div>
        </div>
      </section>

      {/* 4 — Klasemen: pencarian fighter */}
      <section aria-labelledby="demo-klasemen-heading" className="mt-10">
        <h2 id="demo-klasemen-heading" className="font-display text-xl font-semibold uppercase tracking-wide text-paper">
          4. Klasemen — cari fighter
        </h2>
        <p className="mt-1 text-sm text-paper-dim">
          Urutan tetap dari server (rating Elo); pencarian hanya
          menyembunyikan baris yang tidak cocok.
        </p>
        <div className="mt-4">
          <KlasemenList entries={MOCK_KLASEMEN} />
        </div>
      </section>
    </main>
  );
}
