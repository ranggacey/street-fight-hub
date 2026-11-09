# Stickman Fight Arena — di dalam Hub (same-origin)

Arena tarung (mesin stickman + builder + komentator) yang dulu aplikasi
Vercel terpisah (`stickman-fight-arena-zeta.vercel.app`, di-embed Hub via
iframe cross-origin) kini tinggal di repo Hub ini, disajikan same-origin
dari `https://streetfight.ranggafigo.com/arena/index.html`.

## Struktur

- `index.html` — halaman arena (di-embed Hub sebagai iframe).
- `styles.css` — gaya arena (font dari `fonts/`, lihat catatan binari).
- `js/` — seluruh mesin: `app.js` (embed + UI), `fight.js` (director),
  `film.js` (render + pose; berisi fix knockdown bodyRot — petarung jatuh
  terbaring, kepala ~52px di atas lantai, bukan 174px), `moves.js`,
  `techniques.js`, `damage.js`, `scenes.js`, `commentary.js`,
  `commentators.js`, `poster.js`, `presets.js`, `palette.js`,
  `accessories.js`, `sfx.js`, `voice.js`, `vo-manifest.js`.
- `audio/vo/durations.json` — durasi klip VO (untuk audit; klip mp3-nya
  belum ikut di repo — lihat bawah).
- `EMBED-CONTRACT.md` — kontrak embed Hub ↔ Arena (sfa-ready / sfa-config /
  sfa-result; origin = origin Hub sendiri).
- `ENGINE.md` — dokumentasi engine (catatan deploy lama di dalamnya masih
  menyebut domain Arena lama sebagai riwayat — bukan dependensi).

## Semua path relatif

Seluruh referensi aset di kode Arena bersifat relatif (`js/app.js`,
`styles.css`, `audio/...`, `fonts/...`) terhadap `index.html`, jadi
pemindahan ke subpath `/arena/` tidak butuh perubahan path. Satu-satunya
penyesuaian: origin postMessage kini same-origin (lihat `EMBED-CONTRACT.md`
§7 dan `src/components/GameArena.tsx`).

## Mix audio (Tugas 3, diterapkan saat konsolidasi 2026-11-09)

- `js/sfx.js`: master gain `0.9` → `0.765` (SFX x0,85).
- `js/voice.js`: `VOICE_GAIN` `1.1` → `1.359` (komentator juga lewat master
  SFX: 1.359 × 0.765 = 1.0395 vs 0.99 sebelumnya = tepat +5%; nilai 1.155
  akan membuat komentator ~11% LEBIH PELAN).
- No-clipping terukur: VO peak tertinggi -1.9 dB → -1.57 dBFS; SFX terkeras
  -0.8 dB → -3.1 dB.

## Status file binari (2026-11-09 — BELUM ikut di repo)

File binari TIDAK bisa di-push lewat GitHub API dalam jumlah besar
(`push_files` menolak binari; `create_or_update_file` satu file per call,
maks ~96KB). Inventaris lengkap ada di laporan Tugas 6. Ringkasnya:

- **Runtime-critical, belum ikut:** 682 klip VO (`audio/vo/*.mp3`, ~3,0 MB)
  + 19 SFX (`audio/*.wav|mp3`, ~843 KB) + 4 font woff2 (~81 KB).
  SFX dan font masing-masing <96KB (19 + 4 call `create_or_update_file`
  kalau diputuskan ikut); VO butuh 682 call — tidak praktis via API.
- **Tidak perlu ikut:** 16 file audio tak terpakai (~11,9 MB, WAV asli besar
  + varian alternatif; `sfx.js` sendiri mencatat WAV asli "tidak ikut
  deploy"), 33 PNG preview (~4,2 MB, tidak direferensikan kode runtime),
  `tests/smoke-export.webm` (8,5 MB, dev only).
- **Dampak sementara:** fight tetap jalan dan render penuh tanpa file
  audio (loader SFX/VO fail-soft: buffer hilang = senyap, tanpa error);
  komentator tetap tampil + mulut animasi pakai heuristik. Font jatuh ke
  fallback sistem sampai woff2 ikut.

## Yang TIDAK dipindah (tetap di workspace Arena lokal)

`research/`, `tests/`, `scripts/` (deploy/gen_vo/render-preview —
tooling deploy mandiri lama + riset) dan file preview. Suite tes engine
(`tests/run.mjs`, termasuk §33 verifikasi knockdown) tetap dijalankan
dari workspace lokal terhadap salinan kode ini saat verifikasi.
