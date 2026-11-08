# Fight Engine — catatan sinkronisasi (vendor snapshot)

**Sumber:** Stickman Fight Arena (`~/workspace/stickman-fight-app/`, live
`https://stickman-fight-arena-zeta.vercel.app/`).
**Versi engine:** arena app v2 (`window.__fightApp.version === 2`),
kontrak embed v1 (`EMBED-CONTRACT.md`).
**Disalin:** 2026-11-07 (Fase 1 integrasi game Hub); **disalin ulang 2026-11-08**
(perubahan Agen A: jarak gelud + lotere hasil baru — lihat bawah);
**disalin ulang 2026-11-08 (Agen F: perbaikan `buildPositions` — lihat bawah).**
**Checksum md5 saat penyalinan** (verifikasi dengan `md5sum`):

| File | md5 |
|---|---|
| `fight.js` | `25d53a66cea4c2aa5382aa0163359b42` |
| `moves.js` | `e51b601c00717a6cd88ef6ae2546d447` |
| `techniques.js` | `88b100f78635920e4f0e663eb8c90f38` |
| `damage.js` | `8675ae2d39794709d945d385a3ee00e8` |

## Perubahan 2026-11-08 (Agen A — jarak gelud + lotere hasil)

- **Lotere gabungan (metode, pemenang):** Decision R 30% / Decision B 30% /
  KO R 15% / KO B 15% / Draw 10% (dulu KO 35% / decision 65%, tanpa draw).
  Menang R vs B tetap 50/50 (45/45 + 10 draw). Draw = `result: 'draw'`,
  `winner: null`, HP akhir sama persis. `forcedResult` tetap ko/decision
  saja (draw tidak bisa dipaksa). Terukur 2000 seed: 30,9 / 29,5 / 16,2 /
  13,5 / 9,9%.
- **Jarak gelud (dari engine):** `buildFight` mengeluarkan `fight.positions`
  (sampel 30fps: xR/xB/gap/fase) + `fight.spacing` (jarak jaga 250px ≈ 1,5
  panjang badan 166px; lunge hanya saat menyerang). Diteruskan lewat
  `sceneCfg.positions` / `sceneCfg.spacing`. Terukur 10 seed: jarak guard
  mean 213,3px median 230,0px (dulu ~69/62px); gap impact median 90px.
- **PERHATIAN — catatan lama, SUDAH TIDAK BERLAKU (diperiksa Agen F
  2026-11-08):** `verify.ts` ternyata SUDAH diperbarui — `expectedResult`
  memetakan draw dengan `fight.result === 'draw' || (decision + HP sama)`,
  jadi laporan klien `method: 'draw'` dari lotere baru terverifikasi
  dengan benar (bukan `method_mismatch`). Tidak ada yang perlu diubah di
  `verify.ts`. Catatan lama di bawah ini disimpan sebagai riwayat.
- **PERHATIAN — `verify.ts` belum diperbarui (di luar scope Agen A):**
  `expectedResult` memetakan method dari `fight.result === 'ko' ? 'KO' :
  isDraw ? 'draw' : 'decision'` dengan `isDraw` mensyaratkan
  `result === 'decision'` + HP sama. Dengan `result: 'draw'` baru,
  method yang diharapkan jadi `'decision'` (bukan `'draw'`) sehingga
  laporan klien `method: 'draw'` akan `method_mismatch` → `disputed`.
  Perbaikan satu baris di `verify.ts`: `fight.result === 'draw' ||
  isDraw` sebagai syarat draw. Sampai itu diperbaiki, fight draw hasil
  undian baru TIDAK akan terverifikasi (winner/score/stats-nya sudah
  benar — hanya method yang salah petakan).

## Perubahan 2026-11-08 (Agen F — perbaikan `buildPositions`)

Hanya `fight.js` yang berubah (hasil `buildFight` — winner/method/
score/koTime — TIDAK berubah; `buildPositions` murni posisi, tanpa rng):

- **Kontak §5 hijau penuh (arena 68/68, dulu 63/68):** approach serangan
  berikut diprioritaskan atas kembali-ke-jaga; strike hold 0,05 dtk
  sesudah impact (cek kontak di t+0,02 mengukur penyerang yang masih di
  jarak serang); dodge defender selama windup (sidestep 320, slip/duck/
  roll 200, flinch 150 px/dtk) — kecuali serangan ke kaki (lowkick):
  lutut hidup hanya bergerak ~1/2 kecepatan badan dan dodge 200px/dtk
  justru menaruh lutut di jalur kaki (dLive 12-14px), jadi dodge kaki
  20px/dtk (geser bobot; dLive 26-42px, 0 gagal lowkick/slip di sweep
  20 seed acak); hantu ditangkap saat serangan pertama aktif di sim
  (bukan saat windup mulai); latch anti-osilasi saat ambil kayu +
  latch kayu 1,0 dtk (bukan 0,9 — gerbang sim 0,9 gagal karena akumulasi
  `s += 1/30` menghasilkan 15,899999999999954 < 15,9; tanpa margin ini
  sim tidak mengambil kayu dan block pertama sesudahnya gagal dHand 49).
- **Jarak guard pulih:** `RETURN_SPEED` 200 → 250 px/dtk per sisi dan
  `PRE_APPROACH` 0,45 → 0,30 dtk. Terukur 10 seed: guard mean 204,8px
  median 216,7px (target mean ≥190 / median ≥200); gap impact median
  95px. (RETURN 300 dan PRE_APPROACH 0,20 dicoba dan ditolak: 300
  merusak ambil kayu, 0,20 menggagalkan §5.)
- **Sisa di luar ambang (sweep 20 seed, 30/1407 = 2,1%):**
  lowkick/block 17× — tangan block 49,3px dari titik block (titik block
  kaki 114,7px dari bahu, lengan cuma 66px; batas geometri pose sim,
  TIDAK bisa diperbaiki dari timeline — butuh perubahan pose film.js);
  13 kasus tebar (hit/parry/shove) masing-masing 1-3×, ambang tipis.
  Seed tes arena (123456) 0 gagal; seed 982809 1 gagal (lowkick/block).
- **Draw di `sfa-result` (arena `app.js`, bukan file ini):** lotere draw
  kini terkirim sebagai `method: 'draw'`, `winner: null` (dulu lolos
  sebagai `'decision'`). `verify.ts` Hub sudah menanganinya (lihat
  catatan di atas) — tidak ada perubahan verifikasi yang dibutuhkan.

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
