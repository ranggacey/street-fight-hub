// poster.js — Poster hasil fight 720x1280 (JPEG, dikirim ke Hub lewat
// sfa-result sebagai posterDataUrl — KONTRAK TIDAK BERUBAH: ukuran, format,
// dan batas 200KB sama seperti sebelumnya).
//
// Redesign 2026-11-08 (permintaan user: "Bagian ui ux poster dibuat sangat
// buagus"): layout poster laga ala boksing, bukan lagi strip overlay di atas
// frame: header branding -> foto frame akhir -> SKOR BESAR sebagai hero ->
// pita pemenang merah -> panel komentator -> footer seed/tanggal/link.
// Hierarki: charcoal 60% (dominan) / krem 30% (panel + teks) / amber+merah
// 10% (aksen: skor, pita, garis). Font: Teko 700 (display) + Manrope (label).
// Tanpa ruang kosong polos yang besar; tiap zona berisi konten.
import { PALETTE } from './palette.js';
import { drawCommentator, COMMENTATOR_STYLE } from './commentators.js';

export const POSTER_W = 720;
export const POSTER_H = 1280;

const CHARCOAL = '#0E0D0B';
const CHARCOAL_2 = '#1B1713';
const CREAM = '#F3EDE2';
const MUTED = '#C9BFA5';
const AMBER = '#EAB308';
const RED = '#E10600';

// Label gaya dari engine-key ('muay-thai' -> 'MUAY THAI').
const STYLE_LABELS = {
  boxing: 'BOXING', 'muay-thai': 'MUAY THAI', taekwondo: 'TAEKWONDO',
  wrestling: 'GULAT', judo: 'JUDO', kali: 'KALI ARNIS', kudo: 'KUDO',
  'jeet-kune-do': 'JEET KUNE DO', karate: 'KARATE', brawler: 'STREET FIGHTER',
};
export function styleLabel(key) {
  if (typeof key !== 'string' || !key) return '';
  return (STYLE_LABELS[key] || key.replace(/-/g, ' ')).toUpperCase();
}

// "27.9" -> "27,9" (format Indonesia).
export function formatKoTime(sec) {
  const n = typeof sec === 'number' && Number.isFinite(sec) ? sec : 0;
  return n.toFixed(1).replace('.', ',');
}

// Zona layout (murni, bisa dites tanpa canvas): semua rect di dalam 720x1280.
export function posterLayout() {
  return {
    header: { x: 0, y: 0, w: 720, h: 116 },
    photo: { x: 24, y: 132, w: 672, h: 360 },
    score: { x: 0, y: 508, w: 720, h: 240 },
    winner: { x: 0, y: 764, w: 720, h: 164 },
    commentators: { x: 24, y: 944, w: 672, h: 208 },
    footer: { x: 0, y: 1168, w: 720, h: 112 },
  };
}

function fitFont(c, text, maxWidth, startPx, minPx, family) {
  let px = startPx;
  c.font = `700 ${px}px ${family}`;
  while (px > minPx && c.measureText(text).width > maxWidth) {
    px -= 2;
    c.font = `700 ${px}px ${family}`;
  }
  return px;
}

// Font display: Teko 700 (variabel wght 300-700) — string canvas WAJIB pakai
// bobot eksplisit '700' (tanpa bobot, canvas memakai 400 dari file variabel).
// Anton tetap di fallback chain sampai user menyetujui Teko secara final.
const ANTON = '"Teko", Anton, "Arial Black", sans-serif';
const MANROPE = 'Manrope, sans-serif';

// Gambar poster penuh ke ctx `c` (canvas 720x1280).
// data: { frame (canvas/image|null), left {name,style,color}, right {...},
//   scoreA, scoreB, winnerName (null = seri), method 'KO'|'Decision'|'Draw',
//   koTimeSec (null kalau bukan KO), seed, dateStr }.
export function drawPoster(c, data) {
  const L = posterLayout();
  const left = data.left || { name: '?', style: '', color: RED };
  const right = data.right || { name: '?', style: '', color: '#22D3EE' };
  const scoreA = data.scoreA ?? 0;
  const scoreB = data.scoreB ?? 0;
  const isDraw = data.method === 'Draw' || !data.winnerName;
  const method = data.method || 'Decision';

  c.save();
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';

  // ---------- latar charcoal + garis diagonal samar (tekstur, bukan polos) ----------
  c.fillStyle = CHARCOAL; c.fillRect(0, 0, POSTER_W, POSTER_H);
  c.strokeStyle = 'rgba(243,237,226,0.045)'; c.lineWidth = 10;
  for (let x = -POSTER_H; x < POSTER_W + POSTER_H; x += 92) {
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x + POSTER_H, POSTER_H); c.stroke();
  }

  // ---------- header: branding ----------
  c.fillStyle = RED; c.fillRect(0, 0, POSTER_W, 10);
  c.fillStyle = CREAM;
  c.font = `700 44px ${ANTON}`;
  c.fillText('STREET FIGHT HUB', 360, 62);
  c.fillStyle = AMBER;
  c.font = `700 19px ${MANROPE}`;
  if ('letterSpacing' in c) c.letterSpacing = '6px';
  c.fillText('HASIL PERTANDINGAN', 360, 96);
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  c.fillStyle = AMBER; c.fillRect(0, L.header.y + L.header.h - 3, POSTER_W, 3);

  // ---------- foto: frame akhir arena, berbingkai ----------
  const ph = L.photo;
  c.fillStyle = AMBER; c.fillRect(ph.x - 4, ph.y - 4, ph.w + 8, ph.h + 8);
  c.fillStyle = CHARCOAL_2; c.fillRect(ph.x, ph.y, ph.w, ph.h);
  if (data.frame) {
    // Crop ke rasio foto (672x360): ambil pita AKSI di sekitar GROUND_Y
    // (petarung berdiri di y~880, badan sampai ~y 550) — bukan tengah
    // mentah (yang isinya dinding kosong) dan bukan HUD atas / facecam bawah.
    const fw = data.frame.width || POSTER_W;
    const fh = data.frame.height || POSTER_H;
    const targetRatio = ph.w / ph.h;
    const sh = fw / targetRatio;
    const sy = Math.max(0, (fh - sh) * 0.62);
    try { c.drawImage(data.frame, 0, sy, fw, sh, ph.x, ph.y, ph.w, ph.h); } catch (e) { /* frame rusak: panel gelap tetap tampil */ }
  } else {
    // Tanpa frame: panel arena stilasi (ring + wordmark).
    c.strokeStyle = RED; c.lineWidth = 6;
    c.beginPath(); c.arc(360, ph.y + ph.h / 2, 120, 0, Math.PI * 2); c.stroke();
    c.fillStyle = CREAM; c.font = `700 40px ${ANTON}`;
    c.fillText('STREET FIGHT ARENA', 360, ph.y + ph.h / 2 + 14);
  }

  // ---------- scoreboard: SKOR BESAR sebagai hero ----------
  // Susun vertikal (label -> nama+VS -> gaya -> skor raksasa) supaya nama
  // tidak pernah bertabrakan dengan angka skor.
  const sc = L.score;
  c.fillStyle = AMBER; c.font = `700 20px ${MANROPE}`;
  if ('letterSpacing' in c) c.letterSpacing = '5px';
  c.fillText('SKOR AKHIR', 360, sc.y + 30);
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  // Nama kiri / kanan + VS di tengah.
  const nameW = 250;
  fitFont(c, left.name.toUpperCase(), nameW, 42, 22, ANTON);
  c.fillStyle = left.color || CREAM;
  c.textAlign = 'right';
  c.fillText(left.name.toUpperCase(), 295, sc.y + 82);
  fitFont(c, right.name.toUpperCase(), nameW, 42, 22, ANTON);
  c.fillStyle = right.color || CREAM;
  c.textAlign = 'left';
  c.fillText(right.name.toUpperCase(), 425, sc.y + 82);
  c.textAlign = 'center';
  c.fillStyle = AMBER; c.font = `700 28px ${ANTON}`;
  c.fillText('VS', 360, sc.y + 80);
  // Gaya di bawah nama.
  c.fillStyle = MUTED; c.font = `700 17px ${MANROPE}`;
  c.textAlign = 'right'; c.fillText(styleLabel(left.style), 295, sc.y + 112);
  c.textAlign = 'left'; c.fillText(styleLabel(right.style), 425, sc.y + 112);
  c.textAlign = 'center';
  // Skor raksasa di tengah (angka krem, pemisah amber).
  // Pemisah digambar sebagai BATANG (rect), BUKAN glyph '–' sebagai teks:
  // lebar glyph dash tidak terkendali — di poster lama strip menempel ke
  // angka (15-0: ujung strip menyentuh '5' dan '0'). Batang proporsional:
  // lebar ~0,45x lebar digit, tebal ~0,14x tinggi digit (cap height),
  // celah kiri-kanan ~0,22x tinggi digit; seluruh skor dipusatkan sebagai
  // satu grup (diukur dari lebar tiap angka, bukan posisi tetap).
  const scoreFont = `700 120px ${ANTON}`;
  c.font = scoreFont;
  const strA = `${scoreA}`, strB = `${scoreB}`;
  const wA = c.measureText(strA).width;
  const wB = c.measureText(strB).width;
  const m0 = c.measureText('0');
  const capH = (m0.actualBoundingBoxAscent && m0.actualBoundingBoxAscent > 0) ? m0.actualBoundingBoxAscent : 86;
  const gap = Math.round(capH * 0.22);
  const digitW = Math.max(wA / strA.length, wB / strB.length, 1);
  const stripW = Math.max(10, Math.round(digitW * 0.45));
  const stripH = Math.max(8, Math.round(capH * 0.14));
  const totalW = wA + gap + stripW + gap + wB;
  const x0 = 360 - totalW / 2;
  const baseY = sc.y + 215;
  c.fillStyle = CREAM;
  c.textAlign = 'left';
  c.fillText(strA, x0, baseY);
  c.fillStyle = AMBER;
  const stripX = x0 + wA + gap;
  // Batang terpusat vertikal terhadap tinggi digit (cap height).
  c.fillRect(stripX, baseY - capH / 2 - stripH / 2, stripW, stripH);
  c.fillStyle = CREAM;
  c.fillText(strB, stripX + stripW + gap, baseY);
  c.textAlign = 'center';
  // Garis bawah scoreboard.
  c.fillStyle = 'rgba(243,237,226,0.25)'; c.fillRect(24, sc.y + sc.h - 2, 672, 2);

  // ---------- pita pemenang (merah, full-bleed) ----------
  const wn = L.winner;
  c.fillStyle = isDraw ? CHARCOAL_2 : RED; c.fillRect(wn.x, wn.y, wn.w, wn.h);
  c.fillStyle = AMBER; c.fillRect(wn.x, wn.y, wn.w, 4);
  c.fillStyle = AMBER; c.fillRect(wn.x, wn.y + wn.h - 4, wn.w, 4);
  c.fillStyle = isDraw ? MUTED : CREAM;
  c.font = `700 20px ${MANROPE}`;
  if ('letterSpacing' in c) c.letterSpacing = '5px';
  c.fillText(isDraw ? 'TIDAK ADA PEMENANG' : 'PEMENANG', 360, wn.y + 40);
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  const winText = isDraw ? 'HASIL SERI' : data.winnerName.toUpperCase();
  fitFont(c, winText, 640, 62, 30, ANTON);
  c.fillStyle = CREAM;
  c.fillText(winText, 360, wn.y + 106);
  c.fillStyle = isDraw ? MUTED : '#FFE9A8';
  c.font = `700 24px ${MANROPE}`;
  const methodText = isDraw
    ? `SKOR IMBANG ${scoreA} – ${scoreB}`
    : method === 'KO'
      ? `MENANG KO · DETIK ${formatKoTime(data.koTimeSec)}`
      : 'MENANG DECISION';
  c.fillText(methodText, 360, wn.y + 144);

  // ---------- panel komentator (krem) ----------
  const cm = L.commentators;
  c.fillStyle = PALETTE.paper;
  c.beginPath(); c.roundRect(cm.x, cm.y, cm.w, cm.h, 18); c.fill();
  c.fillStyle = PALETTE.ink; c.font = `700 19px ${MANROPE}`;
  if ('letterSpacing' in c) c.letterSpacing = '4px';
  c.fillText('SUARA DI ARENA', 360, cm.y + 34);
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  drawCommentator(c, 250, cm.y + 118, 58, {
    ...COMMENTATOR_STYLE.c1, mouth: 0.65, labelColor: PALETTE.ink,
  });
  drawCommentator(c, 470, cm.y + 118, 58, {
    ...COMMENTATOR_STYLE.c2, mouth: 0.4, labelColor: PALETTE.ink,
  });

  // ---------- footer: seed + tanggal + link ----------
  const ft = L.footer;
  c.fillStyle = 'rgba(243,237,226,0.25)'; c.fillRect(24, ft.y, 672, 2);
  c.fillStyle = MUTED; c.font = `600 19px ${MANROPE}`;
  c.textAlign = 'left';
  c.fillText(typeof data.seed === 'number' ? `SEED #${data.seed}` : 'SEED ACAK', 24, ft.y + 44);
  c.textAlign = 'right';
  c.fillText(data.dateStr || '', 696, ft.y + 44);
  c.textAlign = 'center';
  c.fillStyle = AMBER; c.font = `700 23px ${MANROPE}`;
  c.fillText('streetfight.ranggafigo.com', 360, ft.y + 88);
  c.restore();
}
