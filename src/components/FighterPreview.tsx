"use client";

import {
  ACCESSORY_CATALOG,
  accessoryLabel,
  resolveAccessories,
  type AccessoryPart,
  type FighterAccessories,
} from "@/lib/game/accessories";

/**
 * Preview karakter fighter + ikon item, digambar dengan kode (SVG).
 *
 * Dipakai di form fighter-saya supaya pemilihan aksesoris/warna terlihat
 * langsung: preview stickman mengikuti aksesoris + warna yang dipilih,
 * tiap varian aksesoris punya ikonnya sendiri.
 *
 * Gambar mengikuti cara arena menggambar petarung (film.js):
 * garis tinta di bawah segmen, warna badan menutup tengahnya,
 * kepala putih, sarung tangan + sepatu + sabuk + ikat kepala + tongkat.
 * Varian baru mengikuti deskripsi katalog aksesoris (kepala, tangan,
 * kaki, badan, sabuk, senjata) — tampilan lama (ikat kepala, sarung
 * tinju, sepatu, sabuk, tongkat) tidak diubah.
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

/** Normalisasi nilai warna: "none" -> null (item tidak dipakai). */
function asColor(v: string): string | null {
  return v === "none" ? null : v;
}

/** Ikon kecil tiap item, digambar dengan warna item itu sendiri. */
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
            <circle cx="24" cy="11" r="7" fill={PAPER} stroke={INK} strokeWidth="2" />
            <path d="M24 19 L24 34" stroke={fill} strokeWidth="5" strokeLinecap="round" />
            <path d="M24 23 L14 30 M24 23 L34 30" stroke={fill} strokeWidth="4" strokeLinecap="round" />
            <path d="M24 34 L16 44 M24 34 L32 44" stroke={fill} strokeWidth="4" strokeLinecap="round" />
          </>
        ) : null}
        {part === "gloves" ? (
          <>
            <circle cx="24" cy="24" r="12" fill={fill} stroke={INK} strokeWidth="2" />
            <path d="M14 30 A12 12 0 0 0 34 30" stroke={PAPER} strokeWidth="3" strokeLinecap="round" />
          </>
        ) : null}
        {part === "shoes" ? (
          <>
            <ellipse cx="24" cy="28" rx="15" ry="8" fill={fill} stroke={INK} strokeWidth="2" />
            <path d="M10 32 H38" stroke={PAPER} strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : null}
        {part === "belt" ? (
          <>
            <rect x="7" y="18" width="34" height="11" rx="4" fill={fill} stroke={INK} strokeWidth="2" />
            <rect x="21" y="18" width="6" height="11" fill={PAPER} opacity="0.85" />
          </>
        ) : null}
        {part === "headband" ? (
          <>
            <circle cx="24" cy="23" r="11" fill={PAPER} stroke={INK} strokeWidth="2" />
            <path d="M14 19 A11 11 0 0 1 34 19" stroke={fill} strokeWidth="5" strokeLinecap="round" />
            <path d="M15 21 L6 28" stroke={fill} strokeWidth="3" strokeLinecap="round" />
          </>
        ) : null}
        {part === "weapon" ? (
          <path d="M11 39 L37 9" stroke={fill} strokeWidth="7" strokeLinecap="round" />
        ) : null}
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Ikon satu varian aksesoris (untuk grid pemilih di form).            */
/* ------------------------------------------------------------------ */

/** Warna gambar ikon: 'none' -> abu redup (varian "tanpa"). */
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
      <svg viewBox="0 0 48 48" width="32" height="32" fill="none">
        {part === "head" ? (
          <>
            <circle cx="24" cy="27" r="10" fill={PAPER} stroke={INK} strokeWidth="2" />
            {variant === "headband" ? (
              <>
                <path d="M15 24 A10 10 0 0 1 33 24" stroke={fill} strokeWidth="4" strokeLinecap="round" />
                <path d="M16 25 L8 31" stroke={fill} strokeWidth="2.5" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "bandana" ? (
              <>
                <path d="M15 25 A10 10 0 0 1 33 25 L31 19 A9 9 0 0 0 17 19 Z" fill={fill} stroke={INK} strokeWidth="1.5" />
                <circle cx="15" cy="25" r="2.5" fill={fill} stroke={INK} strokeWidth="1" />
                <path d="M14 27 L9 33 M16 28 L13 34" stroke={fill} strokeWidth="2" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "cap" ? (
              <>
                <path d="M15 25 A10 10 0 0 1 33 25 Z" fill={fill} stroke={INK} strokeWidth="1.5" />
                <ellipse cx="35" cy="24" rx="7" ry="3" fill={fill} stroke={INK} strokeWidth="1.5" />
              </>
            ) : null}
            {variant === "crown" ? (
              <path d="M15 24 L17 13 L21 20 L24 11 L27 20 L31 13 L33 24 Z" fill={fill} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
            ) : null}
            {variant === "helmet" ? (
              <>
                <circle cx="24" cy="25" r="11.5" fill={fill} stroke={INK} strokeWidth="1.5" />
                <path d="M15 24 A10 10 0 0 1 33 24" stroke={PAPER} strokeWidth="2.5" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "topknot" ? (
              <circle cx="24" cy="13" r="4" fill={fill} stroke={INK} strokeWidth="1.5" />
            ) : null}
          </>
        ) : null}
        {part === "hands" ? (
          <>
            {variant === "none" ? (
              <circle cx="24" cy="24" r="6" fill={PAPER} stroke={INK} strokeWidth="2" />
            ) : null}
            {variant === "boxing" ? (
              <>
                <circle cx="24" cy="24" r="12" fill={fill} stroke={INK} strokeWidth="2" />
                <path d="M14 30 A12 12 0 0 0 34 30" stroke={PAPER} strokeWidth="3" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "big" ? (
              <>
                <circle cx="24" cy="24" r="16" fill={fill} stroke={INK} strokeWidth="2" />
                <path d="M11 32 A16 16 0 0 0 37 32" stroke={PAPER} strokeWidth="3" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "mma" ? (
              <>
                <circle cx="24" cy="24" r="12" fill={fill} stroke={INK} strokeWidth="2" />
                <path d="M16 18 A12 12 0 0 1 32 18" stroke={PAPER} strokeWidth="2.5" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "wraps" ? (
              <>
                <circle cx="24" cy="24" r="10" fill={fill} stroke={INK} strokeWidth="2" />
                <path d="M15 21 H33 M15 27 H33" stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "fingerless" ? (
              <>
                <circle cx="24" cy="24" r="13" fill={fill} stroke={INK} strokeWidth="2" />
                <path d="M33 18 V30 M36 20 V28" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M30 16 V20 M30 28 V32" stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
              </>
            ) : null}
          </>
        ) : null}
        {part === "feet" ? (
          <>
            {variant === "barefoot" ? (
              <path d="M12 32 Q24 26 36 32 L36 37 L12 37 Z" fill={PAPER} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            ) : null}
            {variant === "sneakers" ? (
              <>
                <ellipse cx="24" cy="30" rx="15" ry="7" fill={fill} stroke={INK} strokeWidth="2" />
                <path d="M10 34 H38" stroke={PAPER} strokeWidth="2.5" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "boots" ? (
              <>
                <rect x="17" y="12" width="14" height="16" rx="2" fill={fill} stroke={INK} strokeWidth="2" />
                <ellipse cx="24" cy="30" rx="15" ry="7" fill={fill} stroke={INK} strokeWidth="2" />
              </>
            ) : null}
            {variant === "sandals" ? (
              <>
                <ellipse cx="24" cy="31" rx="15" ry="3.5" fill={fill} stroke={INK} strokeWidth="2" />
                <path d="M18 28 L30 33" stroke={INK} strokeWidth="2" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "martial" ? (
              <ellipse cx="24" cy="31" rx="15" ry="4" fill={fill} stroke={INK} strokeWidth="2" />
            ) : null}
          </>
        ) : null}
        {part === "body" ? (
          <>
            <circle cx="24" cy="10" r="6" fill={PAPER} stroke={INK} strokeWidth="2" />
            {variant === "none" ? (
              <path d="M24 18 L24 40" stroke={fill} strokeWidth="5" strokeLinecap="round" />
            ) : null}
            {variant === "shirt" ? (
              <>
                <path d="M24 19 L14 25 M24 19 L34 25" stroke={fill} strokeWidth="7" strokeLinecap="round" />
                <rect x="18" y="18" width="12" height="22" rx="5" fill={fill} stroke={INK} strokeWidth="1.5" />
              </>
            ) : null}
            {variant === "singlet" ? (
              <rect x="19" y="18" width="10" height="22" rx="4" fill={fill} stroke={INK} strokeWidth="1.5" />
            ) : null}
            {variant === "jacket" ? (
              <>
                <path d="M24 19 L14 25 M24 19 L34 25" stroke={fill} strokeWidth="7" strokeLinecap="round" />
                <rect x="18" y="18" width="12" height="22" rx="5" fill={fill} stroke={INK} strokeWidth="1.5" />
                <path d="M24 20 L20 26 M24 20 L28 26" stroke={PAPER} strokeWidth="1.8" strokeLinecap="round" />
                <path d="M24 27 L24 39" stroke={INK} strokeWidth="1.2" />
              </>
            ) : null}
            {variant === "gi" ? (
              <>
                <path d="M24 19 L14 25 M24 19 L34 25" stroke={fill} strokeWidth="7" strokeLinecap="round" />
                <rect x="18" y="18" width="12" height="22" rx="5" fill={fill} stroke={INK} strokeWidth="1.5" />
                <path d="M19 20 L29 29 M29 20 L19 29" stroke={PAPER} strokeWidth="1.8" strokeLinecap="round" />
              </>
            ) : null}
          </>
        ) : null}
        {part === "belt" ? (
          <>
            {variant === "none" ? (
              <rect x="7" y="18" width="34" height="11" rx="4" fill="none" stroke={INK} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
            ) : null}
            {variant === "belt" ? (
              <>
                <rect x="7" y="18" width="34" height="11" rx="4" fill={fill} stroke={INK} strokeWidth="2" />
                <rect x="21" y="18" width="6" height="11" fill={PAPER} opacity="0.85" />
              </>
            ) : null}
            {variant === "champion" ? (
              <>
                <rect x="7" y="17" width="34" height="13" rx="4" fill={fill} stroke={INK} strokeWidth="2" />
                <rect x="19" y="19" width="10" height="9" rx="1" fill={GOLD} stroke={INK} strokeWidth="1.5" />
              </>
            ) : null}
            {variant === "rope" ? (
              <>
                <path d="M7 23 H41" stroke={fill} strokeWidth="3" strokeLinecap="round" />
                <circle cx="30" cy="23" r="3.5" fill={fill} stroke={INK} strokeWidth="1.5" />
                <path d="M32 26 L36 32 M29 26 L27 32" stroke={fill} strokeWidth="2" strokeLinecap="round" />
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
              <path d="M11 39 L37 9" stroke={fill} strokeWidth="7" strokeLinecap="round" />
            ) : null}
            {variant === "short-stick" ? (
              <path d="M17 33 L31 15" stroke={fill} strokeWidth="7" strokeLinecap="round" />
            ) : null}
            {variant === "wooden-sword" ? (
              <>
                <path d="M15 37 L33 13" stroke={fill} strokeWidth="9" strokeLinecap="round" />
                <path d="M24 30 L30 24" stroke={INK} strokeWidth="3" strokeLinecap="round" />
              </>
            ) : null}
            {variant === "nunchaku" ? (
              <>
                <path d="M13 33 L23 19" stroke={fill} strokeWidth="6" strokeLinecap="round" />
                <path d="M23 19 L27 15" stroke={INK} strokeWidth="2" strokeDasharray="2 2" strokeLinecap="round" />
                <path d="M27 15 L37 27" stroke={fill} strokeWidth="6" strokeLinecap="round" />
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

/** Titik-titik sendi pose guard (menghadap kanan), mengikuti arena. */
const J = {
  head: { x: 100, y: 48 },
  shoulder: { x: 100, y: 68 },
  hip: { x: 97, y: 126 },
  kneeF: { x: 116, y: 176 },
  footF: { x: 130, y: 228 },
  kneeB: { x: 78, y: 178 },
  footB: { x: 64, y: 228 },
  elbowF: { x: 120, y: 96 },
  handF: { x: 130, y: 84 },
  elbowB: { x: 82, y: 98 },
  handB: { x: 74, y: 88 },
};

function limbPath(a: { x: number; y: number }, m: { x: number; y: number }, b: { x: number; y: number }) {
  return `M ${a.x} ${a.y} L ${m.x} ${m.y} L ${b.x} ${b.y}`;
}

/* ------------------------------------------------------------------ */
/* Gambar tiap varian di preview besar (viewBox 200x250).              */
/* ------------------------------------------------------------------ */

function HeadAccessory({ variant, color }: { variant: string; color: string }) {
  if (variant === "none") return null;
  return (
    <g strokeLinecap="round" fill="none">
      {variant === "headband" ? (
        <>
          <path d="M 88 42 A 14 14 0 0 1 112 42" stroke={color} strokeWidth="5" />
          <path d="M 88 44 L 74 52" stroke={color} strokeWidth="3" />
        </>
      ) : null}
      {variant === "bandana" ? (
        <>
          <path d="M 86 48 A 14 14 0 0 1 114 48 L 110 38 A 12 12 0 0 0 90 38 Z" fill={color} stroke={INK} strokeWidth="1.5" />
          <circle cx="86" cy="48" r="3.5" fill={color} stroke={INK} strokeWidth="1" />
          <path d="M 84 50 L 76 58 M 87 52 L 81 61" stroke={color} strokeWidth="2.5" />
        </>
      ) : null}
      {variant === "cap" ? (
        <>
          <path d="M 86 46 A 14 14 0 0 1 114 46 Z" fill={color} stroke={INK} strokeWidth="2" />
          <ellipse cx="118" cy="44" rx="8" ry="3.5" fill={color} stroke={INK} strokeWidth="1.5" />
        </>
      ) : null}
      {variant === "crown" ? (
        <path d="M 88 42 L 92 28 L 96 38 L 100 26 L 104 38 L 108 28 L 112 42 Z" fill={color} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      ) : null}
      {variant === "helmet" ? (
        <>
          <circle cx="100" cy="46" r="15.5" fill={color} stroke={INK} strokeWidth="2" />
          <path d="M 88 44 A 14 14 0 0 1 112 44" stroke={PAPER} strokeWidth="2.5" />
        </>
      ) : null}
      {variant === "topknot" ? (
        <>
          <circle cx="100" cy="30" r="5.5" fill={color} stroke={INK} strokeWidth="1.5" />
          <path d="M 95 35 L 105 35" stroke={INK} strokeWidth="1.5" />
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
    return <circle cx={x} cy={y} r="6" fill={PAPER} stroke={INK} strokeWidth="2" />;
  }
  const r = variant === "big" ? 17 : variant === "wraps" ? 10 : variant === "fingerless" ? 13 : 12;
  const cuff = variant === "boxing" || variant === "big";
  const edge = front ? x + r - 2 : x - r + 2;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={color} stroke={INK} strokeWidth="2" />
      {cuff ? (
        <path d={`M ${x - r + 4} ${y + r - 4} A ${r} ${r} 0 0 0 ${x + r - 4} ${y + r - 4}`} stroke={PAPER} strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : null}
      {variant === "mma" ? (
        <path d={`M ${x - r + 4} ${y - r + 5} A ${r} ${r} 0 0 1 ${x + r - 4} ${y - r + 5}`} stroke={PAPER} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ) : null}
      {variant === "wraps" ? (
        <path d={`M ${x - 8} ${y - 3} H ${x + 8} M ${x - 8} ${y + 3} H ${x + 8}`} stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
      ) : null}
      {variant === "fingerless" ? (
        <path
          d={`M ${edge} ${y - 6} ${front ? "h 4" : "h -4"} M ${edge} ${y} ${front ? "h 4" : "h -4"} M ${edge} ${y + 6} ${front ? "h 4" : "h -4"}`}
          stroke={INK}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ) : null}
    </g>
  );
}

function Shoe({
  x,
  y,
  variant,
  color,
}: {
  x: number;
  y: number;
  variant: string;
  color: string;
}) {
  if (variant === "barefoot") return null;
  if (variant === "boots") {
    return (
      <g>
        <rect x={x - 7} y={y - 22} width="14" height="22" fill={color} stroke={INK} strokeWidth="1.5" />
        <ellipse cx={x} cy={y} rx="12" ry="6" fill={color} stroke={INK} strokeWidth="1.5" />
      </g>
    );
  }
  if (variant === "sandals") {
    return (
      <g>
        <ellipse cx={x} cy={y} rx="12" ry="3.5" fill={color} stroke={INK} strokeWidth="1.5" />
        <path d={`M ${x - 6} ${y - 3} L ${x + 6} ${y + 2}`} stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      </g>
    );
  }
  if (variant === "martial") {
    return <ellipse cx={x} cy={y} rx="13" ry="4" fill={color} stroke={INK} strokeWidth="1.5" />;
  }
  return (
    <g>
      <ellipse cx={x} cy={y} rx="12" ry="6" fill={color} stroke={INK} strokeWidth="1.5" />
      <path d={`M ${x - 12} ${y + 5} H ${x + 12}`} stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function Torso({ variant, color }: { variant: string; color: string }) {
  if (variant === "none") {
    return (
      <line x1={J.hip.x} y1={J.hip.y} x2={J.shoulder.x} y2={J.shoulder.y} stroke={color} strokeWidth="6" strokeLinecap="round" />
    );
  }
  const w = variant === "singlet" ? 18 : 24;
  const x = 100 - w / 2;
  return (
    <g>
      {variant === "shirt" || variant === "jacket" || variant === "gi" ? (
        <g stroke={color} strokeWidth="10" strokeLinecap="round">
          <path d={`M ${J.shoulder.x} ${J.shoulder.y} L 112 84`} />
          <path d={`M ${J.shoulder.x} ${J.shoulder.y} L 88 84`} />
        </g>
      ) : null}
      <rect x={x} y="66" width={w} height="62" rx="9" fill={color} stroke={INK} strokeWidth="1.5" />
      {variant === "jacket" ? (
        <>
          <path d="M 100 68 L 93 79 M 100 68 L 107 79" stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
          <path d="M 100 80 L 100 124" stroke={INK} strokeWidth="1.5" />
        </>
      ) : null}
      {variant === "gi" ? (
        <path d="M 91 68 L 109 82 M 109 68 L 91 82" stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
      ) : null}
    </g>
  );
}

function BeltDraw({ variant, color }: { variant: string; color: string }) {
  if (variant === "none") return null;
  if (variant === "champion") {
    return (
      <g>
        <rect x="84" y="120" width="28" height="12" rx="3" fill={color} stroke={INK} strokeWidth="1.5" />
        <rect x="95" y="121.5" width="10" height="9" rx="1" fill={GOLD} stroke={INK} strokeWidth="1" />
      </g>
    );
  }
  if (variant === "rope") {
    return (
      <g strokeLinecap="round">
        <line x1="86" y1="126" x2="108" y2="126" stroke={color} strokeWidth="3" />
        <circle cx="107" cy="126" r="3.5" fill={color} stroke={INK} strokeWidth="1" />
        <path d="M 109 129 L 113 135 M 105 129 L 103 135" stroke={color} strokeWidth="2" />
      </g>
    );
  }
  return (
    <line x1="86" y1="126" x2="108" y2="126" stroke={color} strokeWidth="8" strokeLinecap="round" />
  );
}

function WeaponDraw({ variant, color }: { variant: string; color: string }) {
  if (variant === "none") return null;
  if (variant === "short-stick") {
    return (
      <line x1="80" y1="100" x2="54" y2="62" stroke={color} strokeWidth="7" strokeLinecap="round" />
    );
  }
  if (variant === "wooden-sword") {
    return (
      <g strokeLinecap="round">
        <line x1="78" y1="94" x2="70" y2="82" stroke="#6B4423" strokeWidth="5" />
        <line x1="74" y1="88" x2="40" y2="44" stroke={color} strokeWidth="10" />
        <line x1="64" y1="88" x2="78" y2="76" stroke={INK} strokeWidth="3" />
      </g>
    );
  }
  if (variant === "nunchaku") {
    return (
      <g strokeLinecap="round">
        <line x1="74" y1="88" x2="56" y2="64" stroke={color} strokeWidth="6" />
        <line x1="56" y1="64" x2="50" y2="58" stroke={INK} strokeWidth="2" strokeDasharray="2 2" />
        <line x1="50" y1="58" x2="38" y2="76" stroke={color} strokeWidth="6" />
      </g>
    );
  }
  return (
    <line x1="88" y1="106" x2="30" y2="24" stroke={color} strokeWidth="7" strokeLinecap="round" />
  );
}

/**
 * Preview stickman fighter yang berubah langsung mengikuti aksesoris
 * dan warna yang dipilih di form. Sabuk, ikat kepala, dan senjata
 * hanya muncul kalau variannya bukan "none" (warna 'none' pada
 * varian terpilih digambar dengan warna netral pengganti).
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
  // Warna 'none' pada varian terpilih -> warna netral pengganti supaya
  // varian tetap terlihat (form menyinkronkan varian 'none' <-> 'none').
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
          <radialGradient id="fp-glow" cx="50%" cy="62%" r="55%">
            <stop offset="0%" stopColor="#f5a623" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#f5a623" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="200" height="250" fill="url(#fp-glow)" />
        {/* Lantai ring */}
        <line x1="18" y1="232" x2="182" y2="232" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" />

        {/* Senjata (di tangan belakang) — di bawah badan */}
        <WeaponDraw variant={acc.weapon} color={weaponColor} />

        {/* Garis tinta di bawah segmen (seperti arena) */}
        <g stroke={INK} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={limbPath(J.hip, J.kneeB, J.footB)} />
          <path d={limbPath(J.shoulder, J.elbowB, J.handB)} />
          <path d={`M ${J.hip.x} ${J.hip.y} L ${J.shoulder.x} ${J.shoulder.y}`} strokeWidth="10" />
          <path d={limbPath(J.hip, J.kneeF, J.footF)} />
          <path d={limbPath(J.shoulder, J.elbowF, J.handF)} />
        </g>

        {/* Kaki & tangan belakang (lebih gelap) */}
        <g stroke={body} strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={limbPath(J.hip, J.kneeB, J.footB)} />
          <path d={limbPath(J.shoulder, J.elbowB, J.handB)} />
        </g>

        {/* Torso (varian badan) */}
        <Torso variant={acc.body} color={body} />

        {/* Sabuk */}
        <BeltDraw variant={acc.belt} color={beltColor} />

        {/* Kaki & tangan depan */}
        <g stroke={body} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={limbPath(J.hip, J.kneeF, J.footF)} />
          <path d={limbPath(J.shoulder, J.elbowF, J.handF)} />
        </g>

        {/* Sendi */}
        <g fill={body}>
          <circle cx={J.shoulder.x} cy={J.shoulder.y} r="4" />
          <circle cx={J.elbowF.x} cy={J.elbowF.y} r="3.5" />
          <circle cx={J.hip.x} cy={J.hip.y} r="4" />
          <circle cx={J.kneeF.x} cy={J.kneeF.y} r="3.5" />
        </g>

        {/* Sepatu */}
        <Shoe x={134} y={228} variant={acc.feet} color={shoes} />
        <Shoe x={60} y={228} variant={acc.feet} color={shoes} />

        {/* Sarung tangan */}
        <Glove x={J.handF.x} y={J.handF.y} variant={acc.hands} color={gloves} front />
        <Glove x={J.handB.x} y={J.handB.y} variant={acc.hands} color={gloves} front={false} />

        {/* Leher + kepala */}
        <line x1={J.shoulder.x} y1={J.shoulder.y} x2={J.head.x} y2={J.head.y} stroke={body} strokeWidth="7" strokeLinecap="round" />
        <circle cx={J.head.x} cy={J.head.y} r="14" fill={PAPER} stroke={INK} strokeWidth="2.5" />
        <circle cx={J.head.x} cy={J.head.y} r="11.5" fill="none" stroke={body} strokeWidth="2.5" />

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
