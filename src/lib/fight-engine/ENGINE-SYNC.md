# Fight Engine — catatan sinkronisasi (vendor snapshot)

**Sumber:** Stickman Fight Arena (`~/workspace/stickman-fight-app/`, live
`https://stickman-fight-arena-zeta.vercel.app/`).
**Versi engine:** arena app v2 (`window.__fightApp.version === 2`),
kontrak embed v1 (`EMBED-CONTRACT.md`).
**Disalin:** 2026-11-07 (Fase 1 integrasi game Hub); **disalin ulang 2026-11-08**
(perubahan Agen A: jarak gelud + lotere hasil baru — lihat bawah);
**disalin ulang 2026-11-08 (Agen F: perbaikan `buildPositions` — lihat bawah).**
**Disalin ulang 2026-11-08 (damage x0,25 + rate 80/10/10 + knockdown 10% +
clamp ring — lihat bawah).**
**Checksum md5 saat penyalinan** (verifikasi dengan `md5sum`):

| File | md5 |
|---|---|
| `fight.js` | `4b32072497a2fe712a8775ddc061c179` |
| `moves.js` | `543cb984757d51d816579b4c1e1ce93f` |
| `techniques.js` | `62618f9a409048d60f82be4ef7c728d2` |
| `damage.js` | `debb3b2ea36fbbe88cdd1ef8f9813533` |

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

## Perubahan 2026-11-08 (damage x0,25 + rate 80/10/10 + knockdown 10% + clamp ring)

- **Damage x0,25:** `DMG_BASE` semua kind dikali 0,25 (jab 2, cross 2,5,
  hook 3, uppercut 3,5, headkick 4,5, finisher 5, dst); `BLOCK_CHIP` 2
  jadi 0,5. `moves.js` disinkronkan ke `DMG_BASE` baru. HP tidak lagi
  hampir habis di detik 30-40 (terukur 300 fight: HP terendah mean 45
  di 30 dtk, 33 di 40 dtk — dulu 16 di 30 dtk).
- **Rate outcome:** `pickOutcome` jadi hit 80% / block 10% / dodge 10%
  (dulu 55/15/30). Terukur 300 fight: hit 73,5% / block 10,1% / dodge
  16,5% — dodge di atas target 10% karena steering penjamin hasil
  undian harus mengubah sebagian hit di akhir fight (lantai lunak +
  glancing, lihat bawah).
- **Lantai lunak (soft floor):** hit yang melewati lantai HP tidak lagi
  diubah jadi slip — power-nya diskala supaya damage tepat mendarat di
  lantai (pukulan tetap kena, hanya lebih pelan). Kalau defender sudah
  di lantai, hit jadi glancing blow (damage min = chip block 0,5,
  dibatasi supaya pemenang tetap unggul >= 1 dan pecundang >= 2).
  Ini yang menghilangkan zona mati (terukur: tiap jendela 10 dtk 7-8
  hit, dulu 0,14-0,39 di jendela 30-60 dtk).
- **Knockdown 10% per hit kena:** knockdown tengah fight (sekali per
  fight, 50%) dihapus; tiap hit yang kena mengundi knockdown 10%
  (diundi setelah steering). Terukur 4,7 knockdown/fight.
- **Finisher KO:** diekstrak ke helper + fallback pasca-loop (knockdown
  di akhir fight bisa melompati jendela finisher — dulu 6/97 KO tanpa
  finisher, pecundang hidup). Power finisher tanpa batas atas (damage =
  sisa HP pecundang persis). Terukur: KO pecundang hidup 0, guard
  decision 0.
- **Clamp ring:** `RING_X_MIN = 380`, `RING_X_MAX = 900` (baru, diekspor
  dari `fight.js`); posisi petarung di-clamp ke [380,900] (dulu
  [80,1200], melewati tali ring 330-950). Terukur 0,0% sampel di luar
  tali. Arena `film.js` juga men-clamp power visual finisher ke 2,2
  (bukan file engine — tidak disalin ke Hub; render Arena saja).
- **Lotere, pacing CF2, aturan gelar/rating TIDAK berubah.**

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
