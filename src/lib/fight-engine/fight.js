// fight.js — Fight director: undian pemenang DULU, lalu koreografi.
// Sama seperti NF1-4: jalur KO/decision diundi dulu, lalu pemenang, lalu
// serangan disusun agar hasil undian itu yang terjadi (HP steering).
// Seed tercatat -> fight yang sama bisa diulang identik.
// Pacing mengikuti CF2 §17: jeda kontak 0.55-0.75 dtk, tanpa slow-mo.
import { DMG_BASE, BLOCK_CHIP } from './damage.js';
import { movesFor, WEAPON_MOVES, normalizeStyle } from './moves.js';
import { windupDurOf, totalDurOf } from './techniques.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function randomSeed() {
  return Math.floor(Math.random() * 900000) + 100000;
}

const FINISHER_DMG = { finisher: 20, flyknee: 20, stickchop: 18 };
// Selisih HP maksimum yang dibiarkan steering draw (lihat blok steering).
const DRAW_MARGIN = 12;

function dmgOf(atk) {
  const base = DMG_BASE[atk.kind] ?? 10;
  if (atk.outcome === 'hit') {
    const fin = FINISHER_DMG[atk.kind] ? 1.5 : 1;
    return base * atk.power * fin;
  }
  if (atk.outcome === 'block') return atk.power >= 1.3 ? BLOCK_CHIP * atk.power : BLOCK_CHIP;
  return 0;
}

// Pilih outcome (2026-11-08, perintah user "full bak bikbuk": guard 10%,
// hindar 10%, sisanya 80% kena): hit 80% / block 10% / dodge 10%
// (slip/duck/roll/sidestep/parry/flinch). Dulu hit 55% / block 15% /
// dodge 30% — tapi steering mengubah sebagian besar hit jadi slip
// (rate efektif terukur: hit 13,6% / block 17,3% / dodge 69,1%),
// karena damage lama terlalu besar. Dengan damage baru (x0,25) steering
// baru mengikat di akhir fight, jadi rate efektif mendekati rate ini.
function pickOutcome(rng) {
  const r = rng();
  if (r < 0.80) return 'hit';
  if (r < 0.90) return 'block';
  const dodges = ['slip', 'slip', 'duck', 'roll', 'sidestep', 'parry', 'flinch'];
  return dodges[Math.floor(rng() * dodges.length)];
}

// --- Opsi director (Fase 1 Hub) ---
// opts.weights: { R: { kind: bobot }, B: {...} } — pengali bobot pilih gerak.
//   Tanpa opts (atau tanpa entri kind) bobot = 1 untuk semua → pick uniform
//   persis seperti sebelumnya. signatureMove petarung = bobot 2.5x untuk 1 kind
//   kalau opts.weights sisi itu tidak diisi.
// opts.tempo: { R: 'agresif'|'seimbang'|'bertahan', B: ... } — 'seimbang' =
//   perilaku sekarang (jeda kontak 0.55–0.75 dtk). Nilai lain dibaca juga dari
//   fighter.tempo kalau opts.tempo sisi itu tidak diisi.
// opts.forcedResult: { result: 'ko'|'decision', winner: 'R'|'B' } — ganti
//   undian KO/decision + pemenang (koreografi + HP steering tetap jalan).
//   Draw TIDAK bisa dipaksa lewat forcedResult (hanya dari lotere normal);
//   nilai 'draw' di forcedResult diabaikan seperti nilai tidak valid lain.
//   Undian asli tetap ditarik dari rng lalu DITIMPA, supaya aliran rng
//   (dan koreografi) tetap sebanding dengan run tanpa forcedResult.
function tempoOf(who, opts, fighters) {
  const t = opts?.tempo?.[who] ?? fighters[who]?.tempo ?? 'seimbang';
  return t === 'agresif' || t === 'bertahan' ? t : 'seimbang';
}

function gapFor(tempo, rng) {
  if (tempo === 'agresif') return 0.45 + rng() * 0.2; // 0.45–0.65 dtk
  if (tempo === 'bertahan') return 0.65 + rng() * 0.25; // 0.65–0.90 dtk
  return 0.55 + rng() * 0.2; // seimbang: 0.55–0.75 dtk (CF2 §17)
}

// Weighted pick dengan SATU tarikan rng (deterministik). Bobot seragam (=1)
// menghasilkan indeks yang sama persis dengan pool[floor(rng()*pool.length)].
function pickWeighted(pool, weights, tempo, rng) {
  let total = 0;
  const ws = pool.map((m) => {
    let w = weights?.[m.kind] ?? 1;
    if (tempo === 'agresif' && m.power >= 0.9) w *= 1.5;
    else if (tempo === 'bertahan' && m.power < 0.7) w *= 1.5;
    w = Math.max(0, Number(w) || 0);
    total += w;
    return w;
  });
  if (total <= 0) return pool[Math.floor(rng() * pool.length)];
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= ws[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// Statistik fight dari attacks + hpFinal + knockdowns (dipakai sfa-result
// embed + verifikasi server Hub). accuracy = landed/thrown (0–1, feint tidak
// dihitung sebagai pukulan). damageDealt = jumlah damage (hit + block chip)
// menurut rumus yang sama dengan hpAt film.js.
export function fightStats(fight) {
  const s = {
    accuracyA: 0, accuracyB: 0,
    damageDealtA: 0, damageDealtB: 0,
    strikesThrownA: 0, strikesThrownB: 0,
    strikesLandedA: 0, strikesLandedB: 0,
    knockdowns: fight.knockdowns?.length ?? 0,
  };
  for (const a of fight.attacks) {
    if (a.kind === 'feint' || a.kind === 'ginga') continue; // ginga = stance, bukan pukulan
    const byA = a.by === 'R';
    if (byA) s.strikesThrownA++; else s.strikesThrownB++;
    if (a.outcome === 'hit') {
      if (byA) { s.strikesLandedA++; s.damageDealtA += dmgOf(a); }
      else { s.strikesLandedB++; s.damageDealtB += dmgOf(a); }
    } else if (a.outcome === 'block') {
      if (byA) s.damageDealtA += dmgOf(a); else s.damageDealtB += dmgOf(a);
    }
  }
  s.damageDealtA = Math.round(s.damageDealtA * 10) / 10;
  s.damageDealtB = Math.round(s.damageDealtB * 10) / 10;
  s.accuracyA = s.strikesThrownA ? Math.round((s.strikesLandedA / s.strikesThrownA) * 1000) / 1000 : 0;
  s.accuracyB = s.strikesThrownB ? Math.round((s.strikesLandedB / s.strikesThrownB) * 1000) / 1000 : 0;
  return s;
}

// Momen kunci untuk replay + breakdown "kenapa menang/kalah" (Hub, sfa-result).
// Dihitung dari timeline serangan yang sudah ada (tanpa simulasi ulang).
// `by` memakai 'L' (kiri) / 'R' (kanan) sesuai kontrak embed — berbeda dari
// 'R'/'B' internal engine (R = kiri, B = kanan).
export function keyMoments(fight) {
  const toLR = (who) => (who === 'R' ? 'L' : 'R');
  const round2 = (x) => Math.round(x * 100) / 100;
  let biggestHit = null;
  for (const a of fight.attacks) {
    if (a.outcome !== 'hit' || a.kind === 'feint' || a.kind === 'ginga') continue;
    const dmg = dmgOf(a);
    if (!biggestHit || dmg > biggestHit.damage) {
      biggestHit = { by: toLR(a.by), move: a.kind, damage: Math.round(dmg * 10) / 10, timeSec: round2(a.t) };
    }
  }
  // Finisher KO = satu-satunya serangan knockdown tepat di koT (bukan sekadar
  // cari kind 'flyknee' — flyknee juga gerakan biasa Muay Thai).
  const fin = fight.result === 'ko'
    ? fight.attacks.find((a) => a.t === fight.koT && a.knockdown)
    : undefined;
  const finisher = fin ? { by: toLR(fin.by), move: fin.kind, timeSec: round2(fin.t) } : null;
  const knockdowns = (fight.knockdowns ?? []).map((k) => ({
    // `by` = penyerang yang menjatuhkan (kebalikan dari `who` yang jatuh).
    by: toLR(k.who === 'R' ? 'B' : 'R'),
    timeSec: round2(k.t),
  }));
  // Momen balik (lead change): TERAKHIR kali pemimpin skor berganti — yaitu
  // saat pemenang akhir merebut keunggulan untuk selamanya. Pemimpin dihitung
  // dari HP berjalan (damage kumulatif, rumus yang sama dengan hpAt/dmgOf).
  // Null kalau tidak pernah ada pergantian pemimpin.
  let hpR = 100, hpB = 100, leader = null, leadChange = null;
  for (const a of fight.attacks) {
    if (a.kind === 'feint' || a.kind === 'ginga') continue; // ginga = stance, bukan pukulan
    const d = dmgOf(a);
    if (a.by === 'R') hpB = Math.max(0, hpB - d); else hpR = Math.max(0, hpR - d);
    const cur = hpR === hpB ? null : hpR > hpB ? 'L' : 'R';
    if (cur && leader && cur !== leader) leadChange = { timeSec: round2(a.t), by: cur };
    if (cur) leader = cur;
  }
  return { biggestHit, finisher, knockdowns, leadChange };
}

// --- JARAK GELUD (2026-11-08, feedback video seed 982809) ---
// Dulu film.js menahan kedua petarung di gap ~50–60px (minimum clamp sim +
// guard yang hanya menjaga "jangan lebih dekat dari 45px") — dada-ke-dada
// di semua frame. Sekarang jarak berasal dari ENGINE (buildFight), bukan
// dari gambar: buildFight mengeluarkan timeline posisi `fight.positions`
// (sampel 30fps: xR/xB/gap/fase) yang dipakai film.js + replay/verifikasi
// server, supaya jarak yang terlihat = jarak yang dihitung engine.
// Model (murni, tanpa rng — posisi turunan dari timeline serangan):
// - Panjang badan stickman BODY_LEN_PX = 166px (kepala di GROUND−166,
//   film.js ghostPoint) → jarak jaga GUARD_GAP_PX = 250px ≈ 1,5 badan.
// - Walk-in [0, 1 dtk]: dari startX (440/840, scenes.js) ke posisi jaga
//   di sekitar titik tengah ring 640.
// - Saat tidak menyerang (fase 'guard'): kedua petarung kembali simetris
//   ke jarak jaga (200px/dtk tiap sisi).
// - Lunge: penyerang menutup jarak ke jarak serang HANYA saat menyerang —
//   mulai 0,45 dtk sebelum windup (pra-pendekatan) + selama windup, dengan
//   kecepatan LUNGE_SPEED 450px/dtk (step-in eksplosif ala fencing lunge,
//   ~1,5 m dalam 0,25–0,3 dtk); lalu kembali ke jarak jaga setelah impact.
// - Clinch: rapat (58px). Ambil kayu: pengambil jalan ke tepi ring.
//   Knockdown: korban jatuh diam di tempat, lawan mundur ke jarak jaga.
// - Kecepatan di atas dipilih supaya gap saat impact ≈ jarak serang
//   (median ~90px, p90 ~113px — terukur scripts/measure-distance.mjs),
//   sementara gap saat guard median 250px.
// - SATU pengecualian yang diketahui: serangan pertama tepat setelah
//   ambil kayu bisa berdampak dari jauh (penyerang masih di tepi ring,
//   gap sampai ~430px) — waktunya tidak cukup untuk jalan kembali karena
//   director menjadwalkan serangan itu tepat saat kayu selesai diambil;
//   memperbaiki itu butuh mengubah timing serangan (dilarang di sini).
export const BODY_LEN_PX = 166;
export const GUARD_GAP_PX = 250;
export const RING_CENTER_X = 640;
export const START_X = { R: 440, B: 840 };
// Batas DALAM ring untuk posisi petarung (2026-11-08): tali ring di
// x 330-950 (film.js drawArena, world coords). Petarung di-clamp ke
// [380, 900] supaya badan (pusat ±~50px) tidak melewati tali — dulu
// clamp [80, 1200] membiarkan petarung terdorong sampai ke tepi/keluar
// tali (terukur seed 657095: 16,9% sampel di luar tali, xR sampai 155)
// dan kamera mengikutinya sehingga lingkaran lantai ring menyapu layar
// seperti busur raksasa ("sampai keluar luar"). Senjata kayu di x 380
// (kiri) / 900 (kanan) tetap terjangkau persis di batas clamp.
export const RING_X_MIN = 380;
export const RING_X_MAX = 900;
const LUNGE_SPEED = 450; // px/dtk — step-in/lunge eksplosif
const RETURN_SPEED = 250; // px/dtk per sisi — kembali ke jarak jaga.
// 250 (bukan 200): sesudah approach diprioritaskan + PRE_APPROACH 0,30,
// jeda antar serangan jarang memberi waktu kembali yang panjang — dengan
// 200, median jarak guard jatuh ke ~162-190px (target >= 200). 250 +
// PRE_APPROACH 0,30 memulihkan median ke ~217px, tanpa mengubah approach
// (450) atau jarak serang. Visual: petarung memantul kembali ke jarak
// jaga, bukan berjalan pelan — wajar sesudah adu serangan. 300 TIDAK
// dipakai: membuat picker tiba di kayu sebelum gerbang sim (wp.t+0,9)
// terbuka (lihat latch kayu di bawah).
const WALK_SPEED = 150; // px/dtk — walk-in awal (sama dengan film.js)
const CLINCH_GAP_PX = 58; // rapat saat clinch (film.js: gap > 58 baru mendekat)
const PRE_APPROACH = 0.30; // dtk sebelum windup penyerang mulai mendekat.
// 0,30 (dulu 0,45): approach 0,45 memberi jeda guard terlalu pendek —
// median jarak guard 162px. 0,30 memberi jeda 0,15 dtk lebih panjang per
// serangan (median guard 190px) dan approach masih cukup: 0,30 + windup
// ~0,2 dtk = 0,5 dtk × 450px/dtk = 225px daya tutup, cukup dari jarak
// jaga 250 ke jarak serang mana pun. 0,20 TERLALU pendek (§5 gagal 3×).
// Dipakai bersama RETURN_SPEED 250 untuk median guard >= 200px.
const POS_DT = 1 / 30; // sampel posisi 30fps (sama dengan FPS sim)

// Jarak serang (gap pusat-ke-pusat saat impact) per kind — CERMIN
// strikeRange() film.js (45–110px). Kalau film.js mengubah strikeRange,
// samakan tabel ini supaya timeline engine tetap cocok dengan gambar.
export const STRIKE_GAP_PX = {
  headbutt: 45, elbow: 50, headkick: 52,
  takedown: 55, clinch: 55, seoinage: 55,
  axekick: 60, uchimata: 60, knee: 62, flyknee: 62,
  lowkick: 70, uppercut: 70, sweep: 70, abaniko: 70, osotogari: 70, meialua: 60,
  shuto: 80, butterflykick: 60, hook: 88, bodyshot: 88, haymaker: 88,
  cross: 90, finisher: 90, stickchop: 90, gyakuzuki: 90, queixada: 60,
  tornadokick: 60, lotuskick: 60, overhand: 92,
  jabR: 95, shove: 95, frontkick: 95, teep: 95, spinkick: 95, sinawali: 95,
  redonda: 95, yokogeri: 95, sidekick: 95, maegeri: 95, armada: 60, feint: 95,
  bodykick: 98, roundhouse: 98, stickswing: 100, straightlead: 100,
  // Kind baru 2026-11-08 — CERMIN strikeRange() film.js.
  // Tendangan ke KEPALA harus rapat (60px — sama seperti cabang walk film.js
  // yang memakai rg=60 untuk head kick): kaki 93px tidak sampai ke kepala
  // (~120px dari pinggul) bila gap 85-98; yang lama lolos hanya karena
  // tidak pernah tersampel tes kontak (§5 hanya 1 fight).
  doubleleg: 55, singleleg: 55, suplex: 55, bodyslam: 55, anklepick: 55,
  outsidetrip: 55, armbar: 55, kneediag: 62, elbowup: 50, elbowspin: 55,
  spinhookkick: 60, meialuafrente: 60, ginga: 95, pilantik: 70,
};
export function strikeGapOf(kind) {
  return STRIKE_GAP_PX[kind] ?? 110; // default film.js strikeRange
}

const _clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const _moveToward = (x, target, maxStep) => x + _clamp(target - x, -maxStep, maxStep);

// Kecepatan perpindahan defender saat menghindar (reaksi dodge).
// Sim lama: sidestep vx −320 (tapi posisi badan di-override timeline,
// jadi defender tidak pernah benar-benar menjauh — fist yang mengarah ke
// hantu malah "kena" target hidup). Slip/duck/roll/flinch di sim lama
// hanya pose; di timeline diberi perpindahan supaya miss-nya jelas
// (contactReport: jarak fist ke target hidup >= 20px). Parry TIDAK
// dipindah: cek parry mengukur tangan defender bertemu lengan penyerang
// (dParry <= 15px) — menjauh justru merusak jangkauan tangan itu.
const DODGE_SPEED_PX_S = { sidestep: 320, slip: 200, duck: 200, roll: 200, flinch: 150 };
const DODGE_OUTCOMES = new Set(['slip', 'duck', 'roll', 'sidestep', 'flinch']);
// Dodge untuk serangan ke KAKI (lowkick): yang diukur contactReport adalah
// lutut depan hidup (kneeF), bukan badan. Lutut terikat kaki depan yang
// menapak — ia hanya bergerak ~1/2-2/3 kecepatan badan, dan lutut yang
// menekuk ke depan (roll/slip crouch) terdorong ke arah penyerang. Akibatnya
// dodge 200px/dtk justru menempatkan lutut TEPAT di jalur kaki penyerang
// (dLive 12-14px; zona mati ±18px di sekitar kaki; dodge 320 malah makin
// parah, 8,9-11,4px). Dodge SANGAT pelan (20px/dtk — geser bobot, bukan
// lompat; slip lowkick memang begitu di bela diri) membuat lutut tetap di
// sisi dekat: kaki penyerang meleset 26-42px dari lutut hidup. Terukur:
// LEG 110/80/70/60/40/20 -> gagal seed 123456: 2/1/0/0/0/0, dan sweep 20
// seed acak: lowkick/slip gagal 7 (LEG 60) -> 1 (40) -> 0 (20).
// Target kepala/badan tidak kena aturan ini: kepala/badan ikut badan 1:1
// dan butuh ~33px agar dLive >= 20, jadi tetap pakai DODGE_SPEED_PX_S.
const LEG_DODGE_SPEED_PX_S = 20;
const dodgeSpeedFor = (atk) => (atk.target === 'leg' ? LEG_DODGE_SPEED_PX_S : DODGE_SPEED_PX_S[atk.outcome]);
// Tahan posisi serangan setelah impact (detik). Cek kontak di t+0,02 harus
// mengukur penyerang yang masih di jarak serang — bukan yang sudah mundur
// 15px/langkah untuk serangan berikut (lunge 450px/dtk). 0,05 dtk sudah
// menutupi cek itu (satu sampel sesudah impact); menahan 0,12 dtk (seperti
// fist di sim) hanya membuang waktu kembali-ke-jaga dan menekan median
// jarak guard. Badan boleh bergerak lagi sesudah 0,05 dtk — fist sim tetap
// menahan targetnya sendiri sampai ph=0,12.
const STRIKE_HOLD_S = 0.05;

// Bangun timeline posisi dari fight yang sudah jadi (serangan + event).
// Mengembalikan array sampel { t, xR, xB, gap, phase } tiap 1/30 dtk,
// phase: 'walk' | 'guard' | 'approach' | 'attack' | 'clinch' | 'pickup' | 'down'.
// 'guard' = tidak menyerang (di sinilah jarak jaga 250px diukur).
// Aturan gerak (per petarung, prioritas tertinggi dulu):
//   1. penyerang serangan aktif (windup): approach ke jarak serang — ke
//      HANTU (posisi defender saat serangan menjadi aktif di sim) kalau
//      outcome-nya dodge, karena fist sim mengarah ke hantu, bukan ke
//      defender yang sedang menjauh;
//   2. defender serangan aktif (windup): dodge menjauh (lihat atas) atau
//      diam (+retreat kalau terjadwal);
//   3. pasca-impact: TAHAN posisi 0,12 dtk (strike hold), lalu approach
//      serangan berikut diprioritaskan atas kembali-ke-jaga (dulu approach
//      terblokir sampai jendela serangan sebelumnya habis);
//   4. tanpa serangan berikut: kembali ke jarak jaga.
// Selama approach serangan berikut, defender-nya DIAM (bukan kembali ke
// jaga menjauhi penyerang) — sama seperti cabang pre-approach lama.
// Ambil kayu: picker jalan ke tepi ring, ambil (latch di wp.t+1,0 —
// sim gerbangnya wp.t+0,9 tapi butuh margin, lihat latch di loop),
// lalu jalan kembali ke arah lawan 200px/dtk sampai gap <= 60 (sim lama);
// non-picker guard/approach NORMAL (dulu dibekukan — serangan pertama
// setelah kayu meleset dari ~430px).
export function buildPositions(fight) {
  const { attacks, knockdowns, clinches, retreats, weapon, duration } = fight;
  const atkWin = attacks.map((a) => ({
    ...a,
    ws: a.t - windupDurOf(a.kind),
    end: a.t + totalDurOf(a.kind) - windupDurOf(a.kind),
    gap: strikeGapOf(a.kind),
  })).sort((x, y) => x.ws - y.ws);
  const clWin = (clinches || []).map((c) => ({ t: c.t, end: c.t + c.dur }));
  const kdWin = (knockdowns || []).map((k) => ({ who: k.who, t: k.t, getup: k.getupStart }));
  const rtWin = (retreats || []).map((r) => ({ who: r.who, t: r.t, end: r.t + r.dur }));
  // Posisi hantu per serangan: x defender saat serangan pertama kali
  // menjadi "aktif" di sim (atkFor film.js — pertama dalam urutan t yang
  // jendelanya berisi s). BUKAN saat windup mulai: jendela serangan
  // sebelumnya yang tumpang tindih menunda gilirannya (contoh: headkick
  // [7,13–7,86) menunda hantu takedown; headkick juga menunda hantu
  // flyknee sampai 46,53). Diisi saat loop mencapai sampel tangkap.
  // Waktu tangkap = posisi defender pada sampel s* (penyerang R) atau
  // s*+1 sampel (penyerang B — sim melangkah R dulu, jadi hantu B dibaca
  // setelah R melangkah satu frame). Sebelum tertangkap, penyerang
  // mendekati defender hidup (fallback yang sama dengan contactReport
  // saat entry hantu belum ada).
  const ghostX = new Array(atkWin.length).fill(null);
  let ghostPending = null; // { idx, atSample } — tangkap setelah sampel atSample
  let pickedUp = false; // picker sudah sampai di kayu (latch — anti osilasi)
  let xR = START_X.R, xB = START_X.B;
  const samples = [];
  const n = Math.round(duration / POS_DT);

  const xOf = (who) => (who === 'R' ? xR : xB);
  const setX = (who, v) => { if (who === 'R') xR = v; else xB = v; };
  const otherOf = (who) => (who === 'R' ? 'B' : 'R');
  const guardTarget = (who) => {
    const mid = _clamp((xR + xB) / 2, 580, 700);
    return who === 'R' ? mid - GUARD_GAP_PX / 2 : mid + GUARD_GAP_PX / 2;
  };
  const moveTo = (who, target, speed) => setX(who, _moveToward(xOf(who), target, speed * POS_DT));
  // Penyerang menutup jarak ke jarak serang (target = posisi acuan
  // defender dikurangi gap, ke arah penyerang).
  const approach = (att, defX, gap) => {
    const dir = att === 'R' ? 1 : -1;
    moveTo(att, defX - dir * gap, LUNGE_SPEED);
  };
  // Mundur menjauhi lawan (retreat 120px/dtk / dodge): R ke kiri, B ke
  // kanan — R selalu di kiri B (gap serangan menjaga sisi).
  const stepAway = (who, speed) => {
    const d = who === 'R' ? -1 : 1;
    setX(who, xOf(who) + d * speed * POS_DT);
  };
  const retreating = (who, s) => rtWin.some((r) => r.who === who && s >= r.t && s < r.end);
  const doRetreat = (who, s) => { if (retreating(who, s)) stepAway(who, 120); };

  // Gerakan satu petarung di luar fase global (walk/clinch/down) dan di
  // luar peran picker kayu (lihat stepPicker). `atk` = serangan yang
  // jendelanya berisi s (atau null); `nextAtk` = serangan berikut.
  const stepCombat = (who, s, atk, atkIdx, nextAtk, nextNear) => {
    const foe = otherOf(who);
    if (atk) {
      if (s < atk.t) {
        // Windup serangan aktif.
        if (who === atk.by) {
          if (DODGE_OUTCOMES.has(atk.outcome) && ghostX[atkIdx] !== null) approach(who, ghostX[atkIdx], atk.gap);
          else approach(who, xOf(foe), atk.gap);
        } else if (DODGE_OUTCOMES.has(atk.outcome)) {
          stepAway(who, dodgeSpeedFor(atk));
        } else {
          doRetreat(who, s);
        }
        return;
      }
      // Pasca-impact: strike hold dulu (lihat STRIKE_HOLD_S), lalu
      // approach serangan berikut menang atas kembali-ke-jaga.
      if (s < atk.t + STRIKE_HOLD_S) return; // diam
      if (nextNear && nextAtk.by === who) { approach(who, xOf(foe), nextAtk.gap); return; }
      if (nextNear) { doRetreat(who, s); return; } // defender berikut: diam
      moveTo(who, guardTarget(who), RETURN_SPEED);
      if (who !== atk.by) doRetreat(who, s);
      return;
    }
    if (nextNear) {
      if (who === nextAtk.by) { approach(who, xOf(foe), nextAtk.gap); return; }
      doRetreat(who, s);
      return;
    }
    moveTo(who, guardTarget(who), RETURN_SPEED);
  };

  // Picker kayu: jalan ke tepi ring, ambil, lalu jalan kembali ke arah
  // lawan 200px/dtk sampai gap <= 60. Kalau windup serangan sudah berjalan
  // (serangan pertama setelah kayu dijadwalkan tepat di wp.t+3.0), picker
  // tetap approach/menghindar seperti petarung biasa.
  const stepPicker = (who, foe, s, atk, atkIdx, nextAtk, nextNear) => {
    if (atk && atk.by === who && s < atk.t) {
      if (DODGE_OUTCOMES.has(atk.outcome) && ghostX[atkIdx] !== null) approach(who, ghostX[atkIdx], atk.gap);
      else approach(who, xOf(foe), atk.gap);
      return;
    }
    if (atk && atk.by === foe && s < atk.t) {
      if (DODGE_OUTCOMES.has(atk.outcome)) stepAway(who, dodgeSpeedFor(atk));
      else doRetreat(who, s);
      return;
    }
    if (atk && s >= atk.t && s < atk.t + STRIKE_HOLD_S) return; // strike hold
    if (nextNear && nextAtk.by === who) { approach(who, xOf(foe), nextAtk.gap); return; }
    // Ambil: jalan ke kayu sampai tiba (latch di wp.t+1,0 — sim lama baru
    // menganggap kayu di tangan saat wp.t+0,9, tapi latch butuh margin,
    // lihat loop); status "sampai" di-latch, kalau tidak picker berosilasi
    // di sekitar kayu (maju 200px/dtk lalu mundur 220px/dtk tiap sampel).
    // Lalu jalan kembali.
    if (!pickedUp) {
      moveTo(who, weapon.x, 220);
    } else if (Math.abs(xOf(foe) - xOf(who)) > 60) {
      moveTo(who, xOf(foe), 200);
    }
  };

  for (let i = 0; i <= n; i++) {
    const s = Math.min(i * POS_DT, duration);
    let phase = 'guard';
    let atk = null, nextAtk = null, atkIdx = -1, atkFirstIdx = -1;
    for (let j = 0; j < atkWin.length; j++) {
      const w = atkWin[j];
      if (w.ws <= s && s < w.end) {
        atk = w; atkIdx = j;
        if (atkFirstIdx === -1) atkFirstIdx = j;
      } else if (w.ws > s && !nextAtk) nextAtk = w;
    }
    // Jadwalkan tangkap hantu saat serangan pertama kali menjadi aktif
    // (atkFirst). atkWin terurut ws = terurut t, jadi "pertama" = yang
    // pertama ditemukan di atas.
    if (atkFirstIdx !== -1 && ghostX[atkFirstIdx] === null && !ghostPending) {
      const w = atkWin[atkFirstIdx];
      ghostPending = { idx: atkFirstIdx, atSample: i + (w.by === 'B' ? 1 : 0) };
    }
    const cl = clWin.find((c) => s >= c.t && s < c.end);
    const kd = kdWin.find((k) => s >= k.t && (k.getup === null || k.getup === undefined || s < k.getup));
    const wpActive = weapon && s >= weapon.t && s < weapon.t + 3.0;
    const nextNear = nextAtk && nextAtk.ws - s <= PRE_APPROACH;
    if (s < 1.0) {
      phase = 'walk';
      moveTo('R', RING_CENTER_X - GUARD_GAP_PX / 2, WALK_SPEED);
      moveTo('B', RING_CENTER_X + GUARD_GAP_PX / 2, WALK_SPEED);
    } else if (cl) {
      phase = 'clinch';
      const mid = (xR + xB) / 2;
      moveTo('R', mid - CLINCH_GAP_PX / 2, 120);
      moveTo('B', mid + CLINCH_GAP_PX / 2, 120);
    } else if (kd) {
      phase = 'down';
      const vic = kd.who, other = vic === 'R' ? 'B' : 'R';
      const vicX = xOf(vic);
      const dir = other === 'R' ? -1 : 1;
      const tx = vicX + dir * GUARD_GAP_PX;
      moveTo(other, _clamp(tx, RING_X_MIN, RING_X_MAX), RETURN_SPEED);
    } else if (wpActive) {
      phase = 'pickup';
      const picker = weapon.who, other = otherOf(picker);
      // Latch "sampai di kayu": sekali dalam 26px setelah wp.t+1,0,
      // picker dianggap memegang kayu (sama seperti hasWeapon sim, yang
      // gerbangnya wp.t+0,9 — tapi 0,1 dtk ini MARGIN, bukan penundaan
      // sembarang: sim mengakumulasi s (s += 1/30) sehingga langkah di
      // wp.t+0,9 tepat bernilai 15,899999999999954 < 15,9 dan gerbangnya
      // gagal; dan sim membaca posisi timeline selangkah ke depan, jadi
      // picker yang langsung berbalik di 0,9 sudah 28,7px dari kayu saat
      // sim mengecek. Dengan latch 1,0, picker tetap di kayu melewati
      // gerbang dan sim punya 3-4 langkah untuk mengambilnya — kalau tidak,
      // hasWeapon sim tetap false dan block pertama sesudah kayu gagal
      // (dHand ~49px; terukur saat RETURN_SPEED 250/300 membuat picker
      // tiba di kayu sebelum gerbang 0,9 terbuka).
      if (s >= weapon.t + 1.0 && Math.abs(xOf(picker) - weapon.x) <= 26) pickedUp = true;
      stepPicker(picker, other, s, atk, atkIdx, nextAtk, nextNear);
      stepCombat(other, s, atk, atkIdx, nextAtk, nextNear);
    } else {
      phase = atk ? (s < atk.t || nextNear ? 'approach' : 'attack') : (nextNear ? 'approach' : 'guard');
      stepCombat('R', s, atk, atkIdx, nextAtk, nextNear);
      stepCombat('B', s, atk, atkIdx, nextAtk, nextNear);
    }
    // Tangkap hantu setelah sampel diproses: posisi defender pada waktu s
    // (penyerang R) atau s+1 sampel (penyerang B) — sama dengan yang dibaca
    // sim saat entry serangan dibuat.
    if (ghostPending && i >= ghostPending.atSample) {
      const w = atkWin[ghostPending.idx];
      ghostX[ghostPending.idx] = xOf(otherOf(w.by));
      ghostPending = null;
    }
    xR = _clamp(xR, RING_X_MIN, RING_X_MAX); xB = _clamp(xB, RING_X_MIN, RING_X_MAX);
    samples.push({
      t: Math.round(s * 1000) / 1000,
      xR: Math.round(xR * 10) / 10, xB: Math.round(xB * 10) / 10,
      gap: Math.round(Math.abs(xB - xR) * 10) / 10, phase,
    });
  }
  return samples;
}

// Posisi pada detik t (interpolasi linear antar sampel; null kalau fight
// lama tanpa positions). Dipakai film.js + replay Hub.
export function positionAt(fight, t) {
  const pos = fight.positions;
  if (!pos || pos.length === 0) return null;
  const tt = _clamp(t, 0, fight.duration);
  const fi = tt / POS_DT;
  const i = Math.min(Math.floor(fi), pos.length - 2);
  if (i < 0) return pos[0];
  const a = pos[i], b = pos[i + 1];
  const k = _clamp((tt - a.t) / Math.max(1e-9, b.t - a.t), 0, 1);
  return {
    t: Math.round(tt * 1000) / 1000,
    xR: Math.round((a.xR + (b.xR - a.xR) * k) * 10) / 10,
    xB: Math.round((a.xB + (b.xB - a.xB) * k) * 10) / 10,
    gap: Math.round((a.gap + (b.gap - a.gap) * k) * 10) / 10,
    phase: k < 0.5 ? a.phase : b.phase,
  };
}

// Statistik jarak saat TIDAK menyerang (fase 'guard'): { n, mean, median,
// min, max } dalam px. Dipakai scripts/measure-distance.mjs + tes §18.
export function idleGapStats(fight) {
  const pos = fight.positions;
  if (!pos) return null;
  const gaps = pos.filter((p) => p.phase === 'guard').map((p) => p.gap).sort((x, y) => x - y);
  if (gaps.length === 0) return null;
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const r1 = (v) => Math.round(v * 10) / 10;
  return { n: gaps.length, mean: r1(mean), median: r1(gaps[Math.floor(gaps.length / 2)]), min: r1(gaps[0]), max: r1(gaps[gaps.length - 1]) };
}

// Bangun satu fight lengkap dari dua fighter + durasi + seed.
// Mengembalikan objek fight (dipakai buildScene + commentary + SFX).
export function buildFight(left, right, duration, seed, opts = {}) {
  const rng = mulberry32(seed);
  const fighters = { R: left, B: right };

  // --- UNDIAN DULU (sebelum koreografi) ---
  // Lotere gabungan (metode, pemenang) — SATU tarikan rng (2026-11-08):
  //   Decision R 30% | Decision B 30% | KO R 15% | KO B 15% | Draw 10%.
  //   Peluang menang R vs B tetap 50/50 (30+15 = 45% tiap sisi + 10% draw).
  // Dua tarikan rng ini SELALU dilakukan — tarikan ke-2 dipertahankan
  // (dulu lotWinner) supaya aliran rng setelah undian tetap sebanding
  // dengan run lama; forcedResult hanya menimpa hasilnya (lihat bawah).
  // Draw = hasil seri: winner null, HP akhir disamakan persis oleh
  // steering + penyesuaian power di akhir (lihat § "Penyeimbang draw").
  const lotRoll = rng();
  rng();
  let result, winner;
  if (lotRoll < 0.30) { result = 'decision'; winner = 'R'; }
  else if (lotRoll < 0.60) { result = 'decision'; winner = 'B'; }
  else if (lotRoll < 0.75) { result = 'ko'; winner = 'R'; }
  else if (lotRoll < 0.90) { result = 'ko'; winner = 'B'; }
  else { result = 'draw'; winner = null; }
  const fr = opts?.forcedResult;
  if (fr && (fr.result === 'ko' || fr.result === 'decision') && (fr.winner === 'R' || fr.winner === 'B')) {
    result = fr.result;
    winner = fr.winner;
  }
  const loser = winner === 'R' ? 'B' : winner === 'B' ? 'R' : null;

  // --- Event senjata kayu ---
  // Petarung dengan weapon.kind 'kayu' + pickupAt mengambil kayu di tepi ring.
  let weapon = null;
  for (const who of ['R', 'B']) {
    const f = fighters[who];
    if (f.weapon && f.weapon.kind === 'kayu' && typeof f.weapon.pickupAt === 'number') {
      const t = Math.min(Math.max(f.weapon.pickupAt, 6), duration - 8);
      weapon = { who, t, x: who === 'B' ? 900 : 380 };
      break;
    }
  }

  let koT = result === 'ko' ? duration - 1.2 - rng() * 1.2 : 99;
  const attacks = [], knockdowns = [], cheers = [], retreats = [], clinches = [];
  const hp = { R: 100, B: 100 };

  // Helper finisher KO (2026-11-08) — dipakai di loop DAN sebagai fallback
  // sesudah loop. Power TIDAK ada batas atas: damage finisher harus =
  // sisa HP pecundang persis (KO bersih, HP pecundang 0); power besar
  // tidak merusak visual karena film.js triggerAttack men-clamp power
  // visual ke 2,2. koT di-update ke waktu finisher sebenarnya (dipakai
  // keyMoments + teks KO — harus sama dengan attacks[].t finisher).
  let finisherPushed = false;
  const pushFinisher = () => {
    const wf = fighters[winner];
    const hasStick = weapon && weapon.who === winner && koT > weapon.t + 3.0;
    let finKind = 'finisher';
    if (hasStick) finKind = 'stickchop';
    else if (normalizeStyle(wf.style) === 'muaythai') finKind = 'flyknee';
    const finBase = DMG_BASE[finKind] ?? 5;
    const power = Math.max(1.4, hp[loser] / (finBase * 1.5));
    // Finisher tidak boleh terlalu rapat setelah serangan sebelumnya
    // (kadens normal >= 0,55 dtk): kalau terlalu rapat, defender masih
    // dalam reaksi slip serangan sebelumnya (kepala menjauh ~55px) saat
    // finisher mendarat dan tangan tidak sampai (terukur: finisher KO
    // 0,31 dtk setelah slip meleset 103px).
    const prev = attacks.length ? attacks[attacks.length - 1] : null;
    let finT = Math.max(koT, prev ? prev.t + 0.55 : koT);
    // Kalau serangan terakhir menjatuhkan korban, finisher menunggu korban
    // bangun (getup di prev.t+0,4+1,8) + jeda 0,55 — kalau tidak, finisher
    // menghantam korban yang masih terbaring (triggerAttack mengabaikan
    // reaksi korban yang down). Di-clamp ke dalam durasi fight.
    if (prev && prev.knockdown) finT = Math.max(finT, prev.t + 0.4 + 1.8 + 0.55);
    finT = Math.min(finT, duration - 0.1);
    attacks.push({ t: finT, by: winner, kind: finKind, target: 'head', outcome: 'hit', power, knockdown: true });
    knockdowns.push({ who: loser, t: finT + 0.4, getupStart: null });
    cheers.push({ t: finT, dur: 1.6, power: 1 });
    hp[loser] = Math.max(0, hp[loser] - dmgOf({ kind: finKind, outcome: 'hit', power }));
    koT = finT;
    finisherPushed = true;
  };

  // (Knockdown tengah fight lama — sekali per fight, 50% — DIHAPUS
  // 2026-11-08, diganti knockdown 10% per hit yang kena, diundi setelah
  // steering di bawah.)

  cheers.push({ t: 0.8, dur: 1.2, power: 0.5 });

  let t = 1.6; // Serangan pertama di 1.6 dtk: walk-in [0,1.0] + jalan
  // mendekat sampai jarak serang. Serangan di 0.9 dtk gagal kontak
  // karena petarung masih 150px apart (di luar jangkauan).
  let lastBy = rng() < 0.5 ? 'R' : 'B';
  let guard = 0;
  while (t < duration - 0.6 && guard++ < 200) {
    // --- Jendela ambil kayu: tanpa serangan ---
    if (weapon && t >= weapon.t - 0.4 && t < weapon.t + 3.0) {
      t = weapon.t + 3.0;
      continue;
    }
    // --- Finisher KO (serangan terakhir) ---
    if (result === 'ko' && t >= koT - 0.3) {
      pushFinisher();
      break;
    }
    // --- Clinch sesekali (gulat / muay thai / judo / kudo) ---
    const styles = [normalizeStyle(left.style), normalizeStyle(right.style)];
    if ((styles.includes('gulat') || styles.includes('muaythai') || styles.includes('judo') || styles.includes('kudo')) && rng() < 0.10 && t > 5) {
      const dur = 0.9 + rng() * 0.4;
      clinches.push({ t, dur });
      t += dur + 0.3;
      continue;
    }
    // --- Pilih penyerang (bergantian, 65% ganti) ---
    const by = rng() < 0.65 ? (lastBy === 'R' ? 'B' : 'R') : lastBy;
    lastBy = by;
    const def = by === 'R' ? 'B' : 'R';
    const att = fighters[by];
    // --- Pilih gerakan dari style penyerang ---
    let pool = movesFor(att);
    // Gerakan tongkat hanya setelah kayu diambil.
    if (weapon && weapon.who === by && t < weapon.t + 3.0) {
      pool = pool.filter((m) => !WEAPON_MOVES.has(m.kind));
    }
    if (pool.length === 0) pool = movesFor(att);
    // Weighted pick: opts.weights / signatureMove (2.5x) + bonus tempo
    // (agresif: power>=0.9 x1.5; bertahan: power<0.7 x1.5). Tanpa bobot =
    // pick uniform persis seperti sebelumnya (satu tarikan rng).
    const wBy = opts?.weights?.[by] ?? (att.signatureMove ? { [att.signatureMove]: 2.5 } : undefined);
    const tempoBy = tempoOf(by, opts, fighters);
    let move = pickWeighted(pool, wBy, tempoBy, rng);
    // --- Windup tidak boleh tumpang tindih dengan jendela ambil kayu ---
    // Penjaga di atas hanya menggeser WAKTU serangan ke weapon.t+3.0, tapi
    // windup (0.16-0.4 dtk sebelum t) tetap jatuh di dalam jendela pickup:
    // penyerang masih mode 'pickup' (jalan kembali) saat windup, timeline
    // tidak mendekat ke jarak serang, dan tangan/kaki belum sempat mencapai
    // target saat impact (terukur: suplex/stickchop di t=weapon.t+3.0
    // meleset 23-30px). Geser sampai windup mulai SETELAH jendela pickup.
    if (weapon && t >= weapon.t + 3.0 && t - windupDurOf(move.kind) < weapon.t + 3.0) {
      const pushed = weapon.t + 3.0 + windupDurOf(move.kind);
      // Jangan dorong melewati finisher KO (kalau mepet, biarkan overlap
      // lama — tidak lebih buruk dari sebelumnya).
      if (result !== 'ko' || pushed < koT - 0.3) t = pushed;
    }
    // Feint TIDAK dipakai director: di jarak dekat (gap ~50px) tangan
    // guard sudah 11px dari kepala hantu, jadi flick feint menembus
    // kepala lawan. Feint tetap ada di techniques.js untuk pemakaian
    // manual nanti.
    // (Knockdown tengah fight lama — sekali per fight, 50% — DIHAPUS
    // 2026-11-08, diganti knockdown 10% per hit yang kena, diundi setelah
    // steering di bawah.)
    // --- Outcome + HP steering ---
    let outcome = pickOutcome(rng);
    // Ginga = stance, bukan serangan (seperti feint): outcome 'feint'
    // supaya tidak ada damage/knockback/reaksi hit pada lawan.
    if (move.kind === 'feint' || move.kind === 'ginga') outcome = 'feint';
    let power = 0.9 + rng() * 0.4;
    if (move.power >= 0.9) power = 1.1 + rng() * 0.25;
    // Softening di akhir jalur KO: pemenang dipaksa kena terus.
    if (result === 'ko' && by === winner && t > koT - 6) outcome = 'hit';
    // Steering agar hasil undian bertahan — DUA FASE:
    // - Fase 1 (paruh pertama fight): aturan LUNAK (seperti dulu) — hit yang
    //   mengancam margin pemenang dilunakkan jadi block, pecundang dilindungi
    //   di lantai 10/12. Di fase ini pecundang BOLEH memimpin — justru di
    //   sinilah "momen balik" (leadChange) bisa terjadi: pemenang tertinggal
    //   dulu lalu merebut keunggulan.
    // - Fase 2 (paruh kedua): aturan KERAS — pemenang tidak boleh kehilangan
    //   HP sampai margin < 6 (decision) / HP < 15 (KO). Tanpa ini, chip block
    //   2 yang menumpuk selama 60 dtk menggerus margin sampai pemenang kalah
    //   HP, lalu fix-up akhir menolkan pecundang (fight 3–0 / 0–0 — bug
    //   2026-11-07). Di fase 2 pemenang yang tertinggal pulih karena ia
    //   terus memberi damage sementara tidak menerima damage.
    // Paruh pertama fight memakai aturan lunak lama; aliran rng tetap
    // bergantung pada durasi (mis. midKdT), jadi paruh pertama fight 60 dtk
    // TIDAK identik harfiah dengan fight 30 dtk mandiri seed sama — yang
    // dipertahankan adalah ATURANnya, bukan urutan serangannya.
    const trial = { kind: move.kind, outcome, power };
    const d = dmgOf(trial);
    if (d > 0) {
      const newHp = hp[def] - d;
      // Damage block (chip) — dipakai saat hit penuh harus dilunakkan.
      const blockDmg = power >= 1.3 ? BLOCK_CHIP * power : BLOCK_CHIP;
      const hard = t >= duration * 0.5;
      if (result === 'draw') {
        // Jalur DRAW: kedua HP harus berakhir SAMA. Dua penjaga simetris:
        // (1) lantai HP 12 — tidak ada yang boleh KO (tanpa lantai,
        //   margin kecil tapi kedua HP bisa sama-sama terkikis ke 0);
        // (2) selisih |hpR − hpB| ≤ DRAW_MARGIN. Hit yang melanggar
        //   salah satunya dilunakkan jadi block (kalau chip-nya masih
        //   lolos kedua penjaga) atau slip. Batas 12 ≈ dua pukulan keras
        //   (damage baru x0,25: hit terbesar ~6,8): cukup longgar supaya
        //   pukulan BISA mendarat, cukup ketat supaya selisih akhir kecil.
        //   Selisih sisa dibereskan di akhir dengan menyesuaikan power
        //   beberapa serangan terakhir — lihat "Penyeimbang draw".
        const margin = hp.R - hp.B; // > 0 = R unggul
        const newMargin = def === 'R' ? margin - d : margin + d;
        const marginAfter = (dmg) => (def === 'R' ? margin - dmg : margin + dmg);
        const okHit = newHp >= 12 && Math.abs(newMargin) <= DRAW_MARGIN;
        const okBlock = (hp[def] - blockDmg) >= 12 && Math.abs(marginAfter(blockDmg)) <= DRAW_MARGIN;
        if (!okHit) outcome = okBlock ? 'block' : 'slip';
      } else {
        // Lantai LUNAK (2026-11-08, decision + KO): hit yang melewati
        // lantai TIDAK lagi diubah jadi slip/block — power-nya DISKALA
        // supaya damage-nya tepat mendaratkan HP di lantai. Pukulan tetap
        // KENA (terlihat menghantam, damage tercatat), hanya lebih pelan.
        // Ini yang membuat rate hit efektif mendekati 80%: lantai KERAS
        // dulu mengubah ~19% serangan jadi slip di fase 2 (terukur rate
        // hit 62%, dodge 22% — jendela 50-60 dtk cuma 38% hit). Slip
        // hanya kalau defender SUDAH di lantai (tidak ada ruang damage
        // tersisa). Block yang melewati lantai jadi slip (chip 0,5).
        // Batas trail fase 1 decision = 15 HP (pemenang boleh tertinggal
        // sampai 15 — momen balik; defisit lebih besar tidak bisa
        // dipulihkan fase 2 dan fix-up akhir jalan, terukur 8/165).
        // Fase 2 decision: pemenang harus unggul >= 6. Lantai pecundang
        // decision fase 2 ADAPTIF: kalau pemenang sudah sekarat (mis.
        // 8 HP), lantai 10 akan mengunci margin negatif — turunkan lantai
        // ke (HP pemenang - 6), min 1. KO: pecundang lantai 12 (tidak
        // boleh 0 sebelum finisher), pemenang lantai 15.
        let minHp;
        if (result === 'decision') {
          const loserFloor = hard ? Math.max(1, Math.min(10, hp[winner] - 6)) : 10;
          const minMargin = hard ? 6 : -15;
          minHp = def === loser ? loserFloor : Math.max(10, hp[loser] + minMargin);
        } else { // ko
          minHp = def === loser ? 12 : 15;
        }
        if (newHp < minHp) {
          if (outcome === 'hit') {
            const allowed = hp[def] - minHp;
            // Lantai keras 2: di bawah itu hit jadi slip (jangan KO).
            // Kalau sudah di lantai, hit tetap KENA sebagai glancing blow
            // (damage min = chip block 0,5) — HP merayap turun pelan,
            // bukan membeku. Tanpa ini, begitu defender menyentuh lantai,
            // semua hit berikutnya jadi slip dan rate dodge meledak di
            // fase 2 (terukur 5,19/jendela 50-60 dtk).
            if (hp[def] <= 2) outcome = 'slip';
            else if (allowed <= 0.05) {
              // Glancing dibatasi supaya tidak merusak hasil undian:
              // pemenang harus tetap unggul >= 1 dari pecundang (tanpa
              // batas, pemenang merayap di bawah pecundang saat pecundang
              // sudah membeku di lantai keras 2 sementara pemenang terus
              // kena glancing — fix-up akhir jalan, terukur 3/165);
              // pecundang tidak boleh di bawah lantai keras 2.
              const cap = def === winner ? hp[winner] - hp[loser] - 1 : hp[loser] - 2;
              if (cap <= 0) outcome = 'slip';
              else power = power * (Math.min(BLOCK_CHIP, cap) / d);
            }
            else power = power * (allowed / d);
          } else if (outcome === 'block') {
            outcome = 'slip';
          }
        }
      }
    }
    // --- Knockdown: 10% per pukulan/tendangan yang KENA (2026-11-08,
    // perintah user "rate jatoh 10%"). Diundi SETELAH steering, supaya
    // hanya hit yang benar-benar mendarat yang bisa menjatuhkan (hit
    // yang dilunakkan jadi block/slip tidak ikut diundi). Menggantikan
    // knockdown tengah fight lama (sekali per fight, 50%).
    // Dampak waktu: tiap knockdown menjeda ~3,6 dtk (jatuh 0,4 +
    // terbaring 1,8 + bangun 1,4) — dengan ~5 knockdown/fight, ~18 dtk
    // jeda tersebar di 60 dtk; hit tetap mendarat di semua jendela.
    let knockdown = false;
    if (outcome === 'hit' && rng() < 0.10) knockdown = true;
    const atk = { t, by, kind: move.kind, target: move.target || 'head', outcome, power };
    if (knockdown && outcome === 'hit') {
      atk.knockdown = true;
      knockdowns.push({ who: def, t: t + 0.4, getupStart: t + 0.4 + 1.8 });
      cheers.push({ t, dur: 1.2, power: 0.9 });
    }
    attacks.push(atk);
    if (outcome === 'hit') {
      hp[def] = Math.max(0, hp[def] - dmgOf(atk));
      if (power >= 1.2) {
        cheers.push({ t, dur: 1.0, power: 0.6 });
        if (rng() < 0.4) retreats.push({ who: def, t: t + 0.2, dur: 0.8 });
      }
    } else if (outcome === 'block') {
      hp[def] = Math.max(0, hp[def] - dmgOf(atk));
    }
    // --- Jeda kontak: rentang tergantung tempo penyerang saat itu ---
    const gap = gapFor(tempoBy, rng);
    t = t + gap;
    // Setelah knockdown: jangan jadwal serangan selama korban terbaring
    // (1,8 dtk, getupStart) + 1,4 dtk — animasi bangun sendiri ~0,91 dtk
    // (bodyRot -1,45 -> 0 di 3,5/dtk) dan selama mode 'getup' cabang attack
    // tidak jalan, jadi windup serangan berikut (s.d. 0,4 dtk) harus mulai
    // SETELAH bangun selesai; kalau tidak, tangan/kaki tidak pernah
    // di-IK ke target (terukur: gulat vs muaythai seed 99, singleleg 0,6
    // dtk setelah bangun meleset 50px karena masih mode getup).
    if (atk.knockdown) t = Math.max(t, atk.t + 0.4 + 1.8 + 1.4);
  }

  // Fallback finisher (2026-11-08): knockdown di akhir fight bisa
  // melompati jendela finisher — lompatan t (jatuh 0,4 + terbaring 1,8 +
  // bangun 1,4) melewati duration-0,6 sehingga loop keluar tanpa finisher
  // (terukur: 6/97 KO tanpa finisher, pecundang hidup). Tanpa ini, hasil
  // KO tidak punya pukulan KO dan HP pecundang > 0.
  if (result === 'ko' && !finisherPushed) pushFinisher();

  // Pastikan decision punya pemenang HP (kalau seri karena steering, beri
  // satu pukulan kecil ke pecundang di akhir — tidak mungkin terjadi karena
  // steering, tapi jaga-jaga).
  if (result === 'decision' && hp[winner] <= hp[loser]) {
    hp[loser] = Math.max(0, hp[winner] - 4);
  }

  // --- Penyeimbang draw: samakan HP akhir PERSIS ---
  // Steering draw menjaga |hpR − hpB| ≤ DRAW_MARGIN; selisih sisa
  // dibereskan dengan menyesuaikan power serangan-serangan terakhir yang
  // memberi damage (bukan mengarang hpFinal — damageDealt di fightStats,
  // hpAt film.js, dan keyMoments semua dihitung ulang dari attacks, jadi
  // penyesuaian ini konsisten di semua pembaca). Kebutuhan dibagi ke
  // beberapa serangan (berjalan mundur dari yang terakhir, tiap power
  // tetap dalam [0.5, 2.2]) — satu serangan saja sering tidak cukup
  // karena damage per power kecil (jab 8) dan headroom power terbatas.
  // Utamakan hit; block (chip = 2*power, hanya kalau power ≥ 1.3)
  // hanya dipakai kalau hit tidak cukup menutup selisih.
  if (result === 'draw' && Math.abs(hp.R - hp.B) > 1e-9) {
    const diff = hp.R - hp.B; // > 0 = R unggul → R harus menerima damage lebih
    const leader = diff > 0 ? 'R' : 'B';
    let remaining = Math.abs(diff);
    const adjustPass = (outcome, perPowerOf, minPower) => {
      for (let i = attacks.length - 1; i >= 0 && remaining > 1e-9; i--) {
        const a = attacks[i];
        if (a.outcome !== outcome) continue;
        const perPower = perPowerOf(a);
        if (!perPower) continue;
        // Serangan oleh trailer ke leader: BESARKAN damage-nya.
        // Serangan oleh leader ke trailer: KECILKAN damage-nya.
        const grow = a.by !== leader;
        const maxTake = grow ? (2.2 - a.power) * perPower : (a.power - minPower) * perPower;
        if (maxTake <= 0) continue;
        const take = Math.min(remaining, maxTake);
        a.power = grow ? a.power + take / perPower : a.power - take / perPower;
        remaining -= take;
      }
    };
    adjustPass('hit', (a) => (DMG_BASE[a.kind] ?? 10) * (FINISHER_DMG[a.kind] ? 1.5 : 1), 0.5);
    if (remaining > 1e-9) adjustPass('block', (a) => (a.power >= 1.3 ? BLOCK_CHIP : 0), 1.3);
    if (remaining <= 1e-9) {
      // Hitung ulang HP dari attacks (urut, clamp per serangan — sama
      // seperti loop di atas) supaya hpFinal = damage serangan yang baru.
      let r = 100, b = 100;
      for (const a of attacks) {
        if (a.kind === 'feint') continue;
        const dd = dmgOf(a);
        if (dd <= 0) continue;
        if (a.by === 'R') b = Math.max(0, b - dd); else r = Math.max(0, r - dd);
      }
      hp.R = r; hp.B = b;
    }
    if (Math.abs(hp.R - hp.B) > 0.5) {
      // Jalan buntu (tidak ada serangan yang bisa disesuaikan — praktis
      // tidak terjadi di fight 60 dtk): samakan ke nilai terendah.
      const m = Math.min(hp.R, hp.B);
      hp.R = m; hp.B = m;
    }
  }

  const sceneCfg = {
    duration, left, right, attacks, knockdowns, cheers, retreats, clinches,
    winner, result, koT, weapon, seed,
    // Jarak gelud (otoritatif dari engine — film.js membaca ini, bukan
    // menghitung posisi sendiri): timeline posisi + konstanta jarak.
    positions: null, // diisi di bawah (butuh fight jadi dulu)
    spacing: { bodyLenPx: BODY_LEN_PX, guardGapPx: GUARD_GAP_PX, ringCenterX: RING_CENTER_X },
  };
  const fight = {
    seed, duration, winner, result, koT, weapon,
    attacks, knockdowns, cheers, retreats, clinches,
    left, right, hpFinal: { R: Math.round(hp.R), B: Math.round(hp.B) },
    sceneCfg,
    spacing: sceneCfg.spacing,
    positions: null, // diisi di bawah
  };
  fight.positions = buildPositions(fight);
  sceneCfg.positions = fight.positions;
  fight.stats = fightStats(fight);
  fight.keyMoments = keyMoments(fight);
  return fight;
}

// Ringkasan hasil untuk tampilan (seed, undian, skor akhir).
export function fightSummary(fight) {
  if (fight.result === 'draw') {
    return `Seri ${fight.hpFinal.R}–${fight.hpFinal.B} antara ${fight.left.name} dan ${fight.right.name} (seed ${fight.seed})`;
  }
  const wName = fight.winner === 'R' ? fight.left.name : fight.right.name;
  const lName = fight.winner === 'R' ? fight.right.name : fight.left.name;
  if (fight.result === 'ko') {
    return `${wName} menang KO atas ${lName} di detik ${fight.koT.toFixed(1)} (seed ${fight.seed})`;
  }
  return `${wName} menang angka ${fight.hpFinal.R}–${fight.hpFinal.B} atas ${lName} (seed ${fight.seed})`;
}
