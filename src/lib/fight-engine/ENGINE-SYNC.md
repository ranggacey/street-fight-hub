# Fight Engine — catatan sinkronisasi (vendor snapshot)

**Sumber:** Stickman Fight Arena (`~/workspace/stickman-fight-app/`, live
`https://stickman-fight-arena-zeta.vercel.app/`).
**Versi engine:** arena app v2 (`window.__fightApp.version === 2`),
kontrak embed v1 (`EMBED-CONTRACT.md`).
**Disalin:** 2026-11-07 (Fase 1 integrasi game Hub).
**Checksum md5 saat penyalinan** (verifikasi dengan `md5sum`):

| File | md5 |
|---|---|
| `fight.js` | `b05d9ceedc6ae250db36bc0123bd01e5` |
| `moves.js` | `e51b601c00717a6cd88ef6ae2546d447` |
| `techniques.js` | `88b100f78635920e4f0e663eb8c90f38` |
| `damage.js` | `8675ae2d39794709d945d385a3ee00e8` |

## Aturan

- **JANGAN EDIT file `.js` di folder ini.** File-file ini adalah salinan
  verbatim dari arena app. Kalau arena app berubah, salin ulang keempat
  file sekaligus + perbarui tabel md5 + tanggal di atas.
- Keempat file adalah modul ESM murni (tanpa DOM/`window`/`localStorage`)
  sehingga bisa diimpor di Node (vitest + Route Handler Next.js) untuk
  **verifikasi hasil fight di server** (`src/lib/game/verify.ts`).
- `fight.js` mengimpor `windupDurOf` dari `techniques.js` tapi tidak
  memakainya di `buildFight` — impor tetap harus bisa resolve, jadi
  `techniques.js` wajib ikut disalin meski yang dipakai verifikasi hanya
  `buildFight`/`fightStats`/`keyMoments`.
- **Risiko drift:** kalau arena app live di-deploy dari kode yang lebih
  baru dari snapshot ini, hasil `buildFight` bisa berbeda dan verifikasi
  server akan menandai fight sebagai `disputed`. Kalau itu terjadi,
  sinkronkan ulang folder ini dari arena app terbaru (bukan melonggarkan
  verifikasi).

## Yang dipakai Hub dari engine ini

- `buildFight(left, right, duration, seed, opts)` — jalankan ulang fight
  dari seed + config tersimpan (verifikasi server + replay Fase 2).
- `fightStats(fight)` / `keyMoments(fight)` — statistik + momen kunci
  otoritatif versi server.
- `STYLES` / `movesFor(fighter)` / `normalizeStyle(style)` — daftar gerakan
  per gaya (dipakai validasi `signatureMove` + picker di form fighter).
- `DMG_BASE` / `BLOCK_CHIP` (`damage.js`) — konstanta damage (satu sumber).
