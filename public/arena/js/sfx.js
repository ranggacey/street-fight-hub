// sfx.js — SFX pukulan anime via WebAudio.
// Resep (anime-sfx-research): whoosh dibesar-besarkan + impact/thud +
// SNAP sintetis di atasnya. Bukan thud mentah.
// Timeline fight sudah digenerate di depan, jadi semua SFX dijadwalkan di
// AudioContext clock: whoosh memuncak 0.03 dtk SEBELUM kontak, thud + snap
// TEPAT di kontak (standar CF2 §17).
// Audio juga di-route ke MediaStreamDestination agar export MediaRecorder
// menangkap suara yang sama dengan yang didengar.

const FILES = {
  whooshJab: 'audio/whoosh-jab-01.wav',
  whooshCross: 'audio/whoosh-cross-01.wav',
  whooshHook: 'audio/whoosh-hook-01.wav',
  whooshHeavy: 'audio/whoosh-heavy-01.mp3',
  whooshAnime: 'audio/whoosh-anime-01.wav',
  whooshDash: 'audio/whoosh-dash-01.wav',
  thudJab: 'audio/thud-jab-01.wav',
  thudCross: 'audio/thud-cross-01.wav',
  thudHook: 'audio/thud-hook-01.wav',
  thudHeavy: 'audio/thud-heavy-01.wav',
  snapSmall: 'audio/snap-synth-small.wav',
  snapMedium: 'audio/snap-synth-medium.wav',
  snapBig: 'audio/snap-synth-big.wav',
  snapAnime: 'audio/snap-anime-01.mp3',
  impactAnime: 'audio/impact-anime-01.mp3',
  blockTok: 'audio/block-tok-01.wav',
  boom: 'audio/boom-heavy-01.mp3',
  crowdBed: 'audio/crowd-arena-bed-01.mp3',
  crowdCheer: 'audio/crowd-cheer-ko-01.mp3',
};
// File besar (>88KB, tidak bisa di-upload via CLI arg 128KB) dikonversi ke MP3;
// WAV aslinya tetap di folder audio (tidak ikut deploy).

export class SFX {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.master = null;
    this.recDest = null;
    this.crowdSrc = null;
    this.ready = false;
  }

  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    // Mix audio Tugas 3 (2026-11-09): master SFX 0.9 -> 0.765 (x0,85).
    // Komentator (VOICE_GAIN 1.359 di voice.js) juga lewat master ini:
    // 1.359 x 0.765 = 1.0395 vs 0.99 sebelumnya = tepat +5%.
    // No-clipping terukur: SFX terkeras -0.8 dB -> -3.1 dB; VO peak -1.9 dB -> -1.57 dBFS.
    this.master.gain.value = 0.765;
    this.master.connect(this.ctx.destination);
    this.recDest = this.ctx.createMediaStreamDestination();
    this.master.connect(this.recDest);
    // Muat semua file secara paralel; gagal satu file tidak menggagalkan yang lain.
    await Promise.all(Object.entries(FILES).map(async ([key, url]) => {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        this.buffers[key] = await this.ctx.decodeAudioData(buf);
      } catch (e) {
        console.warn('[sfx] gagal muat', url, e);
      }
    }));
    this.ready = true;
  }

  get stream() { return this.recDest ? this.recDest.stream : null; }

  _play(bufKey, when, { gain = 1, rate = 1 } = {}) {
    const buf = this.buffers[bufKey];
    if (!buf || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g); g.connect(this.master);
    src.start(when);
  }

  // SNAP sintetis: burst osilator + noise, dibuat di kode (legal, tanpa file).
  _synthSnap(when, size = 'medium') {
    if (!this.ctx) return;
    const dur = size === 'big' ? 0.09 : size === 'small' ? 0.04 : 0.06;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(size === 'big' ? 320 : 520, when);
    osc.frequency.exponentialRampToValueAtTime(70, when + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(size === 'big' ? 0.5 : 0.35, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(when); osc.stop(when + dur + 0.02);
    // Noise click di atasnya.
    const len = Math.floor(this.ctx.sampleRate * 0.03);
    const noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const ng = this.ctx.createGain();
    ng.gain.value = size === 'big' ? 0.4 : 0.25;
    noise.connect(ng); ng.connect(this.master);
    noise.start(when);
  }

  // Satu pukulan: whoosh (puncak 0.03 dtk sebelum kontak) + thud + snap di kontak.
  _hit(when, power) {
    const heavy = power >= 0.9;
    const mid = power >= 0.65;
    const whoosh = heavy ? 'whooshAnime' : mid ? 'whooshHook' : 'whooshJab';
    const thud = heavy ? 'thudHeavy' : mid ? 'thudHook' : 'thudJab';
    const snap = heavy ? 'snapBig' : mid ? 'snapMedium' : 'snapSmall';
    // Whoosh 0.12 dtk, puncaknya di akhir → mulai 0.15 dtk sebelum kontak.
    this._play(whoosh, when - 0.15, { gain: heavy ? 1.0 : 0.8, rate: heavy ? 0.95 : 1.05 });
    this._play(thud, when, { gain: heavy ? 1.0 : 0.85 });
    this._play(snap, when, { gain: 0.8 });
    this._synthSnap(when, heavy ? 'big' : mid ? 'medium' : 'small');
    if (heavy) this._play('impactAnime', when, { gain: 0.7 });
  }

  _block(when) { this._play('blockTok', when, { gain: 0.9 }); }
  _boom(when) {
    this._play('boom', when, { gain: 1.0 });
    this._synthSnap(when, 'big');
  }
  _cheer(when) { this._play('crowdCheer', when, { gain: 0.8 }); }

  // Crowd bed loop selama fight.
  startCrowd(when) {
    const buf = this.buffers.crowdBed;
    if (!buf || !this.ctx || this.crowdSrc) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0.16;
    src.connect(g); g.connect(this.master);
    src.start(when);
    this.crowdSrc = src;
  }
  stopCrowd(when) {
    if (!this.crowdSrc) return;
    try { this.crowdSrc.stop(when); } catch (e) { /* sudah berhenti */ }
    this.crowdSrc = null;
  }

  // Jadwalkan seluruh SFX fight dari daftar event.
  // events: [{type:'hit'|'block'|'ko'|'bell'|'dash', t (detik sim), power}]
  // t0 = waktu AudioContext saat fight dimulai (sim t=0).
  schedule(events, t0) {
    if (!this.ctx) return;
    this.startCrowd(t0);
    for (const ev of events) {
      const when = t0 + ev.t;
      if (ev.type === 'hit') this._hit(when, ev.power ?? 0.7);
      else if (ev.type === 'block') this._block(when);
      else if (ev.type === 'ko') { this._boom(when); this._cheer(when + 0.15); }
      else if (ev.type === 'dash') this._play('whooshDash', when, { gain: 0.6 });
      else if (ev.type === 'bell') this._play('impactAnime', when, { gain: 0.5 });
    }
  }
}
