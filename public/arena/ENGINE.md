# ENGINE.md — Peta file engine Stickman Fight Arena

Web app static (vanilla HTML/CSS/JS + Canvas 720x1280). Tidak ada backend.
Fighters di localStorage (`sfa-fighters-v1`). Deploy ke Vercel sebagai
project static.

## Peta file

| File | Isi |
|---|---|
| `index.html` | Shell tema game gelap: topbar, pemilih map (4 kartu), canvas arena, PBP ticker, kontrol (Tarung/Ulang/Export, seed — **tanpa pemilih durasi: match SELALU 60 detik**), builder 2 petarung, grid gerakan. |
| `styles.css` | Tema game fighting GELAP (bukan neobrutalist): charcoal hangat #0E0D0B, kaca gelap + tepi metal, aksen merah #E10600 + emas #EAB308, teks #F3EDE2; Teko 700 + Manrope (Anton tetap fallback); radius bervariasi; mobile-first, target sentuh ≥44px. `body.embed` menyembunyikan topbar/builder/map-picker/pengaturan/footer (mode embed Hub). |
| `js/techniques.js` | **PACING + KEYFRAME.** `TECHNIQUE_KEYS` (keyframe tiap gerakan, t relatif terhadap impact), `CF2_TIME_SCALE` (kompresi CF2 §17: jab 0,26 dtk, headkick 0,73 dtk), `windupDurOf`, `totalDurOf`, `techniquePose`, `mergePose`, `lerpPoseFull`. JANGAN ubah angka pacing tanpa ukur ulang (`npm test`). |
| `js/film.js` | **ANIMASI / RIG / SIM + GAMBAR.** Rig v3 + IK (`ik2`, `computeJoints`), sim inkremental (`createSim`/`advanceSim`/`getSim`/`resetSim` — BUKAN re-simulasi dari 0), `stepFighter` (mode guard/walk/attack/react/hit/falling/down/getup/pickup + IK kaki menapak), `triggerAttack`, `contactReport`/`slideReport`/`kneeReport` (cek otomatis), `render` + `drawArena`/`drawCrowd`/`drawFighter`/`drawHealthBar`/`drawFacecam`/`drawIntro`/`drawDecision`/`drawKOEnd`/`drawOutro`, `hpAt`/`hpDisplayAt`, `setMouth` (mulut komentator dari pemutaran klip audio). `DMG_BASE`/`BLOCK_CHIP` di-re-export dari `js/damage.js` (satu sumber). `normalizeGear(f)` (di-export, dipakai tes) — gear builder → bentuk gambar; warna lewat `fighterColors()` (lihat § "Custom karakter"); tongkat di tangan + di tepi ring memakai warna senjata pilihan user. Gambar badan v3 (redesign 2026-11-08, spec research/2026-11-08-stickman-redesign-spec.md): bahu 16/pinggul 14, torso quad 12->9 px, anggota badan tapered (paha 9/betis 7, lengan atas 8/bawah 6), kepala r16 + outline tinta lw6 di KEDUA petarung, mata r2.8 + alis + mulut, sendi r5.5/5/4.5 isi warna ruas TANPA cincin tinta (keputusan baru, menggantikan cincin §3.2 spec), leher trapesium berisi, glove boxing r17/big r20 + ibu jari r6 + manset kertas lebar (lebih besar dari kepala r16 — tidak tertukar saat clinch), sepatu elips 14x7 + sol 22x4 + outline tinta, celana tapered quad 11->8 px ujung butt; facecam r58 (dulu 54), komentator kepala r*0.40 + kapsul mic 0.42x0.28 headR. Glove mendekati hitam dirender warna petarung + manset putih (preset glove #141210 tetap hitam di data). Crowd v2: figur bahu/baju + kepala kulit + rambut/topi + lengan terangkat saat cheer (deterministik via hash01). Health bar v2: miring ala SF, gradient HP, chip damage, medali VS emas. Judul/intro/outro/juri/nama facecam/nama health bar memakai teks terang kalau map gelap (`getMapPalette(S.MAP).dark`). Label facecam: "Komentator 1" / "Komentator 2" (tanpa nama — aturan 2026-11-07 ~20:32). **Leg-return blend (2026-11-07 ~23:00):** saat tendangan/lutut berakhir, kaki blend kembali ke posisi menapak 0,2 dtk (`LEG_RETURN_DUR`, sstep) via `f.legReturn` + `f.lastAtkKind` di `stepFighter` — jangan hapus tanpa ukur ulang (MOTION-LOG §17). `isKick` di-export (dipakai tes §17). **Knockdown (2026-11-09, bug user "kena knockdown tetap berdiri"):** `computeJointsWithPose` kini menerapkan `f.bodyRot` — seluruh rangka dirotasi kaku mengelilingi titik pijakan (f.x, f.y) sehingga petarung benar-benar rebah ke lantai (kepala ~174px → ~52px di atas lantai) lalu bangkit; cabang pickup senjata TIDAK boleh membajak mode falling/down/getup (dulu bodyRot membeku 1,25 rad → petarung terbaring permanen) + jaring pengaman (bodyRot != 0 di luar mode jatuh → paksa 'getup'); tes §33 (7 tes: jatuh/bangkit/KO). |
| `js/scenes.js` | **SCENE (state fight).** Singleton `SCENE` + `buildScene(cfg)` (director mengisi ATTACKS/KNOCKDOWNS/CHEERS/RETREATS/CLINCHES/WEAPON/WINNER/RESULT/KO_T), `realTime`/`warp` (hit-stop: waktu nyata = sim + freeze), `HITSTOP_FRAMES`. **MAPS** (4 map: ring/gudang/jalanan/dojo — skin visual saja, geometri 720x1280 + GROUND_Y + posisi petarung TIDAK berubah); `SCENE.MAP` (id map aktif, default 'ring', diisi `buildScene` dari `cfg.map`). |
| `js/damage.js` | **KONSTANTA DAMAGE (satu sumber, modul murni tanpa DOM).** `DMG_BASE` (nilai PERSIS dari `film.js` lama — jangan ubah nilai) + `BLOCK_CHIP = 2`. Diimpor `fight.js`/`film.js`/`moves.js` (re-export). Dibutuhkan server Hub untuk verifikasi (`fight.js` bisa diimpor di Node tanpa DOM). |
| `js/fight.js` | **DIRECTOR.** `buildFight(left, right, duration, seed, opts = {})`: undian DULU (lotere gabungan 2026-11-08: Decision R 30% / Decision B 30% / KO R 15% / KO B 15% / Draw 10%; menang R vs B tetap 50/50), lalu koreografi + HP steering agar hasil undian bertahan; jeda kontak 0,55–0,75 dtk (tempo 'seimbang'); event ambil kayu; knockdown tengah fight; finisher KO. Draw: winner null, HP akhir disamakan persis (steering simetris lantai 12 + margin 12, lalu penyeimbang power). **JARAK (2026-11-08):** `buildFight` mengeluarkan timeline posisi `fight.positions` (sampel 30fps, `buildPositions`/`positionAt`/`idleGapStats`) — jarak jaga 250px ≈ 1,5 panjang badan (166px), lunge hanya saat menyerang (lihat § "Jarak gelud"); `sceneCfg.positions` + `sceneCfg.spacing` untuk film.js. `opts` (lihat § "Opts buildFight"): `weights` (bobot per kind, signatureMove = 2.5x), `tempo` (agresif/seimbang/bertahan — jeda memakai tempo penyerang), `forcedResult` (ganti undian ko/decision; draw tidak bisa dipaksa; rng tetap dikonsumsi dulu). `mulberry32` (PRNG seed), `fightSummary`, `fightStats(fight)` (akurasi/damage/thrown/landed/knockdowns; melekat sebagai `fight.stats`). Tanpa `opts` = fight identik dengan versi lama (tes §13). |
| `js/moves.js` | **MOVE LIBRARY.** `STYLES` — 13 gaya: tinju/muaythai/taekwondo/silat/gulat/brawler + baru Fase 1 Hub: kali, judo, kudo, jkd, karate, capoeira, wushu (lihat § "Gaya bela diri baru") — tiap gerakan kind/label/dmg/range/power/target/note; `movesFor(fighter)` (saring gerakan tongkat & finisher; menormalisasi style); `WEAPON_MOVES`, `FINISHER_KINDS`, `BLOCK_CHIP` (re-export dari `damage.js`), `STYLE_ALIASES` + `normalizeStyle()` (Hub-enum → engine-key; tak dikenal → `brawler`). **Warna per bagian:** `COLOR_DEFAULTS`, `fighterColors(f)` (baca `colors` + fallback legacy), `setFighterColors(f, colors)` (tulis `colors` + sinkron legacy) — lihat § "Custom karakter". Gulat TANPA pukulan/tendangan (Takedown, Suplex, Clinch, Dorongan, tongkat, Bantingan Berat — aturan user 2026-11-07). Judo juga lemparan saja. |
| `js/presets.js` | **PRESET PETARUNG.** 10 preset (Nopan, Neonimus + Gulat & `weapon.pickupAt: 15`, Asoka, Reyfan, Esje, Saky, Padlan, Pitung, Danukolor, Anoetheroong); `defaultFighters()` = Nopan vs Neonimus. Semua preset membawa `colors` (diisi dari warna legacy-nya saat modul dimuat). |
| `js/commentary.js` | **PBP.** `generatePBP(fight, windupDurOf, rng)` — seruan di awal windup (SATSET), filler anti-diam, 2 komentator **tanpa nama** (Komentator 1 = kuning/energik, Komentator 2 = cyan/kalem — aturan user 2026-11-07 ~20:32); `activeLine(lines, t)`. `CALLS` + `FILLERS` di-export (dipakai `scripts/gen_vo.mjs`). Setiap baris PBP membawa `clips` (ID klip audio yang diputar untuk baris itu); teks audio TIDAK PERNAH memuat nama petarung (nama/skor hanya teks di layar). |
| `js/voice.js` | **SUARA KOMENTATOR (klip rekaman TTS — BUKAN Web Speech API).** Web Speech API DITOLAK user 2026-11-07 ~20:32 (di HP suara cewek, di laptop cowok, aksen Inggris, ngomong patah-patah) — **jangan ada `speechSynthesis` di kode yang di-deploy** (dijaga tes §11). `createVoice({ storage })`: pemutar klip MP3 dari `VO_CLIPS` (`js/vo-manifest.js`) lewat WebAudio — dirutekan ke `sfx.master` (→ `MediaStreamDestination`) sehingga **suara ikut terekam export video**. API: `attach(sfx)`, `prepare(clipIds)`, `speak(text, who, clipIds)`, `cancel`, `unlock`, `setMuted`, `isMuted`, `isSpeaking` (flag dari event `onended` klip — mulut komentator sinkron dengan pemutaran klip), `getVoice` (mengembalikan info voice TTS C1/C2), `clipIds()`, `hasClip(id)`, `onEnd`. Tanpa AudioContext (mis. Node) semua method no-op. Mute persisten (`sfa-voice-muted`). Voice: C1 "Rushing Jetty" `avocado_v2:vg_id_m31`, C2 "Musing Mirror" `avocado_v2:vd2_r8_rep1k_0363_v068_28k_g5k`, bahasa Indonesia, speed 110. |
| `js/vo-manifest.js` | **MANIFEST KLIP (digenerate, jangan edit manual).** `VO_CLIPS` (id → path `audio/vo/*.mp3`) + `VO_META` (id → `{ src, dur, size, text, voice }`). Ditulis `scripts/gen_vo.mjs` dari `CALLS`/`FILLERS` di `commentary.js`. 248 klip (lihat § "Suara komentator"). |
| `audio/vo/` | 248 klip MP3 suara komentator (lihat § "Suara komentator"). Tiap file < 88KB. Didaftarkan di `scripts/deploy.mjs` secara DINAMIS (glob `audio/vo/*.mp3`) — jangan daftarkan satu-satu. |
| `js/sfx.js` | **SFX ANIME.** `SFX` (WebAudio): whoosh + thud + SNAP sintetis di kontak (whoosh puncak 0,03 dtk sebelum kontak), crowd bed loop, `schedule(events, t0)` (event dalam waktu NYATA), `stream` (MediaStreamDestination untuk export). File di `audio/` (29 WAV, disalin dari night-fight-4-v2). |
| `js/palette.js` | Token warna + `shade(hex)` (gelapkan warna petarung untuk sisi belakang). **MAP_OVERRIDES + `getMapPalette(mapId)`**: tiap map meng-override token permukaan arena saja (wall, concrete, rope, crowd, …) + flag `dark` (gudang/jalanan dark, ring/dojo terang). Warna petarung & kepala kertas TIDAK ikut palet map. |
| `js/app.js` | **UI + LOOP + EXPORT + MAP + VOICE + EMBED.** Builder (form per sisi, localStorage — lihat § "Custom karakter": warna RGB bebas per bagian + field hex, sabuk/ikat kepala bisa tidak ada, warna tongkat), preview guard-pose (leher + joint dots, glove hitam → warna petarung), grid gerakan, rAF loop (`render` + PBP DOM + `setMouth` + `voice.speak(line.text, line.who, line.clips)` saat baris PBP berganti), `startFight`/`endFight` (voice.cancel di keduanya; durasi SELALU 60 detik), `exportVideo` (MediaRecorder: `canvas.captureStream(30)` + `sfx.stream` → webm 720x1280; suara klip ikut terekam lewat `sfx.master`), map state (`loadMap`/`setMap`/`getMap`, localStorage `sfa-map-v1`, `renderIdle()` — setMap gambar ulang frame idle supaya map baru langsung terlihat), tombol mute suara (dibuat via JS), `window.__fightApp` (API otomatisasi: `startFight`, `exportVideo`, `getState`, `waitForEnd`, `setFighters(l, r, opts)` — `opts.persist=false` untuk embed, `setMap`, `getMap`, `voice`, `setVoiceMuted`, `version: 2`, `embed: { isEmbed, getFightId, sendResult }`). Mode embed postMessage: `EMBED_ALLOWED_ORIGINS` (Hub produksi + localhost:3000), `onEmbedMessage` (sfa-config), `sendEmbedResult` (sfa-result + keyMoments + poster ≤ 200KB), `buildPoster` — kontrak lengkap di `EMBED-CONTRACT.md`. |
| `EMBED-CONTRACT.md` | **Kontrak embed Hub** (sumber kebenaran untuk agen Hub): bentuk pesan sfa-ready/sfa-config/sfa-result, objek fighter, stats, origin yang diizinkan, tabel pemetaan Hub-enum → engine-key, contoh pemakaian parent. |
| `scripts/gen_vo.mjs` | Generate 248 klip suara dari `CALLS`/`FILLERS` (`commentary.js`) via `/opt/hatch/bin/tts speak` + trim hening ffmpeg; tulis `js/vo-manifest.js` + `audio/vo/durations.json`; skip file yang sudah ada; cek tiap file < 88KB. |
| `audio/` | 29 WAV SFX (whoosh/thud/snap/impact/crowd/boom/block-tok/riser/thunder). |
| `scripts/deploy.mjs` | Deploy Vercel (upload_file per file + create_deployment). **PENTING: tiap file js baru HARUS didaftarkan di array FILES** — file yang tidak terdaftar = 404 di live (kejadian 2026-11-07: `js/voice.js` sempat tidak terdaftar → app.js gagal import → app rusak live). **JANGAN ada duplikat di FILES** — duplikat = create_deployment 400 `invalid_files` (kejadian yang sama, dari edit yang menduplikasi baris). Klip suara `audio/vo/*.mp3` didaftarkan DINAMIS dari isi folder (glob + sort, tanpa duplikat) — 248 file terlalu banyak untuk didaftar manual. |
| `tests/run.mjs` | Unit test Node (lihat bawah). |
| `research/measure-motion.mjs` | Ukur smoothness (jerk/lompatan/snap) dari sekuens uji. |
| `research/MOTION-LOG.md` | Baseline smoothness terukur + ide improvement berikutnya. |
| `research/filmjs-adaptation-spec.md` | Spec ekstraksi film.js NF4 v2 → adaptasi web app. |

## Cara menjalankan tes

```bash
cd ~/workspace/stickman-fight-app
npm test                  # unit test: pacing, determinisme seed, HP steering,
                          # jeda kontak, hit-stop, kontak, lutut, slide, kayu, 60 dtk
node research/measure-motion.mjs   # smoothness baseline (jerk/lompatan/snap)
```

Keduanya harus HIJAU sebelum deploy. `npm test` keluar kode 1 kalau ada yang gagal.

## Aturan untuk cron improvement (tiap 5 jam)

1. Baca `research/MOTION-LOG.md` — ambil SATU ide improvement (saat ini:
   (f) lag ekor ikat kepala/ujung sabuk (secondary motion), smear ghost
   1 frame saat travel tercepat, hit-stop tuning (riset 2026-11-09
   ~15:00 — butuh baseline metrik (H) dulu, menyentuh pacing CF2 §17).
   SELESAI 2026-11-09 ~15:00: react ramp-in (§31) — (G) react maks
   42,64 → 28,21 px/frame, rata-rata 32,43 → 18,97, 0/10 transisi > 30.
   SELESAI 2026-11-09 ~20:00: camera shake trauma-based (§32) — (H)
   offset maks 2,87 px (cap 5), trauma maks 0,89, 4,4% frame
   ber-offset, 0 jauh dari impact, p95 lompatan offset 0,42 px/frame,
   tier ringan 0,27 / sedang 1,14 / berat 2,62 / knockdown 2,87 px;
   (A)/(B)/(D) TIDAK BERUBAH. **DEPLOY TERTAHAN 2026-11-09 ~20:00:
   create_deployment 403 Vercel (scope team
   `ranggacaisper-5228s-projects`, refresh tidak memulihkan;
   `authorize_team_access` tidak ada, `authorize-url` minta
   disconnect dulu) — deploy ulang setelah user re-otorisasi Vercel;
   kode + tes hijau, TIDAK di-revert; live masih versi 15:00.**
   SELESAI 2026-11-09 ~10:00: land-squash saat mendarat (§30) — bump
   lompatan jendela squash < 30; SELESAI 2026-11-09 ~05:00: ramp-in berskala power
   (§29) — berat frame-1 maks 62,50 → 44,83, frame-2 maks 39,32 → 29,30,
   ringan tak berubah; SELESAI 2026-11-09 ~00:30: return-step re-sync — (D)
   B.footB 32,16 → 24,07, SEMUA kaki < 30; SELESAI 2026-11-08 ~19:00:
   anticipation ramp-in — (E1) maks 42,43 → 28,16, rata-rata 25,05 →
   14,56, 0/28 onset > 30; SELESAI 2026-11-08 ~14:00: lerp sudut busur
   terpendek — (B) R.handF 78,61 → 23,77, SEMUA sendi < 30 px/frame;
   cap jarak langkah SELESAI 2026-11-08 ~09:00, (B) semua kaki < 30;
   easing langkah `easeOut` → `sstep` SELESAI 2026-11-08 ~04:00, (D)
   semua kaki < 30 px/frame; blend kaki tendangan SELESAI 2026-11-07
   ~23:00, R.footB 101,06 → 15,26).
2. Riset dulu (YouTube / referensi animasi) sebelum mengubah kode.
3. Ubah SATU hal, ukur sebelum/sesudah (`npm test` + `measure-motion.mjs`),
   tulis angka baru ke MOTION-LOG.md. Jangan klaim tanpa angka.
4. Jangan ubah pacing CF2 §17 (angka di `techniques.js`) tanpa mengukur
   ulang dan mencatat alasannya.
5. Jangan sentuh `~/workspace/stickman-fight-work/night-fight-5/` (video NF5)
   dan proyek Nusantara/Negara Emas.
6. Deploy hanya kalau tes hijau; kalau merah, revert tanpa deploy.
7. JANGAN rusakkan sistem v2 (2026-11-07 malam): tema gelap + 4 map +
   voice + crowd figur + badan ber-joint. Kalau menambah file js baru,
   DAFTARKAN di `scripts/deploy.mjs` FILES (tanpa duplikat) — lihat baris
   `scripts/deploy.mjs` di peta file untuk dua insiden 2026-11-07.
8. `npm test` saat ini: **561 tes hijau, 0 gagal** (2026-11-09 ~20:20 WIB,
   setelah perbaikan bug knockdown (user 19:50: "kena knockdown tetap
   berdiri"); §33 baru 7 tes. Sebelumnya 554 setelah camera shake cron
   20:00; §32 baru 12 tes. Sebelumnya 542
   setelah react ramp-in cron 15:00; §31 baru 6 tes. Sebelumnya 536
   setelah land-squash cron 10:00; §30 baru 7 tes. Sebelumnya 529
   setelah ramp-in berskala power cron 05:00; §29 baru 5 tes + §27
   diperbarui (jadwal frame ke-2 ringan / ke-3 berat). Sebelumnya 524
   setelah return-step re-sync cron 00:00; §28 baru 4 tes + ambang §17
   dikembalikan 35 → 30. Sebelumnya 520 setelah anticipation ramp-in
   cron 19:00; §27 baru 4 tes.
   Sebelumnya 516 setelah rebuild v3 + 14 kind baru Hub.)
   Angka itu harus naik/tetap, tidak boleh turun tanpa alasan tercatat.
9. **Komentator TANPA NAMA** (aturan user 2026-11-07 ~20:32): jangan pernah
   memberi nama komentator di kode/UI/dokumen. Bedakan hanya lewat warna
   (kuning = Komentator 1, cyan = Komentator 2) dan suara.
10. **Suara = klip rekaman, BUKAN Web Speech API** (ditolak user 2026-11-07
    ~20:32). Jangan kembalikan `speechSynthesis` dalam bentuk apa pun.
    Baris PBP baru WAJIB punya klip (tambah ke `CALLS`/`FILLERS` lalu jalankan
    `scripts/gen_vo.mjs`).
11. **Match web game SELALU 60 detik** (aturan 2026-11-07 ~20:32). Jangan
    kembalikan opsi durasi 30 detik ke UI. Ini HANYA web game — jangan ubah
    durasi video seri Night Fight.
12. **Aset gambar (preferensi user 2026-11-07 ~20:36):** kalau butuh gambar/
    ikon UI, generate saja (izin user) — **TANPA background (transparan,
    alpha)** supaya nyatu dengan UI gelap, format **WebP**, ukuran file kecil.
    Gaya tetap stickman konsisten dengan game, jangan kelihatan AI banget.
    (Poster pengumuman Hub dibuat terpisah dengan kode — jangan buat ulang
    di sini.)

## Prinsip yang dipegang engine

- Pacing CF2 §17 (`TEKNIK-BELADIRI.md`): jab 0,26 dtk, hit-stop total
  ~16 frame per fight pendek, jeda kontak 0,55–0,75 dtk, dash 0,6 dtk,
  tanpa slow-mo, smear + speed lines.
- Prinsip ChatGPT (`CHATGPT-ANIMATION-PRINCIPLES.md` + `CHATGPT-ENGINE-2026-11-07.md`):
  anticipation, follow-through, arcs, secondary motion, impact frames,
  kamera selektif, lutut satu arah, stance hampir lurus.
- Komentator (`KOMENTATOR.md`): PBP SATSET (panggil saat serangan
  dilancarkan), tidak boleh diam > 2 dtk saat fight.
- SFX anime: whoosh dibesar-besarkan + impact/thud + SNAP sintetis.
- Deterministik: seed yang sama = fight yang sama persis (PRNG mulberry32).

## Opts buildFight (director)

`buildFight(left, right, duration, seed, opts = {})` — `opts` kosong/tidak ada
= perilaku lama persis (tes §13 membandingkan serangan/HP/pemenang dengan
versi sebelum opts).

- `opts.weights: { R: { kind: bobot }, B: { kind: bobot } }` — pengali bobot
  saat memilih gerakan dari pool acak. Weighted pick deterministik (satu draw
  rng; bobot seragam = `pool[floor(rng()*len)]` lama). Jurus khas fighter
  (`fighter.signatureMove`) = bobot 2.5x kalau `opts.weights` untuk sisi itu
  tidak ada.
- `opts.tempo: { R: 'agresif'|'seimbang'|'bertahan', B: ... }` — `'seimbang'`
  = perilaku sekarang (jeda kontak 0.55–0.75 dtk). `'agresif'`: jeda 0.45–0.65
  dtk + gerakan power ≥ 0.9 berbobot ×1.5. `'bertahan'`: jeda 0.65–0.90 dtk +
  gerakan power < 0.7 berbobot ×1.5. Jeda memakai tempo penyerang saat itu
  (`by`). `tempo` juga dibaca dari `fighter.tempo` kalau `opts.tempo` tidak ada.
- `opts.forcedResult: { result: 'ko'|'decision', winner: 'R'|'B' } | null` —
  mengganti undian KO/decision + pemenang. Undian rng tetap dikonsumsi dulu
  lalu ditimpa (stream rng tetap sebanding). Nilai tidak valid diabaikan.
  Fase 1 Hub tidak memakainya (challenge = undian normal); titik ekstensi
  untuk gelar/turnamen.
- `fightStats(fight)` → `{ accuracyA, accuracyB, damageDealtA, damageDealtB,
  strikesThrownA, strikesThrownB, strikesLandedA, strikesLandedB, knockdowns }`.
  Akurasi = landed/thrown (feint tidak dihitung); damage dari rumus yang sama
  dengan `hpAt` (beda ≤ 1 dari `100 − HP lawan` karena block chip +2);
  knockdowns = `fight.knockdowns.length`. Melekat sebagai `fight.stats`.
- `keyMoments(fight)` → `{ biggestHit: { by: 'L'|'R', move, damage, timeSec },
  finisher: { by, move, timeSec } | null, knockdowns: [{ by, timeSec }],
  leadChange: { timeSec, by } | null }` — momen kunci untuk replay +
  breakdown Hub (dihitung dari timeline serangan, tanpa simulasi ulang;
  `by` L/R = kiri/kanan, berbeda dari R/B internal). `biggestHit` = hit
  damage terbesar (rumus `dmgOf`); `finisher` = serangan knockdown tepat di
  `koT` (null kalau decision); `knockdowns` = `by` penyerang yang menjatuhkan;
  `leadChange` = terakhir kali pemimpin skor berganti (null kalau pemenang
  memimpin dari awal). Melekat sebagai `fight.keyMoments`; dikirim di
  `sfa-result` (lihat `EMBED-CONTRACT.md` §8a–8b).

## Gaya bela diri baru (Fase 1 Hub, 2026-11-07)

Riset dari pencarian web 2026-11-07 (sumber diringkas di bawah; teknik
diverifikasi dari sumber publik, bukan dikarang). Pacing ikut CF2 §17
(tangan ×0.55, tendangan/lemparan ×0.6; jab 0,26 dtk, headkick 0,73 dtk).
Mekanik benar: lutut satu arah, stance hampir lurus. Tiap gaya baru ≥ 2 kind
benar-benar baru (keyframe di `techniques.js` + `CF2_TIME_SCALE` + `DMG_BASE`
+ dukungan `film.js` seperlunya); sisanya memakai kind lama dengan label khas.

| Gaya (engine key) | Teknik khas (kind baru) | Yang membedakan | Sumber |
|---|---|---|---|
| Kali Arnis (`kali`) | abaniko 8, sinawali 14, redonda 14 | Seni bela diri Filipina: serangan tongkat/pisau berputar (abaniko = kipas), pola silang dua tongkat (sinawali), sapuan melingkar (redonda), footwork segitiga | Riset web: sinawali/abaniko/redonda |
| Judo (`judo`) | seoinage 16, osotogari 16, uchimata 18 | Lemparan Kodokan (dari 67 nage-waza): seoi nage (lempar bahu), osoto gari (sapuan kaki luar besar), uchi mata (lempar paha dalam). **Lemparan saja** (seperti gulat: tanpa pukulan/tendangan) | Riset web: Kodokan 67 nage-waza |
| Kudo (`kudo`) | headbutt 12, yokogeri 14 | Daido Juku (Takashi Azuma, 1981): MMA Jepang dengan pelindung kepala — pukulan + tendangan + bantingan; sundulan kepala legal (beda dari karate/karate-do lain) | Riset web: Daido Juku, gyaku tsuki/mae geri/seoi nage/ashi barai |
| Jeet Kune Do (`jkd`) | straightlead 10, sidekick 16 | Bruce Lee: intercept (stop-hit) — pukulan lurus cepat dari stance (straight lead) + side kick sebagai senjata jarak; lima cara menyerang | Riset web: Bruce Lee, straight lead, side kick, interception |
| Karate (`karate`) | shuto 12, gyakuzuki 12, maegeri 12 | Gyaku-zuki (pukulan lurus tangan belakang), mawashi-geri, shuto-uchi (tebasan tangan pisau), mae-geri (tendangan depan lurus) | Riset web: gyaku-zuki/mawashi-geri/shuto-uchi/mae-geri |
| Capoeira (`capoeira`) | armada 18, meialua 16, queixada 14 | Brasil: ginga (ayunan dasar) + tendangan memutar (armada), meia lua de compasso (tendangan bulan sabit berputar), queixada (tendangan rahang) — gerak mengalir, banyak putaran | Riset web: ginga, armada, meia lua de compasso, queixada, martelo |
| Wushu (`wushu`) | tornadokick 20, butterflykick 18, lotuskick 16 | Kung Fu: tendangan akrobatik — xuanfengjiao (tendangan tornado), xuanzi (tendangan kupu-kupu), bailian (tendangan teratai) | Riset web: xuanfengjiao tornado, xuanzi butterfly, bailian lotus |

Pemetaan Hub-enum → engine-key: lihat `EMBED-CONTRACT.md` §5
(`kali-arnis`→`kali`, `jeet-kune-do`→`jkd`, `karate`→`karate` — **bukan**
taekwondo, `kung-fu`→`wushu`; tak dikenal → `brawler`).

Catatan kontak (diukur, bukan asumsi): kegagalan `contactReport` bersifat
pra-ada dan bergantung seed JUGA untuk gaya lama (tinju vs tinju seed 123456:
4 kegagalan feint; silat: blok sweep/lowkick + hit lowkick/knee; gulat:
shove/clinch). Blok target kaki gagal sistematis (`dHand` ≈ 49px — tangan
`blockPose` defender tetap di tinggi guard, titik blok di lutut). Karena itu
tes gaya baru menguji penyelesaian/determinisme/lutut/slide, bukan all-pass
kontak (lihat `tests/run.mjs` §14).

## Suara komentator (klip rekaman TTS)

Aturan user 2026-11-07 ~20:32: Web Speech API DITOLAK (di HP suara cewek, di
laptop cowok, aksen Inggris, ngomong patah-patah). Jangan tuning voice/pitch/
rate — gantinya rekaman TTS yang sama dengan video Night Fight.

- Voice (dari `night-fight-5/gen_vo.py`, bukan tebakan): C1 "Rushing Jetty"
  `avocado_v2:vg_id_m31`; C2 "Musing Mirror"
  `avocado_v2:vd2_r8_rep1k_0363_v068_28k_g5k`; `--language id --speed 110`.
- Pipeline: `/opt/hatch/bin/tts speak` + ffmpeg `silenceremove` trim hening.
  Generator: `scripts/gen_vo.mjs` (impor `CALLS`/`FILLERS` dari
  `commentary.js`, generate sekuensial, skip file yang sudah ada, tulis
  `js/vo-manifest.js` + `audio/vo/durations.json`, cek tiap file < 88KB).
- Skema klip: `c1/c2-<kind>-<n>` per varian CALLS (105 varian × 2 = 210),
  `<who>-filler-<n>` (22), klip tetap 16
  (`c1-intro-welcome`, `c2-intro-styles`, `c1-intro-ready`, `c1-pickup-wood`,
  `c2-pickup-weapon`, `c1/c2-knockdown`, `c1-ko-win`, `c2-ko-count`,
  `c1-end-bell`, `c2-decision-win`, `c1-outro-bye`, `c1/c2-blocked`,
  `c1/c2-masuk`). **Total 248 klip.** Setiap baris PBP membawa `clips`;
  serangan yang diblok memakai `[callClip, '<who>-blocked']`.
- Audio TIDAK PERNAH memuat nama petarung (nama/skor hanya teks di layar).
- Pemutaran: `js/voice.js` (clip player) lewat `sfx.master` → `MediaStreamDestination`
  sehingga **suara ikut terekam export video**. Mulut komentator sinkron
  dengan pemutaran klip (flag `isSpeaking` dari event `onended`).
- Cakupan dijaga tes `tests/run.mjs` §11: semua varian CALLS + FILLERS +
  klip tetap ada di manifest; semua klip yang dirujuk PBP 5 fight ada;
  semua klip < 88KB dan durasi > 0; tidak ada teks klip memuat nama petarung;
  tidak ada `speechSynthesis` dan tidak ada nama komentator di kode deploy.
- Quirk TTS (2026-11-07): backend `/opt/hatch/bin/tts` GAGAL deterministik
  (audio 26 byte kosong) untuk kata **"Siku"** ("Siku!", "Siku tajam!") dan
  **"Sinawali"** (dengan/tanpa tanda seru) — 6+ kali percobaan di 3 run.
  Padanan yang berhasil: "Sikut!", "Sikut tajam!", "Siku masuk!",
  "Tongkat berputar!". Karena itu teks CALLS `elbow` dan `sinawali` memakai
  padanan tersebut (label gerakan di `moves.js` tetap "Sinawali" — label
  bukan teks suara). Kalau nambah varian CALLS baru, uji dulu satu klipnya
  lewat `tts speak` sebelum generate massal.

## Mode embed (postMessage — Hub Fase 1)

Kontrak lengkap: `EMBED-CONTRACT.md` (sumber kebenaran agen Hub).

- Iframe kirim `{ type: 'sfa-ready' }` saat load; parent balas
  `{ type: 'sfa-config', fightId, fighters: { left, right }, seed, map, duration, opts? }`.
- Origin yang diizinkan (`EMBED_ALLOWED_ORIGINS` di `js/app.js`):
  `https://streetfight.ranggafigo.com` dan `http://localhost:3000` (dev).
  Pesan dari origin lain diabaikan.
- Saat config: `setFighters` (persist: false — petarung Hub tidak menimpa
  localStorage user) + `setMap`, `body.embed` menyembunyikan builder/topbar,
  **TIDAK auto-start** (tombol Tarung tetap di iframe supaya gestur klik di
  origin iframe → klip suara + AudioContext diizinkan).
- Saat fight selesai: kirim `{ type: 'sfa-result', fightId, seed, winner,
  method, score: { a, b }, koTimeSec, stats, keyMoments, posterDataUrl }` ke parent
  (`embed.parentOrigin`). `keyMoments` = momen kunci replay/breakdown
  (biggestHit/finisher/knockdowns/leadChange — `by` L/R = kiri/kanan).
  Payload result ini adalah data replay Hub (seed + config tersimpan → fight
  identik diulang, tanpa simpan video) + breakdown "kenapa menang/kalah".
  Poster = frame akhir + overlay nama/skor/metode,
  JPEG; kualitas 0.85 → 0.7 → 0.6 sampai ≤ 200KB; kalau tetap lewat,
  `posterDataUrl` = `null` (hasil tetap dikirim).
- `window.__fightApp.embed = { isEmbed, getFightId, sendResult }`.
  API lama (`startFight`, `exportVideo`, `getState`, `waitForEnd`,
  `setFighters`, `setMap`, `getMap`, `voice`, `setVoiceMuted`) TIDAK berubah.
- Uji embed: `tests/run.mjs` §15 (tripwire statis) + uji Playwright lokal
  (iframe + sfa-config → klik Tarung → tunggu sfa-result).

## Durasi match: 60 detik saja

Aturan user 2026-11-07 ~20:32 — **match web game SEMUANYA 60 detik**:
default 60, opsi 30 detik dihapus dari UI (`index.html`/`app.js`), `SCENE.DURATION`
default 60, `tests/run.mjs` memakai `DURATION = 60`. Ini HANYA web game —
JANGAN ubah durasi video seri Night Fight. Kontrak embed ikut durasi 60
sebagai default. **Catatan baseline:** angka ukur MOTION-LOG lama diukur di
30 dtk — angka baru di 60 dtk akan berbeda (lebih banyak serangan per fight).

## Aset gambar

Preferensi user 2026-11-07 ~20:36 (berlaku untuk arena app + pekerjaan
berikutnya): kalau butuh gambar/ikon UI, generate saja (izin user) —
**TANPA background (transparan, alpha)**, format **WebP**, ukuran file kecil.
Gaya tetap stickman konsisten dengan game, jangan kelihatan AI banget.
Poster pengumuman Hub dibuat terpisah dengan kode — jangan buat ulang di sini.
Saat ini tidak ada gambar baru yang dibutuhkan (pemilih gaya berupa dropdown,
tanpa slot ikon), jadi belum ada yang di-generate.

## Custom karakter (warna per bagian, 2026-11-07 ~20:44)

Aturan user: custom sedalam mungkin + **warna RGB bebas (color picker, bukan
palet tetap)** supaya tiap user bisa beda-beda, tidak monoton.

**Opsi custom di builder** (per petarung, di `js/app.js` `buildFields`):
nama (teks, maks 18), warna **badan**, bela diri (13 gaya), sarung tangan
(jenis: tanpa/boxing/MMA/besar + warna), senjata (tidak ada / tongkat kayu +
warna tongkat + detik ambil), sepatu (model: sneakers/boots/barefoot + warna),
**sabuk** (warna bebas + checkbox "Tidak ada"), **ikat kepala** (warna bebas +
checkbox "Tidak ada"). Tiap warna = input `type=color` + field hex (ketik
manual, mis. `#C8102E`); CSS `.color-field` / `.hex-input` / `.field-row-opt`
di `styles.css`.

**Bentuk penyimpanan** (kanonik, `js/moves.js`):
```js
fighter.colors = {
  body: '#C8102E',     // garis tubuh (+ sendi, leher)
  gloves: '#141210',   // sarung tangan
  shoes: '#FBF8F1',    // sepatu
  belt: 'none',        // sabuk, atau "none" = tidak pakai
  headband: 'none',    // ikat kepala, atau "none" = tidak pakai
  weapon: '#8B5E34',   // tongkat kayu
};
```
- `fighterColors(f)` — baca warna dari fighter apa pun: `colors` (kalau ada)
  menang atas field legacy; fallback ke `color` / `gloves.color` /
  `shoes.color` / `belt.color` / `headband.color` / `weapon.color`; hex tidak
  valid → default (`COLOR_DEFAULTS`).
- `setFighterColors(f, colors)` — tulis `colors` + sinkronkan field legacy
  (`f.color`, `f.gloves.color`, dst.) supaya kode lama yang membaca field itu
  tetap benar. Dipakai builder, `loadFighters`, `setFighters`, embed, preset.
- **Kompatibilitas mundur:** fighter lama di localStorage `sfa-fighters-v1`
  (hanya `color` + warna legacy) tetap bisa dimuat — `loadFighters` mengisi
  `colors`-nya dari warna legacy saat dibaca; tidak ada migrasi manual.
- **Render** (`js/film.js` `normalizeGear`, di-export untuk tes): glove per
  tangan, sepatu, sabuk, ikat kepala, senjata `{kind, color}` — semuanya
  dibaca dari `fighterColors()`. Tongkat di tangan (setelah diambil) dan
  tongkat di tepi ring (sebelum diambil) memakai warna senjata yang sama.
  Shorts Muay Thai/brawler diturunkan dari warna badan (digelapkan 0.7).
  Preview builder (`drawPreview` di `app.js`) memakai `fighterColors()` yang
  sama, jadi yang terlihat di preview = yang tampil di arena.
- **Warna tidak mengubah determinisme:** satu seed + satu config (termasuk
  `colors`) = satu hasil yang sama (tes §16 membandingkan serangan fighter
  polos vs berwarna — identik). Poster + replay memakai objek fighter yang
  sama, jadi warnanya konsisten otomatis (lihat `EMBED-CONTRACT.md` §4).
- Yang BELUM ada (di luar tugas ini): tongkat Kali Arnis sejak detik 0 —
  senjata kayu saat ini selalu diambil di tengah fight (`pickupAt`, min 5
  dtk di builder). Kalau Kali mau pegang tongkat dari awal, perlu dukungan
  `pickupAt: 0` di director + builder. Aturan Hub "satu akun = satu fighter"
  (2026-11-07 ~20:45) adalah aturan akun Hub, bukan arena (arena tidak punya
  akun) — tidak diimplementasikan di sini.

## Steering HP (dua fase — diperketat 2026-11-07)

`buildFight` mengundi hasil DULU (lotere gabungan 2026-11-08: Decision R 30% /
Decision B 30% / KO R 15% / KO B 15% / Draw 10%; menang R vs B tetap 50/50),
lalu koreografi + HP steering agar hasil undian bertahan. Steering berjalan dalam
dua fase (batas: paruh durasi):

- **Fase 1 (paruh pertama): aturan LUNAK (seperti dulu).** Hit yang mengancam
  margin pemenang dilunakkan jadi block (chip 2); pecundang dilindungi di
  lantai 10 (decision) / 12 (KO). Di fase ini pecundang BOLEH memimpin —
  justru di sinilah "momen balik" (`keyMoments.leadChange`) terjadi.
- **Fase 2 (paruh kedua): aturan KERAS.** Block hanya kalau chip-nya masih
  menjaga margin ≥ 6 (decision) / HP pemenang ≥ 15 (KO); kalau tidak, jadi
  slip (0 damage). Lantai pecundang decision di fase 2 ADAPTIF:
  `max(1, min(10, HP pemenang − 6))` — kalau pemenang sudah sekarat, lantai
  10 akan mengunci margin negatif.
- **Lantai pemenang KO = 15 di KEDUA fase, untuk hit DAN block.** (Dulu hanya
  hit yang dicek — chip block lolos dan menolkan pemenang selama 60 dtk:
  5 hit + 11 block = 102 damage, seed 8/72.)

Bug yang ditemukan saat durasi jadi 60 dtk (2026-11-07, diukur di 200 seed):
tanpa fase keras, chip block 2 menumpuk → pemenang kalah HP → fix-up akhir
menolkan pecundang (fight decision 3–0 / 0–0). Setelah perbaikan: **200 seed
60 dtk: 0 invalid, fix-up akhir 0 kali, leadChange 131/200, KO pemenang 0 HP
0 kali.** Fix-up akhir (`hp[loser] = max(0, hp[winner]-4)` kalau pemenang
kalah HP) tetap ada sebagai jaring pengaman, tapi tidak pernah terpicu di
200 seed. Fight 30 dtk nyaris tak berubah (seed 1: serangan + HP identik
dengan versi lama; seed 123456: jenis serangan sama, HP 10–19 → 10–21).

## Jarak gelud (engine, 2026-11-08)

Dulu film.js menahan petarung di gap ~50–60px (guard hanya menjaga minimum
45px + clamp sim 50px) — dada-ke-dada di semua frame (video user seed 982809).
Sekarang jarak berasal dari ENGINE: `buildFight` mengeluarkan timeline posisi
`fight.positions` (1801 sampel @30fps untuk 60 dtk) + `fight.spacing`
(`bodyLenPx` 166, `guardGapPx` 250, `ringCenterX` 640), diteruskan lewat
`sceneCfg.positions` / `sceneCfg.spacing` untuk dibaca film.js. Ukur ulang:
`node scripts/measure-distance.mjs`.

- Panjang badan 166px (kepala di GROUND−166) → jarak jaga 250px ≈ 1,5 badan.
- Walk-in [0, 1 dtk] dari startX 440/840 ke posisi jaga di sekitar 640.
- Fase 'guard' (tidak menyerang): kembali simetris ke 250px (200px/dtk/sisi).
- Lunge: penyerang menutup ke jarak serang (`STRIKE_GAP_PX`, cermin
  `strikeRange()` film.js, 45–110px) mulai 0,45 dtk sebelum windup +
  selama windup, 450px/dtk (step-in eksplosif); kembali ke jarak jaga
  setelah impact. Clinch rapat 58px; ambil kayu jalan ke tepi ring;
  knockdown: korban diam, lawan mundur ke jarak jaga.
- Terukur (10 seed, Nopan vs Neonimus): guard mean 213,3px median 230,0px
  (sebelum: mean 69,3 median 61,9 dari sim film.js); gap saat impact mean
  92,0 median 90,0 p90 113,3. Pengecualian diketahui: serangan pertama
  tepat setelah ambil kayu bisa berdampak dari jauh (gap ~430px) — tidak
  ada waktu jalan kembali karena director menjadwalkannya tepat saat kayu
  selesai diambil; perbaikannya butuh ubah timing serangan.
- `buildPositions` murni (tanpa rng) — serangan/timing/pacing tidak berubah.

## Lotere draw (2026-11-08)

Draw = `result: 'draw'`, `winner: null`, HP akhir sama persis. Steering draw
simetris: lantai HP 12 (tidak ada yang KO) + selisih |hpR−hpB| ≤ 12
(batas 6 tidak bisa dipakai: lebih kecil dari damage jab terkecil 7,2 —
semua hit akan selalu dilunakkan; batas 12 memberi rata-rata 11,2 hit per
fight draw). Selisih sisa dibagi ke beberapa serangan terakhir
(penyesuaian power dalam [0.5, 2.2], utamakan hit) lalu HP dihitung ulang
dari attacks — jadi `fightStats`/`hpAt`/`keyMoments` tetap konsisten.
Terukur 2000 seed: draw 198 (9,9%), semuanya valid. `forcedResult` hanya
ko/decision (draw tidak bisa dipaksa; nilai 'draw' diabaikan).

## Redesign karakter + font Teko (2026-11-08)

Pemicu: user menilai gambar stickman "masih kurang bagus". Spec:
`research/2026-11-08-stickman-redesign-spec.md` (§6 kriteria terima),
font: `research/2026-11-08-font-display.md`. Gerakan/pacing/timing/engine
TIDAK disentuh — hanya gambar karakter + font display.

- **Petarung (film.js/accessories.js):** lihat "Gambar badan v3" di peta
  file di atas. Satu penyimpangan dari spec §3.2: sendi TIDAK diberi
  cincin tinta (semua 8 sendi, lw2) — implementasi mengisi sendi dengan
  warna ruasnya sendiri tanpa cincin, karena dot krem + cincin gelap
  terbaca seperti baut/rivet; dikunci tes §22 ("tanpa cincin tinta
  kontras").
- **Komentator (commentators.js §3.10):** kepala `r*0.40` (dulu 0.34),
  leher trapesium berisi (dulu 2 garis), mata `r*0.055`, alis lebih
  tebal + tilt K1 0.20/K2 0.06, mulut K1 faktor 1.0/K2 0.9 + senyum saat
  diam, pipi blush DIHAPUS, headband 0.28 headR, headset busur penuh
  `1.0π–2.0π`, ear cup 0.26 headR, kapsul mic 0.42×0.28 headR + grille.
  Facecam fight r58 di (296,1150)/(424,1150) (dulu r54).
- **Font display Teko 700** (variabel wght 300–700, `fonts/teko-var.woff2`
  15.420 byte, OFL): ganti Anton di poster (`poster.js` ANTON), film
  (semua string display + `fitFont` bobot eksplisit), `styles.css`
  (`--font-display`), `app.js` (`document.fonts.load('700 96px Teko')`).
  Manrope (label/body) tidak berubah. Anton tetap di fallback chain +
  file `fonts/anton-400.woff2` dipertahankan. Cadangan Barlow Condensed
  800 sudah diunduh (`fonts/barlow-condensed-800.woff2`) tapi TIDAK ikut
  deploy (tidak dipakai kode) — daftarkan dulu di `deploy.mjs` kalau
  dipakai.
- **Poster JPEG:** `buildPoster` tetap ≤ 200 KB — terukur di browser
  (poster KO 0–17, frame t=20): 0.85 → 107.102 byte, 0.7 → 80.090 byte,
  **0.6 → 70.649 byte**. Bahkan kualitas 0.85 lolos batas.
- **Tes:** `tests/run.mjs` §22 baru (26 checks): glove r17 > kepala r16,
  ibu jari r6, big r20, sendi isi warna ruas, outline kepala tinta lw6
  kedua petarung, komentator headR 0.40 + kapsul mic, Teko 700 di
  poster/film/CSS/app + deploy, jalur kualitas 0.6, cap langkah cron
  (capPx 50/55) tetap ada, facecam r58, determinisme gambar. Total
  **327/327 hijau**.
- **Deploy:** dpl_9V2w1Pss96QqC6Y2LGcfgpJtxbQK (production,
  stickman-fight-arena-zeta.vercel.app, 582 file), READY. Live
  terverifikasi per file (film.js/poster.js/app.js md5 identik dengan
  lokal; `fonts/teko-var.woff2` 200, 15.420 byte, font/woff2).
- **Preview v2** (root app): `poster-preview-v2.png`,
  `facecam-preview-v2.png`, `fight-frame-v2.png` (frame t=14.15, B shove).
  Catatan jujur: glove vs kepala kini jelas beda (manset putih + ibu
  jari); sepatu menapak + sol terbaca; wajah komentator dominan di r58
  dan K1/K2 langsung beda. Yang masih kurang: saat clinch dada-ke-dada,
  petarung belakang tetap sebagian besar tertutup (torso jadi garis
  vertikal) — itu pose, bukan gambar; label facecam "KOMENTATOR 1/2" di
  r58 hampir bersentuhan (jarak pusat 128 px, label ~108 px) — calon
  perbaikan kecil berikutnya. Preview lama (`poster-preview-new.png`,
  `facecam-preview-new.png`, 02:29) sudah memakai gambar redesign —
  jadi pembandingnya bukan pra-redesign.

## Rebuild v3: karakter joint-based + pose teknik (2026-11-08, verifikasi + iterasi + deploy)

Verifikasi + iterasi atas dua worker sebelumnya (karakter: `film.js` torso
poligon sendi + `accessories.js`; pose: `techniques.js` 48 kind, 10 titik
diperbaiki). Brief riset: `research/2026-11-08-movement-teknik.md`.
Engine BEKU — md5 tetap `fight.js 25d53a66…`, `moves.js e51b601c…`,
`damage.js 8675ae2d…`; pacing CF2, lotere, damage TIDAK disentuh.

- **Torso joint-based (film.js `drawFighter`):** torso = poligon sendi
  `hipF → hipB → shB → shF` (bukan quad tengah 9–12 px) — kaki/lengan
  berakar PERSIS di sudut poligon, celah melayang ~4–5 px hilang. Rasio
  lebar/panjang ~0,5 (bahu 32 / pinggul 28 vs panjang 62) — tegak, BUKAN
  kotak; dikunci tes §23c. Rim tinta = poligon sama diperluas 2 px.
- **Tes §23 baru (63 checks, total 396/396 hijau):** (a) konektivitas —
  panjang tiap ruas = kanonik rig (lengan 34/32, kaki 48/46, torso 62,
  leher 22, bahu 32/pinggul 28) di guard + 11 pose kunci, dan 8 dot sendi
  tergambar tepat di titik sendi (trace arc r5.5/5/4.5); clinch sim nyata
  — kedua petarung mode clinch, gap 58 px, tangan mencapai torso lawan
  (29–55 px). (b) keterbacaan — hook siku ~90° (b≈1,5) dari busur sampai
  impact; cross load hipRot/shRot positif → impact negatif + pivot 1,57;
  uppercut lengan bawah vertikal (a+b≈2,2) + DIP crouch 0,58;
  roundhouse/headkick chamber lutut terlipat (k≈−1,7/−1,8) → impact kaki
  lurus + turnover hipRot ≥0,8; takedown level change crouch 0,5 +
  shoot sway 14; seoi tsukuri hipRot 0,55 + lengan tarik; knee lutut
  tetap terlipat (k≤−1,7); elbow lengan bawah terlipat (b≥1,9); jab lurus
  vs hook siku 90°; clinch lengan menarik ke bawah. (c) regresi — label
  facecam 13 px (fitLabelPx 15→13 di batas 100 px, celah 28 px kanvas),
  Teko 700 tetap, cap langkah cron (capPx 50/55) tetap, poster JPEG
  jalur 0,85→0,7→0,6 tetap.
- **Overlay visual lemparan (film.js `throwOverlay` + `thrownPose`,
  RENDER-ONLY — sim tidak disentuh):** temuan QA — korban lemparan di sim
  tidak pernah terangkat (hanya POSE.hit), jadi seoi/takedown di frame
  impact terbaca seperti pukulan badan. Selama jendela kake (ph −0,05..
  0,30) korban digambar terangkat (lift 0→55 px, puncak ph 0,2) +
  melengkung di atas bahu penyerang (`over`: seoinage/osotogari/uchimata;
  `lift`: takedown, badan terbalik lean 0,85) dan digambar SETELAH
  penyerang (di depan). Dikunci tes §23d (overlay null di luar jendela,
  varian + lift terukur, render smoke di tengah seoi). Frame preview
  lemparan diambil di ph +0,15 (puncak overlay), bukan di impact.
- **drawPreview (app.js) diseragamkan:** torso preview dulu garis tipis
  6 px → kini quad berisi (pinggul 12 px → bahu 15 px), ujung-ujung
  tetap titik akar kaki/tangan; diverifikasi lewat screenshot halaman
  (builder Nopan/Neonimus). Tes tetap 396 hijau.
- **Perangkap render preview (script /tmp/render-v3.mjs, BUKAN deploy):**
  `render(INTRO + atk.t)` SALAH — `warp()` menggeser sim 1 frame ke
  belakang karena hit-stop serangan sebelumnya, jadi frame menunjukkan
  tengah ayunan (kaki headkick masih terlipat, a≈3,04). Yang benar:
  `render(INTRO + realTime(atk.t))`. Frame kind kini dipilih yang
  outcome `hit` (bukan `flinch` — kaki berhenti di titik hantu, 75 px
  dari kepala hidup yang menghindar). Pelajaran ini berlaku untuk semua
  render frame fight ke depan.
- **Poster JPEG (browser, poster KO 0–17):** 0.85 → 112.346 byte,
  0.7 → 83.780 byte, **0.6 → 74.012 byte** (batas 200 KB).
- **Preview v3** (root app, TIDAK didaftarkan di deploy):
  `fight-frame-hook-v3.png`, `fight-frame-straight-v3.png`,
  `fight-frame-uppercut-v3.png`, `fight-frame-headkick-v3.png`,
  `fight-frame-roundhouse-v3.png`, `fight-frame-takedown-v3.png`,
  `fight-frame-seoinage-v3.png`, `fight-frame-clinch-v3.png`,
  `poster-preview-v3.png`, `facecam-preview-v3.png` — semua frame fight
  ASLI dari engine (buildFight + render), outcome hit di impact persis.
- **Penilaian visual jujur (lihat langsung semua preview):** semua
  anggota nyambung di semua pose termasuk clinch (tidak ada celah
  melayang); hook/cross/uppercut terbaca beda (siku 90° / lurus /
  naik ke dagu); roundhouse TERBACA JELAS (kaki horizontal ke badan,
  mata X lawan); headkick mendarat TEPAT di kepala (kaki 4,7 px dari
  kepala — terukur) tapi kaki sebagian tertutup badan lawan + starburst
  di jarak serang 52 px (artefak jarak engine, bukan pose); seoi kini
  TERBACA (korban terangkat melengkung di atas bahu, mata X); takedown
  terbaca sebagai angkatan (korban terbalik di atas penyerang) walau
  badan korban agak kaku seperti papan diagonal; clinch TERBACA (kedua
  petarung condong, glove bertemu di tengah); torso TIDAK terlalu kotak;
  komentator + label facecam bagus (celah jelas di r58); poster Teko
  rapi. Sisa: kind baru tertunda karena `moves.js` beku (`kneediag`,
  `elbowup`, `elbowspin`, `spinhookkick`, `armbar`, `doubleleg`,
  `singleleg`, `suplex`, `bodyslam`, `anklepick`, `outsidetrip` —
  lihat brief §2, usulan kind BARU).
- **Deploy:** dpl_3gSPrqhWJPMBhDhqB3uwignj4wNK (production,
  stickman-fight-arena-zeta.vercel.app, 582 file), READY. Live terverifikasi
  per file (curl md5 identik lokal: film.js 32ab6ee8…, app.js 3aad572e…,
  techniques.js 3f9ec69b…, fight.js 25d53a66…, moves.js e51b601c…,
  damage.js 8675ae2d…, accessories.js ff845f57…, poster.js ffa0a251…,
  index.html 6b321476…; fonts/teko-var.woff2 200; `throwOverlay` ada di
  film.js live).
