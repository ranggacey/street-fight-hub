"use client";

import {
  ACCESSORY_CATALOG,
  accessoryLabel,
  resolveAccessories,
  type AccessoryPart,
  type FighterAccessories,
} from "@/lib/game/accessories";

/**
 * Preview karakter fighter + ikon item (SVG) — Edisi Visual Overhaul (V-Taper Athletic & Detailed Gear).
 *
 * Selaras dengan cara arena menggambar petarung (film.js + accessories.js):
 * - Badan atletis V-Taper berotot (bukan kotak!), lengkap dengan bahu deltoid,
 *   dada pectoral, lekuk pinggang ramping, panggul anatomis, serta paha/betis/lengan berotot.
 * - Kepala 3D dengan sorot rim-light, bayangan rahang, dan ekspresi petarung tajam.
 * - Seluruh varian aksesoris (kepala, tangan, kaki, badan, sabuk, senjata) digambar
 *   dengan detail tinggi baik di kanvas preview maupun di ikon pemilih.
 */

export type FighterColorsLike = {
  body: string;
  gloves: string;
  shoes: string;
  belt: string;
  headband: string;
  weapon: string;
};

/** Palet preset yang beragam — di-tap untuk memilih warna item. */
export const COLOR_PRESETS: { hex: string; name: string }[] = [
  { hex: "#E10600", name: "Merah" },
  { hex: "#F97316", name: "Oranye" },
  { hex: "#EAB308", name: "Kuning emas" },
  { hex: "#84CC16", name: "Hijau limau" },
  { hex: "#22C55E", name: "Hijau" },
  { hex: "#14B8A6", name: "Toska" },
  { hex: "#06B6D4", name: "Cyan" },
  { hex: "#3B82F6", name: "Biru" },
  { hex: "#8B5CF6", name: "Ungu" },
  { hex: "#EC4899", name: "Pink" },
  { hex: "#FF00FF", name: "Magenta" },
  { hex: "#FBF8F1", name: "Putih" },
  { hex: "#141210", name: "Hitam" },
  { hex: "#8B5E34", name: "Kayu" },
];

export type ColorPart = keyof FighterColorsLike;

const INK = "#141210";
const PAPER = "#FAF5EC";
const GOLD = "#EAB308";
const GOLD_LIGHT = "#FEF08A";
const SILVER = "#CBD5E1";

/** Normalisasi nilai warna: "none" -> null (item tidak dipakai). */
function asColor(v: string): string | null {
  return v === "none" ? null : v;
}

/** Ikon kecil tiap bagian warna. */
export function ItemIcon({
  part,
  color,
}: {
  part: ColorPart;
  color: string;
}) {
  const c = asColor(color);
  const fill = c ?? "#3A352E";
  const dim = !c;
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5"
      style={dim ? { opacity: 0.45 } : undefined}
    >
      <svg viewBox="0 0 48 48" width="26" height="26" fill="none">
        {part === "body" ? (
          <>
            <circle cx="24" cy="10" r="6" fill={PAPER} stroke={INK} strokeWidth="2" />
            <path
              d="M15 18 Q24 16 33 18 L29 29 L31 35 Q24 37 17 35 L19 29 Z"
              fill={fill}
              stroke={INK}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M15 19 L10 28 M33 19 L38 28" stroke={fill} strokeWidth="4" strokeLinecap="round" />
            <path d="M19 35 L16 44 M29 35 L32 44" stroke={fill} strokeWidth="4" strokeLinecap="round" />
          </>
        ) : null}
        {part === "gloves" ? (
          <>
            <circle cx="24" cy="23" r="12" fill={fill} stroke={INK} strokeWidth="2.2" />
            <circle cx="31" cy="27" r="4.5" fill={fill} stroke={INK} strokeWidth="1.8" />
            <path d="M16 17 A8 8 0 0 1 28 15" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M15 30 A12 12 0 0 0 33 30" stroke={PAPER} strokeWidth="3.5" strokeLinecap="round" />
          </>
        ) : null}
        {part === "shoes" ? (
          <>
            <path d="M13 20 L13 30 L38 30 C39 25 32 23 24 22 L19 19 Z" fill={fill} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <rect x="11" y="30" width="28" height="4" rx="1.5" fill={PAPER} stroke={INK} strokeWidth="1.5" />
          </>
        ) : null}
        {part === "belt" ? (
          <>
            <rect x="7" y="18" width="34" height="10" rx="3" fill={fill} stroke={INK} strokeWidth="2" />
            <path d="M22 25 L18 37 M26 25 L30 37" stroke={fill} strokeWidth="4" strokeLinecap="round" />
            <circle cx="24" cy="23" r="4" fill={fill} stroke={INK} strokeWidth="1.8" />
          </>
        ) : null}
        {part === "headband" ? (
          <>
            <circle cx="25" cy="24" r="11" fill={PAPER} stroke={INK} strokeWidth="2" />
            <path d="M15 20 A11 11 0 0 1 35 20" stroke={fill} strokeWidth="5" strokeLinecap="round" />
            <path d="M15 21 L6 26 M15 23 L8 31" stroke={fill} strokeWidth="3" strokeLinecap="round" />
          </>
        ) : null}
        {part === "weapon" ? (
          <>
            <path d="M11 39 L37 9" stroke={INK} strokeWidth="8.5" strokeLinecap="round" />
            <path d="M11 39 L37 9" stroke={fill} strokeWidth="5.5" strokeLinecap="round" />
            <path d="M19 30 L25 23" stroke={PAPER} strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : null}
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Ikon satu varian aksesoris (untuk grid pemilih di form).            */
/* ------------------------------------------------------------------ */

function iconFill(color: string): { fill: string; dim: boolean } {
  const c = asColor(color);
  return c ? { fill: c, dim: false } : { fill: "#3A352E", dim: true };
}

export function AccessoryIcon({
  part,
  variant,
  color,
}: {
  part: AccessoryPart;
  variant: string;
  color: string;
}) {
  const { fill, dim } = iconFill(color);
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5"
      style={dim ? { opacity: 0.45 } : undefined}
    >
      <svg viewBox="0 0 48 48" width="34" height="34" fill="none">
        {part === "head" ? (
          <>
            <circle cx="25" cy="28" r="10" fill={PAPER} stroke={INK} strokeWidth="2" />
            <circle cx="28" cy="27" r="1.4" fill={INK} />
            <path d="M26 24.5 L30 25.2" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
            {variant === "headband" ? (
              <>
                <path d="M15 24 L6 28 M15 26 L9 33" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
                <path d="M15 24 L6 28 M15 26 L9 33" stroke={fill} strokeWidth="2.6" strokeLinecap="round" />
                <path d="M15 24 A10.5 10.5 0 0 1 35 24" stroke={INK} strokeWidth="6" strokeLinecap="round" />
                <path d="M15 24 A10.5 10.5 0 0 1 35 24" stroke={fill} strokeWidth="3.8" strokeLinecap="round" />
                <circle cx="15" cy="24.5" r="2.4" fill={fill} stroke={INK} strokeWidth="1.2" />
              </>
            ) : null}
            {variant === "bandana" ? (
              <>
                <path d="M15 26 A10.5 10.5 0 0 1 35 26 L33 19 A9.5 9.5 0 0 0 17 19 Z" fill={fill} stroke={INK} strokeWidth="1.6" />
                <path d="M19 22 Q25 20 31 22" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="14.5" cy="26" r="2.8" fill={fill} stroke={INK} strokeWidth="1.3" />
                <path d="M13 27 L7 32 M15 28 L11 35" stroke={fill} strokeWidth="2.4" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "cap" ? (
              <>
                <path d="M15 25 A10.5 10.5 0 0 1 35 25 Z" fill={fill} stroke={INK} strokeWidth="1.6" />
                <circle cx="25" cy="14.5" r="1.4" fill={INK} />
                <circle cx="29" cy="21" r="2" fill={PAPER} />
                <path d="M29 24 C34 23 41 24 42 26 C39 27.5 33 27 28 25.5 Z" fill={fill} stroke={INK} strokeWidth="1.5" />
              </>
            ) : null}
            {variant === "crown" ? (
              <>
                <path
                  d="M15 23 L14 13 L19 18 L22 11 L25 18 L28 11 L31 18 L36 13 L35 23 Z"
                  fill={fill}
                  stroke={INK}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <circle cx="25" cy="20" r="1.6" fill="#E10600" />
                <circle cx="19" cy="20.5" r="1.2" fill="#38BDF8" />
                <circle cx="31" cy="20.5" r="1.2" fill="#38BDF8" />
              </>
            ) : null}
            {variant === "helmet" ? (
              <>
                <path d="M14 29 A11.5 11.5 0 1 1 36 29 L34 32 L30 29 L20 29 L16 32 Z" fill={fill} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M17 24 H34" stroke={INK} strokeWidth="3" strokeLinecap="round" />
                <path d="M18 24 H33" stroke={GOLD_LIGHT} strokeWidth="1.3" strokeLinecap="round" />
                <path d="M22 16 A12 12 0 0 1 28 16" stroke={GOLD_LIGHT} strokeWidth="2" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "topknot" ? (
              <>
                <rect x="22" y="15.5" width="6" height="2.8" rx="1" fill={GOLD} stroke={INK} strokeWidth="1.2" />
                <circle cx="25" cy="11.5" r="4.5" fill={fill} stroke={INK} strokeWidth="1.6" />
                <path d="M24 10 L17 13" stroke={fill} strokeWidth="2.8" strokeLinecap="round" />
              </>
            ) : null}
          </>
        ) : null}
        {part === "hands" ? (
          <>
            {variant === "none" ? (
              <>
                <circle cx="24" cy="24" r="7.5" fill={PAPER} stroke={INK} strokeWidth="2" />
                <path d="M26 21 H30 M26 25 H30" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "boxing" ? (
              <>
                <circle cx="24" cy="23" r="12" fill={fill} stroke={INK} strokeWidth="2" />
                <circle cx="31" cy="27" r="4.8" fill={fill} stroke={INK} strokeWidth="1.6" />
                <path d="M16 17 A8 8 0 0 1 28 15" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M15 31 A12 12 0 0 0 33 31" stroke={PAPER} strokeWidth="3.5" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "big" ? (
              <>
                <circle cx="24" cy="23" r="15" fill={fill} stroke={INK} strokeWidth="2.2" />
                <circle cx="33" cy="28" r="5.5" fill={fill} stroke={INK} strokeWidth="1.8" />
                <path d="M14 16 A10 10 0 0 1 30 14" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="2.8" strokeLinecap="round" />
                <path d="M12 32 A15 15 0 0 0 36 32" stroke={PAPER} strokeWidth="4" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "mma" ? (
              <>
                <circle cx="23" cy="24" r="11.5" fill={fill} stroke={INK} strokeWidth="2" />
                <path d="M31 19 H37 M31 24 H38 M31 29 H37" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
                <path d="M14 30 A11 11 0 0 0 31 30" stroke={PAPER} strokeWidth="2.8" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "wraps" ? (
              <>
                <circle cx="24" cy="24" r="10.5" fill={fill} stroke={INK} strokeWidth="2" />
                <path d="M16 19 L32 29 M16 29 L32 19 M15 24 H33" stroke={PAPER} strokeWidth="2.4" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "fingerless" ? (
              <>
                <circle cx="23" cy="24" r="12" fill={fill} stroke={INK} strokeWidth="2" />
                <path d="M32 19 H37 M32 24 H38 M32 29 H37" stroke={INK} strokeWidth="2" strokeLinecap="round" />
                <circle cx="29" cy="19" r="1.6" fill={GOLD_LIGHT} />
                <circle cx="29" cy="24" r="1.6" fill={GOLD_LIGHT} />
                <circle cx="29" cy="29" r="1.6" fill={GOLD_LIGHT} />
              </>
            ) : null}
          </>
        ) : null}
        {part === "feet" ? (
          <>
            {variant === "barefoot" ? (
              <>
                <path d="M12 32 Q24 25 36 31 L37 36 L11 36 Z" fill={PAPER} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
                <rect x="14" y="24" width="8" height="4" rx="1" fill={PAPER} stroke={INK} strokeWidth="1.4" />
              </>
            ) : null}
            {variant === "sneakers" ? (
              <>
                <path d="M12 22 L12 32 L38 32 C39 27 32 24 24 23 L20 20 Z" fill={fill} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
                <path d="M16 29 L27 26" stroke={PAPER} strokeWidth="2.2" strokeLinecap="round" />
                <rect x="10" y="32" width="29" height="4" rx="1.5" fill={PAPER} stroke={INK} strokeWidth="1.5" />
              </>
            ) : null}
            {variant === "boots" ? (
              <>
                <path d="M14 11 H25 L26 24 L37 28 C38 31 37 33 37 33 H13 Z" fill={fill} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
                <path d="M17 15 H23 M17 19 H23 M17 23 H24" stroke={PAPER} strokeWidth="1.6" strokeLinecap="round" />
                <rect x="11" y="32" width="27" height="4.5" rx="1" fill={INK} />
              </>
            ) : null}
            {variant === "sandals" ? (
              <>
                <rect x="10" y="31" width="28" height="4" rx="1" fill={PAPER} stroke={INK} strokeWidth="1.6" />
                <rect x="15" y="35" width="4" height="3" fill={INK} />
                <rect x="29" y="35" width="4" height="3" fill={INK} />
                <path d="M16 31 L28 24 M28 31 L16 24" stroke={fill} strokeWidth="3" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "martial" ? (
              <>
                <ellipse cx="24" cy="30" rx="15" ry="5" fill={fill} stroke={INK} strokeWidth="2" />
                <path d="M19 28 L25 30 L19 32" stroke={PAPER} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="10" y="33" width="28" height="2.5" rx="1" fill={PAPER} />
              </>
            ) : null}
          </>
        ) : null}
        {part === "body" ? (
          <>
            <circle cx="24" cy="9" r="5.5" fill={PAPER} stroke={INK} strokeWidth="1.8" />
            {variant === "none" ? (
              <>
                <path
                  d="M14 17 Q24 15 34 17 L29 29 L31 39 Q24 41 17 39 L19 29 Z"
                  fill={fill}
                  stroke={INK}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M18 22 Q24 24 30 22 M24 23 V35" stroke={INK} strokeOpacity="0.45" strokeWidth="1.3" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "shirt" ? (
              <>
                <path d="M14 18 L8 25 M34 18 L40 25" stroke={fill} strokeWidth="6.5" strokeLinecap="round" />
                <path
                  d="M14 17 Q24 15 34 17 L29.5 29 L31.5 39 Q24 41 16.5 39 L18.5 29 Z"
                  fill={fill}
                  stroke={INK}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M18 23 L30 21" stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "singlet" ? (
              <>
                <path
                  d="M18 17 L21 22 Q24 24 27 22 L30 17 L29 29 L31 39 Q24 41 17 39 L19 29 Z"
                  fill={fill}
                  stroke={INK}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M20 17 Q24 23 28 17" stroke={PAPER} strokeWidth="1.8" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "jacket" ? (
              <>
                <path d="M14 18 L8 25 M34 18 L40 25" stroke={fill} strokeWidth="6.5" strokeLinecap="round" />
                <path
                  d="M14 17 Q24 15 34 17 L29.5 29 L31.5 39 Q24 41 16.5 39 L18.5 29 Z"
                  fill={fill}
                  stroke={INK}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M19 17 L24 25 L29 17" stroke={PAPER} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M24 25 V39" stroke={SILVER} strokeWidth="1.8" />
              </>
            ) : null}
            {variant === "gi" ? (
              <>
                <path d="M14 18 L7 26 M34 18 L41 26" stroke={fill} strokeWidth="7" strokeLinecap="round" />
                <path
                  d="M14 17 Q24 15 34 17 L29.5 29 L33 40 L24 38 L15 40 L18.5 29 Z"
                  fill={fill}
                  stroke={INK}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M19 17 L28 31 M29 17 L22 26" stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
              </>
            ) : null}
          </>
        ) : null}
        {part === "belt" ? (
          <>
            {variant === "none" ? (
              <rect x="7" y="18" width="34" height="10" rx="3" fill="none" stroke={INK} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
            ) : null}
            {variant === "belt" ? (
              <>
                <rect x="7" y="17" width="34" height="9" rx="3" fill={fill} stroke={INK} strokeWidth="2" />
                <path d="M22 24 L17 37 M26 24 L31 37" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
                <path d="M22 24 L17 37 M26 24 L31 37" stroke={fill} strokeWidth="3.2" strokeLinecap="round" />
                <circle cx="24" cy="22" r="4" fill={fill} stroke={INK} strokeWidth="1.8" />
              </>
            ) : null}
            {variant === "champion" ? (
              <>
                <rect x="6" y="17" width="36" height="12" rx="4" fill={fill} stroke={INK} strokeWidth="2" />
                <polygon points="18,16 30,16 33,23 30,30 18,30 15,23" fill={GOLD} stroke={INK} strokeWidth="1.6" />
                <circle cx="24" cy="23" r="2.5" fill="#E10600" />
              </>
            ) : null}
            {variant === "rope" ? (
              <>
                <path d="M7 22 H41" stroke={INK} strokeWidth="6.5" strokeLinecap="round" />
                <path d="M7 22 H41" stroke={fill} strokeWidth="4" strokeLinecap="round" />
                <circle cx="28" cy="22" r="4" fill={fill} stroke={INK} strokeWidth="1.6" />
                <path d="M29 25 L34 35 M27 25 L24 35" stroke={fill} strokeWidth="2.5" strokeLinecap="round" />
              </>
            ) : null}
          </>
        ) : null}
        {part === "weapon" ? (
          <>
            {variant === "none" ? (
              <path d="M12 36 L36 12" stroke={INK} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" opacity="0.5" />
            ) : null}
            {variant === "stick" ? (
              <>
                <path d="M10 39 L38 9" stroke={INK} strokeWidth="8.5" strokeLinecap="round" />
                <path d="M10 39 L38 9" stroke={fill} strokeWidth="5.5" strokeLinecap="round" />
                <path d="M10 39 L13 36 M35 12 L38 9" stroke={GOLD} strokeWidth="5.5" strokeLinecap="round" />
                <path d="M21 27 L27 21" stroke={PAPER} strokeWidth="2.5" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "short-stick" ? (
              <>
                <path d="M15 35 L34 14" stroke={INK} strokeWidth="8.5" strokeLinecap="round" />
                <path d="M15 35 L34 14" stroke={fill} strokeWidth="5.5" strokeLinecap="round" />
                <path d="M15 35 L21 28" stroke={INK} strokeWidth="6" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "wooden-sword" ? (
              <>
                <path d="M20 30 L38 10 L34 9 L17 27 Z" fill={fill} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M11 39 L19 30" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
                <path d="M15 25 L23 32" stroke={GOLD} strokeWidth="3.2" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "nunchaku" ? (
              <>
                <path d="M12 35 L22 20" stroke={INK} strokeWidth="8" strokeLinecap="round" />
                <path d="M12 35 L22 20" stroke={fill} strokeWidth="5" strokeLinecap="round" />
                <path d="M22 20 L28 16" stroke={SILVER} strokeWidth="2.5" strokeDasharray="2 2" strokeLinecap="round" />
                <path d="M28 16 L37 30" stroke={INK} strokeWidth="8" strokeLinecap="round" />
                <path d="M28 16 L37 30" stroke={fill} strokeWidth="5" strokeLinecap="round" />
              </>
            ) : null}
          </>
        ) : null}
      </svg>
    </span>
  );
}

/** Daftar varian satu bagian (untuk grid pemilih di form). */
export function accessoryOptions(part: AccessoryPart) {
  return ACCESSORY_CATALOG[part];
}

/**
 * Titik-titik sendi pose guard atletis 3/4 (menghadap kanan),
 * selaras dengan proporsi arena (film.js).
 */
const J = {
  head: { x: 101, y: 46 },
  shoulder: { x: 99, y: 69 },
  shF: { x: 112, y: 70 },
  shB: { x: 85, y: 70 },
  waist: { x: 97, y: 104 },
  hip: { x: 96, y: 126 },
  hipF: { x: 102, y: 126 },
  hipB: { x: 90, y: 126 },
  kneeF: { x: 116, y: 176 },
  footF: { x: 128, y: 226 },
  kneeB: { x: 79, y: 178 },
  footB: { x: 64, y: 226 },
  elbowF: { x: 123, y: 98 },
  handF: { x: 134, y: 82 },
  elbowB: { x: 77, y: 98 },
  handB: { x: 70, y: 86 },
};

/**
 * Menghasilkan path SVG untuk satu segmen anggota badan berotot organik
 * (pangkal -> otot tengah melengkung -> ujung meruncing).
 */
function sculptedSegmentPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  wStart: number,
  wMid: number,
  wEnd: number,
  bulge = 0,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const mx = (a.x + b.x) / 2 + px * bulge;
  const my = (a.y + b.y) / 2 + py * bulge;

  const aL = { x: a.x + px * (wStart / 2), y: a.y + py * (wStart / 2) };
  const aR = { x: a.x - px * (wStart / 2), y: a.y - py * (wStart / 2) };
  const mL = { x: mx + px * (wMid / 2), y: my + py * (wMid / 2) };
  const mR = { x: mx - px * (wMid / 2), y: my - py * (wMid / 2) };
  const bL = { x: b.x + px * (wEnd / 2), y: b.y + py * (wEnd / 2) };
  const bR = { x: b.x - px * (wEnd / 2), y: b.y - py * (wEnd / 2) };

  return `M ${aL.x.toFixed(1)} ${aL.y.toFixed(1)} Q ${mL.x.toFixed(1)} ${mL.y.toFixed(1)} ${bL.x.toFixed(1)} ${bL.y.toFixed(1)} A ${(wEnd / 2).toFixed(1)} ${(wEnd / 2).toFixed(1)} 0 0 1 ${bR.x.toFixed(1)} ${bR.y.toFixed(1)} Q ${mR.x.toFixed(1)} ${mR.y.toFixed(1)} ${aR.x.toFixed(1)} ${aR.y.toFixed(1)} A ${(wStart / 2).toFixed(1)} ${(wStart / 2).toFixed(1)} 0 0 1 ${aL.x.toFixed(1)} ${aL.y.toFixed(1)} Z`;
}

/* ------------------------------------------------------------------ */
/* Gambar tiap varian di preview besar (viewBox 200x250).              */
/* ------------------------------------------------------------------ */

function HeadAccessory({ variant, color }: { variant: string; color: string }) {
  if (variant === "none") return null;
  const hx = J.head.x;
  const hy = J.head.y;
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {variant === "headband" ? (
        <>
          {/* Ekor pita berkibar berlapis */}
          <path d={`M ${hx - 14} ${hy - 4} Q ${hx - 25} ${hy - 2} ${hx - 34} ${hy + 5}`} stroke={INK} strokeWidth="6.5" fill="none" />
          <path d={`M ${hx - 14} ${hy - 1} Q ${hx - 22} ${hy + 5} ${hx - 28} ${hy + 12}`} stroke={INK} strokeWidth="6" fill="none" />
          <path d={`M ${hx - 14} ${hy - 4} Q ${hx - 25} ${hy - 2} ${hx - 34} ${hy + 5}`} stroke={color} strokeWidth="4" fill="none" />
          <path d={`M ${hx - 14} ${hy - 1} Q ${hx - 22} ${hy + 5} ${hx - 28} ${hy + 12}`} stroke={color} strokeWidth="3.5" fill="none" />
          {/* Pita utama di dahi */}
          <path d={`M ${hx - 14} ${hy - 5} A 15.5 15.5 0 0 1 ${hx + 14} ${hy - 5}`} stroke={INK} strokeWidth="8.5" fill="none" />
          <path d={`M ${hx - 14} ${hy - 5} A 15.5 15.5 0 0 1 ${hx + 14} ${hy - 5}`} stroke={color} strokeWidth="5.5" fill="none" />
          <path d={`M ${hx - 10} ${hy - 8} A 14 14 0 0 1 ${hx + 10} ${hy - 8}`} stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.5" fill="none" />
          <circle cx={hx - 14.5} cy={hy - 3.5} r="3.8" fill={color} stroke={INK} strokeWidth="1.8" />
        </>
      ) : null}
      {variant === "bandana" ? (
        <>
          <path d={`M ${hx - 15} ${hy} L ${hx - 28} ${hy + 8} M ${hx - 14} ${hy + 3} L ${hx - 24} ${hy + 14}`} stroke={INK} strokeWidth="5.5" />
          <path d={`M ${hx - 15} ${hy} L ${hx - 28} ${hy + 8} M ${hx - 14} ${hy + 3} L ${hx - 24} ${hy + 14}`} stroke={color} strokeWidth="3.2" />
          <path
            d={`M ${hx - 15} ${hy - 2} A 15.5 15.5 0 0 1 ${hx + 15} ${hy - 2} Q ${hx} ${hy - 6} ${hx - 15} ${hy - 2} Z`}
            fill={color}
            stroke={INK}
            strokeWidth="2"
          />
          <path d={`M ${hx - 10} ${hy - 10} Q ${hx} ${hy - 13} ${hx + 10} ${hy - 10}`} stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.6" fill="none" />
          <circle cx={hx - 15} cy={hy - 1} r="4.2" fill={color} stroke={INK} strokeWidth="1.8" />
        </>
      ) : null}
      {variant === "cap" ? (
        <>
          <path d={`M ${hx - 15} ${hy - 3} A 15.5 15.5 0 0 1 ${hx + 15} ${hy - 3} Z`} fill={color} stroke={INK} strokeWidth="2" />
          <path d={`M ${hx} ${hy - 18.5} Q ${hx - 4} ${hy - 11} ${hx - 3} ${hy - 3}`} stroke={INK} strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
          <circle cx={hx} cy={hy - 18.5} r="2" fill={INK} />
          <circle cx={hx + 7} cy={hy - 9} r="2.8" fill={PAPER} stroke={INK} strokeWidth="1" />
          <path
            d={`M ${hx + 8} ${hy - 5} C ${hx + 16} ${hy - 7}, ${hx + 26} ${hy - 5}, ${hx + 27} ${hy - 2} C ${hx + 21} ${hy}, ${hx + 13} ${hy - 1}, ${hx + 7} ${hy - 3} Z`}
            fill={color}
            stroke={INK}
            strokeWidth="2"
          />
        </>
      ) : null}
      {variant === "crown" ? (
        <>
          <path
            d={`M ${hx - 13} ${hy - 10} L ${hx - 15} ${hy - 23} L ${hx - 8} ${hy - 15} L ${hx - 4.5} ${hy - 27} L ${hx} ${hy - 16} L ${hx + 4.5} ${hy - 27} L ${hx + 8} ${hy - 15} L ${hx + 15} ${hy - 23} L ${hx + 13} ${hy - 10} Z`}
            fill={color}
            stroke={INK}
            strokeWidth="2"
          />
          <line x1={hx - 12} y1={hy - 12.5} x2={hx + 12} y2={hy - 12.5} stroke={GOLD_LIGHT} strokeWidth="1.8" />
          <circle cx={hx} cy={hy - 14.5} r="2.3" fill="#E10600" stroke={INK} strokeWidth="0.8" />
          <circle cx={hx - 7} cy={hy - 14} r="1.8" fill="#38BDF8" stroke={INK} strokeWidth="0.8" />
          <circle cx={hx + 7} cy={hy - 14} r="1.8" fill="#38BDF8" stroke={INK} strokeWidth="0.8" />
        </>
      ) : null}
      {variant === "helmet" ? (
        <>
          <path
            d={`M ${hx - 15} ${hy + 3} A 17 17 0 1 1 ${hx + 16} ${hy - 2} L ${hx + 12} ${hy - 4} L ${hx - 4} ${hy - 4} L ${hx - 6} ${hy + 6} Z`}
            fill={color}
            stroke={INK}
            strokeWidth="2.2"
          />
          <circle cx={hx - 4} cy={hy + 3} r="5.5" fill={color} stroke={INK} strokeWidth="1.8" />
          <path d={`M ${hx - 6} ${hy - 16.5} A 17 17 0 0 1 ${hx + 6} ${hy - 16.5}`} stroke={GOLD_LIGHT} strokeWidth="2.8" fill="none" />
          <path d={`M ${hx - 10} ${hy - 5} L ${hx + 15} ${hy - 5}`} stroke={INK} strokeWidth="3.8" />
          <path d={`M ${hx - 8} ${hy - 5} L ${hx + 13} ${hy - 5}`} stroke={PAPER} strokeWidth="1.6" />
        </>
      ) : null}
      {variant === "topknot" ? (
        <>
          <rect x={hx - 4.5} y={hy - 18} width="9" height="4" rx="1.2" fill={GOLD} stroke={INK} strokeWidth="1.6" />
          <circle cx={hx - 1} cy={hy - 23} r="6.5" fill={color} stroke={INK} strokeWidth="2" />
          <path d={`M ${hx - 2} ${hy - 25} Q ${hx - 9} ${hy - 24} ${hx - 12} ${hy - 19}`} stroke={color} strokeWidth="4" fill="none" />
          <path d={`M ${hx - 4} ${hy - 26} A 4.5 4.5 0 0 1 ${hx + 3} ${hy - 25}`} stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.5" fill="none" />
        </>
      ) : null}
    </g>
  );
}

function Glove({
  x,
  y,
  variant,
  color,
  front,
}: {
  x: number;
  y: number;
  variant: string;
  color: string;
  front: boolean;
}) {
  if (variant === "none") {
    return (
      <g>
        <circle cx={x} cy={y} r="7.2" fill={PAPER} stroke={INK} strokeWidth="2.2" />
        <path d={`M ${x + 2} ${y - 2.5} H ${x + 6} M ${x + 2} ${y + 2.5} H ${x + 6}`} stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    );
  }
  const r = variant === "big" ? 17.5 : variant === "wraps" ? 10.5 : variant === "fingerless" ? 12.5 : 14;
  const cuff = variant === "boxing" || variant === "big";
  const dir = front ? 1 : -1;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={color} stroke={INK} strokeWidth="2.4" />
      {/* Sorot 3D kubah atas sarung tangan */}
      <path
        d={`M ${x - r * 0.55} ${y - r * 0.35} A ${r * 0.72} ${r * 0.72} 0 0 1 ${x + r * 0.45} ${y - r * 0.45}`}
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      {cuff ? (
        <>
          {/* Tonjolan ibu jari terkunci */}
          <circle cx={x + dir * (r * 0.48)} cy={y + r * 0.38} r={variant === "big" ? 6 : 5} fill={color} stroke={INK} strokeWidth="2" />
          {/* Manset pergelangan putih berbingkai tinta */}
          <path
            d={`M ${x - r + 3} ${y + r - 4} A ${r} ${r} 0 0 0 ${x + r - 3} ${y + r - 4}`}
            stroke={INK}
            strokeWidth="6.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M ${x - r + 3.5} ${y + r - 4} A ${r} ${r} 0 0 0 ${x + r - 3.5} ${y + r - 4}`}
            stroke={PAPER}
            strokeWidth="3.8"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {variant === "mma" ? (
        <>
          <path d={`M ${x - r + 4} ${y + r - 3} A ${r} ${r} 0 0 0 ${x + r - 4} ${y + r - 3}`} stroke={PAPER} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path
            d={`M ${x + dir * (r - 2)} ${y - 4.5} h ${dir * 5} M ${x + dir * (r - 2)} ${y} h ${dir * 5.5} M ${x + dir * (r - 2)} ${y + 4.5} h ${dir * 5}`}
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {variant === "wraps" ? (
        <path
          d={`M ${x - 7} ${y - 4} L ${x + 7} ${y + 4} M ${x - 7} ${y + 4} L ${x + 7} ${y - 4} M ${x - 8} ${y} H ${x + 8}`}
          stroke={PAPER}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      ) : null}
      {variant === "fingerless" ? (
        <>
          <path
            d={`M ${x + dir * (r - 2)} ${y - 5} h ${dir * 4.5} M ${x + dir * (r - 2)} ${y} h ${dir * 4.5} M ${x + dir * (r - 2)} ${y + 5} h ${dir * 4.5}`}
            stroke={INK}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx={x + dir * 6.5} cy={y - 4.5} r="1.8" fill={GOLD_LIGHT} />
          <circle cx={x + dir * 6.5} cy={y} r="1.8" fill={GOLD_LIGHT} />
          <circle cx={x + dir * 6.5} cy={y + 4.5} r="1.8" fill={GOLD_LIGHT} />
        </>
      ) : null}
    </g>
  );
}

function Shoe({
  x,
  y,
  variant,
  color,
  skinColor,
}: {
  x: number;
  y: number;
  variant: string;
  color: string;
  skinColor: string;
}) {
  if (variant === "barefoot") {
    return (
      <g>
        {/* Ankle wrap putih + telapak kaki atletis */}
        <path d={`M ${x - 5} ${y - 11} L ${x + 3} ${y - 11} L ${x + 4} ${y - 4} L ${x - 4} ${y - 4} Z`} fill={PAPER} stroke={INK} strokeWidth="1.5" />
        <path
          d={`M ${x - 6} ${y - 3} Q ${x + 4} ${y - 5} ${x + 14} ${y - 1} L ${x + 15} ${y + 3} L ${x - 6} ${y + 3} Z`}
          fill={skinColor}
          stroke={INK}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </g>
    );
  }
  if (variant === "boots") {
    return (
      <g>
        <path
          d={`M ${x - 8} ${y - 22} H ${x + 5} L ${x + 6} ${y - 6} L ${x + 16} ${y - 2} C ${x + 17} ${y + 1}, ${x + 16} ${y + 3}, ${x + 15} ${y + 3} H ${x - 9} Z`}
          fill={color}
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d={`M ${x - 4} ${y - 17} H ${x + 3} M ${x - 4} ${y - 12} H ${x + 3} M ${x - 3} ${y - 7} H ${x + 4}`} stroke={PAPER} strokeWidth="1.6" strokeLinecap="round" />
        <rect x={x - 10} y={y + 1} width="26" height="4" rx="1" fill={INK} />
        <rect x={x - 9} y={y + 1.5} width="24" height="2" rx="0.5" fill={PAPER} />
      </g>
    );
  }
  if (variant === "sandals") {
    return (
      <g>
        <ellipse cx={x + 4} cy={y - 2} rx="12" ry="4" fill={skinColor} stroke={INK} strokeWidth="1.5" />
        <rect x={x - 9} y={y} width="24" height="3.5" rx="1" fill={PAPER} stroke={INK} strokeWidth="1.5" />
        <rect x={x - 5} y={y + 3.5} width="3.5" height="2.5" fill={INK} />
        <rect x={x + 7} y={y + 3.5} width="3.5" height="2.5" fill={INK} />
        <path d={`M ${x - 3} ${y} L ${x + 7} ${y - 6} M ${x + 7} ${y} L ${x - 3} ${y - 6}`} stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <path d={`M ${x - 3} ${y} L ${x + 7} ${y - 6} M ${x + 7} ${y} L ${x - 3} ${y - 6}`} stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    );
  }
  if (variant === "martial") {
    return (
      <g>
        <ellipse cx={x + 4} cy={y - 1} rx="14" ry="5" fill={color} stroke={INK} strokeWidth="1.8" />
        <path d={`M ${x} ${y - 3.5} L ${x + 6} ${y - 1} L ${x} ${y + 1}`} stroke={PAPER} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x={x - 9} y={y + 2} width="25" height="2.5" rx="1" fill={PAPER} stroke={INK} strokeWidth="1.2" />
      </g>
    );
  }
  // Sneakers High-Top Street
  return (
    <g>
      <path
        d={`M ${x - 8} ${y - 10} L ${x - 8} ${y + 2} L ${x + 16} ${y + 2} C ${x + 17} ${y - 3}, ${x + 10} ${y - 6}, ${x + 3} ${y - 7} L ${x - 1} ${y - 10} Z`}
        fill={color}
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d={`M ${x - 4} ${y - 1} L ${x + 6} ${y - 4}`} stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
      <path d={`M ${x + 1} ${y - 7} L ${x + 5} ${y - 5} M ${x + 4} ${y - 6} L ${x + 8} ${y - 4}`} stroke={PAPER} strokeWidth="1.5" strokeLinecap="round" />
      <rect x={x - 9} y={y + 1} width="26" height="4" rx="1.5" fill={PAPER} stroke={INK} strokeWidth="1.6" />
    </g>
  );
}

/**
 * Torso V-Taper Atletis (menggantikan kotak <rect> lama).
 * Baik saat tanpa baju ('none') maupun berbaju ('shirt', 'singlet', 'jacket', 'gi'),
 * siluet mengikuti anatomi bahu bidang -> pinggang ramping -> panggul proporsional.
 */
function Torso({ variant, color }: { variant: string; color: string }) {
  const vTaperPath =
    "M 85 70 Q 99 65 112 70 C 113 83, 105 95, 103 105 C 102 113, 104 120, 103 126 Q 96 127 89 126 C 88 120, 90 113, 91 105 C 89 95, 84 83, 85 70 Z";
  const backShadowPath =
    "M 85 70 Q 93 67 99 69 L 97 105 L 96 128 Q 92 127 89 126 C 88 120, 90 113, 91 105 C 89 95, 84 83, 85 70 Z";

  if (variant === "none") {
    return (
      <g>
        <path d={vTaperPath} fill={color} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
        {/* Cel-shading sisi belakang torso */}
        <path d={backShadowPath} fill="#000000" fillOpacity="0.22" />
        {/* Kap bahu deltoid */}
        <circle cx={J.shB.x} cy={J.shB.y} r="5.5" fill={color} />
        <circle cx={J.shB.x} cy={J.shB.y} r="5.5" fill="#000000" fillOpacity="0.22" />
        <circle cx={J.shF.x} cy={J.shF.y} r="6.2" fill={color} />
        {/* Kontur otot dada (pectoral) & linea alba (abs) */}
        <path d="M 109 82 Q 103 87 98 85" stroke={INK} strokeOpacity="0.42" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M 98 86 L 96.5 114" stroke={INK} strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 94 96 H 101 M 94.5 104 H 100.5" stroke={INK} strokeOpacity="0.25" strokeWidth="1.3" strokeLinecap="round" />
        {/* Rim light dada depan */}
        <path d="M 110 73 C 111 83, 104 94, 102 104" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
    );
  }

  if (variant === "singlet") {
    const singletPath =
      "M 91 69 L 95 79 Q 99 83 103 79 L 107 69 C 109 82, 105 94, 103.5 105 C 102.5 113, 104 120, 103.5 126 Q 96 127 88.5 126 C 88 120, 89.5 113, 90.5 105 C 89 94, 88 82, 91 69 Z";
    return (
      <g>
        {/* Bahu deltoid terbuka */}
        <path d={vTaperPath} fill={color} stroke={INK} strokeWidth="2.2" />
        <path d={singletPath} fill={color} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M 91 69 L 95 79 Q 99 83 103 79 L 107 69" stroke={PAPER} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M 104 82 C 103 94, 101.5 105, 103.5 122" stroke={PAPER} strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    );
  }

  const clothVTaper =
    "M 83 69 Q 99 64 114 69 C 115 83, 106.5 95, 104.5 105 C 103.5 113, 105 120, 104.5 126 Q 96 127 87.5 126 C 87 120, 88.5 113, 89.5 105 C 87.5 95, 82 83, 83 69 Z";

  return (
    <g>
      {/* Lengan pendek / baju mengikuti arah lengan atas */}
      <path d={sculptedSegmentPath(J.shB, { x: 81, y: 84 }, 11, 10.5, 9.5, 0)} fill={color} stroke={INK} strokeWidth="2" />
      <path d={sculptedSegmentPath(J.shF, { x: 118, y: 84 }, 11.5, 11, 10, 0)} fill={color} stroke={INK} strokeWidth="2" />
      <path d={clothVTaper} fill={color} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d={backShadowPath} fill="#000000" fillOpacity="0.18" />

      {variant === "shirt" ? (
        <>
          <path d="M 93 69 Q 99 75 105 69" stroke={INK} strokeOpacity="0.55" strokeWidth="2.2" fill="none" />
          <path d="M 89 82 L 109 79" stroke={PAPER} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M 114 85 L 121 82 M 78 82 L 84 85" stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : null}

      {variant === "jacket" ? (
        <>
          <polygon points="91,68 99,82 107,68" fill={INK} />
          <path d="M 91 68 L 99 82 L 107 68" stroke={PAPER} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <line x1="99" y1="82" x2="96.5" y2="127" stroke={INK} strokeWidth="3.2" />
          <line x1="99" y1="82" x2="96.5" y2="127" stroke={SILVER} strokeWidth="1.6" />
          <path d="M 114 85 L 121 82 M 78 82 L 84 85" stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : null}

      {variant === "gi" ? (
        <>
          {/* Rok bawah kimono (uwagi) melebar sedikit di bawah sabuk */}
          <path
            d="M 89.5 105 L 82 135 L 95 132 L 97 125 L 99 132 L 110 135 L 104.5 105 Z"
            fill={color}
            stroke={INK}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          {/* Kerah silang Y (eri) tebal */}
          <path d="M 91 68 L 103 106 M 107 68 L 95 92" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 91 68 L 103 106 M 107 68 L 95 92" stroke={PAPER} strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : null}
    </g>
  );
}

function BeltDraw({ variant, color }: { variant: string; color: string }) {
  if (variant === "none") return null;
  if (variant === "champion") {
    return (
      <g>
        <rect x="83" y="117" width="27" height="11" rx="3.5" fill={color} stroke={INK} strokeWidth="2" />
        <rect x="85" y="119" width="4" height="7" rx="1" fill={GOLD} stroke={INK} strokeWidth="1" />
        <rect x="104" y="119" width="4" height="7" rx="1" fill={GOLD} stroke={INK} strokeWidth="1" />
        <polygon points="92,115 102,115 105,122.5 102,130 92,130 89,122.5" fill={GOLD} stroke={INK} strokeWidth="1.8" />
        <circle cx="97" cy="122.5" r="2.6" fill="#E10600" stroke={INK} strokeWidth="0.8" />
      </g>
    );
  }
  if (variant === "rope") {
    return (
      <g strokeLinecap="round">
        <line x1="85" y1="122" x2="107" y2="122" stroke={INK} strokeWidth="7" />
        <line x1="85" y1="122" x2="107" y2="122" stroke={color} strokeWidth="4.2" />
        <path d="M 90 120 L 92 124 M 96 120 L 98 124 M 102 120 L 104 124" stroke={GOLD_LIGHT} strokeWidth="1.4" />
        <path d="M 103 124 L 109 136 M 101 124 L 98 136" stroke={INK} strokeWidth="4.5" />
        <path d="M 103 124 L 109 136 M 101 124 L 98 136" stroke={color} strokeWidth="2.5" />
        <circle cx="102" cy="122" r="4.2" fill={color} stroke={INK} strokeWidth="1.8" />
      </g>
    );
  }
  // Sabuk Bela Diri (Obi) dengan simpul & 2 ekor menggantung
  return (
    <g strokeLinecap="round">
      <line x1="85" y1="122" x2="107" y2="122" stroke={INK} strokeWidth="9" />
      <line x1="85" y1="122" x2="107" y2="122" stroke={color} strokeWidth="5.8" />
      <path d="M 98 123 L 105 137 M 96 123 L 91 138" stroke={INK} strokeWidth="5.8" />
      <path d="M 98 123 L 105 137 M 96 123 L 91 138" stroke={color} strokeWidth="3.4" />
      <circle cx="97" cy="122" r="4.2" fill={color} stroke={INK} strokeWidth="1.8" />
    </g>
  );
}

function WeaponDraw({ variant, color }: { variant: string; color: string }) {
  if (variant === "none") return null;
  if (variant === "short-stick") {
    return (
      <g strokeLinecap="round">
        <line x1="78" y1="98" x2="50" y2="56" stroke={INK} strokeWidth="10.5" />
        <line x1="78" y1="98" x2="50" y2="56" stroke={color} strokeWidth="7" />
        <line x1="78" y1="98" x2="69" y2="85" stroke={INK} strokeWidth="7.5" />
        <line x1="60" y1="71" x2="63" y2="69" stroke={INK} strokeWidth="2" />
      </g>
    );
  }
  if (variant === "wooden-sword") {
    return (
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Bilah katana/bokken ber-shinogi lancip */}
        <polygon points="65,81 33,38 35,31 41,35 71,76" fill={color} stroke={INK} strokeWidth="2.2" />
        <line x1="67" y1="78" x2="36" y2="34" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" />
        {/* Gagang tsuka berlilit */}
        <line x1="80" y1="99" x2="68" y2="83" stroke={INK} strokeWidth="9.5" />
        <line x1="80" y1="99" x2="68" y2="83" stroke="#6B4423" strokeWidth="6" />
        {/* Pelindung tangan (tsuba) emas */}
        <line x1="61" y1="85" x2="74" y2="75" stroke={INK} strokeWidth="5.5" />
        <line x1="62" y1="84" x2="73" y2="76" stroke={GOLD} strokeWidth="3" />
      </g>
    );
  }
  if (variant === "nunchaku") {
    return (
      <g strokeLinecap="round">
        <line x1="72" y1="88" x2="54" y2="62" stroke={INK} strokeWidth="9.5" />
        <line x1="72" y1="88" x2="54" y2="62" stroke={color} strokeWidth="6" />
        <line x1="54" y1="62" x2="46" y2="56" stroke={INK} strokeWidth="4" />
        <line x1="54" y1="62" x2="46" y2="56" stroke={SILVER} strokeWidth="2.2" strokeDasharray="2 2" />
        <line x1="46" y1="56" x2="34" y2="78" stroke={INK} strokeWidth="9.5" />
        <line x1="46" y1="56" x2="34" y2="78" stroke={color} strokeWidth="6" />
        <circle cx="54" cy="62" r="3.2" fill={GOLD} stroke={INK} strokeWidth="1.2" />
        <circle cx="46" cy="56" r="3.2" fill={GOLD} stroke={INK} strokeWidth="1.2" />
      </g>
    );
  }
  // Tongkat Panjang (Bo Staff / Toya) dengan ferrule emas & grip tengah
  return (
    <g strokeLinecap="round">
      <line x1="88" y1="108" x2="28" y2="22" stroke={INK} strokeWidth="10.5" />
      <line x1="88" y1="108" x2="28" y2="22" stroke={color} strokeWidth="7" />
      <line x1="88" y1="108" x2="84" y2="102" stroke={GOLD} strokeWidth="7" />
      <line x1="32" y1="28" x2="28" y2="22" stroke={GOLD} strokeWidth="7" />
      <path d="M 66 81 L 71 77 M 61 74 L 66 70 M 56 67 L 61 63" stroke={PAPER} strokeWidth="2.2" />
    </g>
  );
}

/**
 * Preview stickman fighter yang berubah langsung mengikuti aksesoris
 * dan warna yang dipilih di form.
 */
export default function FighterPreview({
  colors,
  accessories,
  name,
}: {
  colors: FighterColorsLike;
  accessories?: Partial<FighterAccessories> | null;
  name?: string;
}) {
  const body = asColor(colors.body) ?? "#F97316";
  const gloves = asColor(colors.gloves) ?? "#141210";
  const shoes = asColor(colors.shoes) ?? "#FBF8F1";
  const headColor = asColor(colors.headband) ?? "#8B5E34";
  const beltColor = asColor(colors.belt) ?? GOLD;
  const weaponColor = asColor(colors.weapon) ?? "#8B5E34";

  const acc = resolveAccessories(accessories, {
    headband: colors.headband,
    belt: colors.belt,
    weapon: colors.weapon,
  });

  const label = [
    `Kepala ${accessoryLabel("head", acc.head)}`,
    `Tangan ${accessoryLabel("hands", acc.hands)}`,
    `Kaki ${accessoryLabel("feet", acc.feet)}`,
    `Badan ${accessoryLabel("body", acc.body)}`,
    `Sabuk ${accessoryLabel("belt", acc.belt)}`,
    `Senjata ${accessoryLabel("weapon", acc.weapon)}`,
  ].join(", ");

  return (
    <figure
      role="img"
      aria-label={`Preview fighter${name ? ` ${name}` : ""}: ${label}`}
      className="overflow-hidden rounded-2xl border border-white/15 bg-ink-950"
    >
      <svg viewBox="0 0 200 250" className="block h-auto w-full" aria-hidden="true">
        <defs>
          <radialGradient id="fp-glow" cx="50%" cy="56%" r="58%">
            <stop offset="0%" stopColor={body} stopOpacity="0.22" />
            <stop offset="55%" stopColor="#f5a623" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="200" height="250" fill="url(#fp-glow)" />

        {/* Tali ring samar di latar belakang + lantai arena + bayangan pijakan */}
        <line x1="14" y1="158" x2="186" y2="158" stroke="#e10600" strokeOpacity="0.14" strokeWidth="1.5" />
        <line x1="14" y1="188" x2="186" y2="188" stroke="#e10600" strokeOpacity="0.14" strokeWidth="1.5" />
        <ellipse cx="98" cy="230" rx="52" ry="7.5" fill="#000000" fillOpacity="0.45" />
        <ellipse cx="128" cy="229" rx="20" ry="4" fill="#000000" fillOpacity="0.3" />
        <line x1="18" y1="232" x2="182" y2="232" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" />

        {/* Senjata di tangan belakang */}
        <WeaponDraw variant={acc.weapon} color={weaponColor} />

        {/* Kaki & lengan belakang (berotot + cel-shading lebih gelap) */}
        <g stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
          <path d={sculptedSegmentPath(J.hipB, J.kneeB, 10.5, 10, 7, 1.3)} fill={body} />
          <path d={sculptedSegmentPath(J.hipB, J.kneeB, 10.5, 10, 7, 1.3)} fill="#000000" fillOpacity="0.32" />
          <path d={sculptedSegmentPath(J.kneeB, J.footB, 7, 8.2, 5.2, -1.2)} fill={body} />
          <path d={sculptedSegmentPath(J.kneeB, J.footB, 7, 8.2, 5.2, -1.2)} fill="#000000" fillOpacity="0.32" />
          <path d={sculptedSegmentPath(J.shB, J.elbowB, 8.5, 8.8, 6.2, 1.0)} fill={body} />
          <path d={sculptedSegmentPath(J.shB, J.elbowB, 8.5, 8.8, 6.2, 1.0)} fill="#000000" fillOpacity="0.32" />
          <path d={sculptedSegmentPath(J.elbowB, J.handB, 6.4, 7.2, 5.2, -0.8)} fill={body} />
          <path d={sculptedSegmentPath(J.elbowB, J.handB, 6.4, 7.2, 5.2, -0.8)} fill="#000000" fillOpacity="0.32" />
        </g>

        {/* Torso V-Taper Atletis (dan baju jika dipakai) */}
        <Torso variant={acc.body} color={body} />

        {/* Sabuk */}
        <BeltDraw variant={acc.belt} color={beltColor} />

        {/* Kaki & lengan depan (otot anatomis bervolume + rim highlight) */}
        <g stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
          <path d={sculptedSegmentPath(J.hipF, J.kneeF, 11.5, 11, 7.5, 1.6)} fill={body} />
          <path d={sculptedSegmentPath(J.kneeF, J.footF, 7.5, 8.8, 5.5, -1.4)} fill={body} />
          <path d={sculptedSegmentPath(J.shF, J.elbowF, 9.2, 9.6, 6.5, 1.2)} fill={body} />
          <path d={sculptedSegmentPath(J.elbowF, J.handF, 6.8, 7.8, 5.5, -0.9)} fill={body} />
        </g>
        {/* Sorot otot paha & lengan depan */}
        <path d="M 110 135 Q 116 152 118 168" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M 116 75 Q 121 85 123 93" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.6" strokeLinecap="round" fill="none" />

        {/* Sendi lutut & siku mulus */}
        <g fill={body}>
          <circle cx={J.elbowF.x} cy={J.elbowF.y} r="3.6" />
          <circle cx={J.kneeF.x} cy={J.kneeF.y} r="4" />
        </g>

        {/* Sepatu / Kaki */}
        <Shoe x={J.footB.x} y={J.footB.y} variant={acc.feet} color={shoes} skinColor={body} />
        <Shoe x={J.footF.x} y={J.footF.y} variant={acc.feet} color={shoes} skinColor={body} />

        {/* Sarung tangan / Kepalan */}
        <Glove x={J.handB.x} y={J.handB.y} variant={acc.hands} color={gloves} front={false} />
        <Glove x={J.handF.x} y={J.handF.y} variant={acc.hands} color={gloves} front />

        {/* Leher berotot + bayangan bawah dagu + Kepala 3D ekspresif */}
        <path d="M 95.5 69 L 97 56 L 104 56 L 103 69 Z" fill={body} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M 96.5 62 L 97 56 L 104 56 L 103.5 62 Z" fill="#000000" fillOpacity="0.28" />

        <circle cx={J.head.x} cy={J.head.y} r="15" fill={PAPER} stroke={INK} strokeWidth="3.2" />
        <circle cx={J.head.x} cy={J.head.y} r="12.4" fill="none" stroke={body} strokeWidth="2.2" />
        {/* Rim-light atas kepala */}
        <path d={`M ${J.head.x - 9} ${J.head.y - 8} A 11.5 11.5 0 0 1 ${J.head.x + 4} ${J.head.y - 11.5}`} stroke="#ffffff" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Mata & ekspresi petarung fokus */}
        <circle cx={J.head.x + 4.5} cy={J.head.y - 1.5} r="2.4" fill={INK} />
        <circle cx={J.head.x + 9.5} cy={J.head.y - 1.8} r="1.6" fill={INK} />
        <circle cx={J.head.x + 5.2} cy={J.head.y - 2.2} r="0.8" fill={PAPER} />
        <path d={`M ${J.head.x + 1} ${J.head.y - 6.5} L ${J.head.x + 8.5} ${J.head.y - 5}`} stroke={INK} strokeWidth="2.3" strokeLinecap="round" />
        <path d={`M ${J.head.x + 8} ${J.head.y - 6.2} L ${J.head.x + 11.5} ${J.head.y - 5.2}`} stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
        <path d={`M ${J.head.x + 3} ${J.head.y + 5.5} Q ${J.head.x + 6} ${J.head.y + 6} ${J.head.x + 8.5} ${J.head.y + 4.2}`} stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Aksesoris kepala */}
        <HeadAccessory variant={acc.head} color={headColor} />
      </svg>
      <figcaption className="border-t border-white/10 px-4 py-3 text-center">
        <span className="font-display text-lg uppercase tracking-wide text-paper">
          {name?.trim() ? name.trim() : "Fighter-mu"}
        </span>
        <span className="mt-0.5 block text-xs text-paper-mute">
          Preview berubah langsung setiap kali kamu mengganti aksesoris atau warna
        </span>
      </figcaption>
    </figure>
  );
}
