// voice.js — Suara komentator: KLIP REKAMAN TTS (bukan Web Speech API).
//
// Aturan user 2026-11-07 ~20:32: Web Speech API DITOLAK (di HP suaranya
// cewek, di laptop cowok, aksen Inggris, ngomong patah-patah) — jangan
// tuning voice/pitch/rate. Gantinya rekaman dari pipeline TTS yang sama
// dengan video Night Fight (night-fight-5/gen_vo.py):
//   Komentator 1 (energik, kuning) = Rushing Jetty
//     (avocado_v2:vg_id_m31)
//   Komentator 2 (energik, cyan)   = Vibrant Boulder
//     (avocado_v2:vg_id_m44) — ganti dari Musing Mirror 2026-11-08:
//     Musing Mirror kalem/lembut sehingga terdengar dingin/cuek;
//     Vibrant Boulder ceria + hangat, diukur A/B lebih lantang + cepat.
//   --language id, speed 100 (natural; 110 terlalu cepat).
//   Gain komentator 1.1x (keluhan "kekecilan").
//   Jeda minimum 0.25 dtk antar baris: baris baru TIDAK memotong baris yang
//   sedang berbunyi di tengah kata (itu yang bikin terdengar diburu-buru) —
//   melainkan antre tepat setelah baris sebelumnya selesai + jeda; kalau
//   antreannya lebih dari 0.6 dtk, baris dilewati (sudah basi, teks tetap tampil).
// Klip digenerate scripts/gen_vo.mjs -> audio/vo/*.mp3, peta id->file di
// js/vo-manifest.js. Teks audio TIDAK pernah memuat nama petarung.
// Pemutaran lewat WebAudio, di-route ke sfx.master (SFX) — master terhubung
// ke ctx.destination DAN MediaStreamDestination, jadi suara komentator IKUT
// terekam export video (berbeda dengan Web Speech API dulu yang tidak bisa).
// Modul ini TIDAK mengandung referensi ke API suara bawaan browser apa pun.
// Guard total: tanpa AudioContext (Node, browser tanpa WebAudio), semua
// method jadi no-op aman, tidak pernah throw — app tetap jalan, mulut
// komentator memakai heuristik 2.5 detik per baris seperti sebelumnya.
// Jangan bicara saat load halaman: speak() hanya dipanggil dari updatePBP
// saat fight berjalan; unlock() (resume) hanya dari handler gestur
// (klik tombol Tarung) — sesuai kebijakan autoplay browser.
import { VO_CLIPS, VO_META } from './vo-manifest.js';

export const VOICE_LANG = 'id-ID';
export const MUTE_LS_KEY = 'sfa-voice-muted';
// Gain suara komentator (1.359; keluhan "kekecilan" 2026-11-08).
// Mix audio Tugas 3 (2026-11-09): SFX dikurangi 15% (master 0.9 -> 0.765),
// komentator harus naik TEPAT +5% efektif. Komentator juga lewat master SFX,
// jadi 1.359 x 0.765 = 1.0395 vs 1.1 x 0.9 = 0.99 sebelumnya = +5%.
// Nilai 1.155 SALAH (1.155 x 0.765 = 0.884 = ~11% LEBIH PELAN).
// No-clipping terukur: VO peak tertinggi -1.9 dB -> -1.57 dBFS.
export const VOICE_GAIN = 1.359;
// Jeda minimum antar baris PBP (detik) + antrean maksimum sebelum baris dilewati.
export const VO_MIN_GAP_S = 0.25;
export const VO_MAX_QUEUE_DELAY_S = 0.6;

// Dua suara rekaman (nama voice TTS + id, untuk dokumentasi/debug).
export const VOICES = {
  c1: { name: 'Rushing Jetty', id: 'avocado_v2:vg_id_m31', tone: 'energik' },
  c2: { name: 'Vibrant Boulder', id: 'avocado_v2:vg_id_m44', tone: 'energik' },
};

export function createVoice(opts = {}) {
  const storage = opts.storage !== undefined
    ? opts.storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  const mutedKey = opts.mutedKey || MUTE_LS_KEY;

  let muted = false;
  try {
    muted = storage ? storage.getItem(mutedKey) === '1' : false;
  } catch (e) { /* abaikan, pakai default nyala */ }

  let sfx = null; // { ctx, master } dari SFX, dipasang via attach()
  const buffers = new Map(); // clipId -> AudioBuffer (cache)
  let current = []; // BufferSource yang sedang dijadwalkan/berbunyi
  let speaking = false;
  let speakToken = 0;
  let onEndCb = null;
  // Waktu ctx saat audio yang sudah dijadwalkan selesai (untuk antrean
  // jeda minimum — lihat speak()). 0 = tidak ada yang dijadwalkan.
  let busyUntil = 0;

  // Pasang sumber audio (dipanggil app.js setelah sfx.init()).
  function attach(s) {
    sfx = s && s.ctx && s.master ? s : null;
  }

  // Bundle VO: 682 klip dikemas jadi SATU JSON (audio/vo-bundle.json:
  // id klip -> base64). File mp3 tidak bisa di-push langsung via GitHub
  // API (create_or_update_file double-encode base64 -> file jadi teks),
  // dan 682 file tidak praktis dipush satu per satu. Bundle di-fetch
  // sekali (lazy, saat klip pertama diminta), lalu di-decode per klip.
  // Isi suara TIDAK berubah — hanya cara pengemasannya.
  let bundlePromise = null;
  function getBundle() {
    if (!bundlePromise) {
      bundlePromise = (async () => {
        try {
          const res = await fetch('audio/vo-bundle.json');
          if (!res.ok) return null;
          return await res.json();
        } catch (e) {
          if (typeof console !== 'undefined') console.warn('[voice] gagal muat bundle VO', e);
          return null;
        }
      })();
    }
    return bundlePromise;
  }

  async function loadClip(id) {
    if (buffers.has(id)) return buffers.get(id);
    const url = VO_CLIPS[id];
    if (!url || !sfx?.ctx || typeof fetch === 'undefined') return null;
    try {
      const bundle = await getBundle();
      const b64 = bundle && bundle[id];
      if (!b64) return null;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const dec = await sfx.ctx.decodeAudioData(bytes.buffer);
      buffers.set(id, dec);
      return dec;
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[voice] gagal muat klip', id, e);
      return null;
    }
  }

  // Preload klip yang akan dipakai fight ini (dipanggil startFight setelah
  // pbpLines digenerate) supaya tidak ada jeda saat baris berganti.
  async function prepare(clipIds) {
    if (!sfx?.ctx) return;
    const ids = [...new Set((clipIds || []).flat().filter((id) => VO_CLIPS[id]))];
    await Promise.all(ids.map((id) => loadClip(id)));
  }

  function stopCurrent() {
    speakToken++;
    for (const s of current) { try { s.stop(); } catch (e) { /* sudah berhenti */ } }
    current = [];
    speaking = false;
    busyUntil = 0;
  }

  function cancel() { stopCurrent(); }

  // Dipanggil dari handler gestur (klik Tarung): membuka kunci autoplay.
  function unlock() {
    if (!sfx?.ctx) return;
    try {
      if (sfx.ctx.state === 'suspended') sfx.ctx.resume().catch(() => {});
    } catch (e) { /* abaikan */ }
  }

  // Putar klip untuk satu baris PBP. clipIds = daftar id dari line.clips
  // (commentary.js); klip yang diblock diputar berurutan (seruan + "Tapi
  // diblock!"). Teks (argumen pertama) hanya untuk kompatibilitas pemanggil
  // — audio SELALU dari klip, tidak pernah dari teks. Mengembalikan true
  // kalau ada klip yang dijadwalkan.
  // JEDA ANTAR BARIS (2026-11-08): baris baru TIDAK memotong baris yang
  // sedang berbunyi — ia dijadwalkan mulai setelah baris sebelumnya selesai
  // + VO_MIN_GAP_S. Slot waktu dicadangkan SINKRON dari durasi klip di
  // VO_META (supaya dua speak() berurutan tidak tumpang tindih walau
  // loadClip masih async). Kalau antreannya lebih dari
  // VO_MAX_QUEUE_DELAY_S, baris dilewati saja (false) — sudah basi, dan
  // memotong kata di tengah kalimat lebih buruk daripada diam satu baris.
  function speak(text, who, clipIds) {
    if (muted || !sfx?.ctx || !sfx?.master) return false;
    const ids = (Array.isArray(clipIds) ? clipIds : []).filter((id) => VO_CLIPS[id]);
    if (ids.length === 0) return false;
    unlock();
    const now = sfx.ctx.currentTime;
    const startAt = Math.max(now + 0.02, busyUntil + VO_MIN_GAP_S);
    if (startAt - now > VO_MAX_QUEUE_DELAY_S) return false;
    // Cadangkan slot: durasi dari VO_META (fallback 0.7 dtk per klip).
    const totalDur = ids.reduce((a, id) => a + (VO_META[id]?.dur ?? 0.7), 0);
    busyUntil = startAt + totalDur;
    const token = speakToken;
    let when = startAt;
    let started = 0;
    (async () => {
      for (const id of ids) {
        if (token !== speakToken || muted) return;
        const buf = await loadClip(id);
        if (token !== speakToken || muted || !buf) continue;
        const src = sfx.ctx.createBufferSource();
        src.buffer = buf;
        const g = sfx.ctx.createGain();
        g.gain.value = VOICE_GAIN;
        src.connect(g);
        g.connect(sfx.master);
        const srcStart = Math.max(when, sfx.ctx.currentTime + 0.01);
        try { src.start(srcStart); } catch (e) { continue; }
        started++;
        speaking = true;
        current.push(src);
        when = srcStart + buf.duration;
        src.onended = () => {
          current = current.filter((s) => s !== src);
          if (current.length === 0) {
            speaking = false;
            if (onEndCb) onEndCb();
          }
        };
      }
      if (started === 0) speaking = false;
    })();
    return true;
  }

  function setMuted(m) {
    muted = !!m;
    if (muted) cancel();
    try { if (storage) storage.setItem(mutedKey, muted ? '1' : '0'); } catch (e) { /* abaikan */ }
    return muted;
  }

  return {
    speak,
    cancel,
    unlock,
    attach,
    prepare,
    setMuted,
    isMuted: () => muted,
    // True selama klip sedang berbunyi (flag dari event onended).
    isSpeaking: () => speaking,
    // Info suara (null kalau audio belum dipasang — mis. di Node).
    getVoice: () => (sfx ? { name: 'Rushing Jetty + Vibrant Boulder (klip rekaman)', lang: VOICE_LANG } : null),
    // Daftar id klip yang dikenal (untuk tes cakupan).
    clipIds: () => Object.keys(VO_CLIPS),
    hasClip: (id) => !!VO_CLIPS[id],
    // Callback opsional saat ucapan selesai.
    onEnd(cb) { onEndCb = typeof cb === 'function' ? cb : null; },
    // Audio terpasang atau tidak (dipakai app untuk memilih strategi mulut).
    isAvailable: () => !!sfx?.ctx,
  };
}
