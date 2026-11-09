// app.js — UI Stickman Fight Arena: builder + loop fight + export video.
// Alur: Tarung -> buildFight (undian dulu) -> buildScene -> rAF render ->
// PBP + mulut komentator + SFX terjadwal -> hasil -> Ulang / Export.
// Export: MediaRecorder dari canvas.captureStream(30) + stream audio SFX
// (webm 720x1280 portrait, siap upload IG Reels).
import { PRESETS, PRESET_ORDER, clonePreset, defaultFighters } from './presets.js';
import { STYLES, movesFor, normalizeStyle, fighterColors, setFighterColors } from './moves.js';
import { buildFight, randomSeed, fightSummary, mulberry32 } from './fight.js';
import { buildScene, SCENE, realTime, MAPS } from './scenes.js';
import { render, resetSim, setMouth } from './film.js';
import { generatePBP, activeLine, COMMENTATORS } from './commentary.js';
import { windupDurOf } from './techniques.js';
import { drawPoster, POSTER_W, POSTER_H } from './poster.js';
import { SFX } from './sfx.js';
import { createVoice } from './voice.js';

const LS_KEY = 'sfa-fighters-v1';
const MAP_LS_KEY = 'sfa-map-v1';

// ---------------- map/arena ----------------
function loadMap() {
  try {
    const raw = localStorage.getItem(MAP_LS_KEY);
    if (raw && MAPS.some((m) => m.id === raw)) return raw;
  } catch (e) { /* abaikan, pakai default */ }
  return 'ring';
}
let currentMap = loadMap();

function setMap(id) {
  if (!MAPS.some((m) => m.id === id)) return false;
  currentMap = id;
  try { localStorage.setItem(MAP_LS_KEY, id); } catch (e) { /* abaikan */ }
  document.querySelectorAll('#mapGrid .map-card').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.map === id ? 'true' : 'false');
  });
  // Gambar ulang frame idle supaya map baru langsung terlihat (tanpa ini
  // canvas diam di frame intro map lama sampai Tarung ditekan).
  if (phase === 'idle') renderIdle();
  return true;
}
function getMap() { return currentMap; }

// Frame idle: bangun scene dummy (seed tetap) + render t=0.
function renderIdle() {
  const f = buildFight(fighters.left, fighters.right, 60, 20261107);
  f.sceneCfg.map = currentMap;
  buildScene(f.sceneCfg);
  resetSim();
  render(ctx, 0);
}

function buildMapPicker() {
  const grid = $('mapGrid');
  grid.innerHTML = '';
  for (const m of MAPS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'map-card';
    b.dataset.map = m.id;
    b.setAttribute('aria-pressed', m.id === currentMap ? 'true' : 'false');
    const sw = document.createElement('span');
    sw.className = `map-swatch map-swatch-${m.id}`;
    sw.setAttribute('aria-hidden', 'true');
    const tx = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'map-name';
    name.textContent = m.name;
    const tag = document.createElement('span');
    tag.className = 'map-tag';
    tag.textContent = m.tagline;
    tx.appendChild(name);
    tx.appendChild(tag);
    b.appendChild(sw);
    b.appendChild(tx);
    b.addEventListener('click', () => setMap(m.id));
    grid.appendChild(b);
  }
}
const $ = (id) => document.getElementById(id);
const canvas = $('arena');
const ctx = canvas.getContext('2d');

// ---------------- state ----------------
let fighters = loadFighters();
let fight = null;
let pbpLines = [];
let sfx = new SFX();
const voice = createVoice(); // suara komentator (klip rekaman TTS; no-op kalau tak ada AudioContext)
let rafId = null;
let fightStartPerf = 0;
let phase = 'idle'; // idle | running | done
let lastLine = null;
let recording = null; // { recorder, chunks, mime }
let endWaiters = [];

function loadFighters() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const f = JSON.parse(raw);
      if (f && f.left && f.left.name && f.left.style && f.left.color && f.right && f.right.name) {
        // Fighter lama (tanpa `colors`) tetap valid: isi colors dari warna
        // legacy-nya (lihat moves.js fighterColors).
        setFighterColors(f.left, {});
        setFighterColors(f.right, {});
        return f;
      }
    }
  } catch (e) { /* abaikan, pakai default */ }
  return defaultFighters();
}
function saveFighters() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(fighters)); } catch (e) { /* abaikan */ }
}

// ---------------- builder ----------------
function fighterSideKey(side) { return side === 'left' ? 'left' : 'right'; }

function buildPresetSelects() {
  for (const side of ['left', 'right']) {
    const sel = $(side === 'left' ? 'presetLeft' : 'presetRight');
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = ''; opt0.textContent = 'Preset…';
    sel.appendChild(opt0);
    for (const key of PRESET_ORDER) {
      const o = document.createElement('option');
      o.value = key;
      o.textContent = `${PRESETS[key].name} (${STYLES[PRESETS[key].style].label})`;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      if (!sel.value) return;
      const f = clonePreset(sel.value);
      fighters[fighterSideKey(side)] = f;
      saveFighters();
      refreshSide(side);
    });
  }
}

function buildFields(side) {
  const key = fighterSideKey(side);
  const box = document.querySelector(`.builder-fields[data-side="${side}"]`);
  box.innerHTML = '';
  const f = fighters[key];
  const colors = fighterColors(f); // warna per bagian (kanonik, lihat moves.js)

  const addField = (label, el) => {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    const span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(span);
    wrap.appendChild(el);
    box.appendChild(wrap);
  };
  const textInput = (val, onChange) => {
    const el = document.createElement('input');
    el.type = 'text'; el.value = val; el.maxLength = 18;
    el.addEventListener('input', () => { onChange(el.value); afterEdit(side); });
    return el;
  };
  // Input warna RGB bebas: swatch (type=color) + field hex (ketik manual).
  // onChange dipanggil dengan hex '#RRGGBB'. Bukan palet tetap (aturan user
  // 2026-11-07 ~20:44) — tiap user bisa beda-beda, tidak monoton.
  const colorField = (val, onChange) => {
    const wrap = document.createElement('div');
    wrap.className = 'color-field';
    const sw = document.createElement('input');
    sw.type = 'color'; sw.value = val || '#C8102E';
    const hex = document.createElement('input');
    hex.type = 'text'; hex.value = sw.value.toUpperCase(); hex.maxLength = 7;
    hex.spellcheck = false; hex.className = 'hex-input'; hex.title = 'Kode hex, mis. #C8102E';
    sw.addEventListener('input', () => { hex.value = sw.value.toUpperCase(); onChange(sw.value.toUpperCase()); afterEdit(side); });
    hex.addEventListener('input', () => {
      const v = hex.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) { sw.value = v.toUpperCase(); onChange(v.toUpperCase()); afterEdit(side); }
    });
    wrap.appendChild(sw); wrap.appendChild(hex);
    return wrap;
  };
  const selectInput = (options, val, onChange) => {
    const el = document.createElement('select');
    for (const [v, label] of options) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      el.appendChild(o);
    }
    el.value = val;
    el.addEventListener('change', () => { onChange(el.value); afterEdit(side); });
    return el;
  };

  addField('Nama', textInput(f.name, (v) => { f.name = v.trim() || 'Petarung'; }));
  addField('Warna badan', colorField(colors.body, (v) => setFighterColors(f, { body: v })));
  addField('Bela diri', selectInput(Object.entries(STYLES).map(([k, s]) => [k, s.label]), f.style, (v) => { f.style = v; }));

  // Sarung tangan.
  const gloveRow = document.createElement('div');
  gloveRow.className = 'field-row';
  const gloveType = selectInput(
    [['none', 'Tanpa glove'], ['boxing', 'Boxing'], ['mma', 'MMA'], ['big', 'Besar']],
    f.gloves?.type || 'none',
    (v) => { f.gloves = f.gloves || { type: 'none', color: '#141210' }; f.gloves.type = v; },
  );
  const gloveColor = colorField(colors.gloves, (v) => setFighterColors(f, { gloves: v }));
  gloveRow.appendChild(gloveType); gloveRow.appendChild(gloveColor);
  const gloveWrap = document.createElement('label');
  gloveWrap.className = 'field';
  const gloveSpan = document.createElement('span');
  gloveSpan.textContent = 'Sarung tangan';
  gloveWrap.appendChild(gloveSpan); gloveWrap.appendChild(gloveRow);
  box.appendChild(gloveWrap);

  // Senjata.
  const weaponSel = selectInput(
    [['none', 'Tidak ada'], ['kayu', 'Tongkat kayu']],
    f.weapon?.kind || 'none',
    (v) => {
      f.weapon = f.weapon || { kind: 'none', hand: 'right' };
      f.weapon.kind = v;
      if (v === 'kayu' && typeof f.weapon.pickupAt !== 'number') f.weapon.pickupAt = 15;
      buildFields(side); // tampilkan/sembunyikan input detik ambil
    },
  );
  addField('Senjata di tangan', weaponSel);
  if (f.weapon?.kind === 'kayu') {
    addField('Warna tongkat', colorField(colors.weapon, (v) => setFighterColors(f, { weapon: v })));
    const pick = document.createElement('input');
    pick.type = 'number'; pick.min = 5; pick.max = 50; pick.step = 1;
    pick.value = f.weapon.pickupAt ?? 15;
    pick.addEventListener('input', () => {
      f.weapon.pickupAt = Math.max(5, Math.min(50, Number(pick.value) || 15));
      afterEdit(side);
    });
    addField('Ambil kayu di detik ke-', pick);
  }

  // Sepatu.
  const shoeRow = document.createElement('div');
  shoeRow.className = 'field-row';
  const shoeModel = selectInput(
    [['sneakers', 'Sneakers'], ['boots', 'Boots'], ['barefoot', 'Barefoot']],
    f.shoes?.model || 'sneakers',
    (v) => { f.shoes = f.shoes || { model: 'sneakers', color: '#FBF8F1' }; f.shoes.model = v; },
  );
  const shoeColor = colorField(colors.shoes, (v) => setFighterColors(f, { shoes: v }));
  shoeRow.appendChild(shoeModel); shoeRow.appendChild(shoeColor);
  const shoeWrap = document.createElement('label');
  shoeWrap.className = 'field';
  const shoeSpan = document.createElement('span');
  shoeSpan.textContent = 'Sepatu';
  shoeWrap.appendChild(shoeSpan); shoeWrap.appendChild(shoeRow);
  box.appendChild(shoeWrap);

  // Sabuk & ikat kepala — warna RGB bebas + bisa tidak ada (checkbox).
  const optionalColor = (label, current, dflt, onPick) => {
    const row = document.createElement('div');
    row.className = 'field-row-opt';
    const none = document.createElement('input');
    none.type = 'checkbox'; none.checked = current === 'none';
    const noneLab = document.createElement('span');
    noneLab.textContent = 'Tidak ada';
    const cf = colorField(current === 'none' ? dflt : current, (v) => {
      none.checked = false; cf.style.opacity = '1'; onPick(v);
    });
    cf.style.opacity = current === 'none' ? '0.4' : '1';
    none.addEventListener('change', () => {
      onPick(none.checked ? 'none' : dflt);
      buildFields(side); // gambar ulang supaya centang + opacity sinkron
    });
    row.appendChild(none); row.appendChild(noneLab); row.appendChild(cf);
    const wrap = document.createElement('label');
    wrap.className = 'field';
    const span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(span); wrap.appendChild(row);
    box.appendChild(wrap);
  };
  optionalColor('Sabuk', colors.belt, '#E10600', (v) => setFighterColors(f, { belt: v }));
  optionalColor('Ikat kepala', colors.headband, '#FACC15', (v) => setFighterColors(f, { headband: v }));
}

function afterEdit(side) {
  saveFighters();
  drawPreview(side);
  buildMoves(side);
  // Sinkronkan preset select (kosongkan kalau sudah diubah dari preset).
  const sel = $(side === 'left' ? 'presetLeft' : 'presetRight');
  const f = fighters[fighterSideKey(side)];
  const match = PRESET_ORDER.find((k) => JSON.stringify(PRESETS[k]) === JSON.stringify(f));
  sel.value = match || '';
}

function refreshSide(side) {
  buildFields(side);
  drawPreview(side);
  buildMoves(side);
  afterEdit(side);
}

// Preview 240x240: stickman pose guard dengan gear.
function drawPreview(side) {
  const cv = $(side === 'left' ? 'previewLeft' : 'previewRight');
  const c = cv.getContext('2d');
  const f = fighters[fighterSideKey(side)];
  const W2 = cv.width, H2 = cv.height;
  c.clearRect(0, 0, W2, H2);
  c.fillStyle = '#1C1915';
  c.fillRect(0, 0, W2, H2);
  const cx = W2 / 2, gy = H2 - 30;
  const colors = fighterColors(f); // warna per bagian (kanonik)
  const col = colors.body;
  c.lineCap = 'round'; c.lineJoin = 'round';
  // Bayangan.
  c.fillStyle = 'rgba(0,0,0,0.4)';
  c.beginPath(); c.ellipse(cx, gy + 6, 42, 8, 0, 0, Math.PI * 2); c.fill();
  // Kaki (stance).
  c.strokeStyle = col; c.lineWidth = 6;
  c.beginPath(); c.moveTo(cx, gy - 78); c.lineTo(cx - 16, gy - 38); c.lineTo(cx - 30, gy); c.stroke();
  c.beginPath(); c.moveTo(cx, gy - 78); c.lineTo(cx + 14, gy - 40); c.lineTo(cx + 28, gy); c.stroke();
  // Sepatu.
  if (f.shoes?.model !== 'barefoot') {
    c.fillStyle = colors.shoes;
    c.beginPath(); c.ellipse(cx - 30, gy - 3, 10, 5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(cx + 28, gy - 3, 10, 5, 0, 0, Math.PI * 2); c.fill();
  }
  // Torso — quad berisi (pinggul 12px -> bahu 15px), BUKAN garis tipis:
  // preview kini seragam dengan render fight (torso poligon sendi berisi),
  // ujung-ujungnya TETAP titik akar kaki/tangan (cx,gy-78)/(cx+4,gy-132)
  // supaya tidak ada celah.
  {
    const hx = cx, hy = gy - 78, sx = cx + 4, sy = gy - 132;
    const dx = sx - hx, dy = sy - hy;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(hx + px * 6, hy + py * 6);
    c.lineTo(sx + px * 7.5, sy + py * 7.5);
    c.lineTo(sx - px * 7.5, sy - py * 7.5);
    c.lineTo(hx - px * 6, hy - py * 6);
    c.closePath(); c.fill();
  }
  // Sabuk.
  if (colors.belt !== 'none') {
    c.strokeStyle = colors.belt; c.lineWidth = 7;
    c.beginPath(); c.moveTo(cx - 8, gy - 78); c.lineTo(cx + 10, gy - 78); c.stroke();
    c.strokeStyle = col;
  }
  // Tangan guard.
  c.lineWidth = 6;
  c.beginPath(); c.moveTo(cx + 4, gy - 132); c.lineTo(cx + 22, gy - 112); c.lineTo(cx + 30, gy - 96); c.stroke();
  c.beginPath(); c.moveTo(cx + 4, gy - 132); c.lineTo(cx - 14, gy - 110); c.lineTo(cx - 20, gy - 94); c.stroke();
  // Glove (warna mendekati hitam diganti warna petarung — sama seperti
  // render film.js — supaya tidak terbaca sebagai bola hitam).
  if (f.gloves?.type && f.gloves.type !== 'none') {
    const r = f.gloves.type === 'big' ? 13 : f.gloves.type === 'mma' ? 9 : 11;
    const gc = colors.gloves;
    const n = parseInt(gc.slice(1), 16);
    const nearBlack = (((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255)) < 120;
    c.fillStyle = nearBlack ? col : gc;
    c.beginPath(); c.arc(cx + 30, gy - 96, r, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx - 20, gy - 94, r, 0, Math.PI * 2); c.fill();
  }
  // Kepala.
  c.fillStyle = '#FBF8F1';
  c.beginPath(); c.arc(cx + 6, gy - 150, 13, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col; c.lineWidth = 5; c.stroke();
  // Leher (menghubungkan kepala ke torso).
  c.strokeStyle = col; c.lineWidth = 6;
  c.beginPath(); c.moveTo(cx + 5, gy - 137); c.lineTo(cx + 4, gy - 130); c.stroke();
  // Joint dots di sendi (bahu, siku, pinggul, lutut) — senada rig film.
  const joints = [
    [cx + 4, gy - 132], [cx + 22, gy - 112], [cx - 14, gy - 110],
    [cx, gy - 78], [cx - 16, gy - 38], [cx + 14, gy - 40],
  ];
  for (const [jx, jy] of joints) {
    c.fillStyle = '#F3EDE2';
    c.beginPath(); c.arc(jx, jy, 3.5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(20,18,16,0.6)'; c.lineWidth = 1; c.stroke();
  }
  // Ikat kepala.
  if (colors.headband !== 'none') {
    c.strokeStyle = colors.headband; c.lineWidth = 4;
    c.beginPath(); c.arc(cx + 6, gy - 150, 13, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  }
  // Tongkat kayu (kalau punya) — warnanya warna senjata pilihan user.
  if (f.weapon?.kind === 'kayu') {
    c.strokeStyle = colors.weapon; c.lineWidth = 7;
    c.beginPath(); c.moveTo(cx + 30, gy - 120); c.lineTo(cx + 52, gy - 60); c.stroke();
  }
  // Nama.
  c.fillStyle = '#F3EDE2';
  c.font = '800 16px Manrope, sans-serif';
  c.textAlign = 'center';
  c.fillText(f.name, cx, 24);
  c.font = '600 12px Manrope, sans-serif';
  c.fillStyle = '#B8AF9E';
  c.fillText(STYLES[f.style]?.label || f.style, cx, 42);
}

function buildMoves(side) {
  const box = $(side === 'left' ? 'movesLeft' : 'movesRight');
  const f = fighters[fighterSideKey(side)];
  const moves = movesFor(f);
  box.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = `${f.name} — ${STYLES[f.style]?.label || f.style}`;
  box.appendChild(title);
  const list = document.createElement('ul');
  list.className = 'moves-list';
  for (const m of moves) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${m.label}</b><span>${m.dmg} dmg · ${m.range}</span>`;
    li.title = m.note || '';
    list.appendChild(li);
  }
  box.appendChild(list);
}

// ---------------- PBP + SFX (dikonversi sim time -> real time) ----------------
// PBP & SFX dijadwalkan dalam WAKTU NYATA (hit-stop membekukan sim, jadi
// realTime() dipakai agar teks/suara jatuh tepat di frame kontak).
function buildPBPLines(f) {
  const INTRO = SCENE.INTRO_DUR;
  const events = f.attacks.map((a) => ({
    t: realTime(a.t) + INTRO,
    type: 'attack',
    attacker: a.by,
    move: { kind: a.kind },
    blocked: a.outcome === 'block',
    knockdown: !!a.knockdown,
  }));
  if (f.weapon) {
    events.push({
      t: realTime(f.weapon.t) + INTRO,
      type: 'pickup',
      fighter: f.weapon.who === 'R' ? f.left.name : f.right.name,
    });
  }
  return generatePBP({
    fighters: { left: f.left, right: f.right },
    events,
    introEnd: INTRO,
    fightEnd: INTRO + SCENE.FIGHT_REAL,
    winnerName: f.winner === 'R' ? f.left.name : f.right.name,
    loserName: f.winner === 'R' ? f.right.name : f.left.name,
    result: f.result,
  }, windupDurOf, mulberry32((f.seed ^ 0x9e3779b9) >>> 0));
}

function buildSFXEvents(f) {
  const evs = [
    { type: 'dash', t: 0.1, power: 0.6 },
    { type: 'bell', t: 0 },
  ];
  for (const a of f.attacks) {
    const rt = realTime(a.t);
    if (a.outcome === 'hit') evs.push({ type: 'hit', t: rt, power: a.power });
    else if (a.outcome === 'block') evs.push({ type: 'block', t: rt });
  }
  if (f.result === 'ko') evs.push({ type: 'ko', t: realTime(f.koT) });
  evs.push({ type: 'bell', t: realTime(f.duration) });
  return evs;
}

// ---------------- loop fight ----------------
function totalDuration() {
  return SCENE.INTRO_DUR + SCENE.FIGHT_REAL
    + (SCENE.RESULT === 'ko' ? SCENE.KO_DUR : SCENE.DECISION_DUR)
    + SCENE.OUTRO_DUR;
}

function tick(now) {
  const tf = (now - fightStartPerf) / 1000;
  const total = totalDuration();
  render(ctx, Math.min(tf, total));
  updatePBP(Math.min(tf, total));
  if (tf >= total) { endFight(); return; }
  rafId = requestAnimationFrame(tick);
}

function updatePBP(tf) {
  const line = activeLine(pbpLines, tf);
  if (line !== lastLine) {
    lastLine = line;
    if (line) {
      const who = COMMENTATORS[line.who];
      // Komentator tanpa nama: label "Komentator 1/2" + warna saja.
      $('pbpWho').textContent = line.who === 'c1' ? 'Komentator 1' : 'Komentator 2';
      $('pbpWho').style.color = who.color;
      $('pbpText').textContent = line.text;
      // Suara: klip rekaman untuk baris ini (voice.speak sendiri juga cek
      // mute + guard kalau audio belum terpasang).
      if (phase === 'running') voice.speak(line.text, line.who, line.clips);
    }
  }
  // Mulut: kalau suara sungguhan sedang berbunyi, mulut ikut selama ucapan
  // (bisa lebih dari 2.5 dtk untuk baris panjang); kalau tidak ada suara
  // (muted / TTS tak tersedia / ucapan selesai), pakai heuristik lama:
  // bicara ~2.5 dtk per baris, lalu mulut menutup — jangan bergerak tanpa suara.
  const live = voice.isSpeaking() && !voice.isMuted();
  const window = live ? Infinity : 2.5;
  let c1 = 0, c2 = 0;
  if (line && tf - line.t < window) {
    const open = 0.35 + 0.65 * Math.abs(Math.sin(tf * 13));
    if (line.who === 'c1') c1 = open; else c2 = open;
  }
  setMouth(c1, c2);
}

async function startFight(opts = {}) {
  if (phase === 'running') return fight;
  if (rafId) cancelAnimationFrame(rafId);
  // Hentikan ucapan fight lama; unlock TTS di gestur klik ini (autoplay policy).
  voice.cancel();
  voice.unlock();
  let seed = opts.seed ?? embed.seed ?? parseInt($('inpSeed').value, 10);
  if (!seed || Number.isNaN(seed)) {
    seed = randomSeed();
    $('inpSeed').value = String(seed);
  }
  const duration = opts.duration ?? embed.duration ?? 60; // match web game SELALU 60 detik (aturan 2026-11-07 ~20:32)
  fight = buildFight(fighters.left, fighters.right, duration, seed, opts.fightOpts ?? embed.fightOpts);
  fight.sceneCfg.map = currentMap;
  buildScene(fight.sceneCfg);
  resetSim();
  setMouth(0, 0);
  pbpLines = buildPBPLines(fight);
  lastLine = null;
  $('pbpWho').textContent = 'Komentator';
  $('pbpWho').style.color = '#F3EDE2';
  $('pbpText').textContent = 'Fight dimulai…';
  $('arenaState').textContent = `Seed ${seed} — ${fighters.left.name} vs ${fighters.right.name}`;
  $('seedNote').textContent = `Seed ${seed}. Seed yang sama = fight yang sama persis.`;
  $('btnFight').disabled = true;
  $('btnRematch').disabled = true;
  $('btnExport').disabled = true;
  $('exportStatus').hidden = true;
  await sfx.init();
  // Mode embed auto-record (admin Hub ekspor video): rekam otomatis saat
  // fight mulai. Gestur klik Tarung di iframe inilah yang mengizinkan
  // AudioContext (autoplay policy) — makanya rekaman dipicu di sini,
  // bukan saat sfa-config tiba. Video terunduh otomatis saat fight selesai
  // (finishRecording via onstop).
  if (embed.active && embed.autoRecord && !recording) startRecording();
  // Pasang suara komentator (klip rekaman) ke AudioContext SFX — klip
  // di-route lewat sfx.master sehingga ikut terekam export video.
  // Preload klip fight ini supaya tidak ada jeda saat baris PBP berganti.
  voice.attach(sfx);
  voice.prepare(pbpLines.flatMap((l) => l.clips || []));
  fightStartPerf = performance.now();
  const t0 = sfx.ctx ? sfx.ctx.currentTime + SCENE.INTRO_DUR : 0;
  sfx.schedule(buildSFXEvents(fight), t0);
  phase = 'running';
  rafId = requestAnimationFrame(tick);
  return fight;
}

function endFight() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  phase = 'done';
  if (sfx.ctx) sfx.stopCrowd(sfx.ctx.currentTime);
  voice.cancel();
  setMouth(0, 0);
  if (fight) {
    $('arenaState').textContent = fightSummary(fight);
    $('seedNote').textContent = `Seed ${fight.seed} — ${fightSummary(fight)}`;
  }
  $('btnFight').disabled = false;
  $('btnRematch').disabled = false;
  $('btnExport').disabled = false;
  $('exportStatus').hidden = true;
  if (recording) {
    try { recording.recorder.stop(); } catch (e) { /* abaikan */ }
    recording = null;
  }
  // Mode embed: laporkan hasil ke parent (Hub) begitu fight selesai.
  if (embed.active) sendEmbedResult();
  const waiters = endWaiters;
  endWaiters = [];
  for (const w of waiters) w();
}

// ---------------- export video ----------------
// Mulai MediaRecorder (video canvas + audio SFX). Dipakai DUA jalur:
// (1) export manual (tombol Export) — exportVideo() di bawah;
// (2) auto-record mode embed (admin Hub ekspor video) — startFight()
//     memanggil ini otomatis saat fight mulai kalau embed.autoRecord.
// Download webm terjadi saat recorder berhenti (akhir fight) lewat
// finishRecording — jadi kedua jalur sama-sama mengunduh otomatis.
function startRecording() {
  if (recording) return recording;
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  const tracks = [...canvas.captureStream(30).getVideoTracks()];
  if (sfx.stream) tracks.push(...sfx.stream.getAudioTracks());
  const stream = new MediaStream(tracks);
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8000000 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => { rec.onstop = () => res(finishRecording(rec, chunks)); });
  recording = { recorder: rec, chunks, mime, done };
  $('exportStatus').hidden = false;
  $('exportStatus').textContent = 'Merekam fight… tunggu sampai selesai.';
  rec.start(250);
  return recording;
}

// Berhenti merekam -> rakit webm -> unduh otomatis. Dipanggil lewat
// onstop recorder (endFight menghentikan recorder saat fight selesai).
function finishRecording(rec, chunks) {
  const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
  const name = `stickman-fight-${fight ? fight.seed : 'demo'}.webm`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  $('exportStatus').hidden = false;
  $('exportStatus').textContent = `Video tersimpan: ${name} (${(blob.size / 1024 / 1024).toFixed(1)} MB).`;
  window.__fightApp.lastExport = { url, name, size: blob.size, type: blob.type };
  return { url, name, size: blob.size };
}

async function exportVideo() {
  if (phase === 'running') return null;
  await sfx.init();
  const rec = startRecording();
  await startFight();
  return rec.done;
}

// ---------------- wiring + init ----------------
// Tombol mute suara komentator — dibuat via JS (index.html milik subagent UI).
// Token tema gelap dari styles.css, dengan fallback literal kalau var tak ada.
const btnVoice = document.createElement('button');
btnVoice.type = 'button';
btnVoice.id = 'btnVoice';
btnVoice.className = 'btn btn-ghost';
btnVoice.style.minHeight = '44px';
btnVoice.style.background = 'var(--surface-solid, #1C1915)';
btnVoice.style.color = 'var(--text, #F3EDE2)';
btnVoice.style.border = 'var(--border-strong, 1px solid rgba(243, 237, 226, 0.28))';
function applyVoiceMuted(muted) {
  voice.setMuted(muted);
  btnVoice.textContent = muted ? '🔇 Suara: Mati' : '🔊 Suara: Nyala';
  btnVoice.setAttribute('aria-pressed', muted ? 'false' : 'true');
  btnVoice.setAttribute('aria-label', muted ? 'Nyalakan suara komentator' : 'Matikan suara komentator');
}
btnVoice.addEventListener('click', () => applyVoiceMuted(!voice.isMuted()));
document.querySelector('.controls').appendChild(btnVoice);
applyVoiceMuted(voice.isMuted());

$('btnFight').addEventListener('click', () => startFight());
$('btnRematch').addEventListener('click', () => startFight({ seed: fight ? fight.seed : undefined }));
$('btnSeed').addEventListener('click', () => { $('inpSeed').value = String(randomSeed()); });
$('btnExport').addEventListener('click', () => exportVideo());

// ---------------- mode embed (postMessage — kontrak untuk Hub) ----------------
// Kontrak lengkap: EMBED-CONTRACT.md. Iframe mendengarkan sfa-config dari
// parent (Hub), TIDAK auto-start (tunggu klik Tarung di dalam iframe supaya
// gestur klik berada di origin iframe → TTS klip + AudioContext diizinkan),
// lalu mengirim sfa-result saat fight selesai.
// Origin yang diizinkan (dua arah): Hub produksi + localhost dev.
const EMBED_ALLOWED_ORIGINS = ['https://streetfight.ranggafigo.com', 'http://localhost:3000'];
const embed = {
  active: false,
  fightId: null,
  parentOrigin: null,
  seed: null,
  duration: 60,
  fightOpts: null,
  // Mode auto-record (admin Hub ekspor video): true kalau sfa-config
  // membawa autoRecord. Rekaman mulai saat Tarung diklik (lihat startFight).
  autoRecord: false,
};

// Lengkapi fighter dari parent (boleh parsial) + normalisasi style Hub-enum
// ke engine-key. Kembalikan null kalau field wajib tidak valid.
function normalizeEmbedFighter(f) {
  if (!f || typeof f !== 'object') return null;
  if (typeof f.name !== 'string' || !f.name.trim()) return null;
  if (typeof f.style !== 'string' || !f.style.trim()) return null;
  if (typeof f.color !== 'string' || !f.color.trim()) return null;
  const out = {
    name: f.name.trim().slice(0, 18),
    color: f.color,
    style: normalizeStyle(f.style),
    gloves: f.gloves && typeof f.gloves === 'object' ? f.gloves : { type: 'none', color: '#141210' },
    weapon: f.weapon && typeof f.weapon === 'object' ? f.weapon : { kind: 'none', hand: 'right' },
    shoes: f.shoes && typeof f.shoes === 'object' ? f.shoes : { model: 'sneakers', color: '#FBF8F1' },
    belt: f.belt && typeof f.belt === 'object' ? f.belt : { color: 'none' },
    headband: f.headband && typeof f.headband === 'object' ? f.headband : { color: 'none' },
  };
  if (typeof f.signatureMove === 'string' && f.signatureMove) out.signatureMove = f.signatureMove;
  if (typeof f.tempo === 'string' && f.tempo) out.tempo = f.tempo;
  // Warna per bagian: `colors` Hub (kalau ada) menang atas field legacy;
  // kalau tidak ada, isi dari field legacy (kompatibilitas mundur).
  setFighterColors(out, (f.colors && typeof f.colors === 'object') ? f.colors : {});
  return out;
}

function onEmbedMessage(ev) {
  if (!EMBED_ALLOWED_ORIGINS.includes(ev.origin)) return;
  const d = ev.data;
  if (!d || typeof d !== 'object' || d.type !== 'sfa-config') return;
  const l = normalizeEmbedFighter(d.fighters?.left);
  const r = normalizeEmbedFighter(d.fighters?.right);
  // Fighter Hub TIDAK disimpan ke localStorage (persist: false) — petarung
  // user sendiri tetap utuh saat buka arena secara mandiri.
  if (l && r) setFighters(l, r, { persist: false });
  if (typeof d.map === 'string') setMap(d.map);
  embed.active = true;
  embed.fightId = typeof d.fightId === 'string' ? d.fightId : null;
  embed.parentOrigin = ev.origin;
  embed.seed = typeof d.seed === 'number' && Number.isFinite(d.seed) ? d.seed : null;
  embed.duration = typeof d.duration === 'number' && d.duration > 0 ? d.duration : 60;
  const fo = {};
  if (d.opts && typeof d.opts === 'object') {
    if (d.opts.weights) fo.weights = d.opts.weights;
    if (d.opts.tempo) fo.tempo = d.opts.tempo;
    if (d.opts.forcedResult) fo.forcedResult = d.opts.forcedResult;
  }
  embed.fightOpts = Object.keys(fo).length ? fo : null;
  if (embed.seed !== null) $('inpSeed').value = String(embed.seed);
  document.body.classList.add('embed');
  // Mode auto-record: status jelas bahwa klik Tarung = mulai merekam,
  // video webm terunduh otomatis saat fight selesai (~60 detik).
  embed.autoRecord = d.autoRecord === true;
  $('arenaState').textContent = embed.autoRecord
    ? 'Mode ekspor video: tekan Tarung — rekaman mulai otomatis, video terunduh saat fight selesai.'
    : 'Mode embed: tekan Tarung untuk memulai.';
}

// Poster hasil: layout poster laga penuh (js/poster.js) di atas frame akhir
// canvas arena, JPEG 720x1280.
// Turunkan kualitas sampai <= 200KB; kalau tetap lewat, kembalikan null
// (hasil tetap dikirim tanpa poster).
function buildPoster() {
  if (!fight) return null;
  try {
    const off = document.createElement('canvas');
    off.width = POSTER_W;
    off.height = POSTER_H;
    const c = off.getContext('2d');
    // Draw: jangan tulis pemenang palsu (winner null -> ternary di bawah
    // jatuh ke nama kanan). Poster draw cukup menulis "Hasil seri".
    const isDraw = fight.result === 'draw' || (fight.result === 'decision' && fight.hpFinal.R === fight.hpFinal.B);
    const method = fight.result === 'ko' ? 'KO' : isDraw ? 'Draw' : 'Decision';
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    drawPoster(c, {
      frame: canvas,
      left: { name: fight.left.name, style: fight.left.style, color: fight.left.color },
      right: { name: fight.right.name, style: fight.right.style, color: fight.right.color },
      scoreA: fight.hpFinal.R,
      scoreB: fight.hpFinal.B,
      winnerName: isDraw ? null : (fight.winner === 'R' ? fight.left.name : fight.right.name),
      method,
      koTimeSec: fight.result === 'ko' ? Math.round(fight.koT * 100) / 100 : null,
      seed: fight.seed,
      dateStr,
    });
    for (const q of [0.85, 0.7, 0.6]) {
      const url = off.toDataURL('image/jpeg', q);
      if (url.length * 0.75 <= 200 * 1024) return url;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Kirim sfa-result ke parent. Dipanggil endFight; tersedia juga sebagai
// __fightApp.embed.sendResult untuk pemakaian manual/debug.
function sendEmbedResult() {
  if (!embed.active || !fight || !embed.parentOrigin) return null;
  // Draw lotere (result 'draw', winner null) JANGAN lolos sebagai
  // method 'decision' — dulu isDraw hanya menangkap decision yang
  // berakhir imbang, sehingga draw lotere terkirim sebagai decision
  // dengan winner null. (Perbaikan mapping laporan saja; logika hasil
  // di buildFight tidak diubah.)
  const isDraw = fight.result === 'draw' || (fight.result === 'decision' && fight.hpFinal.R === fight.hpFinal.B);
  const payload = {
    type: 'sfa-result',
    fightId: embed.fightId,
    seed: fight.seed,
    winner: isDraw ? null : fight.winner,
    method: fight.result === 'ko' ? 'KO' : isDraw ? 'draw' : 'decision',
    score: { a: fight.hpFinal.R, b: fight.hpFinal.B },
    koTimeSec: fight.result === 'ko' ? Math.round(fight.koT * 100) / 100 : null,
    stats: fight.stats || null,
    keyMoments: fight.keyMoments || null,
    posterDataUrl: buildPoster(),
  };
  try { window.parent.postMessage(payload, embed.parentOrigin); } catch (e) { /* abaikan */ }
  return payload;
}

// Ganti kedua petarung (dipakai builder preset, API otomatisasi, dan embed).
// Style dinormalisasi (Hub-enum -> engine-key). opts.persist=false dipakai
// embed supaya petarung Hub tidak menimpa petarung user di localStorage.
function setFighters(l, r, opts = {}) {
  fighters = {
    left: setFighterColors({ ...l, style: normalizeStyle(l.style) }, {}),
    right: setFighterColors({ ...r, style: normalizeStyle(r.style) }, {}),
  };
  if (opts.persist !== false) saveFighters();
  refreshSide('left');
  refreshSide('right');
}

// API otomatisasi (dipakai smoke test headless & demo video).
window.__fightApp = {
  startFight,
  exportVideo,
  startRecording,
  finishRecording,
  getState: () => ({
    phase,
    seed: fight?.seed ?? null,
    duration: fight?.duration ?? null,
    result: fight?.result ?? null,
    winner: fight?.winner ?? null,
    winnerName: fight ? (fight.winner === 'R' ? fight.left.name : fight.right.name) : null,
    hpFinal: fight?.hpFinal ?? null,
    attacks: fight?.attacks?.length ?? 0,
    weapon: fight?.weapon ?? null,
    tf: phase === 'running' ? (performance.now() - fightStartPerf) / 1000 : null,
  }),
  waitForEnd: () => new Promise((res) => {
    if (phase === 'done' || phase === 'idle') res();
    else endWaiters.push(res);
  }),
  setFighters,
  fighters: () => fighters,
  setMap,
  getMap,
  voice,
  setVoiceMuted: (m) => applyVoiceMuted(!!m),
  lastExport: null,
  version: 2,
  embed: {
    isEmbed: () => embed.active,
    getFightId: () => embed.fightId,
    sendResult: () => sendEmbedResult(),
  },
};

buildMapPicker();
buildPresetSelects();
refreshSide('left');
refreshSide('right');
$('btnExport').disabled = false;

// Frame idle: arena + judul sudah terlihat sebelum Tarung pertama.
(function initIdle() {
  // Teko display (2026-11-08): muat eksplisit bobot 700 (font variabel)
  // sebelum render pertama supaya judul tidak ter-render dengan fallback
  // Anton — mirror cara Anton dimuat (@font-face di styles.css +
  // document.fonts.ready di bawah).
  if (document.fonts?.load) {
    document.fonts.load('700 96px Teko')
      .then(() => { if (phase === 'idle') render(ctx, 0); })
      .catch(() => {});
  }
  renderIdle();
  // Gambar ulang begitu font display selesai dimuat — kalau tidak, judul
  // intro ter-render dengan font fallback (modul jalan sebelum woff2 tiba).
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => { if (phase === 'idle') render(ctx, 0); });
  }
})();

// Mode embed: dengarkan sfa-config dari parent, lalu beri tahu parent
// bahwa iframe siap (parent membalas dengan sfa-config).
window.addEventListener('message', onEmbedMessage);
if (window.parent !== window) {
  try { window.parent.postMessage({ type: 'sfa-ready' }, '*'); } catch (e) { /* abaikan */ }
}
