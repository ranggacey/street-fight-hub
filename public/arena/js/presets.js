// presets.js — Preset petarung yang sudah dikenal dari @streetfightstickman.
// Warna adalah default yang bisa diubah di builder. Nama di video TANPA @.
// Neonimus: Gulat, lalu di pertengahan fight ambil tongkat kayu — di app ini
// diwakili weaponPickupAt (detik fight saat dia mengambil kayu di tepi ring).
import { setFighterColors } from './moves.js';

export const PRESETS = {
  nopan: {
    name: 'Nopan', style: 'muaythai', color: '#C8102E',
    gloves: { type: 'boxing', color: '#141210', left: true, right: true },
    weapon: { kind: 'none', hand: 'right' },
    shoes: { model: 'sneakers', color: '#FBF8F1' },
    belt: { color: 'none' }, headband: { color: 'none' },
    tagline: 'Petarung handal, tidak terlalu lincah.',
  },
  neonimus: {
    name: 'Neonimus', style: 'gulat', color: '#1D4ED8',
    gloves: { type: 'mma', color: '#141210', left: true, right: true },
    weapon: { kind: 'kayu', hand: 'right', pickupAt: 15 },
    shoes: { model: 'boots', color: '#7C2D12' },
    belt: { color: 'none' }, headband: { color: '#FACC15' },
    tagline: 'Gulat dulu, kayu kemudian.',
  },
  asoka: {
    name: 'Asoka', style: 'tinju', color: '#EAB308',
    gloves: { type: 'boxing', color: '#E10600', left: true, right: true },
    weapon: { kind: 'none', hand: 'right' },
    shoes: { model: 'sneakers', color: '#FBF8F1' },
    belt: { color: 'none' }, headband: { color: 'none' },
    tagline: 'Anak kampung jago tinju, lincah, tak terkalahkan.',
  },
  reyfan: {
    name: 'Reyfan', style: 'tinju', color: '#E10600',
    gloves: { type: 'boxing', color: '#141210', left: true, right: true },
    weapon: { kind: 'none', hand: 'right' },
    shoes: { model: 'sneakers', color: '#141210' },
    belt: { color: 'none' }, headband: { color: 'none' },
    tagline: 'Pemain juara boxing, tangan kanan mematikan.',
  },
  esje: {
    name: 'Esje', style: 'muaythai', color: '#15803D',
    gloves: { type: 'mma', color: '#141210', left: true, right: true },
    weapon: { kind: 'none', hand: 'right' },
    shoes: { model: 'sneakers', color: '#FBF8F1' },
    belt: { color: 'none' }, headband: { color: '#15803D' },
    tagline: 'Muay Thai, lutut terbang mematikan.',
  },
  saky: {
    name: 'Saky', style: 'tinju', color: '#0E7490',
    gloves: { type: 'boxing', color: '#E10600', left: true, right: true },
    weapon: { kind: 'none', hand: 'right' },
    shoes: { model: 'sneakers', color: '#FBF8F1' },
    belt: { color: 'none' }, headband: { color: 'none' },
    tagline: 'Petinju lincah, tangan kanan saja.',
  },
  padlan: {
    name: 'Padlan', style: 'tinju', color: '#EA580C',
    gloves: { type: 'boxing', color: '#141210', left: true, right: true },
    weapon: { kind: 'none', hand: 'right' },
    shoes: { model: 'sneakers', color: '#FBF8F1' },
    belt: { color: 'none' }, headband: { color: 'none' },
    tagline: 'Tinju, pemenang Night Fight 2.',
  },
  pitung: {
    name: 'Pitung', style: 'brawler', color: '#57534E',
    gloves: { type: 'none', color: '#141210', left: false, right: false },
    weapon: { kind: 'none', hand: 'right' },
    shoes: { model: 'sneakers', color: '#FBF8F1' },
    belt: { color: 'none' }, headband: { color: 'none' },
    tagline: 'Anak jalanan, tangan dibalut, sepatu sneakers.',
  },
  danukolor: {
    name: 'Danukolor', style: 'taekwondo', color: '#7C3AED',
    gloves: { type: 'mma', color: '#141210', left: true, right: true },
    weapon: { kind: 'none', hand: 'right' },
    shoes: { model: 'sneakers', color: '#FBF8F1' },
    belt: { color: '#EAB308' }, headband: { color: 'none' },
    tagline: 'Taekwondo, tendangan memutar.',
  },
  anoetheroong: {
    name: 'Anoetheroong', style: 'tinju', color: '#0891B2',
    gloves: { type: 'boxing', color: '#E10600', left: true, right: true },
    weapon: { kind: 'none', hand: 'right' },
    shoes: { model: 'sneakers', color: '#141210' },
    belt: { color: 'none' }, headband: { color: 'none' },
    tagline: 'Petinju, pemenang Night Fight 1.',
  },
};

export const PRESET_ORDER = ['nopan', 'neonimus', 'asoka', 'reyfan', 'esje', 'saky', 'padlan', 'pitung', 'danukolor', 'anoetheroong'];

// Isi fighter.colors tiap preset dari warna legacy-nya (body/gloves/sepatu/
// sabuk/ikat kepala/senjata) — supaya preset membawa bentuk kanonik yang sama
// dengan fighter hasil builder/embed (lihat moves.js fighterColors).
for (const p of Object.values(PRESETS)) setFighterColors(p, {});

export function clonePreset(key) {
  const p = PRESETS[key];
  if (!p) return null;
  return JSON.parse(JSON.stringify(p));
}

// Default dua petarung saat pertama buka: Nopan vs Neonimus.
export function defaultFighters() {
  return { left: clonePreset('nopan'), right: clonePreset('neonimus') };
}
