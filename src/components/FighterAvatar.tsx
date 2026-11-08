import {
  resolveAccessories,
} from "@/lib/game/accessories";
import type { ChatFighterIdentity } from "@/components/types";

/**
 * PP karakter petarung — bust (kepala + bahu) dalam lingkaran.
 *
 * Dipakai sebagai foto profil pengirim di obrolan: kepala putih + garis
 * tinta + cincin warna badan, bahu warna badan, sarung tangan di bahu,
 * dan aksesoris kepala mengikuti katalog (resolveAccessories — sama
 * seperti FighterPreview, jadi yang terlihat di chat = yang dipilih di
 * /fighter-saya). Tanpa fighter → siluet generik abu-abu, dan client
 * menampilkan username (satu-satunya kasus username boleh tampil).
 *
 * Digambar SVG murni (tanpa gambar eksternal), viewBox 48x48.
 */

const INK = "#141210";
const PAPER = "#FAF5EC";

/** Normalisasi nilai warna: "none" -> null (item tidak dipakai). */
function asColor(v: string | null | undefined): string | null {
  return v === "none" || !v ? null : v;
}

function HeadAccessory({
  variant,
  color,
}: {
  variant: string;
  color: string;
}) {
  if (variant === "none") return null;
  return (
    <g strokeLinecap="round" fill="none">
      {variant === "headband" ? (
        <>
          <path
            d="M 14.5 17 A 10.5 10.5 0 0 1 33.5 17"
            stroke={color}
            strokeWidth="3.5"
          />
          <path d="M 15 18 L 9.5 22.5" stroke={color} strokeWidth="2.5" />
        </>
      ) : null}
      {variant === "bandana" ? (
        <>
          <path
            d="M 14 18 A 10.5 10.5 0 0 1 34 18 L 32 12.5 A 9 9 0 0 0 16 12.5 Z"
            fill={color}
            stroke={INK}
            strokeWidth="1.2"
          />
          <circle cx="14" cy="18" r="2" fill={color} stroke={INK} strokeWidth="0.8" />
          <path d="M 13 20 L 9.5 25 M 15 20.5 L 13 26" stroke={color} strokeWidth="2" />
        </>
      ) : null}
      {variant === "cap" ? (
        <>
          <path
            d="M 14 17 A 10.5 10.5 0 0 1 34 17 Z"
            fill={color}
            stroke={INK}
            strokeWidth="1.2"
          />
          <ellipse
            cx="36"
            cy="16.5"
            rx="5.5"
            ry="2.5"
            fill={color}
            stroke={INK}
            strokeWidth="1.2"
          />
        </>
      ) : null}
      {variant === "crown" ? (
        <path
          d="M 14.5 16 L 16.5 8 L 19.5 13 L 24 6.5 L 28.5 13 L 31.5 8 L 33.5 16 Z"
          fill={color}
          stroke={INK}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      ) : null}
      {variant === "helmet" ? (
        <>
          <circle cx="24" cy="18" r="12" fill={color} stroke={INK} strokeWidth="1.5" />
          <path
            d="M 14.5 16 A 10.5 10.5 0 0 1 33.5 16"
            stroke={PAPER}
            strokeWidth="2"
          />
        </>
      ) : null}
      {variant === "topknot" ? (
        <circle cx="24" cy="6.5" r="3.5" fill={color} stroke={INK} strokeWidth="1.2" />
      ) : null}
    </g>
  );
}

export default function FighterAvatar({
  fighter,
  username,
  size = 40,
  className = "",
}: {
  /** Fighter pengirim — null/undefined = belum punya fighter (fallback siluet). */
  fighter?: ChatFighterIdentity | null;
  /** Username akun — hanya dipakai untuk label aksesibilitas fallback. */
  username?: string;
  /** Diameter lingkaran dalam px (default 40). */
  size?: number;
  className?: string;
}) {
  const label = fighter?.displayName
    ? `Foto profil ${fighter.displayName}`
    : `Foto profil ${username ? `@${username}` : "pengguna tanpa fighter"}`;

  if (!fighter) {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 ${className}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
          {/* Siluet generik abu-abu — pengguna belum punya fighter. */}
          <circle cx="24" cy="19" r="10" fill="#6b655c" />
          <path
            d="M 6 48 C 8 35 15 30 24 30 C 33 30 40 35 42 48 Z"
            fill="#4a453f"
          />
        </svg>
      </span>
    );
  }

  const colors = fighter.colors ?? null;
  const body = asColor(colors?.body) ?? "#F97316";
  const gloves = asColor(colors?.gloves) ?? "#141210";
  const headColor = asColor(colors?.headband) ?? "#8B5E34";
  const acc = resolveAccessories(fighter.accessories ?? null, {
    headband: colors?.headband ?? null,
    belt: colors?.belt ?? null,
    weapon: colors?.weapon ?? null,
  });

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-ink-800 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        {/* Bahu warna badan */}
        <path
          d="M 6 48 C 8 35 15 30 24 30 C 33 30 40 35 42 48 Z"
          fill={body}
          stroke={INK}
          strokeWidth="1.5"
        />
        {/* Sarung tangan di bahu */}
        <circle cx="10.5" cy="43" r="4" fill={gloves} stroke={INK} strokeWidth="1.2" />
        <circle cx="37.5" cy="43" r="4" fill={gloves} stroke={INK} strokeWidth="1.2" />
        {/* Kepala putih + cincin warna badan (seperti FighterPreview) */}
        <circle cx="24" cy="19" r="10.5" fill={PAPER} stroke={INK} strokeWidth="2" />
        <circle cx="24" cy="19" r="8" fill="none" stroke={body} strokeWidth="1.8" />
        {/* Mata + alis */}
        <circle cx="20.5" cy="19" r="1.3" fill={INK} />
        <circle cx="27.5" cy="19" r="1.3" fill={INK} />
        <path
          d="M 18 15.5 L 21.5 15 M 26.5 15 L 30 15.5"
          stroke={INK}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* Aksesoris kepala */}
        <HeadAccessory variant={acc.head} color={headColor} />
      </svg>
    </span>
  );
}
