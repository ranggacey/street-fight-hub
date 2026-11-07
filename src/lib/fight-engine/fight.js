// fight.js — Fight director: undian pemenang DULU, lalu koreografi.
// Sama seperti NF1-4: jalur KO/decision diundi dulu, lalu pemenang, lalu
// serangan disusun agar hasil undian itu yang terjadi (HP steering).
// Seed tercatat -> fight yang sama bisa diulang identik.
// Pacing mengikuti CF2 §17: jeda kontak 0.55-0.75 dtk, tanpa slow-mo.
import { DMG_BASE, BLOCK_CHIP } from './damage.js';
import { movesFor, WEAPON_MOVES, normalizeStyle } from './moves.js';
import { windupDurOf } from './techniques.js';

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

function dmgOf(atk) {
  const base = DMG_BASE[atk.kind] ?? 10;
  if (atk.outcome === 'hit') {
    const fin = FINISHER_DMG[atk.kind] ? 1.5 : 1;
    return base * atk.power * fin;
  }
  if (atk.outcome === 'block') return atk.power >= 1.3 ? BLOCK_CHIP * atk.power : BLOCK_CHIP;
  return 0;
}

// Pilih outcome: hit 55% / block 15% / dodge 30% (slip/duck/roll/sidestep/parry/flinch).
function pickOutcome(rng) {
  const r = rng();
  if (r < 0.55) return 'hit';
  if (r < 0.70) return 'block';
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
    if (a.kind === 'feint') continue;
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
    if (a.outcome !== 'hit' || a.kind === 'feint') continue;
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
    if (a.kind === 'feint') continue;
    const d = dmgOf(a);
    if (a.by === 'R') hpB = Math.max(0, hpB - d); else hpR = Math.max(0, hpR - d);
    const cur = hpR === hpB ? null : hpR > hpB ? 'L' : 'R';
    if (cur && leader && cur !== leader) leadChange = { timeSec: round2(a.t), by: cur };
    if (cur) leader = cur;
  }
  return { biggestHit, finisher, knockdowns, leadChange };
}

// Bangun satu fight lengkap dari dua fighter + durasi + seed.
// Mengembalikan objek fight (dipakai buildScene + commentary + SFX).
export function buildFight(left, right, duration, seed, opts = {}) {
  const rng = mulberry32(seed);
  const fighters = { R: left, B: right };

  // --- UNDIAN DULU (sebelum koreografi) ---
  // Dua tarikan rng ini SELALU dilakukan — forcedResult hanya menimpa
  // hasilnya, jadi aliran rng setelahnya identik dengan run tanpa opts.
  const lotResult = rng() < 0.35 ? 'ko' : 'decision';
  const lotWinner = rng() < 0.5 ? 'R' : 'B';
  let result = lotResult;
  let winner = lotWinner;
  const fr = opts?.forcedResult;
  if (fr && (fr.result === 'ko' || fr.result === 'decision') && (fr.winner === 'R' || fr.winner === 'B')) {
    result = fr.result;
    winner = fr.winner;
  }
  const loser = winner === 'R' ? 'B' : 'R';

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

  const koT = result === 'ko' ? duration - 1.2 - rng() * 1.2 : 99;
  const attacks = [], knockdowns = [], cheers = [], retreats = [], clinches = [];
  const hp = { R: 100, B: 100 };

  // Knockdown tengah fight (sekali, 50%): korban bangkit lagi.
  const midKdT = 8 + rng() * Math.max(4, duration * 0.45);
  let midKdDone = false;
  let midKdVictim = rng() < 0.5 ? 'R' : 'B';

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
      const wf = fighters[winner];
      const hasStick = weapon && weapon.who === winner && koT > weapon.t + 3.0;
      let finKind = 'finisher';
      if (hasStick) finKind = 'stickchop';
      else if (normalizeStyle(wf.style) === 'muaythai') finKind = 'flyknee';
      const finBase = DMG_BASE[finKind] ?? 20;
      const power = Math.min(2.2, Math.max(1.4, hp[loser] / (finBase * 1.5)));
      attacks.push({ t: koT, by: winner, kind: finKind, target: 'head', outcome: 'hit', power, knockdown: true });
      knockdowns.push({ who: loser, t: koT + 0.4, getupStart: null });
      cheers.push({ t: koT, dur: 1.6, power: 1 });
      hp[loser] = Math.max(0, hp[loser] - dmgOf({ kind: finKind, outcome: 'hit', power }));
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
    // Feint TIDAK dipakai director: di jarak dekat (gap ~50px) tangan
    // guard sudah 11px dari kepala hantu, jadi flick feint menembus
    // kepala lawan. Feint tetap ada di techniques.js untuk pemakaian
    // manual nanti.
    // --- Knockdown tengah fight ---
    let knockdown = false;
    if (!midKdDone && t >= midKdT && move.kind !== 'feint') {
      midKdDone = true;
      if (rng() < 0.5) midKdVictim = def; // korban = yang diserang sekarang
      knockdown = by !== midKdVictim; // serangan ini yang menjatuhkan
      if (knockdown && (move.kind === 'takedown' || move.kind === 'sweep' || move.kind === 'finisher')) {
        // takedown/sweep sudah cocok sebagai bantingan
      }
    }
    // --- Outcome + HP steering ---
    let outcome = pickOutcome(rng);
    if (move.kind === 'feint') outcome = 'feint';
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
      if (result === 'decision') {
        // Pecundang tidak boleh KO; pemenang harus tetap unggul (margin >= 6).
        // Lantai pecundang di fase 2 ADAPTIF: kalau pemenang sudah sekarat
        // (mis. 8 HP), lantai 10 akan mengunci margin negatif — turunkan
        // lantai ke (HP pemenang - 6), min 1, supaya margin bisa pulih
        // lewat damage (tanpa fix-up akhir yang membalik pemimpin).
        const loserFloor = hard ? Math.max(1, Math.min(10, hp[winner] - 6)) : 10;
        if (def === loser && newHp < loserFloor) outcome = 'slip';
        else if (def === winner && newHp < hp[loser] + 6) {
          // Fase 1: block saja (margin boleh turun — bisa pulih, ini fase
          // comeback). Fase 2: block hanya kalau chip-nya masih menjaga
          // margin; kalau tidak, slip (0 damage).
          outcome = (hard && hp[winner] - blockDmg < hp[loser] + 6) ? 'slip' : 'block';
        }
      } else {
        // Jalur KO: pecundang tidak boleh 0 sebelum finisher; pemenang jangan terlalu sekarat.
        // Lantai pemenang 15 berlaku untuk hit DAN block, di KEDUA fase:
        // dulu hanya hit yang dicek — chip block lolos dan menolkan
        // pemenang selama 60 dtk (5 hit + 11 block = 102 damage, seed 8/72).
        if (def === loser && newHp < 12) outcome = 'slip';
        else if (def === winner && newHp < 15) outcome = (hp[winner] - blockDmg < 15) ? 'slip' : 'block';
      }
    }
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
  }

  // Pastikan decision punya pemenang HP (kalau seri karena steering, beri
  // satu pukulan kecil ke pecundang di akhir — tidak mungkin terjadi karena
  // steering, tapi jaga-jaga).
  if (result === 'decision' && hp[winner] <= hp[loser]) {
    hp[loser] = Math.max(0, hp[winner] - 4);
  }

  const sceneCfg = {
    duration, left, right, attacks, knockdowns, cheers, retreats, clinches,
    winner, result, koT, weapon, seed,
  };
  const fight = {
    seed, duration, winner, result, koT, weapon,
    attacks, knockdowns, cheers, retreats, clinches,
    left, right, hpFinal: { R: Math.round(hp.R), B: Math.round(hp.B) },
    sceneCfg,
  };
  fight.stats = fightStats(fight);
  fight.keyMoments = keyMoments(fight);
  return fight;
}

// Ringkasan hasil untuk tampilan (seed, undian, skor akhir).
export function fightSummary(fight) {
  const wName = fight.winner === 'R' ? fight.left.name : fight.right.name;
  const lName = fight.winner === 'R' ? fight.right.name : fight.left.name;
  if (fight.result === 'ko') {
    return `${wName} menang KO atas ${lName} di detik ${fight.koT.toFixed(1)} (seed ${fight.seed})`;
  }
  return `${wName} menang angka ${fight.hpFinal.R}–${fight.hpFinal.B} atas ${lName} (seed ${fight.seed})`;
}
