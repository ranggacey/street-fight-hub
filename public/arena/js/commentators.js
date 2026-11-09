// commentators.js — Gambar komentator Stickman Fight Arena (dipakai BERSAMA
// oleh film.js [facecam saat fight] dan poster.js [poster hasil fight]).
// Tetap stickman, konsisten dengan gaya game — BUKAN karakter realistis.
// Upgrade 2026-11-08 (permintaan user: "karakter komentator di upgrade jadi
// bagus lagi"): kepala + bahu proporsional, headband, headset dengan boom mic
// + kapsul mic yang JELAS (bukan titik kecil), mata + alis berekspresi (beda
// tiap komentator), mulut hidup dari param `mouth` (0 = tutup, 1 = buka
// penuh), garis tegas + bayangan halus di dalam bingkai bulat.
// Redesign 2026-11-08 ronde 2 (spesifikasi §3.10): kepala r*0.40 (wajah
// dominan di facecam r=54), leher trapesium berisi, alis tebal ala Henry,
// mulut lebih lebar + senyum saat diam, tanpa pipi, headset busur penuh,
// ear cup + kapsul mic lebih besar.
//
// Komentator 1 (kuning #EAB308): alis miring ke dalam = semangat/fokus,
// mic di kanan, mulut lebih lebar. Komentator 2 (cyan #22D3EE): alis datar
// = kalem, mic di kiri (cermin), mulut lebih kecil. Tanpa nama orang.
import { PALETTE } from './palette.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const COMMENTATOR_STYLE = {
  c1: { color: '#EAB308', label: 'KOMENTATOR 1', brows: 'energetic', mirror: false },
  c2: { color: '#22D3EE', label: 'KOMENTATOR 2', brows: 'calm', mirror: true },
};

// Kecilkan ukuran font label sampai lebar teks <= maxW (diukur pakai
// measureFn yang menerima (teks, px) dan mengembalikan lebar px pada
// ukuran itu). maxW <= 0 = tanpa batas. Lantai 10px (di bawah itu label
// tidak terbaca). Pure — bisa di-unit-test tanpa canvas.
export function fitLabelPx(text, basePx, maxW, measureFn) {
  if (!maxW || maxW <= 0) return basePx;
  let px = basePx;
  while (px > 10 && measureFn(text, px) > maxW) px -= 1;
  return px;
}

// Gambar satu komentator di dalam bingkai bulat + label di bawahnya.
// c: CanvasRenderingContext2D; (cx, cy): pusat lingkaran; r: radius lingkaran.
// opts: { color, mouth (0..1), label, labelColor, brows ('energetic'|'calm'),
//   mirror (mic di kiri bila true), ring (warna bingkai, default = color),
//   maxLabelW (lebar maks label px — font dikecilkan sampai muat) }.
export function drawCommentator(c, cx, cy, r, opts = {}) {
  const color = opts.color || '#EAB308';
  const mouth = clamp(typeof opts.mouth === 'number' ? opts.mouth : 0.5, 0, 1);
  const label = opts.label || '';
  const labelColor = opts.labelColor || PALETTE.ink;
  const brows = opts.brows || 'energetic';
  const mirror = !!opts.mirror;
  const side = mirror ? -1 : 1; // sisi headset + mic
  const lw = Math.max(2, r * 0.055); // ketebalan garis utama, skala dgn r

  c.save();
  // --- bingkai bulat: isi kertas + bayangan dalam halus di bawah ---
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fillStyle = PALETTE.paper; c.fill();
  c.save();
  c.beginPath(); c.arc(cx, cy, r - 1, 0, Math.PI * 2); c.clip();
  // Bayangan dalam: separuh bawah sedikit lebih gelap (kedalaman).
  c.fillStyle = 'rgba(20,18,16,0.07)';
  c.beginPath(); c.ellipse(cx, cy + r * 0.62, r * 0.95, r * 0.55, 0, 0, Math.PI * 2); c.fill();
  // Sorot atas: setengah lingkaran atas sedikit lebih terang.
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath(); c.ellipse(cx, cy - r * 0.62, r * 0.9, r * 0.45, 0, 0, Math.PI * 2); c.fill();

  const headY = cy - r * 0.12;   // pusat kepala (naik sedikit, ruang bahu lbh kecil)
  const headR = r * 0.40;        // radius kepala (wajah +20% di facecam r=54)
  const shoulderY = cy + r * 0.48; // garis bahu

  // --- bahu + dada: trapesium membulat warna komentator, kerah kertas ---
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(cx - r * 0.70, cy + r * 1.02);
  c.lineTo(cx - r * 0.52, shoulderY + r * 0.06);
  c.quadraticCurveTo(cx - r * 0.3, shoulderY - r * 0.08, cx, shoulderY - r * 0.08);
  c.quadraticCurveTo(cx + r * 0.3, shoulderY - r * 0.08, cx + r * 0.52, shoulderY + r * 0.06);
  c.lineTo(cx + r * 0.70, cy + r * 1.02);
  c.closePath(); c.fill();
  // Garis lipatan bahu (bayangan) + kerah V kertas di leher.
  c.strokeStyle = 'rgba(20,18,16,0.35)'; c.lineWidth = Math.max(1.5, r * 0.03); c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx - r * 0.52, shoulderY + r * 0.06); c.lineTo(cx - r * 0.70, cy + r * 1.02); c.stroke();
  c.beginPath(); c.moveTo(cx + r * 0.52, shoulderY + r * 0.06); c.lineTo(cx + r * 0.70, cy + r * 1.02); c.stroke();
  c.fillStyle = PALETTE.paper;
  c.beginPath();
  c.moveTo(cx - r * 0.14, shoulderY + r * 0.02);
  c.lineTo(cx, shoulderY + r * 0.24);
  c.lineTo(cx + r * 0.14, shoulderY + r * 0.02);
  c.closePath(); c.fill();

  // --- leher: trapesium berisi (kertas), bukan dua garis ---
  c.fillStyle = PALETTE.paper;
  c.beginPath();
  c.moveTo(cx - r * 0.07, headY + headR * 0.85);
  c.lineTo(cx + r * 0.07, headY + headR * 0.85);
  c.lineTo(cx + r * 0.09, shoulderY);
  c.lineTo(cx - r * 0.09, shoulderY);
  c.closePath(); c.fill();
  c.strokeStyle = PALETTE.ink; c.lineWidth = Math.max(2, r * 0.04); c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx - r * 0.07, headY + headR * 0.85); c.lineTo(cx - r * 0.09, shoulderY); c.stroke();
  c.beginPath(); c.moveTo(cx + r * 0.07, headY + headR * 0.85); c.lineTo(cx + r * 0.09, shoulderY); c.stroke();

  // --- kepala: lingkaran kertas, outline tinta ---
  c.fillStyle = PALETTE.paper;
  c.beginPath(); c.arc(cx, headY, headR, 0, Math.PI * 2); c.fill();
  c.lineWidth = lw; c.strokeStyle = PALETTE.ink; c.stroke();

  // --- headband warna komentator di dahi + simpul kecil di samping ---
  c.save();
  c.beginPath(); c.arc(cx, headY, headR, 0, Math.PI * 2); c.clip();
  c.fillStyle = color;
  c.fillRect(cx - headR, headY - headR * 0.98, headR * 2, headR * 0.28);
  c.strokeStyle = 'rgba(20,18,16,0.4)'; c.lineWidth = Math.max(1.5, r * 0.025);
  c.beginPath(); c.moveTo(cx - headR, headY - headR * 0.70); c.lineTo(cx + headR, headY - headR * 0.70); c.stroke();
  c.restore();
  // Ujung headband berkibar di sisi berlawanan mic.
  c.strokeStyle = color; c.lineWidth = Math.max(2, r * 0.045); c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx - side * headR * 0.95, headY - headR * 0.55);
  c.lineTo(cx - side * headR * 1.22, headY - headR * 0.34); c.stroke();
  c.beginPath(); c.moveTo(cx - side * headR * 0.95, headY - headR * 0.72);
  c.lineTo(cx - side * headR * 1.18, headY - headR * 0.62); c.stroke();

  // --- mata + alis (ekspresi beda tiap komentator; alis dominan ala Henry) ---
  const eyeY = headY - headR * 0.08;
  const eyeDX = headR * 0.36;
  const eyeR = Math.max(2, r * 0.055);
  c.fillStyle = PALETTE.ink;
  c.beginPath(); c.arc(cx - eyeDX, eyeY, eyeR, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(cx + eyeDX, eyeY, eyeR, 0, Math.PI * 2); c.fill();
  // Alis: energetic = miring tajam ke dalam (semangat), calm = hampir datar
  // tapi ujung luar sedikit naik (kalem tapi hidup, bukan datar).
  c.strokeStyle = PALETTE.ink; c.lineWidth = Math.max(2.5, r * 0.055); c.lineCap = 'round';
  const browY = eyeY - headR * 0.34;
  const browLen = headR * 0.38;
  const tilt = brows === 'energetic' ? headR * 0.20 : headR * 0.06;
  c.beginPath(); c.moveTo(cx - eyeDX - browLen / 2, browY - tilt); c.lineTo(cx - eyeDX + browLen / 2, browY + tilt); c.stroke();
  c.beginPath(); c.moveTo(cx + eyeDX - browLen / 2, browY + tilt); c.lineTo(cx + eyeDX + browLen / 2, browY - tilt); c.stroke();
  // Bukan titik pipi (terbaca noda di ukuran kecil): 1 sapuan bayangan
  // hangat di bawah mata.
  c.fillStyle = 'rgba(20,18,16,0.06)';
  c.beginPath(); c.ellipse(cx, headY + headR * 0.24, headR * 0.78, headR * 0.14, 0, 0, Math.PI * 2); c.fill();

  // --- mulut: hidup dari param mouth (buka-tutup saat bicara) ---
  const mouthY = headY + headR * 0.42;
  const mouthOpen = brows === 'energetic' ? 1 : 0.9; // K2 mulut sedikit lbh kecil
  const mo = mouth * mouthOpen;
  c.fillStyle = PALETTE.ink;
  c.beginPath();
  c.ellipse(cx, mouthY, headR * 0.30, Math.max(headR * 0.05, headR * 0.3 * mo), 0, 0, Math.PI * 2);
  c.fill();
  if (mo > 0.45) {
    // Lidah saat mulut terbuka lebar.
    c.fillStyle = '#D64541';
    c.beginPath();
    c.ellipse(cx, mouthY + headR * 0.1, headR * 0.15, headR * 0.1, 0, 0, Math.PI);
    c.fill();
  }
  if (mouth < 0.15) {
    // Senyum tipis saat diam (K2 tidak terlihat cemberut).
    c.strokeStyle = PALETTE.ink; c.lineWidth = Math.max(1.5, r * 0.03); c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx - headR * 0.16, mouthY + headR * 0.12);
    c.quadraticCurveTo(cx, mouthY + headR * 0.22, cx + headR * 0.16, mouthY + headR * 0.12);
    c.stroke();
  }

  // --- headset: busur penuh mengikuti lengkung kepala + ear cup + boom mic melengkung ke mulut ---
  const earX = cx + side * headR * 0.92;
  const earY = headY + headR * 0.05;
  c.strokeStyle = PALETTE.ink; c.lineWidth = Math.max(2, r * 0.05); c.lineCap = 'round';
  c.beginPath(); c.arc(cx, headY - headR * 0.08, headR * 1.02, Math.PI * 1.0, Math.PI * 2.0); c.stroke();
  // Ear cup (lingkaran berisi warna komentator) + titik tengah tinta.
  c.fillStyle = color;
  c.beginPath(); c.arc(earX, earY, headR * 0.26, 0, Math.PI * 2); c.fill();
  c.lineWidth = Math.max(1.5, r * 0.03); c.strokeStyle = PALETTE.ink; c.stroke();
  c.fillStyle = PALETTE.ink;
  c.beginPath(); c.arc(earX, earY, headR * 0.07, 0, Math.PI * 2); c.fill();
  // Boom mic: kurva tipis dari ear cup ke depan mulut (bukan garis lurus
  // memotong pipi).
  const micX = cx + side * headR * 0.42;
  const micY = mouthY + headR * 0.08;
  c.strokeStyle = PALETTE.ink; c.lineWidth = Math.max(2, r * 0.045);
  c.beginPath(); c.moveTo(earX, earY + headR * 0.12);
  c.quadraticCurveTo(earX - side * headR * 0.1, micY + headR * 0.28, micX - side * headR * 0.18, micY + headR * 0.12);
  c.stroke();
  // Kapsul mic: jelas terlihat (bukan titik kecil) + dot warna + grille.
  const capW = headR * 0.42, capH = headR * 0.28;
  c.fillStyle = PALETTE.ink;
  c.beginPath();
  c.roundRect(micX - capW / 2, micY - capH / 2, capW, capH, capH / 2);
  c.fill();
  c.fillStyle = color;
  c.beginPath(); c.arc(micX, micY, headR * 0.08, 0, Math.PI * 2); c.fill();
  // 2 garis grille vertikal di kapsul (warna komentator — garis tinta di
  // atas kapsul tinta tidak akan terlihat).
  c.strokeStyle = color; c.lineWidth = 1.5; c.lineCap = 'round';
  for (const gx of [micX - capW * 0.22, micX + capW * 0.22]) {
    c.beginPath(); c.moveTo(gx, micY - capH * 0.28); c.lineTo(gx, micY + capH * 0.28); c.stroke();
  }
  c.restore(); // keluar dari clip lingkaran

  // --- bingkai luar + label di bawah ---
  c.lineWidth = Math.max(3, r * 0.07); c.strokeStyle = color;
  c.beginPath(); c.arc(cx, cy, r - c.lineWidth / 2, 0, Math.PI * 2); c.stroke();
  if (label) {
    // Label: ukuran dasar r*0.26 (maks 16px, min 11px), lalu DICCOCOKKAN
    // ke maxLabelW (bila ada) lewat measureText — turun sampai 10px.
    // Alasan: facecam fight pusatnya cuma 128px berjarak (296/424), label
    // Manrope 700 15px 'KOMENTATOR 1/2' selebar 111/113px (diukur font
    // asli) → celah cuma ~16px di kanvas (~9px di HP 390px) — nyaris
    // menempel. Dengan maxLabelW 100 label jadi 13px (98/100px) dan celah
    // minimal 28px kanvas (~15px di HP 390px).
    const basePx = Math.max(11, Math.min(Math.round(r * 0.26), 16));
    const measureAt = (t, px) => { c.font = `700 ${px}px Manrope, sans-serif`; return c.measureText(t).width; };
    const px = fitLabelPx(label, basePx, opts.maxLabelW || 0, measureAt);
    c.font = `700 ${px}px Manrope, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillStyle = labelColor;
    c.fillText(label, cx, cy + r + Math.max(14, r * 0.3));
  }
  c.restore();
}
