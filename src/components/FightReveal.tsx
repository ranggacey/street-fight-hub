'use client';

import { useEffect, useRef, useState } from 'react';
import FighterPreview from './FighterPreview';
import GachaMoveCard from './GachaMoveCard';
import { moveLabel, styleLabel } from './api';
import type { Fighter, FighterColors } from './types';

/**
 * FightReveal — layar reveal lawan sebelum fight dimulai.
 *
 * PRESENTASI SAJA: deck yang ditampilkan sudah terkunci saat fight
 * dibuat (config.opts.deck dari buildFightSetup) — pemain TIDAK BISA
 * mengubah deck setelah melihat deck lawan (tidak ada UI untuk itu,
 * dan komponen ini tidak memanggil API apa pun).
 *
 * Fokus LAWAN: preview stickman + nama/gaya/rating/rekor, lalu grid
 * deck lawan (6 kartu + signature yang ditandai) memakai GachaMoveCard
 * yang sama seperti DeckBuilder. Baris "VS kamu" hanya kecil di bawah
 * hero lawan. Overlay menutupi seluruh layar (fixed) sampai countdown
 * habis atau tombol MULAI TARUNG ditekan — arena di bawahnya tetap
 * ter-mount supaya handshake postMessage sfa-ready/sfa-config tidak
 * terganggu; user baru bisa klik "Tarung" di dalam arena setelah
 * overlay hilang.
 */
export interface FightRevealProps {
  /** Lawan — fighter yang deck-nya di-reveal. */
  opponent: Fighter;
  /** Fighter sendiri (baris kecil "VS kamu"); null = sembunyikan. */
  me: Fighter | null;
  /** 6 kind kartu deck lawan (dari config.opts.deck; kosong = fight lama). */
  opponentDeck: string[];
  /** Signature lawan (Fighter.signatureMove — cermin FighterDeck.signature). */
  opponentSignature: string | null;
  /** Detik countdown sebelum auto-tutup. Default 5. */
  countdownSeconds?: number;
  /** Dipanggil sekali saat countdown habis atau tombol ditekan. */
  onDone: () => void;
}

const DEFAULT_COLORS: FighterColors = {
  body: '#E10600',
  gloves: '#141210',
  shoes: '#FBF8F1',
  belt: '#EAB308',
  headband: '#8B5E34',
  weapon: '#8B5E34',
};

function recordLabel(f: Fighter): string {
  const r = f.record;
  if (!r) return 'Rekor 0M–0K';
  const draws = r.draws ? `–${r.draws}S` : '';
  const kos = r.kos ? ` • ${r.kos} KO` : '';
  return `Rekor ${r.wins ?? 0}M–${r.losses ?? 0}K${draws}${kos}`;
}

export default function FightReveal({
  opponent,
  me,
  opponentDeck,
  opponentSignature,
  countdownSeconds = 5,
  onDone,
}: FightRevealProps) {
  const [remaining, setRemaining] = useState(countdownSeconds);
  const [playAllSignal, setPlayAllSignal] = useState(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  // Simpan onDone terbaru tanpa mengikat ulang effect countdown
  // (parent boleh kirim arrow inline yang identitasnya berubah).
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Countdown 1 detik; habis -> onDone sekali. Kunci scroll body
  // selama overlay tampil (modal), kembalikan saat unmount.
  useEffect(() => {
    if (doneRef.current) return;
    const timer = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          if (!doneRef.current) {
            doneRef.current = true;
            onDoneRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearInterval(timer);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const dismiss = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  const colors: FighterColors = { ...DEFAULT_COLORS, ...opponent.colors };
  const hasDeck = opponentDeck.length > 0 || !!opponentSignature;
  // Signature tampil PALING DEPAN di grid, ditandai badge emas.
  const gridKinds: { kind: string; isSignature: boolean }[] = [
    ...(opponentSignature
      ? [{ kind: opponentSignature, isSignature: true }]
      : []),
    ...opponentDeck.map((kind) => ({ kind, isSignature: false })),
  ];

  // z-[60]: HARUS di atas tombol mengambang FloatingChat +
  // QuickFightButton (keduanya z-50 di layout root) supaya bar sticky
  // MULAI TARUNG tidak tertutup di HP.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Reveal lawan: ${opponent.displayName}`}
      className="fixed inset-0 z-[60] overflow-y-auto bg-ink-950/95 backdrop-blur-sm"
    >
      <div className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-6">
        <header className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-brand">
            Lawanmu sudah menunggu
          </p>
          <h2 className="mt-1 font-display text-3xl uppercase leading-tight tracking-wide text-paper sm:text-4xl">
            Kenali <span className="text-amber-brand">Lawanmu</span>
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-paper-dim">
            Ini deck yang akan dia bawa ke arena. Deck sudah terkunci —
            tidak bisa diubah setelah reveal.
          </p>
        </header>

        {/* Hero lawan: preview stickman + identitas. */}
        <section
          aria-label={`Lawan: ${opponent.displayName}`}
          className="glass mt-5 p-4 sm:p-5"
        >
          <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <div className="mx-auto w-40 sm:mx-0 sm:w-full">
              <FighterPreview
                colors={colors}
                accessories={opponent.accessories}
                name={opponent.displayName}
                hideCaption
              />
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <p className="break-words font-display text-3xl uppercase leading-tight tracking-wide text-paper sm:text-4xl">
                {opponent.displayName}
              </p>
              <p className="mt-1 text-sm font-semibold text-paper-dim">
                {styleLabel(opponent.style, opponent.styleOther)}
                {opponent.igUsername ? (
                  <span className="text-paper-mute">
                    {' '}
                    • @{opponent.igUsername}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-paper-dim">
                Rating {opponent.rating ?? 1000} • {recordLabel(opponent)}
              </p>
              {opponentSignature ? (
                <p className="mt-2 inline-flex min-h-[32px] items-center rounded-full bg-amber-brand/15 px-3 py-1 text-xs font-bold text-amber-brand ring-1 ring-amber-brand/40">
                  ★ Jurus khas: {moveLabel(opponentSignature)}
                </p>
              ) : null}
              {opponent.tempo ? (
                <p className="mt-2 text-xs capitalize text-paper-mute">
                  Tempo: {opponent.tempo}
                </p>
              ) : null}
            </div>
          </div>

          {/* Baris kecil "VS kamu" — lawan tetap dominan. */}
          {me ? (
            <p className="mt-4 border-t border-white/10 pt-3 text-center text-sm text-paper-dim sm:text-left">
              <span className="font-display text-lg text-amber-brand">
                VS{' '}
              </span>
              kamu —{' '}
              <span className="font-semibold text-paper">
                {me.displayName}
              </span>{' '}
              <span className="text-paper-mute">
                ({styleLabel(me.style, me.styleOther)} • Rating{' '}
                {me.rating ?? 1000})
              </span>
            </p>
          ) : null}
        </section>

        {/* Deck lawan: 6 kartu + signature (GachaMoveCard). */}
        <section aria-label="Deck lawan" className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-display text-2xl uppercase tracking-wide text-paper">
                Deck <span className="text-amber-brand">Lawan</span>
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-paper-mute">
                {hasDeck
                  ? 'Kartu berbingkai emas = Special Move. Kartu pertama bertanda ★ Signature (1x/fight).'
                  : 'Deck lawan tidak tercatat untuk fight ini (fight lama, sebelum sistem deck).'}
              </p>
            </div>
            {hasDeck ? (
              <button
                type="button"
                onClick={() => setPlayAllSignal((s) => s + 1)}
                className="flex min-h-11 items-center gap-2 rounded-xl bg-amber-brand px-4 text-sm font-bold text-[#1a1206] shadow-md shadow-black/40 transition-colors hover:bg-amber-300"
              >
                <span aria-hidden="true">▶</span> Mainkan Semua (1x)
              </button>
            ) : null}
          </div>

          {hasDeck ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {gridKinds.map(({ kind, isSignature }, i) => (
                <div key={`${kind}-${i}`} className="relative">
                  {isSignature ? (
                    <span className="absolute -top-2.5 left-2 z-20 rounded-full bg-amber-brand px-2 py-0.5 text-[11px] font-bold text-[#1a1206] shadow-md shadow-black/40">
                      ★ Signature
                    </span>
                  ) : null}
                  <GachaMoveCard
                    kind={kind}
                    fighterColors={{
                      body: colors.body,
                      gloves: colors.gloves,
                      shoes: colors.shoes,
                    }}
                    playSignal={playAllSignal}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-paper-dim">
              Tidak ada kartu deck yang bisa ditampilkan.
            </p>
          )}
        </section>

        {/* Bar menempel di bawah: countdown + tombol mulai. z-20 HARUS
            ada: kartu gacha punya art window relative z-10 yang kalau
            tidak, menutupi bar saat bar menempel di atas grid kartu
            (terbukti elementFromPoint di tengah tombol = CANVAS). */}
        <div className="sticky bottom-0 z-20 -mx-3 mt-6 border-t border-white/10 bg-ink-950/95 px-3 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-brand font-display text-2xl text-[#1a1206]"
            >
              {remaining}
            </span>
            <p className="min-w-0 flex-1 text-xs leading-snug text-paper-dim sm:text-sm">
              Fight mulai otomatis dalam{' '}
              <span className="font-bold text-paper">
                {remaining} detik
              </span>
              . Siap?
            </p>
            <button
              type="button"
              onClick={dismiss}
              className="min-h-[48px] shrink-0 rounded-xl bg-amber-brand px-5 text-sm font-bold text-on-amber transition-transform hover:scale-[1.02] sm:px-8 sm:text-base"
            >
              MULAI TARUNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
