'use client';

/**
 * GachaMoveCard — Kartu jurus bergaya kartu gacha / MMORPG TCG.
 *
 * Membungkus MovePreview yang sudah ada (mode 'tap' — diam di frame
 * impact, ketuk untuk main satu putaran) di dalam frame kartu yang
 * dibuat murni dari CSS/SVG — tanpa gambar, tanpa aset baru, tanpa GIF.
 *
 * DUA TIER SAJA (keputusan user 18 Nov — bukan Rare/Epic/Legendary):
 * - Biasa: frame slate netral, tanpa badge, tanpa glow.
 * - Special Move: frame emas amber-brand + cincin spesial di canvas
 *   (MovePreview isSpecial) + label "★ Spesial" di name plate.
 *   Aturan `isSpecialMoveCard`: kind finisher (punya cincin + potensi
 *   KO — flyknee, headkick, finisher, stickchop) ATAU haymaker
 *   (Superman punch — patokan kualitas special move, cincin es biru
 *   #7DD3FC). `meta.isSpecial` TIDAK dipakai sebagai tier: 57 dari 59
 *   kind punya profil FX di special-fx.js, jadi hampir semua kartu
 *   akan jadi Spesial.
 *
 * Desain (per skill frontend_design + color_theory + ui_ux_design):
 * - Basis Hub: warm analogous gelap (ink-950/ink-800 + amber-brand),
 *   satu aksen saja (emas) untuk Special — Biasa sengaja pendiam.
 * - 60-30-10: 60% latar gelap, 30% permukaan kartu, 10% aksen emas.
 * - Kontras: nama paper #faf5ec di ink-950 (~15:1, AAA); teks
 *   sekunder paper-dim di atas gelap (AA).
 * - Kartu portrait 3:4, art window 4/3 di atas, name plate di BAWAH
 *   (nama + gaya • target + badge DMG/STA). Baris gaya boleh bungkus
 *   2 baris (line-clamp-2) — JANGAN truncate satu baris di HP.
 * - Play affordance: chip kecil "Ketuk untuk mainkan" di pojok kiri
 *   bawah art window (milik MovePreview) — tidak menutupi stickman.
 * - Touch target >= 44px (name plate = tombol pilih di DeckBuilder;
 *   tombol perbesar 44px). Reduced motion: glow Special hanya jalan
 *   di `motion-safe`.
 */
import MovePreview, {
  type MovePreviewColors,
} from './MovePreview';
import { getMoveMeta, isFinisherMove, targetLabel } from '@/lib/game/move-meta';

/**
 * Apakah kind ini kartu Special Move (tier emas)? Finisher + haymaker
 * (Superman punch). Lihat penjelasan di header file.
 */
export function isSpecialMoveCard(kind: string): boolean {
  return isFinisherMove(kind) || kind === 'haymaker';
}

const SPECIAL_FRAME =
  'linear-gradient(160deg, #fde68a 0%, #f5a623 35%, #b45309 70%, #fcd34d 100%)';
const SPECIAL_GLOW =
  'radial-gradient(120% 90% at 50% 0%, rgba(245,166,35,0.30) 0%, transparent 65%)';
const BIASA_FRAME =
  'linear-gradient(160deg, #94a3b8 0%, #64748b 45%, #475569 100%)';

/** Angka kartu ala Indonesia: bulat tampil bulat, desimal 1 angka (2,5). */
function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

/** Ornamen sudut frame — satu path SVG, tanpa aset. */
function CornerOrnament({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`pointer-events-none absolute h-5 w-5 ${className ?? ''}`}
    >
      <path
        d="M1 19 V6 Q1 1 6 1 H19"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="10" cy="10" r="1.8" fill={color} />
    </svg>
  );
}

export interface GachaMoveCardProps {
  /** Kunci kind jurus (mis. 'jab', 'headkick', 'flyknee', 'haymaker'). */
  kind: string;
  /**
   * Paksa status Special; kalau tidak diisi, diambil dari aturan kartu
   * (isSpecialMoveCard: finisher + haymaker).
   */
  isSpecial?: boolean;
  /** Warna stickman — default merah standar MovePreview. */
  fighterColors?: Partial<MovePreviewColors>;
  /**
   * Sinyal eksternal "Mainkan Semua": naikkan untuk memainkan animasi
   * kartu ini satu putaran (diteruskan ke MovePreview).
   */
  playSignal?: number;
  /** Status terpilih di deck (opsional — dipakai DeckBuilder). */
  selected?: boolean;
  /** Nomor urut di deck kalau terpilih. */
  order?: number | null;
  /** Nonaktif (deck penuh & belum terpilih). */
  disabled?: boolean;
  /**
   * Ketuk name plate untuk pilih / batal pilih (opsional — dipakai
   * DeckBuilder). Kalau tidak diisi, name plate bukan tombol.
   */
  onToggle?: () => void;
  /** Label aria tombol pilih — DeckBuilder yang menyusun kalimatnya. */
  toggleAriaLabel?: string;
  /** Buka panel preview besar (opsional — dipakai DeckBuilder). */
  onExpand?: () => void;
  className?: string;
}

export default function GachaMoveCard({
  kind,
  isSpecial,
  fighterColors,
  playSignal,
  selected,
  order,
  disabled,
  onToggle,
  toggleAriaLabel,
  onExpand,
  className,
}: GachaMoveCardProps) {
  const meta = getMoveMeta(kind);
  const special = isSpecial ?? isSpecialMoveCard(kind);
  const sta = meta.power > 0 ? meta.power * 6 : 0;
  const frame = special ? SPECIAL_FRAME : BIASA_FRAME;
  const frameColor = special ? '#f5a623' : '#64748b';
  const lightColor = special ? '#fcd34d' : '#cbd5e1';

  const namePlate = (
    <div
      className="rounded-lg border-l-4 bg-ink-950/80 px-2.5 py-1.5 ring-1 ring-white/10 sm:py-2"
      style={{ borderLeftColor: frameColor }}
    >
      <p className="font-display text-[15px] font-semibold uppercase leading-tight tracking-wide text-paper sm:text-lg">
        {meta.label}
      </p>
      {/* Baris gaya: boleh bungkus 2 baris, jangan truncate satu baris
          di HP (target ditulis singkat "Kepala", bukan "Target: Kepala"). */}
      <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-paper-dim">
        {meta.styleLabel}
        {special ? ' • ★ Spesial' : ''}
        {meta.target ? ` • ${targetLabel(meta.target)}` : ''}
      </p>
      {meta.found && (meta.dmg > 0 || meta.power > 0) && (
        <p className="mt-1.5 flex flex-nowrap gap-1">
          {meta.dmg > 0 && (
            <span className="rounded-md bg-amber-brand/15 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-amber-brand">
              DMG {fmtNum(meta.dmg)}
            </span>
          )}
          {sta > 0 && (
            <span className="rounded-md bg-ink-700 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-paper-dim">
              STA {fmtNum(sta)}
            </span>
          )}
        </p>
      )}
      {meta.note ? (
        <p className="mt-1.5 hidden text-[11px] leading-snug text-paper-mute sm:block sm:line-clamp-2">
          {meta.note}
        </p>
      ) : null}
    </div>
  );

  return (
    <article
      aria-label={`Kartu ${meta.label}${special ? ' — Special Move' : ''}`}
      className={`relative aspect-[3/4] w-full select-none ${disabled ? 'opacity-40' : ''} ${className ?? ''}`}
    >
      {/* Frame luar: border gradient 2px via padding + glow Special.
          Kartu terpilih: ring emas tebal di luar frame. */}
      <div
        className={`absolute inset-0 rounded-[20px] p-[2px] shadow-lg shadow-black/50 ${
          special ? 'motion-safe:animate-glow-pulse' : ''
        } ${selected ? 'ring-2 ring-amber-brand' : ''}`}
        style={{
          background: frame,
          boxShadow: `0 10px 30px -8px ${frameColor}66, 0 4px 14px rgba(0,0,0,0.5)`,
        }}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-[18px] bg-ink-900">
          {/* Glow Special di belakang art window (Biasa: tanpa glow). */}
          {special ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-3/5"
              style={{ background: SPECIAL_GLOW }}
            />
          ) : null}

          {/* Badge terpilih + nomor urut — status harus terlihat sekilas.
              Posisi kanan atas, di atas ornamen (ornamen kiri atas saja
              yang dipakai bareng badge — kanan atas kosong dari ornamen
              supaya tidak bertabrakan). */}
          {selected ? (
            <span className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full bg-amber-brand px-2 py-0.5 text-xs font-bold text-[#1a1206] shadow-md shadow-black/40">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1a1206] font-display text-[10px] text-amber-brand">
                {order ?? '✓'}
              </span>
              Dipilih
            </span>
          ) : null}

          {/* Art window: tinggi PASTI via aspect 4/3 + shrink-0.
              (Tanpa ini, di kartu sempit flex mengecilkan window ke 0
              karena min-content canvas aspect-ratio = 0.) */}
          <div className="relative z-10 mx-2 mt-2 aspect-[4/3] shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15">
            <MovePreview
              kind={kind}
              mode="tap"
              showInfo={false}
              size="lg"
              isSpecial={special}
              fighterColors={fighterColors}
              playSignal={playSignal}
            />
            {onExpand ? (
              <button
                type="button"
                onClick={onExpand}
                aria-label={`Perbesar preview ${meta.label}`}
                title="Perbesar preview"
                className="absolute bottom-2 right-2 z-20 flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-ink-950/80 text-base text-paper backdrop-blur-sm transition-colors hover:bg-amber-brand hover:text-[#1a1206]"
              >
                <span aria-hidden="true">⤢</span>
              </button>
            ) : null}
          </div>

          {/* Name plate di BAWAH. Di DeckBuilder, name plate adalah
              tombol pilih / batal pilih (44px+); di galeri/demo, div biasa. */}
          <div className="relative z-10 mt-auto px-2.5 pb-2 pt-1.5 sm:pb-2.5 sm:pt-2">
            {onToggle ? (
              <button
                type="button"
                onClick={onToggle}
                disabled={disabled}
                aria-pressed={selected ?? false}
                aria-label={toggleAriaLabel ?? meta.label}
                className="block w-full rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/60 disabled:cursor-not-allowed"
              >
                {namePlate}
              </button>
            ) : (
              namePlate
            )}
          </div>

          {/* Ornamen sudut frame — hanya kiri atas + kiri bawah + kanan
              bawah; kanan atas dikosongkan untuk badge "Dipilih". */}
          <CornerOrnament className="left-1.5 top-1.5" color={lightColor} />
          <CornerOrnament
            className="bottom-1.5 right-1.5 rotate-180"
            color={lightColor}
          />
          <CornerOrnament
            className="bottom-1.5 left-1.5 -rotate-90"
            color={lightColor}
          />
        </div>
      </div>
    </article>
  );
}
