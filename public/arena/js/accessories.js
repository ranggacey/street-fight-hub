// accessories.js — Sistem aksesoris fighter (HANYA visual).
// Dipindah dari js/film.js 2026-11-08 supaya film.js muat di batas
// argumen upload Vercel (125.000 byte, lihat scripts/deploy.mjs).
// Kontrak dengan Hub: EMBED-CONTRACT.md §4 — ID katalog, fallback,
// dan perilaku gambar TIDAK BOLEH berubah (refactor murni).
import { PALETTE, shade } from './palette.js';
import { fighterColors } from './moves.js';

// ---------------- katalog aksesoris (kontrak dengan Hub, EMBED-CONTRACT.md §4) ----------------
// fighter.accessories = { head, hands, feet, body, belt, weapon } (ID string
// per bagian). Warna tiap bagian TETAP dari colors (head<-headband,
// hands<-gloves, feet<-shoes, body<-body, belt<-belt, weapon<-weapon).
// Kalau accessories ADA, ID yang dikenal menang atas field legacy; ID yang
// tidak dikenal -> default bagian itu; kunci yang tidak ada -> fallback
// legacy (lihat normalizeGear). Aksesoris HANYA visual: tidak memengaruhi
// buildFight/verifikasi, dan weapon.kind dari Hub tetap 'none' (tanpa
// gerakan tongkat baru — senjata aksesoris hanya digambar di tangan).
export const ACCESSORY_IDS = {
  head: ['none', 'headband', 'bandana', 'cap', 'crown', 'helmet', 'topknot'],
  hands: ['none', 'boxing', 'big', 'mma', 'wraps', 'fingerless'],
  feet: ['barefoot', 'sneakers', 'boots', 'sandals', 'martial'],
  body: ['none', 'shirt', 'singlet', 'jacket', 'gi'],
  belt: ['none', 'belt', 'champion', 'rope'],
  weapon: ['none', 'stick', 'short-stick', 'wooden-sword', 'nunchaku'],
};
// Default tiap bagian kalau tidak ada info sama sekali (tampilan lama:
// kepalan kecil, sepatu sneakers, tanpa aksesoris lain).
export const ACCESSORY_DEFAULTS = {
  head: 'none', hands: 'none', feet: 'sneakers', body: 'none', belt: 'none', weapon: 'none',
};
// Emas untuk pelat sabuk juara + mahkota (lebih dalam dari kuning arena).
const GEAR_GOLD = '#D4A017';

// Normalisasi gear builder (presets.js) ke bentuk yang digambar drawFighter:
// gloves per tangan {F:{type,color}, B:{...}} (type = varian hands), shoes
// {model,color} (model = varian feet), belt {variant,color}, head
// {variant,color} + headband {color} (alias lama, hanya bila headband),
// body {variant,color}, weapon {kind,variant,color,fromAccessories},
// shorts opsional. Warna dibaca lewat fighterColors() (moves.js) — fighter
// lama tanpa `colors` tetap benar karena fallback ke field legacy-nya.
// kind weapon: 'kayu' untuk varian stick (kompat tes lama), selain itu ID
// varian. fromAccessories: true bila varian berasal dari accessories —
// senjata seperti itu digambar sejak awal fight; senjata legacy (kayu +
// pickupAt) baru digambar setelah event ambil kayu (f.hasWeapon).
export function normalizeGear(f) {
  const col = fighterColors(f);
  const acc = (f.accessories && typeof f.accessories === 'object') ? f.accessories : null;
  const known = (part, id) => ACCESSORY_IDS[part].includes(id) ? id : null;
  // Per bagian: accessories dikenal -> pakai; accessories ada tapi tak
  // dikenal -> default bagian itu; kunci accessories tidak ada -> legacy.
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
  // Warna kepala: dari colors.headband; kalau 'none' tapi varian butuh
  // warna, pakai warna badan — kecuali mahkota yang selalu emas.
  const headColor = col.headband !== 'none'
    ? col.headband : (head.id === 'crown' ? GEAR_GOLD : col.body);
  const headGear = head.id === 'none' ? null : { variant: head.id, color: headColor };
  const headband = head.id === 'headband' ? { color: headColor } : null;
  const bodyGear = body.id === 'none' ? null : { variant: body.id, color: col.body };
  // Warna sabuk: dari colors.belt; kalau 'none' tapi varian butuh warna,
  // pakai warna badan (pelat juara tetap emas).
  const beltGear = belt.id === 'none'
    ? null : { variant: belt.id, color: col.belt !== 'none' ? col.belt : col.body };
  const weaponGear = weapon.id === 'none' ? null : {
    kind: weapon.id === 'stick' ? 'kayu' : weapon.id,
    variant: weapon.id, color: col.weapon, fromAccessories: weapon.fromAccessories,
  };
  const shorts = (f.style === 'muaythai' || f.style === 'brawler') ? { color: shade(f.color, 0.7) } : null;
  return { gloves, shoes, belt: beltGear, headband, head: headGear, body: bodyGear, weapon: weaponGear, shorts };
}

// Hitam pekat (jumlah channel < 120, mis. tinta #141210) — bukan warna glove.
const isNearBlack = (hex) => {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255) < 120;
};

// Poligon torso joint-based (duplikat kecil dari film.js — file ini tidak
// boleh mengimpor film.js karena film.js mengimpor file ini).
// Sudut = titik sendi hipF/hipB/shB/shF; ex = perluasan radial dari centroid.
function torsoPoly(j, ex = 0) {
  const pts = [j.hipF, j.hipB, j.shB, j.shF];
  if (!ex) return pts;
  const cx = (j.hipF.x + j.hipB.x + j.shB.x + j.shF.x) / 4;
  const cy = (j.hipF.y + j.hipB.y + j.shB.y + j.shF.y) / 4;
  return pts.map((p) => {
    const dx = p.x - cx, dy = p.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / d) * ex, y: p.y + (dy / d) * ex };
  });
}
function fillPoly(c, pts, fill) {
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.closePath(); c.fill();
}

// Digambar dari drawFighter (film.js) — ctx: { c, j, f, gear, s, front, col, dark }.
// c = canvas ctx, j = joints (computeJoints), f = fighter, gear = f.gear,
// s = detik, front = petarung depan, col/dark = warna badan/gelap.
export function drawBodyGear(ctx) {
  const { c, j, f, gear, s, front, col, dark } = ctx;
  // --- baju (varian body; 'none' = garis torso saja, tampilan lama) ---
  // Torso tebal menutup garis torso; warna = warna badan. Lengan pendek
  // (shirt/gi) = segmen tebal di 45% lengan atas dari bahu — digambar di
  // sini, lengan depan yang digambar sesudahnya menutup tengahnya dan
  // menyisakan rim lengan. Kerah V (jacket/gi) + resleting (jacket) /
  // kerah menyilang (gi) digambar di atas torso.
  if (gear.body) {
    const bcol = gear.body.color || col;
    const bv = gear.body.variant || 'shirt';
    // Baju = poligon torso joint-based yang sama seperti di drawFighter,
    // diperluas 1,5 px (singlet) / 2 px (lainnya) supaya menutup tepi
    // torso — bukan stroke tengah yang menyisakan celah di sudut sendi.
    fillPoly(c, torsoPoly(j, bv === 'singlet' ? 1.5 : 2), bcol);
    if (bv === 'shirt' || bv === 'gi') {
      c.lineWidth = 11;
      for (const [sh, el] of [[j.shF, j.elbowF], [j.shB, j.elbowB]]) {
        c.beginPath();
        c.moveTo(sh.x, sh.y);
        c.lineTo(sh.x + (el.x - sh.x) * 0.5, sh.y + (el.y - sh.y) * 0.5);
        c.stroke();
      }
    }
    if (bv === 'jacket' || bv === 'gi') {
      // Kerah V di leher: apex mengikuti arah torso (bahu -> pinggul).
      const dx = j.hip.x - j.shoulder.x, dy = j.hip.y - j.shoulder.y;
      const dl = Math.hypot(dx, dy) || 1;
      const ux = dx / dl, uy = dy / dl;
      const px = -uy, py = ux; // tegak lurus torso
      const ax = j.shoulder.x + ux * 13, ay = j.shoulder.y + uy * 13;
      c.strokeStyle = shade(bcol, 0.65); c.lineWidth = 3;
      c.beginPath();
      c.moveTo(j.shoulder.x - px * 8, j.shoulder.y - py * 8);
      c.lineTo(ax, ay);
      c.lineTo(j.shoulder.x + px * 8, j.shoulder.y + py * 8);
      c.stroke();
      if (bv === 'jacket') {
        // Resleting tengah sepanjang torso.
        c.strokeStyle = PALETTE.paper; c.lineWidth = 2;
        c.beginPath(); c.moveTo(j.shoulder.x, j.shoulder.y); c.lineTo(j.hip.x, j.hip.y); c.stroke();
      } else {
        // Gi: kerah menyilang — garis kedua melintang di dada.
        c.strokeStyle = shade(bcol, 0.65); c.lineWidth = 3;
        c.beginPath();
        c.moveTo(j.shoulder.x - px * 8, j.shoulder.y + uy * 14 - py * 8);
        c.lineTo(j.shoulder.x + px * 8, j.shoulder.y + uy * 14 + py * 8);
        c.stroke();
      }
    }
  }
}

// Digambar dari drawFighter (film.js) — ctx: { c, j, f, gear, s, front, col, dark }.
// c = canvas ctx, j = joints (computeJoints), f = fighter, gear = f.gear,
// s = detik, front = petarung depan, col/dark = warna badan/gelap.
export function drawBeltGear(ctx) {
  const { c, j, f, gear, s, front, col, dark } = ctx;
  // --- sabuk (pinggang) ---
  if (gear.belt) {
    const bcol = gear.belt.color || PALETTE.red;
    const midX = (j.hipF.x + j.hipB.x) / 2, midY = (j.hipF.y + j.hipB.y) / 2 + 2;
    if (gear.belt.variant === 'champion') {
      // Pita tebal + pelat emas persegi di depan.
      c.strokeStyle = bcol; c.lineWidth = 12;
      c.beginPath(); c.moveTo(j.hipF.x, j.hipF.y + 2); c.lineTo(j.hipB.x, j.hipB.y + 2); c.stroke();
      c.fillStyle = GEAR_GOLD;
      c.fillRect(midX - 10, midY - 9, 20, 18);
      c.lineWidth = 2.5; c.strokeStyle = PALETTE.ink;
      c.strokeRect(midX - 10, midY - 9, 20, 18);
      c.fillStyle = shade(GEAR_GOLD, 0.6);
      c.beginPath(); c.arc(midX, midY, 3, 0, Math.PI * 2); c.fill();
    } else if (gear.belt.variant === 'rope') {
      // Garis tipis + simpul di depan.
      c.strokeStyle = bcol; c.lineWidth = 3;
      c.beginPath(); c.moveTo(j.hipF.x, j.hipF.y + 2); c.lineTo(j.hipB.x, j.hipB.y + 2); c.stroke();
      c.fillStyle = bcol;
      c.beginPath(); c.arc(midX, midY, 4.5, 0, Math.PI * 2); c.fill();
    } else {
      // Sabuk biasa — LAMA, jangan diubah.
      c.strokeStyle = bcol; c.lineWidth = 8;
      c.beginPath(); c.moveTo(j.hipF.x, j.hipF.y + 2); c.lineTo(j.hipB.x, j.hipB.y + 2); c.stroke();
    }
  }
}

// Digambar dari drawFighter (film.js) — ctx: { c, j, f, gear, s, front, col, dark }.
// c = canvas ctx, j = joints (computeJoints), f = fighter, gear = f.gear,
// s = detik, front = petarung depan, col/dark = warna badan/gelap.
export function drawShoesGear(ctx) {
  const { c, j, f, gear, s, front, col, dark } = ctx;
  // --- sepatu ---
  if (gear.shoes && gear.shoes.model !== 'barefoot') {
    const smodel = gear.shoes.model || 'sneakers';
    const scol = gear.shoes.color || PALETTE.sneaker;
    for (const [foot, leg] of [[j.footF, 'F'], [j.footB, 'B']]) {
      if (smodel === 'boots') {
        // Sepatu bot: elips + cuff naik ke pergelangan (searah tungkai).
        // Cuff mulai TEPAT di sendi kaki (bukan 2 px di atasnya) supaya
        // sepatu menempel di pergelangan, bukan melayang.
        const knee = leg === 'F' ? j.kneeF : j.kneeB;
        const dx = knee.x - foot.x, dy = knee.y - foot.y;
        const dl = Math.hypot(dx, dy) || 1;
        c.strokeStyle = scol; c.lineWidth = 10; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(foot.x, foot.y);
        c.lineTo(foot.x + (dx / dl) * 22, foot.y + (dy / dl) * 22);
        c.stroke();
        c.fillStyle = scol;
        c.beginPath();
        c.ellipse(foot.x + f.face * 5, foot.y - 3, 14, 7, 0, 0, Math.PI * 2);
        c.fill();
        c.lineWidth = 1.5; c.strokeStyle = PALETTE.ink; c.globalAlpha = 0.7; c.stroke(); c.globalAlpha = 1;
        c.fillStyle = PALETTE.sneakerSole;
        c.fillRect(foot.x - 9, foot.y - 2, 22, 4);
      } else if (smodel === 'sandals') {
        // Sandal: sol tebal + 2 tali menyilang (X) di atas kaki.
        c.fillStyle = PALETTE.sneakerSole;
        c.fillRect(foot.x - 9, foot.y - 2, 22, 3);
        c.strokeStyle = scol; c.lineWidth = 3;
        c.beginPath();
        c.moveTo(foot.x - 6, foot.y - 2);
        c.lineTo(foot.x + 6, foot.y - 8);
        c.stroke();
        c.beginPath();
        c.moveTo(foot.x + 6, foot.y - 2);
        c.lineTo(foot.x - 6, foot.y - 8);
        c.stroke();
      } else if (smodel === 'martial') {
        // Sepatu bela diri: elips datar + sol tipis.
        c.fillStyle = scol;
        c.beginPath();
        c.ellipse(foot.x + f.face * 5, foot.y - 2, 14, 5, 0, 0, Math.PI * 2);
        c.fill();
        c.lineWidth = 1.5; c.strokeStyle = PALETTE.ink; c.globalAlpha = 0.7; c.stroke(); c.globalAlpha = 1;
        c.fillStyle = PALETTE.ink; c.globalAlpha = 0.6;
        c.fillRect(foot.x - 9, foot.y - 1, 20, 2);
        c.globalAlpha = 1;
      } else {
        // Sneakers: elips lebih besar + sol lebih lebar + tali.
        c.fillStyle = scol;
        c.beginPath();
        c.ellipse(foot.x + f.face * 5, foot.y - 3, 14, 7, 0, 0, Math.PI * 2);
        c.fill();
        c.lineWidth = 1.5; c.strokeStyle = PALETTE.ink; c.globalAlpha = 0.7; c.stroke(); c.globalAlpha = 1;
        c.fillStyle = PALETTE.sneakerSole;
        c.fillRect(foot.x - 9, foot.y - 2, 22, 4);
        c.strokeStyle = PALETTE.ink; c.globalAlpha = 0.5; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(foot.x + f.face * 2, foot.y - 8);
        c.lineTo(foot.x + f.face * 6, foot.y - 5);
        c.stroke();
        c.beginPath();
        c.moveTo(foot.x - f.face * 2, foot.y - 8);
        c.lineTo(foot.x + f.face * 2, foot.y - 5);
        c.stroke();
        c.globalAlpha = 1;
      }
    }
  }
}

// Digambar dari drawFighter (film.js) — ctx: { c, j, f, gear, s, front, col, dark }.
// c = canvas ctx, j = joints (computeJoints), f = fighter, gear = f.gear,
// s = detik, front = petarung depan, col/dark = warna badan/gelap.
export function drawGlovesGear(ctx) {
  const { c, j, f, gear, s, front, col, dark } = ctx;
  // --- sarung tangan (per tangan, jenis + warna) ---
  if (gear.gloves) {
    for (const [hand, side] of [[j.handF, 'F'], [j.handB, 'B']]) {
      const g = gear.gloves[side] || gear.gloves.F;
      if (!g) continue;
      const gtype = g.type || 'boxing';
      let gcol = g.color || col;
      // Glove hitam pekat (#141210 dari preset) kebaca seperti kepala
      // tambahan saat clinch — ganti ke warna petarung supaya jelas glove.
      if (isNearBlack(gcol)) gcol = col;
      if (gtype === 'wraps') {
        // Perban tangan: kepalan r=11 + 3 garis perban.
        c.fillStyle = gcol;
        c.beginPath(); c.arc(hand.x, hand.y, 11, 0, Math.PI * 2); c.fill();
        c.lineWidth = 2.5; c.strokeStyle = PALETTE.ink; c.stroke();
        c.strokeStyle = PALETTE.paper; c.lineWidth = 2.5;
        for (const dy of [-4, 0, 4]) {
          c.beginPath(); c.moveTo(hand.x - 7, hand.y + dy); c.lineTo(hand.x + 7, hand.y + dy); c.stroke();
        }
      } else if (gtype === 'fingerless') {
        // Sarung tanpa jari: r=14 + 3 garis jari di tepi depan.
        c.fillStyle = gcol;
        c.beginPath(); c.arc(hand.x, hand.y, 14, 0, Math.PI * 2); c.fill();
        c.lineWidth = 2.5; c.strokeStyle = PALETTE.ink; c.stroke();
        c.strokeStyle = PALETTE.ink; c.lineWidth = 2;
        for (const dy of [-5, 0, 5]) {
          c.beginPath();
          c.moveTo(hand.x + f.face * 11, hand.y + dy);
          c.lineTo(hand.x + f.face * 17, hand.y + dy);
          c.stroke();
        }
      } else {
        // boxing / big / mma: glove HARUS lebih besar dari kepala (r 16)
        // dan bukan lingkaran polos — tonjolan ibu jari + manset kertas
        // lebar + jahitan membedakannya dari kepala saat clinch.
        const r = gtype === 'big' ? 20 : gtype === 'mma' ? 14 : 17;
        const cuffW = gtype === 'big' ? 7 : 6;
        c.fillStyle = gcol;
        c.beginPath(); c.arc(hand.x, hand.y, r, 0, Math.PI * 2); c.fill();
        c.lineWidth = 2.5; c.strokeStyle = PALETTE.ink; c.stroke();
        // Tonjolan ibu jari di sisi depan-bawah glove.
        const tx = hand.x + f.face * (r * 0.55), ty = hand.y + r * 0.45;
        c.fillStyle = gcol;
        c.beginPath(); c.arc(tx, ty, 6, 0, Math.PI * 2); c.fill();
        c.lineWidth = 2; c.strokeStyle = PALETTE.ink; c.stroke();
        // Manset kertas LEBAR di sisi pergelangan.
        const el = side === 'F' ? j.elbowF : j.elbowB;
        const dx = hand.x - el.x, dy = hand.y - el.y;
        const dl = Math.hypot(dx, dy) || 1;
        const wa = Math.atan2(dy / dl, dx / dl);
        c.strokeStyle = PALETTE.paper; c.lineWidth = cuffW;
        c.beginPath();
        c.arc(hand.x, hand.y, r - 2, wa + Math.PI - 0.7, wa + Math.PI + 0.7);
        c.stroke();
        // Jahitan melengkung di tengah glove (sisi buku jari).
        c.strokeStyle = PALETTE.ink; c.lineWidth = 1.5;
        c.beginPath();
        c.arc(hand.x, hand.y, r * 0.55, wa - 1.0, wa + 1.0);
        c.stroke();
        if (gtype === 'mma') {
          // MMA: 3 garis jari lebih tebal, memanjang sampai face*19.
          c.strokeStyle = PALETTE.ink; c.lineWidth = 2.5;
          for (const dy of [-5, 0, 5]) {
            c.beginPath();
            c.moveTo(hand.x + f.face * 11, hand.y + dy);
            c.lineTo(hand.x + f.face * 19, hand.y + dy);
            c.stroke();
          }
        }
      }
    }
  } else {
    // Tanpa glove: kepalan tangan r=7 + 2 garis buku jari.
    for (const hand of [j.handF, j.handB]) {
      c.fillStyle = col;
      c.beginPath(); c.arc(hand.x, hand.y, 7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = PALETTE.ink; c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(hand.x + f.face * 4, hand.y - 3);
      c.lineTo(hand.x + f.face * 7, hand.y - 3);
      c.stroke();
      c.beginPath();
      c.moveTo(hand.x + f.face * 4, hand.y + 3);
      c.lineTo(hand.x + f.face * 7, hand.y + 3);
      c.stroke();
    }
  }
}

// Digambar dari drawFighter (film.js) — ctx: { c, j, f, gear, s, front, col, dark }.
// c = canvas ctx, j = joints (computeJoints), f = fighter, gear = f.gear,
// s = detik, front = petarung depan, col/dark = warna badan/gelap.
export function drawWeaponGear(ctx) {
  const { c, j, f, gear, s, front, col, dark } = ctx;
  // --- senjata di tangan belakang ---
  // (a) Senjata aksesoris (dari Hub/builder, gear.weapon.fromAccessories):
  // dipegang SEJAK AWAL fight — HANYA visual, tanpa event ambil kayu dan
  // tanpa gerakan tongkat baru (weapon.kind Hub tetap 'none', jadi movesFor
  // tidak membuka stickswing/stickchop). Geometri searah lengan belakang,
  // sama seperti tongkat pasca-pickup.
  // (b) Preset Arena lama (weapon.kind 'kayu' + pickupAt): tongkat muncul
  // setelah event ambil kayu (f.hasWeapon), seperti dulu.
  const wpen = gear.weapon;
  if (wpen && (wpen.fromAccessories || f.hasWeapon)) {
    const dirX = j.handB.x - j.elbowB.x, dirY = j.handB.y - j.elbowB.y;
    const len = Math.hypot(dirX, dirY) || 1;
    const ux = dirX / len, uy = dirY / len;
    const wcol = wpen.color || PALETTE.wood;
    const wv = wpen.variant || 'stick';
    if (wv === 'short-stick') {
      // Tongkat pendek: ~setengah panjang tongkat.
      c.strokeStyle = wcol; c.lineWidth = 8; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(j.handB.x - ux * 13, j.handB.y - uy * 13);
      c.lineTo(j.handB.x + ux * 39, j.handB.y + uy * 39);
      c.stroke();
    } else if (wv === 'wooden-sword') {
      // Pedang kayu: gagang gelap + bilah datar lebar (ujung rata).
      c.strokeStyle = shade(wcol, 0.6); c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(j.handB.x - ux * 20, j.handB.y - uy * 20);
      c.lineTo(j.handB.x + ux * 6, j.handB.y + uy * 6);
      c.stroke();
      c.strokeStyle = wcol; c.lineWidth = 11; c.lineCap = 'butt';
      c.beginPath();
      c.moveTo(j.handB.x + ux * 6, j.handB.y + uy * 6);
      c.lineTo(j.handB.x + ux * 72, j.handB.y + uy * 72);
      c.stroke();
      c.lineCap = 'round';
    } else if (wv === 'nunchaku') {
      // Nunchaku: dua tongkat pendek + rantai pendek, membentuk sudut.
      const jx = j.handB.x + ux * 34, jy = j.handB.y + uy * 34;
      const th = 0.9; // ~52° dari arah lengan
      const vx = ux * Math.cos(th) - uy * Math.sin(th);
      const vy = ux * Math.sin(th) + uy * Math.cos(th);
      c.strokeStyle = wcol; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(j.handB.x, j.handB.y); c.lineTo(jx, jy); c.stroke();
      c.strokeStyle = PALETTE.ink; c.lineWidth = 2;
      c.beginPath(); c.moveTo(jx, jy); c.lineTo(jx + vx * 8, jy + vy * 8); c.stroke();
      c.strokeStyle = wcol; c.lineWidth = 7;
      c.beginPath();
      c.moveTo(jx + vx * 8, jy + vy * 8);
      c.lineTo(jx + vx * 38, jy + vy * 38);
      c.stroke();
    } else {
      // Tongkat panjang + 2 lilitan gelap di dekat genggaman.
      c.strokeStyle = wcol; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(j.handB.x - ux * 26, j.handB.y - uy * 26);
      c.lineTo(j.handB.x + ux * 78, j.handB.y + uy * 78);
      c.stroke();
      c.strokeStyle = shade(wcol, 0.6); c.lineWidth = 2;
      for (const off of [8, 18]) {
        const gx = j.handB.x + ux * off, gy = j.handB.y + uy * off;
        c.beginPath();
        c.moveTo(gx - uy * 6, gy + ux * 6);
        c.lineTo(gx + uy * 6, gy - ux * 6);
        c.stroke();
      }
    }
  }
}

// Digambar dari drawFighter (film.js) — ctx: { c, j, f, gear, s, front, col, dark }.
// c = canvas ctx, j = joints (computeJoints), f = fighter, gear = f.gear,
// s = detik, front = petarung depan, col/dark = warna badan/gelap.
export function drawHeadGear(ctx) {
  const { c, j, f, gear, s, front, col, dark } = ctx;
  // --- aksesoris kepala (varian head; 'none' = kepala polos) ---
  if (gear.head) {
    const hcol = gear.head.color || PALETTE.red;
    const hv = gear.head.variant || 'headband';
    if (hv === 'headband') {
      // Ikat kepala: busur r 16 + 2 ekor berkibar.
      c.strokeStyle = hcol; c.lineWidth = 6;
      c.beginPath();
      c.arc(j.head.x, j.head.y, 16, Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
      // Ekor ikat kepala berkibar (2 helai: panjang 14 px + 9 px).
      const tail = Math.sin(s * 6) * 4;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(j.head.x - f.face * 14, j.head.y - 4);
      c.lineTo(j.head.x - f.face * 28, j.head.y + 2 + tail);
      c.stroke();
      c.beginPath();
      c.moveTo(j.head.x - f.face * 14, j.head.y + 2);
      c.lineTo(j.head.x - f.face * 23, j.head.y + 8 + tail);
      c.stroke();
    } else if (hv === 'bandana') {
      // Penutup atas/belakang kepala + simpul + 2 ekor pendek.
      c.fillStyle = hcol;
      c.beginPath(); c.arc(j.head.x, j.head.y, 16, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(j.head.x - f.face * 14, j.head.y - 2, 5, 0, Math.PI * 2); c.fill();
      const tail = Math.sin(s * 6) * 3;
      c.strokeStyle = hcol; c.lineWidth = 3;
      c.beginPath();
      c.moveTo(j.head.x - f.face * 15, j.head.y);
      c.lineTo(j.head.x - f.face * 25, j.head.y + 6 + tail);
      c.stroke();
      c.beginPath();
      c.moveTo(j.head.x - f.face * 15, j.head.y + 3);
      c.lineTo(j.head.x - f.face * 24, j.head.y + 12 + tail);
      c.stroke();
    } else if (hv === 'cap') {
      // Topi: kubah + lidah pendek ke depan.
      c.fillStyle = hcol;
      c.beginPath(); c.arc(j.head.x, j.head.y, 16, Math.PI, 0); c.fill();
      c.beginPath();
      c.ellipse(j.head.x + f.face * 15, j.head.y - 6, 12, 5, 0, 0, Math.PI * 2);
      c.fill();
    } else if (hv === 'crown') {
      // Mahkota 3 ujung di atas kepala (warna emas bila headband 'none').
      c.fillStyle = hcol;
      c.beginPath();
      c.moveTo(j.head.x - 12, j.head.y - 11);
      c.lineTo(j.head.x - 9, j.head.y - 25);
      c.lineTo(j.head.x - 4, j.head.y - 12);
      c.lineTo(j.head.x, j.head.y - 28);
      c.lineTo(j.head.x + 4, j.head.y - 12);
      c.lineTo(j.head.x + 9, j.head.y - 25);
      c.lineTo(j.head.x + 12, j.head.y - 11);
      c.closePath(); c.fill();
    } else if (hv === 'helmet') {
      // Helm: kubah bulat menutup atas kepala + garis visor di dahi.
      c.fillStyle = hcol;
      c.beginPath();
      c.arc(j.head.x, j.head.y, 17, Math.PI * 1.05, Math.PI * 1.95);
      c.closePath(); c.fill();
      c.strokeStyle = PALETTE.ink; c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(j.head.x - f.face * 12, j.head.y - 6);
      c.lineTo(j.head.x + f.face * 14, j.head.y - 6);
      c.stroke();
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(j.head.x, j.head.y - 16);
      c.lineTo(j.head.x, j.head.y - 8);
      c.stroke();
    } else if (hv === 'topknot') {
      // Kuncir: sanggul kecil di atas kepala (menempel 4 px ke kepala,
      // bukan 3 px — ujungnya tidak melayang).
      c.fillStyle = hcol;
      c.beginPath(); c.arc(j.head.x, j.head.y - 18, 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = hcol; c.lineWidth = 3;
      c.beginPath();
      c.moveTo(j.head.x, j.head.y - 14);
      c.lineTo(j.head.x, j.head.y - 13);
      c.stroke();
    }
  }
}
