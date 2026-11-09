// damage.js — Konstanta damage (modul MURNI, tanpa DOM/canvas).
// Satu-satunya sumber kebenaran DMG_BASE + BLOCK_CHIP untuk engine.
// Dipindah dari film.js (2026-11-07) supaya server Hub bisa memverifikasi
// hasil fight dengan mengimpor fight.js di Node tanpa rantai DOM.
// SKALA 2026-11-08 (komplain user: HP hampir habis di detik 20-30, lalu
// 30 dtk terakhir tidak ada pukulan kena): DMG_BASE LAMA (jab 8, headkick
// 18, finisher 20) terlalu besar — kedua HP menyentuh lantai steering
// (pecundang 12, pemenang 15) di ~detik 15-20, lalu steering mengubah
// ~90% serangan jadi slip/block selama sisa fight (zona mati, terukur:
// kena 4,95/jendela 0-10 dtk -> 0,14/jendela 40-50 dtk). Nilai baru =
// nilai lama x0,25 (jab 2, headkick 4,5, finisher 5) supaya HP turun
// bertahap sepanjang 60 dtk dan steering baru mengikat di ~10 dtk akhir.
// BLOCK_CHIP ikut diskala (2 -> 0,5) supaya block tetap ~13% dari hit
// (dulu 2/15) — kalau chip tetap 2, block hampir sama sakitnya dengan hit
// dan steering tidak bisa membentuk margin. moves.js dmg = CERMIN persis
// tabel ini (tes Arena § mengecek kesamaan).
export const DMG_BASE = {
  jab: 2, cross: 2.5, hook: 3, uppercut: 3.5, bodyshot: 3,
  lowkick: 3.5, bodykick: 4, headkick: 4.5, frontkick: 2.5, roundhouse: 4,
  spinkick: 4.5, axekick: 4, overhand: 3.25, haymaker: 3.75, shove: 1, teep: 2.5,
  knee: 4, elbow: 3.5, flyknee: 5, finisher: 5,
  takedown: 3.5, clinch: 1.5, sweep: 3, stickswing: 4, stickchop: 4.5,
  feint: 0, // pancingan — tidak ada damage (dipakai JKD; dulu tidak ada entri)
  // Kind baru gaya Fase 1 Hub (2026-11-07) — cermin dmg di moves.js.
  abaniko: 2, sinawali: 3.5, redonda: 3.5,
  seoinage: 4, osotogari: 4, uchimata: 4.5,
  headbutt: 3, yokogeri: 3.5,
  straightlead: 2.5, sidekick: 4,
  shuto: 3, gyakuzuki: 3, maegeri: 3,
  armada: 4.5, meialua: 4, queixada: 3.5,
  tornadokick: 5, butterflykick: 4.5, lotuskick: 4,
  // Kind baru 2026-11-08 (14 kind) — cermin dmg di moves.js.
  // Gulat: doubleleg/singleleg 4 (= takedown generik), suplex/bodyslam 4.5
  // (bantingan berat), anklepick 3 (cepat, low-commitment), outsidetrip 3.5.
  // Muay Thai: kneediag 4 (= knee), elbowup 3.5 (= elbow), elbowspin 4
  // (putaran = lebih berat). Taekwondo: spinhookkick 4.5 (= spinkick).
  // Capoeira: meialuafrente 3.5 (= queixada), ginga 0 (STANCE, bukan
  // serangan — seperti feint). Kali: pilantik 3 (cambuk rapat, di antara
  // abaniko 2 dan sinawali 3.5). Judo: armbar 4.5 (kuncian, = uchimata).
  doubleleg: 4, singleleg: 4, suplex: 4.5, bodyslam: 4.5,
  anklepick: 3, outsidetrip: 3.5,
  kneediag: 4, elbowup: 3.5, elbowspin: 4,
  spinhookkick: 4.5, meialuafrente: 3.5, ginga: 0, pilantik: 3, armbar: 4.5,
};
export const BLOCK_CHIP = 0.5;
