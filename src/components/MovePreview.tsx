'use client';

/**
 * MovePreview — Preview gerakan SATU jurus / special move di canvas kecil.
 *
 * Bukan gambar statis dan bukan video MP4: animasi loop diambil dari
 * keyframe teknik Arena yang sama dengan engine tarung
 * (`techniquePose` di fight-engine/techniques.js) dan digambar
 * frame-per-frame lewat requestAnimationFrame oleh
 * `drawPreviewFrame` (fight-engine/move-preview-anim.ts).
 *
 * Dua mode putar (prop `mode`):
 * - 'loop' (default): animasi berulang saat terlihat — perilaku galeri
 *   lama. Klik gambar → mode diperbesar (overlay).
 * - 'tap': kartu DIAM di satu frame representatif (momen impact, dt = 0:
 *   tangan/kaki terulur penuh, paling menggambarkan jurusnya) dan TIDAK
 *   menjalankan rAF sama sekali saat diam. Ketuk gambar → animasi jalan
 *   SATU putaran penuh, lalu kembali diam di frame impact. Dipakai kartu
 *   jurus di deck builder / galeri supaya puluhan kartu tidak
 *   menganimasikan terus-menerus (hemat CPU, tidak ramai).
 *
 * Hemat CPU: rAF hanya jalan saat kartu terlihat (IntersectionObserver)
 * dan saat tidak di-pause; rAF di-cancel saat unmount dan saat kembali
 * diam (mode tap). Tiap preview hanya satu canvas 360x270 — jauh lebih
 * ringan daripada iframe Arena.
 *
 * Efek cincin impact mengikuti aturan film.js `specialForAttack`:
 * tampil untuk kind finisher, atau saat dipasang sebagai jurus khas
 * (prop `isSpecial` / `signature`). Warna cincin dari special-fx.js
 * (mis. haymaker #7DD3FC, flyknee #F97316, finisher #EF4444).
 */
import { useEffect, useRef, useState } from 'react';
import {
  getMoveMeta,
  getSpecialRing,
  hasTechniqueKeys,
  isFinisherMove,
  targetLabel,
} from '@/lib/game/move-meta';
import {
  PREVIEW_H,
  PREVIEW_W,
  drawPreviewFrame,
  moveLoopDurationSec,
  previewWindupSec,
} from '@/lib/fight-engine/move-preview-anim';

export interface MovePreviewColors {
  body: string;
  gloves: string;
  shoes: string;
}

export interface MovePreviewProps {
  /** Kunci kind jurus (mis. 'jab', 'headkick', 'haymaker', 'flyknee'). */
  kind: string;
  /** Label tampilan — default dari katalog moves.js. */
  label?: string;
  /** Gaya pemilik jurus (untuk chip) — default dari katalog. */
  style?: string;
  /** Catatan teknik — default dari katalog moves.js. */
  note?: string;
  /** Damage dasar — default dari katalog moves.js. */
  dmg?: number;
  /** Target ('head' | 'body' | 'leg') — default dari katalog. */
  target?: string;
  /**
   * Tampilkan efek cincin spesial saat impact. Default: true hanya
   * untuk kind finisher (aturan film.js). Set true untuk signature move.
   */
  isSpecial?: boolean;
  /** Alias isSpecial: jurus ini jurus khas fighter (efek cincin tampil). */
  signature?: boolean;
  /** Warna stickman — default merah standar (#C8102E). */
  fighterColors?: Partial<MovePreviewColors>;
  /** Ukuran kartu: sm (240px) | md (320px) | lg (420px). Default md. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Mode putar — 'loop' (default): animasi berulang saat terlihat.
   * 'tap': diam di frame impact sampai diketuk, lalu main satu putaran
   * penuh dan kembali diam. `autoPlay` hanya berlaku di mode 'loop'.
   */
  mode?: 'loop' | 'tap';
  /** Putar otomatis saat terlihat (mode 'loop' saja). Default true. */
  autoPlay?: boolean;
  /** Tampilkan label + catatan + info di bawah canvas. Default true. */
  showInfo?: boolean;
  /** Tampilkan lawan dummy abu-abu sebagai sasaran. Default true. */
  showDefender?: boolean;
  className?: string;
}

const DEFAULT_COLORS: MovePreviewColors = {
  body: '#C8102E',
  gloves: '#141210',
  shoes: '#FBF8F1',
};

const SIZE_CLASS: Record<NonNullable<MovePreviewProps['size']>, string> = {
  sm: 'max-w-[240px]',
  md: 'max-w-[320px]',
  lg: 'max-w-[420px]',
};

export default function MovePreview(props: MovePreviewProps) {
  const meta = getMoveMeta(props.kind);
  const label = props.label ?? meta.label;
  const note = props.note ?? meta.note;
  const dmg = props.dmg ?? meta.dmg;
  const target = props.target ?? meta.target;
  const styleLabel = props.style ?? meta.styleLabel;

  const showRing =
    props.isSpecial ?? props.signature ?? isFinisherMove(props.kind);
  const ring = getSpecialRing(props.kind) ?? {
    ringColor: '#EF4444',
    ringSize: 1.5,
  };
  const colors: MovePreviewColors = {
    ...DEFAULT_COLORS,
    ...props.fighterColors,
  };
  const loopDuration = moveLoopDurationSec(props.kind);
  const canAnimate = hasTechniqueKeys(props.kind);
  const isTap = props.mode === 'tap';
  /**
   * Frame diam mode tap: momen impact (dt = 0, loopT = windup).
   * Anggota gerak yang memukul terulur penuh ke sasaran — pose yang
   * paling menggambarkan jurusnya (jab: tangan depan lurus ke depan;
   * headkick: kaki terangkat tinggi; grapple: tangan meraih). Guard
   * pose sengaja TIDAK dipakai: semua jurus terlihat sama di guard.
   */
  const staticLoopT = previewWindupSec(props.kind);

  const [playing, setPlaying] = useState(props.autoPlay !== false);
  const [tapPlaying, setTapPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopTRef = useRef(0);
  const tapPlayedRef = useRef(0);

  // Reset putaran saat jurus / mode berganti. Mode tap mulai dari frame
  // impact (diam), bukan dari guard.
  // State di-reset SAAT RENDER (pola "adjusting state when props change"
  // dari React docs) — BUKAN di effect — supaya tidak memicu cascading
  // render / lint react-hooks/set-state-in-effect.
  const [prevKindMode, setPrevKindMode] = useState({
    kind: props.kind,
    mode: props.mode,
  });
  if (prevKindMode.kind !== props.kind || prevKindMode.mode !== props.mode) {
    setPrevKindMode({ kind: props.kind, mode: props.mode });
    setTapPlaying(false);
    setHasPlayed(false);
  }

  // Reset posisi putaran (ref saja — bukan state) saat jurus / mode
  // berganti. Ref boleh diubah di effect; setState tidak boleh.
  useEffect(() => {
    loopTRef.current = isTap ? staticLoopT : 0;
    tapPlayedRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.kind, props.mode]);

  // Hanya animasikan saat kartu terlihat di viewport.
  // (Diobservasi ulang saat expanded berubah: kartu pindah ke overlay.)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [expanded]);

  // Gambar frame + loop animasi. Mode tap yang diam TIDAK menjalankan
  // rAF sama sekali — hanya satu draw frame impact. rAF jalan hanya
  // saat (mode loop + playing) atau (mode tap + tapPlaying), dan
  // di-cancel saat unmount / saat kembali diam / saat tak terlihat.
  useEffect(() => {
    if (!canAnimate) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(
      2,
      typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    );
    canvas.width = PREVIEW_W * dpr;
    canvas.height = PREVIEW_H * dpr;

    let raf = 0;
    let last = performance.now();
    const draw = (loopT: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPreviewFrame({
        ctx,
        width: PREVIEW_W,
        height: PREVIEW_H,
        kind: props.kind,
        loopT,
        colors,
        showRing,
        ringColor: ring.ringColor,
        ringSize: ring.ringSize,
        showDefender: props.showDefender !== false,
      });
    };
    // Gambar satu frame awal supaya canvas tidak kosong saat diam:
    // mode tap → frame impact; mode loop → posisi terakhir.
    draw(isTap && !tapPlaying ? staticLoopT : loopTRef.current);
    const shouldRun = isTap ? tapPlaying : playing;
    if (!shouldRun || !visible) return;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      loopTRef.current =
        (loopTRef.current + dt) % moveLoopDurationSec(props.kind);
      if (isTap) {
        tapPlayedRef.current += dt;
        if (tapPlayedRef.current >= loopDuration) {
          // Satu putaran penuh selesai → kembali diam di frame impact.
          draw(staticLoopT);
          setHasPlayed(true);
          setTapPlaying(false);
          return;
        }
      }
      draw(loopTRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.kind,
    props.mode,
    playing,
    tapPlaying,
    visible,
    canAnimate,
    showRing,
    ring.ringColor,
    ring.ringSize,
    colors.body,
    colors.gloves,
    colors.shoes,
    props.showDefender,
    expanded, // kartu pindah DOM saat expand → ikat ulang ke canvas baru
  ]);

  const replay = () => {
    loopTRef.current = 0;
    setPlaying(true);
  };

  /** Mode tap: mainkan SATU putaran penuh dari guard, lalu diam lagi. */
  const playOnce = () => {
    if (!canAnimate || tapPlaying) return;
    loopTRef.current = 0;
    tapPlayedRef.current = 0;
    setTapPlaying(true);
  };

  const card = (
    <div
      className={`w-full ${expanded ? 'max-w-[560px]' : SIZE_CLASS[props.size ?? 'md']} ${props.className ?? ''}`}
    >
      <div
        ref={wrapRef}
        className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900"
      >
        <div className="relative">
          {canAnimate ? (
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Preview gerakan ${label}`}
              className={`block h-auto w-full ${isTap ? 'cursor-pointer' : 'cursor-zoom-in'}`}
              style={{ aspectRatio: '4 / 3' }}
              onClick={() => {
                // Mode tap: ketuk = mainkan animasi DI TEMPAT (bukan
                // memperbesar). Mode loop: ketuk = perbesar (lama).
                if (isTap) playOnce();
                else setExpanded((v) => !v);
              }}
            />
          ) : (
            <div
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-zinc-900 px-4 text-center"
              role="img"
              aria-label={`Preview belum tersedia untuk ${label}`}
            >
              <span className="text-2xl" aria-hidden>
                🥋
              </span>
              <p className="text-sm font-medium text-zinc-200">
                Preview belum tersedia untuk jurus ini
              </p>
              <p className="text-xs text-zinc-400">
                {label} belum punya keyframe teknik.
              </p>
            </div>
          )}
          {/* Mode tap, diam: affordance ▶ elegan di atas frame impact —
              lingkaran amber + label, supaya jelas kartu bisa diketuk. */}
          {canAnimate && isTap && !tapPlaying && (
            <button
              type="button"
              onClick={playOnce}
              aria-label={`Mainkan preview ${label}`}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/10 transition-colors hover:bg-black/20"
            >
              <span
                aria-hidden
                className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 pl-0.5 text-xl text-black shadow-lg shadow-black/50 ring-2 ring-white/70 transition-transform hover:scale-105"
              >
                ▶
              </span>
              <span className="rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
                {hasPlayed ? 'Ketuk untuk putar ulang' : 'Ketuk untuk mainkan'}
              </span>
            </button>
          )}
          {/* Mode tap, sedang main: penanda halus, tanpa tombol pause —
              satu putaran berhenti sendiri. */}
          {canAnimate && isTap && tapPlaying && (
            <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
              ▶ Memainkan gerakan…
            </span>
          )}
          {/* Mode tap, sudah pernah main: tombol Ulangi kecil di pojok
              bawah-kiri (pojok bawah-kanan milik tombol perbesar kartu). */}
          {canAnimate && isTap && hasPlayed && !tapPlaying && (
            <button
              type="button"
              onClick={playOnce}
              aria-label="Ulangi preview dari awal"
              className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white hover:bg-black/80"
            >
              ↺ Ulangi
            </button>
          )}
          {canAnimate && !isTap && (
            <div className="absolute right-2 top-2 flex gap-1">
              <button
                type="button"
                onClick={() => setPlaying((v) => !v)}
                aria-label={playing ? 'Jeda preview' : 'Putar preview'}
                className="rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white hover:bg-black/80"
              >
                {playing ? '⏸ Jeda' : '▶ Putar'}
              </button>
              <button
                type="button"
                onClick={replay}
                aria-label="Ulangi preview dari awal"
                className="rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white hover:bg-black/80"
              >
                ↺ Ulangi
              </button>
            </div>
          )}
          {showRing && canAnimate && (
            <span className="absolute left-2 top-2 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
              ★ Spesial
            </span>
          )}
        </div>
        {props.showInfo !== false && (
          <div className="space-y-1 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-white">{label}</p>
              {styleLabel ? (
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                  {styleLabel}
                </span>
              ) : null}
            </div>
            {note ? (
              <p className="text-xs leading-relaxed text-zinc-400">{note}</p>
            ) : null}
            <p className="text-[11px] text-zinc-500">
              {dmg > 0 ? `DMG ${dmg}` : 'Tanpa damage'}
              {target ? ` • Target: ${targetLabel(target)}` : ''}
              {canAnimate ? ` • ${loopDuration.toFixed(2)} dtk/putaran` : ''}
            </p>
            {canAnimate && (
              <p className="text-[11px] text-zinc-600">
                {isTap
                  ? 'Ketuk gambar untuk memainkan gerakan — berhenti sendiri setelah satu putaran.'
                  : 'Ketuk gambar untuk memperbesar.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (!expanded) return card;

  // Mode diperbesar: kartu yang SAMA pindah ke overlay (bukan duplikat —
  // satu canvas, satu rAF; loopTRef tetap jalan dari posisi terakhir).
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview diperbesar: ${label}`}
      onClick={() => setExpanded(false)}
    >
      <div onClick={(e) => e.stopPropagation()}>{card}</div>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
      >
        Tutup
      </button>
    </div>
  );
}
