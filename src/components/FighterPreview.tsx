"use client";

/**
 * Preview karakter fighter + ikon item, digambar dengan kode (SVG).
 *
 * Dipakai di form fighter-saya supaya pemilihan warna/item terlihat
 * langsung: preview stickman mengikuti warna yang dipilih, tiap item
 * punya ikonnya sendiri, dan tiap item punya banyak pilihan warna
 * preset yang bisa di-tap — bukan cuma ketik hex.
 *
 * Gambar mengikuti cara arena menggambar petarung (film.js):
 * garis tinta di bawah segmen, warna badan menutup tengahnya,
 * kepala putih, sarung tangan + sepatu + sabuk + ikat kepala + tongkat.
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

/**
 * Preview stickman fighter yang berubah langsung mengikuti warna
 * yang dipilih di form. Sabuk, ikat kepala, dan senjata hanya muncul
 * kalau warnanya bukan "none".
 */
export default function FighterPreview({
  colors,
  name,
}: {
  colors: FighterColorsLike;
  name?: string;
}) {
  const body = asColor(colors.body) ?? "#F97316";
  const gloves = asColor(colors.gloves) ?? "#141210";
  const shoes = asColor(colors.shoes) ?? "#FBF8F1";
  const belt = asColor(colors.belt);
  const headband = asColor(colors.headband);
  const weapon = asColor(colors.weapon);

  const label = [
    `Badan ${colors.body}`,
    `Sarung tangan ${colors.gloves}`,
    `Sepatu ${colors.shoes}`,
    belt ? `Sabuk ${colors.belt}` : "tanpa sabuk",
    headband ? `Ikat kepala ${colors.headband}` : "tanpa ikat kepala",
    weapon ? `Senjata ${colors.weapon}` : "tanpa senjata",
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

        {/* Senjata (tongkat di tangan belakang) — di bawah badan */}
        {weapon ? (
          <line
            x1="88"
            y1="106"
            x2="30"
            y2="24"
            stroke={weapon}
            strokeWidth="7"
            strokeLinecap="round"
          />
        ) : null}

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

        {/* Torso */}
        <line x1={J.hip.x} y1={J.hip.y} x2={J.shoulder.x} y2={J.shoulder.y} stroke={body} strokeWidth="6" strokeLinecap="round" />

        {/* Sabuk */}
        {belt ? (
          <line x1="86" y1="126" x2="108" y2="126" stroke={belt} strokeWidth="8" strokeLinecap="round" />
        ) : null}

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
        <g>
          <ellipse cx="134" cy="228" rx="12" ry="6" fill={shoes} stroke={INK} strokeWidth="1.5" />
          <ellipse cx="60" cy="228" rx="12" ry="6" fill={shoes} stroke={INK} strokeWidth="1.5" />
        </g>

        {/* Sarung tangan + manset putih */}
        <g>
          <circle cx={J.handF.x} cy={J.handF.y} r="12" fill={gloves} stroke={INK} strokeWidth="2" />
          <path d={`M ${J.handF.x - 8} ${J.handF.y + 8} A 12 12 0 0 0 ${J.handF.x + 8} ${J.handF.y + 8}`} stroke={PAPER} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx={J.handB.x} cy={J.handB.y} r="12" fill={gloves} stroke={INK} strokeWidth="2" />
          <path d={`M ${J.handB.x - 8} ${J.handB.y + 8} A 12 12 0 0 0 ${J.handB.x + 8} ${J.handB.y + 8}`} stroke={PAPER} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>

        {/* Leher + kepala */}
        <line x1={J.shoulder.x} y1={J.shoulder.y} x2={J.head.x} y2={J.head.y} stroke={body} strokeWidth="7" strokeLinecap="round" />
        <circle cx={J.head.x} cy={J.head.y} r="14" fill={PAPER} stroke={INK} strokeWidth="2.5" />
        <circle cx={J.head.x} cy={J.head.y} r="11.5" fill="none" stroke={body} strokeWidth="2.5" />

        {/* Ikat kepala + ekor berkibar */}
        {headband ? (
          <g stroke={headband} strokeLinecap="round" fill="none">
            <path d="M 88 42 A 14 14 0 0 1 112 42" strokeWidth="5" />
            <path d="M 88 44 L 74 52" strokeWidth="3" />
          </g>
        ) : null}
      </svg>
      <figcaption className="border-t border-white/10 px-4 py-3 text-center">
        <span className="font-display text-lg uppercase tracking-wide text-paper">
          {name?.trim() ? name.trim() : "Fighter-mu"}
        </span>
        <span className="mt-0.5 block text-xs text-paper-mute">
          Preview berubah langsung setiap kali kamu mengganti warna
        </span>
      </figcaption>
    </figure>
  );
}

