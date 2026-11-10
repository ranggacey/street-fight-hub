// accessories.js — Sistem aksesoris & anatomi visual fighter (HANYA visual).
// Dipindah dari js/film.js 2026-11-08 supaya film.js muat di batas
// argumen upload Vercel (125.000 byte, lihat scripts/deploy.mjs).
// Kontrak dengan Hub: EMBED-CONTRACT.md §4 — ID katalog, fallback,
// dan perilaku gambar TIDAK BOLEH mengubah gameplay/simulasi.
import { PALETTE, shade } from './palette.js';
import { fighterColors } from './moves.js';

// ---------------- katalog aksesoris (kontrak dengan Hub, EMBED-CONTRACT.md §4) ----------------
export const ACCESSORY_IDS = {
  head: ['none', 'headband', 'bandana', 'cap', 'crown', 'helmet', 'topknot'],
  hands: ['none', 'boxing', 'big', 'mma', 'wraps', 'fingerless'],
  feet: ['barefoot', 'sneakers', 'boots', 'sandals', 'martial'],
  body: ['none', 'shirt', 'singlet', 'jacket', 'gi'],
  belt: ['none', 'belt', 'champion', 'rope'],
  weapon: ['none', 'stick', 'short-stick', 'wooden-sword', 'nunchaku'],
};

export const ACCESSORY_DEFAULTS = {
  head: 'none', hands: 'none', feet: 'sneakers', body: 'none', belt: 'none', weapon: 'none',
};

const GEAR_GOLD = '#D4A017';
const GEAR_GOLD_LIGHT = '#FCE79C';
const GEAR_SILVER = '#CBD5E1';

export function normalizeGear(f) {
  const col = fighterColors(f);
  const acc = (f.accessories && typeof f.accessories === 'object') ? f.accessories : null;
  const known = (part, id) => ACCESSORY_IDS[part].includes(id) ? id : null;
  const pick = (part, legacyId) => {
    if (acc && acc[part] !== undefined && acc[part] !== null) {
      const k = known(part, acc[part]);
      return { id: k !== null ? k : ACCESSORY_DEFAULTS[part], fromAccessories: true };
    }
    return { id: legacyId, fromAccessories: false };
  };
  const headLegacy = col.headband !== 'none' ? 'headband' : 'none';
  const handsLegacy = ['none', 'boxing', 'mma', 'big'].includes(f.gloves && f.gloves.type)
    ? f.gloves.type : 'none';
  const feetLegacy = ['barefoot', 'sneakers', 'boots'].includes(f.shoes && f.shoes.model)
    ? f.shoes.model : 'sneakers';
  const beltLegacy = col.belt !== 'none' ? 'belt' : 'none';
  const weaponLegacy = (f.weapon && f.weapon.kind === 'kayu') ? 'stick' : 'none';

  const head = pick('head', headLegacy);
  const hands = pick('hands', handsLegacy);
  const feet = pick('feet', feetLegacy);
  const body = pick('body', 'none');
  const belt = pick('belt', beltLegacy);
  const weapon = pick('weapon', weaponLegacy);

  const gloves = hands.id === 'none'
    ? null
    : { F: { type: hands.id, color: col.gloves }, B: { type: hands.id, color: col.gloves } };
  const shoes = feet.id === 'barefoot' ? null : { model: feet.id, color: col.shoes };
  const headColor = col.headband !== 'none'
    ? col.headband : (head.id === 'crown' ? GEAR_GOLD : col.body);
  const headGear = head.id === 'none' ? null : { variant: head.id, color: headColor };
  const headband = head.id === 'headband' ? { color: headColor } : null;
  const bodyGear = body.id === 'none' ? null : { variant: body.id, color: col.body };
  const beltGear = belt.id === 'none'
    ? null : { variant: belt.id, color: col.belt !== 'none' ? col.belt : col.body };
  const weaponGear = weapon.id === 'none' ? null : {
    kind: weapon.id === 'stick' ? 'kayu' : weapon.id,
    variant: weapon.id, color: col.weapon, fromAccessories: weapon.fromAccessories,
  };
  const shorts = (f.style === 'muaythai' || f.style === 'brawler') ? { color: shade(f.color, 0.7) } : null;
  return { gloves, shoes, belt: beltGear, headband, head: headGear, body: bodyGear, weapon: weaponGear, shorts };
}

const isNearBlack = (hex) => {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255) < 120;
};

function fillPoly(c, pts, fill) {
  if (!pts.length) return;
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.closePath();
  c.fill();
}

function strokePoly(c, pts, stroke, lw, closed = true) {
  if (!pts.length) return;
  c.strokeStyle = stroke;
  c.lineWidth = lw;
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  if (closed) c.closePath();
  c.stroke();
}

function torsoAxis(j) {
  const dx = j.hip.x - j.shoulder.x;
  const dy = j.hip.y - j.shoulder.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  return { ux, uy, px: -uy, py: ux, len };
}

// Poligon Torso V-Taper Atletis:
// Bahu bidang (shB..shF) -> dada & latissimus kekar -> pinggang ramping -> panggul padat menyatu ke paha.
const VTAPER_STATIONS = [
  { t: 0.00, wf: 1.02, wb: 1.00 }, // bahu deltoid bidang
  { t: 0.24, wf: 0.94, wb: 0.90 }, // dada atas / latissimus
  { t: 0.50, wf: 0.72, wb: 0.68 }, // rusuk meruncing (V-taper)
  { t: 0.74, wf: 0.64, wb: 0.62 }, // lekuk pinggang atletis ramping
  { t: 0.92, wf: 0.86, wb: 0.84 }, // panggul atas
  { t: 1.00, wf: 1.00, wb: 1.00 }, // akar paha (menyatu mulus ke hipF/hipB)
];

export function vTaperTorsoPts(j, ex = 0, profile = VTAPER_STATIONS) {
  const { ux, uy } = torsoAxis(j);
  const shFdx = j.shF.x - j.shoulder.x, shFdy = j.shF.y - j.shoulder.y;
  const shBdx = j.shB.x - j.shoulder.x, shBdy = j.shB.y - j.shoulder.y;
  const hpFdx = j.hipF.x - j.hip.x, hpFdy = j.hipF.y - j.hip.y;
  const hpBdx = j.hipB.x - j.hip.x, hpBdy = j.hipB.y - j.hip.y;

  const frontSide = [];
  const backSide = [];
  for (const st of profile) {
    const t = st.t;
    const sx = j.shoulder.x + (j.hip.x - j.shoulder.x) * t;
    const sy = j.shoulder.y + (j.hip.y - j.shoulder.y) * t;
    const fdx = (shFdx + (hpFdx - shFdx) * t) * st.wf;
    const fdy = (shFdy + (hpFdy - shFdy) * t) * st.wf;
    const bdx = (shBdx + (hpBdx - shBdx) * t) * st.wb;
    const bdy = (shBdy + (hpBdy - shBdy) * t) * st.wb;
    const fl = Math.hypot(fdx, fdy) || 1;
    const bl = Math.hypot(bdx, bdy) || 1;
    frontSide.push({
      x: sx + fdx + (fdx / fl) * ex,
      y: sy + fdy + (fdy / fl) * ex,
    });
    backSide.push({
      x: sx + bdx + (bdx / bl) * ex,
      y: sy + bdy + (bdy / bl) * ex,
    });
  }
  const neckBridge = {
    x: j.shoulder.x - ux * (3.5 + ex * 0.7),
    y: j.shoulder.y - uy * (3.5 + ex * 0.7),
  };
  const pelvisBridge = {
    x: j.hip.x + ux * (0.5 + ex * 0.6),
    y: j.hip.y + uy * (0.5 + ex * 0.6),
  };
  const pts = [neckBridge, ...frontSide, pelvisBridge];
  for (let i = backSide.length - 1; i >= 0; i--) pts.push(backSide[i]);
  return pts;
}

// Menggambar ruas anggota badan berotot organik (bahu-siku, siku-tangan, paha, betis).
export function drawSculptedLimb(c, a, b, wStart, wMid, wEnd, curveBulge, fill, hiCol = null) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const steps = [
    { t: 0.00, w: wStart, off: 0 },
    { t: 0.28, w: wStart * 0.4 + wMid * 0.6, off: curveBulge * 0.85 },
    { t: 0.52, w: wMid, off: curveBulge },
    { t: 0.76, w: wMid * 0.45 + wEnd * 0.55, off: curveBulge * 0.45 },
    { t: 1.00, w: wEnd, off: 0 },
  ];
  const leftPts = [];
  const rightPts = [];
  for (const s of steps) {
    const cx = a.x + dx * s.t + px * s.off;
    const cy = a.y + dy * s.t + py * s.off;
    leftPts.push({ x: cx + px * (s.w / 2), y: cy + py * (s.w / 2) });
    rightPts.push({ x: cx - px * (s.w / 2), y: cy - py * (s.w / 2) });
  }
  const poly = [...leftPts];
  for (let i = rightPts.length - 1; i >= 0; i--) poly.push(rightPts[i]);
  fillPoly(c, poly, fill);
  c.fillStyle = fill;
  c.beginPath(); c.arc(a.x, a.y, wStart / 2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(b.x, b.y, wEnd / 2, 0, Math.PI * 2); c.fill();
  if (hiCol) {
    c.strokeStyle = hiCol;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(leftPts[1].x - px * 1.2, leftPts[1].y - py * 1.2);
    c.lineTo(leftPts[2].x - px * 1.2, leftPts[2].y - py * 1.2);
    c.lineTo(leftPts[3].x - px * 1.2, leftPts[3].y - py * 1.2);
    c.stroke();
  }
}

// Menggambar anatomi torso atletis V-taper + bayangan 3D + definisi dada/otot inti.
export function drawAthleticTorso(c, j, f, col, dark, front) {
  const { ux, uy, px, py, len } = torsoAxis(j);
  const pts = vTaperTorsoPts(j, 0);
  fillPoly(c, pts, col);

  // Bayangan 3D sisi belakang torso (cel-shading).
  const backShadowPts = [
    { x: j.shoulder.x - ux * 2, y: j.shoulder.y - uy * 2 },
    { x: j.shoulder.x + (j.hip.x - j.shoulder.x) * 0.45, y: j.shoulder.y + (j.hip.y - j.shoulder.y) * 0.45 },
    { x: j.hip.x + ux * 5, y: j.hip.y + uy * 5 },
    pts[pts.length - 5],
    pts[pts.length - 4],
    pts[pts.length - 3],
    pts[pts.length - 2],
    pts[pts.length - 1],
  ];
  fillPoly(c, backShadowPts, shade(col, 0.76));

  // Kap bahu deltoid bulat di shB dan shF.
  c.fillStyle = dark;
  c.beginPath(); c.arc(j.shB.x, j.shB.y, 5.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = col;
  c.beginPath(); c.arc(j.shF.x, j.shF.y, 6, 0, Math.PI * 2); c.fill();

  // Garis kontur dada (pectoral) & linea alba (otot perut tengah).
  const chestY = len * 0.30;
  const sternum = { x: j.shoulder.x + ux * chestY, y: j.shoulder.y + uy * chestY };
  const pecOuter = {
    x: j.shF.x * 0.7 + j.shoulder.x * 0.3 + ux * (len * 0.22),
    y: j.shF.y * 0.7 + j.shoulder.y * 0.3 + uy * (len * 0.22),
  };
  c.strokeStyle = shade(col, 0.62);
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(pecOuter.x, pecOuter.y);
  c.lineTo((pecOuter.x + sternum.x) / 2 + ux * 2, (pecOuter.y + sternum.y) / 2 + uy * 2);
  c.lineTo(sternum.x, sternum.y);
  c.stroke();

  c.strokeStyle = shade(col, 0.68);
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(sternum.x, sternum.y + uy * 2);
  c.lineTo(j.shoulder.x + ux * (len * 0.74), j.shoulder.y + uy * (len * 0.74));
  c.stroke();

  // Sorot tepi depan dada & rusuk (rim light).
  c.strokeStyle = 'rgba(255,255,255,0.45)';
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(pts[1].x - px * f.face * 1.2, pts[1].y - py * f.face * 1.2);
  c.lineTo(pts[2].x - px * f.face * 1.2, pts[2].y - py * f.face * 1.2);
  c.lineTo(pts[3].x - px * f.face * 1.2, pts[3].y - py * f.face * 1.2);
  c.stroke();

}

// Digambar dari drawFighter (film.js) — ctx: { c, j, f, gear, s, front, col, dark }.
export function drawBodyGear(ctx) {
  const { c, j, f, gear, col } = ctx;
  if (!gear.body) return;
  const bcol = gear.body.color || col;
  const bdark = shade(bcol, 0.78);
  const bv = gear.body.variant || 'shirt';
  const { ux, uy, px, py, len } = torsoAxis(j);

  if (bv === 'singlet') {
    const singletProfile = [
      { t: 0.00, wf: 0.62, wb: 0.58 },
      { t: 0.24, wf: 0.84, wb: 0.80 },
      { t: 0.46, wf: 0.74, wb: 0.70 },
      { t: 0.68, wf: 0.64, wb: 0.60 },
      { t: 0.88, wf: 0.86, wb: 0.84 },
      { t: 1.02, wf: 1.04, wb: 1.02 },
    ];
    const pts = vTaperTorsoPts(j, 1.0, singletProfile);
    fillPoly(c, pts, bcol);
    c.strokeStyle = PALETTE.paper;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(pts[2].x - px * f.face * 1.8, pts[2].y);
    c.lineTo(pts[4].x - px * f.face * 1.8, pts[4].y);
    c.stroke();
    c.strokeStyle = PALETTE.paper;
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(j.shoulder.x - px * 5.5, j.shoulder.y - py * 5.5);
    c.lineTo(j.shoulder.x + ux * 11, j.shoulder.y + uy * 11);
    c.lineTo(j.shoulder.x + px * 5.5, j.shoulder.y + py * 5.5);
    c.stroke();
    strokePoly(c, pts, PALETTE.ink, 2, true);
    return;
  }

  const clothProfile = [
    { t: 0.00, wf: 1.05, wb: 1.02 },
    { t: 0.22, wf: 0.98, wb: 0.94 },
    { t: 0.45, wf: 0.82, wb: 0.78 },
    { t: 0.68, wf: 0.68, wb: 0.64 },
    { t: 0.88, wf: 0.88, wb: 0.86 },
    { t: 1.02, wf: 1.06, wb: 1.04 },
  ];
  const pts = vTaperTorsoPts(j, 1.5, clothProfile);

  // Lengan baju di bahu.
  for (const [sh, el, isF] of [[j.shB, j.elbowB, false], [j.shF, j.elbowF, true]]) {
    const slRatio = bv === 'gi' ? 0.55 : bv === 'jacket' ? 0.50 : 0.45;
    const end = { x: sh.x + (el.x - sh.x) * slRatio, y: sh.y + (el.y - sh.y) * slRatio };
    const sCol = isF ? bcol : bdark;
    drawSculptedLimb(c, sh, end, 12.5, 11.5, bv === 'gi' ? 12.5 : 10.5, 0, PALETTE.ink);
    drawSculptedLimb(c, sh, end, 10, 9, bv === 'gi' ? 10 : 8, 0, sCol);
    const sdx = end.x - sh.x, sdy = end.y - sh.y;
    const sl = Math.hypot(sdx, sdy) || 1;
    const spx = -sdy / sl, spy = sdx / sl;
    c.strokeStyle = bv === 'gi' ? PALETTE.ink : PALETTE.paper;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(end.x - spx * 4.2, end.y - spy * 4.2);
    c.lineTo(end.x + spx * 4.2, end.y + spy * 4.2);
    c.stroke();
  }

  fillPoly(c, pts, bcol);
  c.strokeStyle = bdark;
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
  c.lineTo(pts[pts.length - 4].x, pts[pts.length - 4].y);
  c.stroke();

  if (bv === 'shirt') {
    c.strokeStyle = PALETTE.paper;
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(j.shoulder.x - px * 6 + ux * (len * 0.22), j.shoulder.y - py * 6 + uy * (len * 0.22));
    c.lineTo(j.shoulder.x + px * 7 + ux * (len * 0.18), j.shoulder.y + py * 7 + uy * (len * 0.18));
    c.stroke();
    c.strokeStyle = bdark;
    c.lineWidth = 2.4;
    c.beginPath();
    c.arc(j.shoulder.x + ux * 2, j.shoulder.y + uy * 2, 5.5, 0, Math.PI);
    c.stroke();
  } else if (bv === 'jacket') {
    const ax = j.shoulder.x + ux * 15, ay = j.shoulder.y + uy * 15;
    c.fillStyle = PALETTE.ink;
    c.beginPath();
    c.moveTo(j.shoulder.x - px * 7.5, j.shoulder.y - py * 7.5);
    c.lineTo(ax, ay);
    c.lineTo(j.shoulder.x + px * 7.5, j.shoulder.y + py * 7.5);
    c.closePath();
    c.fill();
    c.strokeStyle = PALETTE.paper;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(j.shoulder.x - px * 7, j.shoulder.y - py * 7);
    c.lineTo(ax, ay);
    c.lineTo(j.shoulder.x + px * 7, j.shoulder.y + py * 7);
    c.stroke();
    c.strokeStyle = PALETTE.ink;
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(j.hip.x, j.hip.y); c.stroke();
    c.strokeStyle = GEAR_SILVER;
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(j.hip.x, j.hip.y); c.stroke();
  } else if (bv === 'gi') {
    // Baju bela diri (Dogi): kerah silang Y tegas + rok bawah kimono (uwagi) rapi.
    const skirtPts = [
      pts[4],
      { x: j.hipF.x + px * f.face * 4 + ux * 9, y: j.hipF.y + py * f.face * 4 + uy * 9 },
      { x: j.hip.x + ux * 7, y: j.hip.y + uy * 7 },
      { x: j.hipB.x - px * f.face * 4 + ux * 9, y: j.hipB.y - py * f.face * 4 + uy * 9 },
      pts[pts.length - 4],
    ];
    fillPoly(c, skirtPts, bcol);
    strokePoly(c, skirtPts, PALETTE.ink, 2, true);
    const midChest = { x: j.shoulder.x + ux * (len * 0.44), y: j.shoulder.y + uy * (len * 0.44) };
    const waistCross = { x: j.shoulder.x - px * 4 + ux * (len * 0.72), y: j.shoulder.y - py * 4 + uy * (len * 0.72) };
    c.strokeStyle = PALETTE.ink;
    c.lineWidth = 4.2;
    c.beginPath();
    c.moveTo(j.shoulder.x - px * 6.5, j.shoulder.y - py * 6.5);
    c.lineTo(midChest.x, midChest.y);
    c.moveTo(j.shoulder.x + px * 6.5, j.shoulder.y + py * 6.5);
    c.lineTo(waistCross.x, waistCross.y);
    c.stroke();
    c.strokeStyle = isNearBlack(bcol) ? PALETTE.paper : bdark;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(j.shoulder.x - px * 6.5, j.shoulder.y - py * 6.5);
    c.lineTo(midChest.x, midChest.y);
    c.moveTo(j.shoulder.x + px * 6.5, j.shoulder.y + py * 6.5);
    c.lineTo(waistCross.x, waistCross.y);
    c.stroke();
  }

  strokePoly(c, pts, PALETTE.ink, 2.2, true);
}

// Digambar dari drawFighter (film.js) — sabuk di pinggang V-taper.
export function drawBeltGear(ctx) {
  const { c, j, f, gear } = ctx;
  if (!gear.belt) return;
  const bcol = gear.belt.color || PALETTE.red;
  const { ux, uy, px, py } = torsoAxis(j);
  const bF = { x: j.hipF.x + px * f.face * 2 - ux * 4, y: j.hipF.y + py * f.face * 2 - uy * 4 };
  const bB = { x: j.hipB.x - px * f.face * 2 - ux * 4, y: j.hipB.y - py * f.face * 2 - uy * 4 };
  const midX = (bF.x + bB.x) / 2 + f.face * 2;
  const midY = (bF.y + bB.y) / 2;

  if (gear.belt.variant === 'champion') {
    c.strokeStyle = PALETTE.ink; c.lineWidth = 13;
    c.beginPath(); c.moveTo(bB.x, bB.y); c.lineTo(bF.x, bF.y); c.stroke();
    c.strokeStyle = bcol; c.lineWidth = 9;
    c.beginPath(); c.moveTo(bB.x, bB.y); c.lineTo(bF.x, bF.y); c.stroke();
    const medPts = [
      { x: midX - 5.5, y: midY - 8 }, { x: midX + 5.5, y: midY - 8 },
      { x: midX + 9, y: midY - 4 }, { x: midX + 9, y: midY + 4 },
      { x: midX + 5.5, y: midY + 8 }, { x: midX - 5.5, y: midY + 8 },
      { x: midX - 9, y: midY + 4 }, { x: midX - 9, y: midY - 4 },
    ];
    fillPoly(c, medPts, GEAR_GOLD);
    strokePoly(c, medPts, PALETTE.ink, 2, true);
    c.strokeStyle = GEAR_GOLD_LIGHT; c.lineWidth = 1.3;
    c.strokeRect(midX - 4.5, midY - 4.5, 9, 9);
    c.fillStyle = PALETTE.red;
    c.beginPath(); c.arc(midX, midY, 2.8, 0, Math.PI * 2); c.fill();
  } else if (gear.belt.variant === 'rope') {
    c.strokeStyle = PALETTE.ink; c.lineWidth = 7.5;
    c.beginPath(); c.moveTo(bB.x, bB.y); c.lineTo(bF.x, bF.y); c.stroke();
    c.strokeStyle = bcol; c.lineWidth = 4.5;
    c.beginPath(); c.moveTo(bB.x, bB.y); c.lineTo(bF.x, bF.y); c.stroke();
    c.strokeStyle = GEAR_GOLD_LIGHT; c.lineWidth = 1.4;
    for (const k of [0.25, 0.5, 0.75]) {
      const rx = bB.x + (bF.x - bB.x) * k, ry = bB.y + (bF.y - bB.y) * k;
      c.beginPath(); c.moveTo(rx - 2, ry - 2); c.lineTo(rx + 2, ry + 2); c.stroke();
    }
    c.fillStyle = bcol; c.strokeStyle = PALETTE.ink; c.lineWidth = 1.8;
    c.beginPath(); c.arc(midX, midY, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = PALETTE.ink; c.lineWidth = 4.5;
    c.beginPath();
    c.moveTo(midX, midY + 2); c.lineTo(midX + f.face * 5, midY + 13);
    c.moveTo(midX, midY + 2); c.lineTo(midX - f.face * 3, midY + 14);
    c.stroke();
    c.strokeStyle = bcol; c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(midX, midY + 2); c.lineTo(midX + f.face * 5, midY + 13);
    c.moveTo(midX, midY + 2); c.lineTo(midX - f.face * 3, midY + 14);
    c.stroke();
  } else {
    c.strokeStyle = PALETTE.ink; c.lineWidth = 9.5;
    c.beginPath(); c.moveTo(bB.x, bB.y); c.lineTo(bF.x, bF.y); c.stroke();
    c.strokeStyle = bcol; c.lineWidth = 6;
    c.beginPath(); c.moveTo(bB.x, bB.y); c.lineTo(bF.x, bF.y); c.stroke();
    c.strokeStyle = PALETTE.ink; c.lineWidth = 5.5;
    c.beginPath();
    c.moveTo(midX, midY + 1); c.lineTo(midX + f.face * 6, midY + 14);
    c.moveTo(midX, midY + 1); c.lineTo(midX - f.face * 4, midY + 15);
    c.stroke();
    c.strokeStyle = bcol; c.lineWidth = 3.2;
    c.beginPath();
    c.moveTo(midX, midY + 1); c.lineTo(midX + f.face * 6, midY + 14);
    c.moveTo(midX, midY + 1); c.lineTo(midX - f.face * 4, midY + 15);
    c.stroke();
    c.fillStyle = bcol; c.strokeStyle = PALETTE.ink; c.lineWidth = 1.8;
    c.beginPath(); c.arc(midX, midY, 4.2, 0, Math.PI * 2); c.fill(); c.stroke();
  }
}

// Digambar dari drawFighter (film.js) — sepatu atau detail kaki.
// ATURAN (user 2026-11-10): sepatu HARUS mengikuti sudut kaki — berputar
// mengikuti kaki saat kaki menekuk/menendang, bukan digambar horizontal
// tetap. Sudut sepatu dihitung dari arah tungkai + sudut pose kaki
// (f.pose.footF/footB.ang; -0,55 saat menendang = ujung kaki menunjuk).
// Kaki yang masih menapak di tanah tetap datar (horizontal) supaya tidak
// jinjit; transisi mulus saat kaki terangkat 6-26 px dari tanah.
// Badan sepatu + sol digambar dalam frame yang dirotasi mengelilingi
// pergelangan kaki; manset/tali pergelangan tetap mengikuti tungkai.
export function drawShoesGear(ctx) {
  const { c, j, f, gear, col, dark } = ctx;
  const ff = f.face;
  const normAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // Kemiringan sepatu (rad, rotasi canvas) + arah tungkai (ux, uy).
  // 0 = datar (menapak); saat terangkat, mengikuti sudut kaki.
  const shoeTilt = (foot, knee, isF) => {
    const dx = knee.x - foot.x, dy = knee.y - foot.y;
    const dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl, uy = dy / dl;
    // Arah telapak datar: tegak lurus tungkai, ujung ke arah hadap.
    // (ux, uy) = arah kaki->lutut; tegak lurus yang menunjuk ke depan
    // adalah (-uy, ux) dikali arah hadap. Tanda dibalik dari draf awal:
    // (uy, -ux) justru menunjuk ke belakang/bawah (sol menghadap target).
    const fx = -ff * uy, fy = ff * ux;
    // Sudut pose kaki (menunjuk saat menendang): putar ke arah tungkai.
    const poseFoot = f.pose && f.pose[isF ? 'footF' : 'footB'];
    const ang = poseFoot && typeof poseFoot.ang === 'number' ? poseFoot.ang : 0;
    const rho = -ang * ff;
    const cs = Math.cos(rho), sn = Math.sin(rho);
    const ax = fx * cs - fy * sn, ay = fx * sn + fy * cs;
    // Blend vektor: menapak (horizontal, ujung ke arah hadap) -> terangkat
    // (ikut sudut kaki). Vektor, bukan sudut, supaya tidak berputar jauh
    // saat hadap kiri (sudut datar = PI, bukan 0).
    const groundY = (typeof f.y === 'number') ? f.y : foot.y;
    const lift = groundY - foot.y;
    const w = Math.max(0, Math.min(1, (lift - 6) / 20));
    const bx = ff * (1 - w) + ax * w, by = ay * w;
    const bl = Math.hypot(bx, by);
    if (bl < 0.2) return { tilt: 0, ux, uy };
    const phi = Math.atan2(by / bl, bx / bl);
    const phiGround = ff === 1 ? 0 : Math.PI;
    return { tilt: normAng(phi - phiGround), ux, uy };
  };

  if (!gear.shoes || gear.shoes.model === 'barefoot') {
    for (const [foot, knee, isF] of [[j.footB, j.kneeB, false], [j.footF, j.kneeF, true]]) {
      const fCol = isF ? col : dark;
      const dx = knee.x - foot.x, dy = knee.y - foot.y;
      const dl = Math.hypot(dx, dy) || 1;
      c.strokeStyle = PALETTE.paper; c.lineWidth = 5.5;
      c.beginPath();
      c.moveTo(foot.x + (dx / dl) * 4, foot.y + (dy / dl) * 4);
      c.lineTo(foot.x + (dx / dl) * 11, foot.y + (dy / dl) * 11);
      c.stroke();
      const { tilt } = shoeTilt(foot, knee, isF);
      c.save();
      c.translate(foot.x, foot.y);
      c.rotate(tilt);
      const footPts = [
        { x: -ff * 4, y: -4 },
        { x: ff * 13, y: -2 },
        { x: ff * 15, y: 2 },
        { x: -ff * 5, y: 2 },
      ];
      fillPoly(c, footPts, fCol);
      strokePoly(c, footPts, PALETTE.ink, 1.6, true);
      c.restore();
    }
    return;
  }

  const smodel = gear.shoes.model || 'sneakers';
  const scol = gear.shoes.color || PALETTE.sneaker;
  const sdark = shade(scol, 0.72);

  for (const [foot, leg] of [[j.footB, 'B'], [j.footF, 'F']]) {
    const isF = leg === 'F';
    const mainCol = isF ? scol : sdark;
    const knee = isF ? j.kneeF : j.kneeB;
    const dx = knee.x - foot.x, dy = knee.y - foot.y;
    const dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl, uy = dy / dl;
    const { tilt } = shoeTilt(foot, knee, isF);

    if (smodel === 'boots') {
      // Manset bot mengikuti tungkai (tetap di ruang layar).
      c.strokeStyle = PALETTE.ink; c.lineWidth = 13.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(foot.x, foot.y); c.lineTo(foot.x + ux * 22, foot.y + uy * 22); c.stroke();
      c.strokeStyle = mainCol; c.lineWidth = 10;
      c.beginPath(); c.moveTo(foot.x, foot.y); c.lineTo(foot.x + ux * 22, foot.y + uy * 22); c.stroke();
      c.strokeStyle = PALETTE.paper; c.lineWidth = 1.8;
      for (const h of [8, 14, 20]) {
        const bx = foot.x + ux * h, by = foot.y + uy * h;
        c.beginPath(); c.moveTo(bx - ff * 4, by); c.lineTo(bx + ff * 5, by); c.stroke();
      }
      // Badan + sol bot mengikuti sudut kaki (frame terotasi di pergelangan).
      c.save();
      c.translate(foot.x, foot.y);
      c.rotate(tilt);
      c.fillStyle = mainCol;
      c.beginPath(); c.ellipse(ff * 5.5, -3, 14.5, 7, 0, 0, Math.PI * 2); c.fill();
      c.lineWidth = 2; c.strokeStyle = PALETTE.ink; c.stroke();
      c.fillStyle = PALETTE.ink;
      c.fillRect(-10, -1, 24, 4.5);
      c.fillStyle = PALETTE.sneakerSole;
      c.fillRect(-9, -1.5, 22, 2.5);
      c.restore();
    } else if (smodel === 'sandals') {
      c.save();
      c.translate(foot.x, foot.y);
      c.rotate(tilt);
      c.fillStyle = isF ? col : dark;
      c.beginPath(); c.ellipse(ff * 5, -3.5, 13, 4.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = PALETTE.ink;
      c.fillRect(-10, -2, 24, 4.5);
      c.fillStyle = PALETTE.sneakerSole;
      c.fillRect(-9, -1.5, 22, 3);
      c.fillStyle = PALETTE.ink;
      c.fillRect(-5, 2, 4, 2.5);
      c.fillRect(6, 2, 4, 2.5);
      c.strokeStyle = PALETTE.ink; c.lineWidth = 5;
      c.beginPath();
      c.moveTo(-5, -2); c.lineTo(7, -8);
      c.moveTo(7, -2); c.lineTo(-4, -8);
      c.stroke();
      c.strokeStyle = mainCol; c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-5, -2); c.lineTo(7, -8);
      c.moveTo(7, -2); c.lineTo(-4, -8);
      c.stroke();
      c.restore();
    } else if (smodel === 'martial') {
      c.save();
      c.translate(foot.x, foot.y);
      c.rotate(tilt);
      c.fillStyle = mainCol;
      c.beginPath(); c.ellipse(ff * 5.5, -2.5, 14, 5.2, 0, 0, Math.PI * 2); c.fill();
      c.lineWidth = 2; c.strokeStyle = PALETTE.ink; c.stroke();
      c.strokeStyle = isNearBlack(scol) ? PALETTE.paper : PALETTE.red;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-ff * 2, -5);
      c.lineTo(ff * 4, -2);
      c.lineTo(-ff * 2, 0);
      c.stroke();
      c.fillStyle = PALETTE.sneakerSole;
      c.fillRect(-9, -0.5, 22, 2.5);
      c.restore();
    } else {
      // Sneakers: tali pergelangan mengikuti tungkai (ruang layar).
      c.strokeStyle = PALETTE.ink; c.lineWidth = 11.5;
      c.beginPath(); c.moveTo(foot.x, foot.y - 2); c.lineTo(foot.x + ux * 9, foot.y + uy * 9); c.stroke();
      c.strokeStyle = mainCol; c.lineWidth = 8;
      c.beginPath(); c.moveTo(foot.x, foot.y - 2); c.lineTo(foot.x + ux * 9, foot.y + uy * 9); c.stroke();

      // Badan + tali + sol mengikuti sudut kaki (frame terotasi di pergelangan).
      c.save();
      c.translate(foot.x, foot.y);
      c.rotate(tilt);
      c.fillStyle = mainCol;
      c.beginPath(); c.ellipse(ff * 5.5, -3.5, 14.5, 6.8, 0, 0, Math.PI * 2); c.fill();
      c.lineWidth = 2; c.strokeStyle = PALETTE.ink; c.stroke();

      c.strokeStyle = isNearBlack(scol) ? PALETTE.paper : PALETTE.ink;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-ff * 4, -2);
      c.lineTo(ff * 6, -5.5);
      c.stroke();

      c.strokeStyle = PALETTE.paper; c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(ff * 2, -8); c.lineTo(ff * 6, -5.5);
      c.moveTo(ff * 5, -7); c.lineTo(ff * 9, -4.5);
      c.stroke();

      c.fillStyle = PALETTE.ink;
      c.fillRect(-10, -2, 24, 5);
      c.fillStyle = PALETTE.sneakerSole;
      c.fillRect(-9, -1.5, 22, 3);
      c.restore();
    }
  }
}

// Digambar dari drawFighter (film.js) — sarung tangan & kepalan proporsional.
export function drawGlovesGear(ctx) {
  const { c, j, f, gear, col, dark } = ctx;
  const ff = f.face;
  if (gear.gloves) {
    for (const [hand, side] of [[j.handB, 'B'], [j.handF, 'F']]) {
      const g = gear.gloves[side] || gear.gloves.F;
      if (!g) continue;
      const gtype = g.type || 'boxing';
      let gcol = g.color || col;
      if (isNearBlack(gcol)) gcol = col;
      if (side === 'B') gcol = shade(gcol, 0.82);

      const el = side === 'F' ? j.elbowF : j.elbowB;
      const dx = hand.x - el.x, dy = hand.y - el.y;
      const dl = Math.hypot(dx, dy) || 1;
      const wa = Math.atan2(dy / dl, dx / dl);

      if (gtype === 'wraps') {
        c.fillStyle = gcol;
        c.beginPath(); c.arc(hand.x, hand.y, 10.5, 0, Math.PI * 2); c.fill();
        c.lineWidth = 2.2; c.strokeStyle = PALETTE.ink; c.stroke();
        c.strokeStyle = PALETTE.paper; c.lineWidth = 2.4;
        c.beginPath();
        c.moveTo(hand.x - 6, hand.y - 4.5); c.lineTo(hand.x + 6, hand.y + 4.5);
        c.moveTo(hand.x - 6, hand.y + 4.5); c.lineTo(hand.x + 6, hand.y - 4.5);
        c.moveTo(hand.x - 7, hand.y); c.lineTo(hand.x + 7, hand.y);
        c.stroke();
        c.fillStyle = side === 'F' ? col : dark;
        for (const ky of [-3.5, 0, 3.5]) {
          c.beginPath(); c.arc(hand.x + ff * 8.5, hand.y + ky, 2.2, 0, Math.PI * 2); c.fill();
        }
      } else if (gtype === 'fingerless') {
        c.fillStyle = gcol;
        c.beginPath(); c.arc(hand.x, hand.y, 12, 0, Math.PI * 2); c.fill();
        c.lineWidth = 2.2; c.strokeStyle = PALETTE.ink; c.stroke();
        c.strokeStyle = PALETTE.paper; c.lineWidth = 3;
        c.beginPath(); c.arc(hand.x, hand.y, 10, wa + Math.PI - 0.65, wa + Math.PI + 0.65); c.stroke();
        c.strokeStyle = PALETTE.ink; c.lineWidth = 2.2;
        for (const dyF of [-4.5, 0, 4.5]) {
          c.beginPath();
          c.moveTo(hand.x + ff * 10, hand.y + dyF);
          c.lineTo(hand.x + ff * 15, hand.y + dyF);
          c.stroke();
        }
        c.fillStyle = GEAR_GOLD_LIGHT;
        for (const dyS of [-4.5, 0, 4.5]) {
          c.beginPath(); c.arc(hand.x + ff * 6.5, hand.y + dyS, 2, 0, Math.PI * 2); c.fill();
        }
      } else {
        // Boxing / Big / MMA: bentuk sarung tinju anatomis (elips sedikit memanjang searah lengan).
        const rx = gtype === 'big' ? 16.5 : gtype === 'mma' ? 12.5 : 14.5;
        const ry = gtype === 'big' ? 14.5 : gtype === 'mma' ? 11 : 12.5;
        const cuffW = gtype === 'big' ? 6 : 5;
        c.fillStyle = gcol;
        c.beginPath(); c.ellipse(hand.x, hand.y, rx, ry, wa, 0, Math.PI * 2); c.fill();
        c.lineWidth = 2.5; c.strokeStyle = PALETTE.ink; c.stroke();

        // Highlight 3D di kubah buku jari.
        c.strokeStyle = 'rgba(255,255,255,0.55)';
        c.lineWidth = 2.4;
        c.beginPath();
        c.arc(hand.x, hand.y, ry - 3.5, wa - 0.85, wa + 0.35);
        c.stroke();

        // Ibu jari terkunci (thumb lock).
        const tx = hand.x + ff * (ry * 0.45), ty = hand.y + ry * 0.38;
        c.fillStyle = shade(gcol, 0.86);
        c.beginPath(); c.arc(tx, ty, 5.2, 0, Math.PI * 2); c.fill();
        c.lineWidth = 2; c.strokeStyle = PALETTE.ink; c.stroke();

        // Manset pergelangan tangan tegas.
        c.strokeStyle = PALETTE.ink; c.lineWidth = cuffW + 2.6;
        c.beginPath(); c.arc(hand.x, hand.y, ry - 1.5, wa + Math.PI - 0.68, wa + Math.PI + 0.68); c.stroke();
        c.strokeStyle = PALETTE.paper; c.lineWidth = cuffW;
        c.beginPath(); c.arc(hand.x, hand.y, ry - 1.5, wa + Math.PI - 0.64, wa + Math.PI + 0.64); c.stroke();

        if (gtype === 'mma') {
          c.strokeStyle = PALETTE.ink; c.lineWidth = 2.4;
          for (const dyM of [-4.5, 0, 4.5]) {
            c.beginPath();
            c.moveTo(hand.x + ff * 10, hand.y + dyM);
            c.lineTo(hand.x + ff * 16.5, hand.y + dyM);
            c.stroke();
          }
        }
      }
    }
  } else {
    for (const [hand, isF] of [[j.handB, false], [j.handF, true]]) {
      const hCol = isF ? col : dark;
      c.fillStyle = hCol;
      c.beginPath(); c.arc(hand.x, hand.y, 7.5, 0, Math.PI * 2); c.fill();
      c.lineWidth = 2.2; c.strokeStyle = PALETTE.ink; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(hand.x, hand.y, 4.8, -0.8, 0.8); c.stroke();
      c.strokeStyle = PALETTE.ink; c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(hand.x + ff * 3.5, hand.y - 2.8); c.lineTo(hand.x + ff * 7, hand.y - 2.8);
      c.moveTo(hand.x + ff * 3.5, hand.y + 2.5); c.lineTo(hand.x + ff * 7, hand.y + 2.5);
      c.stroke();
    }
  }
}

// Digambar dari drawFighter (film.js) — senjata di tangan belakang.
export function drawWeaponGear(ctx) {
  const { c, j, f, gear } = ctx;
  const wpen = gear.weapon;
  if (!wpen || (!wpen.fromAccessories && !f.hasWeapon)) return;

  const dirX = j.handB.x - j.elbowB.x, dirY = j.handB.y - j.elbowB.y;
  const len = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / len, uy = dirY / len;
  const px = -uy, py = ux;
  const wcol = wpen.color || PALETTE.wood;
  const wdark = shade(wcol, 0.6);
  const wv = wpen.variant || 'stick';

  if (wv === 'short-stick') {
    const p0 = { x: j.handB.x - ux * 14, y: j.handB.y - uy * 14 };
    const p1 = { x: j.handB.x + ux * 42, y: j.handB.y + uy * 42 };
    c.strokeStyle = PALETTE.ink; c.lineWidth = 11; c.lineCap = 'round';
    c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
    c.strokeStyle = wcol; c.lineWidth = 7.5;
    c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
    c.strokeStyle = PALETTE.ink; c.lineWidth = 8;
    c.beginPath();
    c.moveTo(j.handB.x - ux * 10, j.handB.y - uy * 10);
    c.lineTo(j.handB.x + ux * 8, j.handB.y + uy * 8);
    c.stroke();
    c.strokeStyle = wdark; c.lineWidth = 2;
    for (const off of [18, 30]) {
      const rx = j.handB.x + ux * off, ry = j.handB.y + uy * off;
      c.beginPath(); c.moveTo(rx - px * 3.8, ry - py * 3.8); c.lineTo(rx + px * 3.8, ry + py * 3.8); c.stroke();
    }
  } else if (wv === 'wooden-sword') {
    const hilt0 = { x: j.handB.x - ux * 20, y: j.handB.y - uy * 20 };
    const guard = { x: j.handB.x + ux * 8, y: j.handB.y + uy * 8 };
    const tip = { x: j.handB.x + ux * 74 + px * 3, y: j.handB.y + uy * 74 + py * 3 };

    const bladePts = [
      { x: guard.x + px * 4.5, y: guard.y + py * 4.5 },
      { x: j.handB.x + ux * 62 + px * 5, y: j.handB.y + uy * 62 + py * 5 },
      tip,
      { x: j.handB.x + ux * 66 - px * 3.5, y: j.handB.y + uy * 66 - py * 3.5 },
      { x: guard.x - px * 4, y: guard.y - py * 4 },
    ];
    fillPoly(c, bladePts, wcol);
    strokePoly(c, bladePts, PALETTE.ink, 2.2, true);
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(guard.x + px * 1.2, guard.y + py * 1.2);
    c.lineTo(tip.x, tip.y);
    c.stroke();

    c.strokeStyle = PALETTE.ink; c.lineWidth = 9.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hilt0.x, hilt0.y); c.lineTo(guard.x, guard.y); c.stroke();
    c.strokeStyle = wdark; c.lineWidth = 6;
    c.beginPath(); c.moveTo(hilt0.x, hilt0.y); c.lineTo(guard.x, guard.y); c.stroke();
    c.strokeStyle = PALETTE.paper; c.lineWidth = 1.5;
    for (const off of [-14, -7, 0]) {
      const gx = j.handB.x + ux * off, gy = j.handB.y + uy * off;
      c.beginPath(); c.moveTo(gx - px * 2.8, gy - py * 2.8); c.lineTo(gx + px * 2.8, gy + py * 2.8); c.stroke();
    }

    c.strokeStyle = PALETTE.ink; c.lineWidth = 5.5;
    c.beginPath();
    c.moveTo(guard.x - px * 9.5, guard.y - py * 9.5);
    c.lineTo(guard.x + px * 9.5, guard.y + py * 9.5);
    c.stroke();
    c.strokeStyle = GEAR_GOLD; c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(guard.x - px * 8, guard.y - py * 8);
    c.lineTo(guard.x + px * 8, guard.y + py * 8);
    c.stroke();
  } else if (wv === 'nunchaku') {
    const jx = j.handB.x + ux * 34, jy = j.handB.y + uy * 34;
    const th = 0.92;
    const vx = ux * Math.cos(th) - uy * Math.sin(th);
    const vy = ux * Math.sin(th) + uy * Math.cos(th);
    const cEndX = jx + vx * 12, cEndY = jy + vy * 12;
    const b2EndX = jx + vx * 42, b2EndY = jy + vy * 42;

    for (const [a, b] of [[[j.handB.x, j.handB.y], [jx, jy]], [[cEndX, cEndY], [b2EndX, b2EndY]]]) {
      c.strokeStyle = PALETTE.ink; c.lineWidth = 10; c.lineCap = 'round';
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      c.strokeStyle = wcol; c.lineWidth = 6.5;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
    c.fillStyle = GEAR_GOLD;
    c.beginPath(); c.arc(jx, jy, 3.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cEndX, cEndY, 3.8, 0, Math.PI * 2); c.fill();
    c.strokeStyle = PALETTE.ink; c.lineWidth = 4;
    c.beginPath(); c.moveTo(jx, jy); c.lineTo(cEndX, cEndY); c.stroke();
    c.strokeStyle = GEAR_SILVER; c.lineWidth = 2;
    c.beginPath(); c.moveTo(jx, jy); c.lineTo(cEndX, cEndY); c.stroke();
  } else {
    const p0 = { x: j.handB.x - ux * 26, y: j.handB.y - uy * 26 };
    const p1 = { x: j.handB.x + ux * 78, y: j.handB.y + uy * 78 };
    c.strokeStyle = PALETTE.ink; c.lineWidth = 11.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
    c.strokeStyle = wcol; c.lineWidth = 8;
    c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(p0.x + px * 1.4, p0.y + py * 1.4);
    c.lineTo(p1.x + px * 1.4, p1.y + py * 1.4);
    c.stroke();
    c.strokeStyle = GEAR_GOLD; c.lineWidth = 7.5;
    c.beginPath();
    c.moveTo(p0.x, p0.y); c.lineTo(p0.x + ux * 5, p0.y + uy * 5);
    c.moveTo(p1.x, p1.y); c.lineTo(p1.x - ux * 5, p1.y - uy * 5);
    c.stroke();
    c.strokeStyle = PALETTE.paper; c.lineWidth = 2;
    for (const off of [4, 12, 20, 28]) {
      const gx = j.handB.x + ux * off, gy = j.handB.y + uy * off;
      c.beginPath();
      c.moveTo(gx - px * 4, gy - py * 4);
      c.lineTo(gx + px * 4, gy + py * 4);
      c.stroke();
    }
  }
}

// Digambar dari drawFighter (film.js) — aksesoris kepala.
export function drawHeadGear(ctx) {
  const { c, j, f, gear, s } = ctx;
  if (!gear.head) return;
  const hcol = gear.head.color || PALETTE.red;
  const hdark = shade(hcol, 0.72);
  const hv = gear.head.variant || 'headband';
  const ff = f.face;
  const hx = j.head.x, hy = j.head.y;

  if (hv === 'headband') {
    const wave = Math.sin(s * 6.5) * 4.5;
    // Ekor ikat kepala — LAG/DRAG (§34): arah ekor dari state f.tailAng /
    // f.tailAngS (dihitung stepFighter, tertinggal 1-2 frame dari gerak
    // kepala); tanpa state (preview builder) = sudut istirahat -> gambar
    // lama persis. Bentuk Gemini dipertahankan: tiap ruas ekor diputar
    // sebesar selisih sudut state vs sudut istirahat di sekitar simpul.
    const restA = Math.atan2(6, -14 * ff);
    const restAS = Math.atan2(6, -9 * ff);
    const dL = (typeof f.tailAng === 'number' ? f.tailAng : restA) - restA;
    const dS = (typeof f.tailAngS === 'number' ? f.tailAngS : restAS) - restAS;
    const rot = (dx, dy, d) => {
      const co = Math.cos(d), si = Math.sin(d);
      return { x: dx * co - dy * si, y: dx * si + dy * co };
    };
    const kLx = hx - ff * 14, kLy = hy - 5; // simpul ekor panjang
    const kSx = hx - ff * 14, kSy = hy - 2; // simpul ekor pendek
    const mL = rot(-ff * 10, 3 + wave * 0.5, dL); // tengah ekor panjang
    const tL = rot(-ff * 20, 8 + wave, dL); // ujung ekor panjang
    const tS = rot(-ff * 14, 12 + wave * 0.8, dS); // ujung ekor pendek
    c.lineCap = 'round';
    c.strokeStyle = PALETTE.ink; c.lineWidth = 7.5;
    c.beginPath();
    c.moveTo(kLx, kLy);
    c.lineTo(kLx + mL.x, kLy + mL.y);
    c.lineTo(kLx + tL.x, kLy + tL.y);
    c.moveTo(kSx, kSy);
    c.lineTo(kSx + tS.x, kSy + tS.y);
    c.stroke();
    c.strokeStyle = hcol; c.lineWidth = 4.5;
    c.beginPath();
    c.moveTo(kLx, kLy);
    c.lineTo(kLx + mL.x, kLy + mL.y);
    c.lineTo(kLx + tL.x, kLy + tL.y);
    c.stroke();
    c.strokeStyle = hdark; c.lineWidth = 4;
    c.beginPath();
    c.moveTo(kSx, kSy);
    c.lineTo(kSx + tS.x, kSy + tS.y);
    c.stroke();
    c.strokeStyle = PALETTE.ink; c.lineWidth = 9.5;
    c.beginPath(); c.arc(hx, hy, 16, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
    c.strokeStyle = hcol; c.lineWidth = 6.2;
    c.beginPath(); c.arc(hx, hy, 16, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.8;
    c.beginPath(); c.arc(hx, hy, 17, Math.PI * 1.25, Math.PI * 1.75); c.stroke();
    c.fillStyle = hcol; c.strokeStyle = PALETTE.ink; c.lineWidth = 2;
    c.beginPath(); c.arc(hx - ff * 15, hy - 4, 4.2, 0, Math.PI * 2); c.fill(); c.stroke();
  } else if (hv === 'bandana') {
    const tail = Math.sin(s * 6) * 3.5;
    // Ekor bandana — LAG/DRAG (§36, mekanisme §34): seperti ikat kepala,
    // tiap ekor diputar sebesar simpangan sudut state dari sudut
    // istirahatnya (tailAng - atan2(6,-14*face) untuk ekor 1, tailAngS -
    // atan2(6,-9*face) untuk ekor 2); tanpa state (preview builder) =
    // sudut istirahat -> gambar Gemini lama persis. Bentuk Gemini
    // dipertahankan (2 ruas lurus + outline tinta).
    const restHB = Math.atan2(6, -14 * ff), restHBS = Math.atan2(6, -9 * ff);
    const dB1 = (typeof f.tailAng === 'number' ? f.tailAng : restHB) - restHB;
    const dB2 = (typeof f.tailAngS === 'number' ? f.tailAngS : restHBS) - restHBS;
    const rotB = (dx, dy, d) => {
      const co = Math.cos(d), si = Math.sin(d);
      return { x: dx * co - dy * si, y: dx * si + dy * co };
    };
    const tB1 = rotB(-ff * 12, 7 + tail, dB1); // ujung ekor 1 (relatif simpul)
    const tB2 = rotB(-ff * 10, 10 + tail, dB2); // ujung ekor 2 (relatif simpul)
    c.fillStyle = hcol; c.strokeStyle = PALETTE.ink; c.lineWidth = 2.5;
    c.beginPath(); c.arc(hx, hy - 1, 16.5, Math.PI * 0.98, Math.PI * 2.02); c.closePath();
    c.fill(); c.stroke();
    c.strokeStyle = hdark; c.lineWidth = 2;
    c.beginPath(); c.arc(hx, hy - 2, 13, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    c.fillStyle = hcol; c.strokeStyle = PALETTE.ink; c.lineWidth = 2;
    c.beginPath(); c.arc(hx - ff * 15, hy - 2, 5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = PALETTE.ink; c.lineWidth = 6;
    c.beginPath();
    c.moveTo(hx - ff * 16, hy); c.lineTo(hx - ff * 16 + tB1.x, hy + tB1.y);
    c.moveTo(hx - ff * 15, hy + 3); c.lineTo(hx - ff * 15 + tB2.x, hy + 3 + tB2.y);
    c.stroke();
    c.strokeStyle = hcol; c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(hx - ff * 16, hy); c.lineTo(hx - ff * 16 + tB1.x, hy + tB1.y);
    c.moveTo(hx - ff * 15, hy + 3); c.lineTo(hx - ff * 15 + tB2.x, hy + 3 + tB2.y);
    c.stroke();
  } else if (hv === 'cap') {
    c.fillStyle = hcol; c.strokeStyle = PALETTE.ink; c.lineWidth = 2.5;
    c.beginPath(); c.arc(hx, hy - 2, 16.5, Math.PI, 0); c.closePath();
    c.fill(); c.stroke();
    c.strokeStyle = hdark; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(hx, hy - 18.5); c.lineTo(hx - ff * 3, hy - 2); c.stroke();
    c.fillStyle = PALETTE.ink;
    c.beginPath(); c.arc(hx, hy - 18.5, 2.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = PALETTE.paper;
    c.beginPath(); c.arc(hx + ff * 7, hy - 9, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = hdark; c.strokeStyle = PALETTE.ink; c.lineWidth = 2.2;
    c.beginPath();
    c.ellipse(hx + ff * 15, hy - 4.5, 12.5, 4.2, ff * 0.12, 0, Math.PI * 2);
    c.fill(); c.stroke();
  } else if (hv === 'crown') {
    const cPts = [
      { x: hx - 13, y: hy - 11 },
      { x: hx - 14, y: hy - 23 },
      { x: hx - 8,  y: hy - 15 },
      { x: hx - 5,  y: hy - 27 },
      { x: hx,      y: hy - 16 },
      { x: hx + 5,  y: hy - 27 },
      { x: hx + 8,  y: hy - 15 },
      { x: hx + 14, y: hy - 23 },
      { x: hx + 13, y: hy - 11 },
    ];
    fillPoly(c, cPts, hcol);
    strokePoly(c, cPts, PALETTE.ink, 2.2, true);
    c.strokeStyle = GEAR_GOLD_LIGHT; c.lineWidth = 2;
    c.beginPath(); c.moveTo(hx - 12, hy - 13); c.lineTo(hx + 12, hy - 13); c.stroke();
    c.fillStyle = PALETTE.red;
    c.beginPath(); c.arc(hx, hy - 14.5, 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#38BDF8';
    c.beginPath(); c.arc(hx - 7, hy - 14, 1.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(hx + 7, hy - 14, 1.8, 0, Math.PI * 2); c.fill();
  } else if (hv === 'helmet') {
    c.fillStyle = hcol; c.strokeStyle = PALETTE.ink; c.lineWidth = 2.6;
    c.beginPath();
    c.arc(hx, hy, 17.8, Math.PI * 0.82, Math.PI * 2.18);
    c.closePath();
    c.fill(); c.stroke();
    c.fillStyle = hdark;
    c.beginPath(); c.arc(hx - ff * 4, hy + 3, 6.5, 0, Math.PI * 2); c.fill();
    c.lineWidth = 2; c.strokeStyle = PALETTE.ink; c.stroke();
    c.strokeStyle = GEAR_GOLD_LIGHT; c.lineWidth = 3;
    c.beginPath(); c.arc(hx, hy, 18.2, Math.PI * 1.35, Math.PI * 1.65); c.stroke();
    c.strokeStyle = PALETTE.ink; c.lineWidth = 4;
    c.beginPath();
    c.moveTo(hx - ff * 11, hy - 5);
    c.lineTo(hx + ff * 15, hy - 5);
    c.stroke();
    c.strokeStyle = PALETTE.paper; c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(hx - ff * 9, hy - 5);
    c.lineTo(hx + ff * 13, hy - 5);
    c.stroke();
  } else if (hv === 'topknot') {
    c.fillStyle = GEAR_GOLD; c.strokeStyle = PALETTE.ink; c.lineWidth = 1.8;
    c.fillRect(hx - 4.5, hy - 17, 9, 4);
    c.strokeRect(hx - 4.5, hy - 17, 9, 4);
    c.fillStyle = hcol; c.strokeStyle = PALETTE.ink; c.lineWidth = 2.2;
    c.beginPath(); c.arc(hx - ff * 1, hy - 22, 6.8, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = hcol; c.lineWidth = 4.5; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(hx - ff * 2, hy - 24);
    c.lineTo(hx - ff * 11, hy - 19);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.6;
    c.beginPath(); c.arc(hx - ff * 1, hy - 22, 4.2, Math.PI * 1.1, Math.PI * 1.8); c.stroke();
  }
}

