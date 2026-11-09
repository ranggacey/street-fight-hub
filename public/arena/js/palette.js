// palette.js — token warna Stickman Fight Arena (web app).
// Identitas Street Fight: kertas #FBF8F1, tinta #141210, merah #E10600.
// Arena KERTAS (bukan gudang gelap seperti video) — satu identitas dengan UI web.
// Warna petarung datang dari builder (hex), PALETTE hanya menyimpan token
// arena + warna bernama untuk preset.
export const PALETTE = {
  paper: '#FBF8F1',
  paper2: '#F1EAD9',
  paperDark: '#EDE4CE',
  ink: '#141210',
  inkSoft: '#3A352F',
  red: '#E10600',
  redDark: '#A80400',
  blue: '#1D4ED8',
  blueDark: '#1E3A8A',
  yellow: '#EAB308',
  yellowDark: '#A16207',
  cyan: '#22D3EE',
  green: '#15803D',
  greenDark: '#166534',
  orange: '#EA580C',
  orangeDark: '#7C2D12',
  purple: '#7C3AED',
  teal: '#0E7490',
  gray: '#57534E',
  white: '#FFFFFF',
  dust: '#C9BFA5',
  flash: '#141210',
  ko: '#E10600',
  shadow: 'rgba(20,18,16,0.12)',
  // --- arena kertas ---
  arena: '#FBF8F1',
  wall: '#F1EAD9',
  wallDark: '#E3D9BE',
  concrete: '#EDE4CE',
  concreteDark: '#DCD2B4',
  wood: '#8B5E34',
  woodDark: '#6B4423',
  lampWarm: '#F5C86B',
  matWhite: '#FFFFFF',
  ropeRed: '#E10600',
  ropeWhite: '#FFFFFF',
  post: '#141210',
  // --- gear ---
  gloveRed: '#7F1D1D',
  gloveDark: '#450A0A',
  gloveBlue: '#1D4ED8',
  gloveBlueDark: '#1E3A8A',
  gloveOrange: '#EA580C',
  gloveOrangeDark: '#7C2D12',
  bootRed: '#991B1B',
  bootBlue: '#1E40AF',
  ankleWrap: '#F5F5DC',
  mongkol: '#D97706',
  shorts: '#141210',
  shortsTrim: '#E10600',
  sneaker: '#FBF8F1',
  sneakerSole: '#141210',
  headband: '#E10600',
  judgeGray: '#9CA3AF',
  // Penonton: tinta + warna-warna redup (harmoni dengan kertas).
  crowd: ['#141210', '#E10600', '#1D4ED8', '#15803D', '#EAB308', '#7C3AED', '#0E7490', '#EA580C', '#57534E', '#0891B2'],
};

// Gelapkan hex (untuk sisi belakang badan): faktor 0.65.
export function shade(hex, f = 0.65) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// --- map palettes (skin arena; geometri & posisi tidak berubah) ---
// Tiap map meng-override token permukaan arena SAJA (dinding, lantai,
// tali, penonton, banner). Warna petarung (dari builder) dan kepala
// kertas stickman TIDAK ikut berubah, supaya petarung tetap terbaca.
// getMapPalette(mapId) mengembalikan palet lengkap (PALETTE + override).
//
// Kontras per map (petarung warna apa pun harus terbaca):
// - ring: terang klasik — petarung gelap kontras kuat; kuning (#EAB308)
//   paling lemah tapi kepala kertas + gear tetap menandai sosok.
// - gudang/jalanan: gelap tapi TIDAK hitam pekat (dinding & lantai
//   mid-dark, ~#2A–#33) supaya petarung gelap (Tinta/Abu) masih
//   terbedakan dari lantai; kepala kertas terang selalu menonjol.
// - dojo: terang hangat seperti ring.
// Catatan: film.js saat ini membaca PALETTE langsung (belum getMapPalette);
// skin map aktif begitu film.js memakai getMapPalette(SCENE.MAP).
const MAP_OVERRIDES = {
  // Ring Tinju — arena klasik terang: pertahankan palet kertas sekarang.
  ring: {},
  // Gudang Underground — gelap moody ala Night Fight 4: dinding bata
  // gelap, lampu hangat, lantai beton gelap, tali merah kusam.
  gudang: {
    dark: true,
    arena: '#241D16',
    wall: '#3B2F28',
    wallDark: '#2A211B',
    concrete: '#332E28',
    concreteDark: '#26211C',
    wood: '#5C4026',
    woodDark: '#422C18',
    lampWarm: '#F5C86B',
    matWhite: '#E8DCC2',
    ropeRed: '#C8102E',
    ropeWhite: '#E8DCC2',
    post: '#171310',
    dust: '#8A7B66',
    shadow: 'rgba(0,0,0,0.35)',
    crowd: ['#E8DCC2', '#EAB308', '#C97B2D', '#8A7B66', '#B8452A', '#5C6B4A', '#2E5E6B', '#E10600', '#4A4238', '#D8C9A8'],
  },
  // Jalanan Malam — neon: dinding gelap kebiruan, tali neon magenta/cyan.
  jalanan: {
    dark: true,
    arena: '#14101C',
    wall: '#191423',
    wallDark: '#100D18',
    concrete: '#232030',
    concreteDark: '#171524',
    wood: '#4A3B2E',
    woodDark: '#33281E',
    lampWarm: '#22D3EE',
    matWhite: '#D8D2E8',
    ropeRed: '#FF2E88',
    ropeWhite: '#22D3EE',
    post: '#0D0B12',
    dust: '#6B6480',
    shadow: 'rgba(0,0,0,0.4)',
    crowd: ['#22D3EE', '#FF2E88', '#EAB308', '#8B7CF6', '#E8E4F0', '#3DD6C2', '#F0567A', '#9A8FB5', '#D8D2E8', '#6B5B8F'],
  },
  // Dojo — hangat tenang: kayu, kertas shoji, lantai tatami.
  dojo: {
    arena: '#E8DCC0',
    wall: '#E8DCC0',
    wallDark: '#D5C49A',
    concrete: '#C9B78F',
    concreteDark: '#A8986E',
    wood: '#8B5E34',
    woodDark: '#6B4423',
    lampWarm: '#F5C86B',
    matWhite: '#F7F2E3',
    ropeRed: '#B91C1C',
    ropeWhite: '#F7F2E3',
    post: '#4A3220',
    dust: '#A8986E',
    shadow: 'rgba(74,50,32,0.18)',
    crowd: ['#4A3220', '#B91C1C', '#1D4ED8', '#5C6B4A', '#8A6D3B', '#7A5C3E', '#3E5C50', '#9C7B4F', '#6B4A2E', '#E8DCC0'],
  },
};
export function getMapPalette(mapId) {
  const over = MAP_OVERRIDES[mapId] || {};
  return { ...PALETTE, ...over };
}
