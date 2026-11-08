// damage.js — Konstanta damage (modul MURNI, tanpa DOM/canvas).
// Satu-satunya sumber kebenaran DMG_BASE + BLOCK_CHIP untuk engine.
// Dipindah dari film.js (2026-11-07) supaya server Hub bisa memverifikasi
// hasil fight dengan mengimpor fight.js di Node tanpa rantai DOM.
// NILAI JANGAN DIUBAH: angka di bawah = salinan persis DMG_BASE film.js
// lama (baris ~910) — dmg per kind dipakai director (fight.js) dan
// HUD/sim (film.js hpAt). BLOCK_CHIP = chip damage saat block.
export const DMG_BASE = {
  jab: 8, cross: 10, hook: 12, uppercut: 14, bodyshot: 12,
  lowkick: 14, bodykick: 16, headkick: 18, frontkick: 10, roundhouse: 16,
  spinkick: 18, axekick: 16, overhand: 13, haymaker: 15, shove: 4, teep: 10,
  knee: 16, elbow: 14, flyknee: 20, finisher: 20,
  takedown: 14, clinch: 6, sweep: 12, stickswing: 16, stickchop: 18,
  feint: 0, // pancingan — tidak ada damage (dipakai JKD; dulu tidak ada entri)
  // Kind baru gaya Fase 1 Hub (2026-11-07) — cermin dmg di moves.js.
  abaniko: 8, sinawali: 14, redonda: 14,
  seoinage: 16, osotogari: 16, uchimata: 18,
  headbutt: 12, yokogeri: 14,
  straightlead: 10, sidekick: 16,
  shuto: 12, gyakuzuki: 12, maegeri: 12,
  armada: 18, meialua: 16, queixada: 14,
  tornadokick: 20, butterflykick: 18, lotuskick: 16,
  // Kind baru 2026-11-08 (14 kind) — cermin dmg di moves.js.
  // Gulat: doubleleg/singleleg 16 (= takedown generik), suplex/bodyslam 18
  // (bantingan berat), anklepick 12 (cepat, low-commitment), outsidetrip 14.
  // Muay Thai: kneediag 16 (= knee), elbowup 14 (= elbow), elbowspin 16
  // (putaran = lebih berat). Taekwondo: spinhookkick 18 (= spinkick).
  // Capoeira: meialuafrente 14 (= queixada), ginga 0 (STANCE, bukan
  // serangan — seperti feint). Kali: pilantik 12 (cambuk rapat, di antara
  // abaniko 8 dan sinawali 14). Judo: armbar 18 (kuncian, = uchimata).
  doubleleg: 16, singleleg: 16, suplex: 18, bodyslam: 18,
  anklepick: 12, outsidetrip: 14,
  kneediag: 16, elbowup: 14, elbowspin: 16,
  spinhookkick: 18, meialuafrente: 14, ginga: 0, pilantik: 12, armbar: 18,
};
export const BLOCK_CHIP = 2;
