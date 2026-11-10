# Kontrak Embed — Stickman Fight Arena ↔ Street Fight Hub

**Sumber kebenaran untuk agen Hub (Fase 1).** Arena app di-embed sebagai `<iframe>` di Hub.
Versi kontrak: 1. Arena app v2 (`window.__fightApp.version === 2`).

Arena live (same-origin, sejak konsolidasi 2026-11-09 — Tugas 6): disajikan Hub
sendiri dari `public/arena/` di `https://streetfight.ranggafigo.com/arena/index.html`
(bukan lagi domain Vercel Arena terpisah). Project Vercel lama
`stickman-fight-arena-zeta` masih ada tapi TIDAK dipakai lagi oleh Hub.
Kode: `public/arena/` di repo ini — `js/app.js` (fungsi `onEmbedMessage`, `sendEmbedResult`, `buildPoster`, konstanta `EMBED_ALLOWED_ORIGINS`), `js/fight.js` (`buildFight` + `fightStats`), `js/moves.js` (`normalizeStyle`).

## 1. Alur pesan

```
Hub (parent)                          Arena (iframe)
     │                                      │
     │  iframe load                         │ kirim sfa-ready
     │ ◄──────────────────────────────────── │
     │                                      │
     │  sfa-config ───────────────────────► │ setFighters + setMap,
     │                                      │ body.classList.add('embed')
     │                                      │ (builder/topbar disembunyikan,
     │                                      │ TIDAK auto-start)
     │                                      │
     │        user klik "Tarung" di iframe  │ (gestur di origin iframe →
     │                                      │  klip suara + AudioContext
     │                                      │  diizinkan browser)
     │                                      │
     │  sfa-result ◄────────────────────────│ saat fight selesai
     │  (termasuk stats + posterDataUrl)    │
```

## 2. `sfa-ready` — iframe → parent (saat load)

```json
{ "type": "sfa-ready" }
```

Dikirim sekali saat `js/app.js` selesai init, **hanya** kalau `window.parent !== window`
(di dalam iframe). Parent membalas dengan `sfa-config`. `postMessage` keluar
menggunakan targetOrigin `'*'` (parent sudah dikenal lewat `event.origin` saat
membalas; pesan ini tidak membawa data sensitif).

## 3. `sfa-config` — parent → iframe

```json
{
  "type": "sfa-config",
  "fightId": "challenge-abc123",
  "fighters": {
    "left":  { "name": "Nopan", "color": "#C8102E", "style": "muaythai", "signatureMove": "knee", "tempo": "agresif" },
    "right": { "name": "Neon", "color": "#1D4ED8", "style": "kali-arnis", "tempo": "seimbang" }
  },
  "seed": 123456,
  "map": "gudang",
  "duration": 60,
  "opts": {
    "weights": { "R": { "knee": 2.5 } },
    "tempo": { "R": "agresif", "B": "bertahan" },
    "forcedResult": { "result": "decision", "winner": "R" }
  }
}
```

| Field | Wajib | Keterangan |
|---|---|---|
| `fightId` | tidak (disarankan) | String bebas, dikembalikan apa adanya di `sfa-result`. Kalau tidak ada string → `null`. |
| `fighters.left` / `fighters.right` | ya | Objek fighter (lihat §4). Keduanya harus valid; kalau salah satu tidak valid, pasangan lama dipertahankan. |
| `seed` | tidak | Number; kalau tidak ada/tidak valid → seed acak dari input arena. Seed ditampilkan di input seed arena. |
| `map` | tidak | `'ring' \| 'gudang' \| 'jalanan' \| 'dojo'`; nilai lain diabaikan oleh `setMap` (map lama dipertahankan). |
| `duration` | tidak | Number detik; default **60**. Match web game SELALU 60 detik (aturan 2026-11-07 ~20:32). |
| `opts` | tidak | Passthrough ke `buildFight` (lihat §6): `weights`, `tempo`, `forcedResult`. Fase 1 Hub: **jangan kirim `opts`** — challenge memakai undian normal. |
| `autoRecord` | tidak | Boolean. `true` = **mode ekspor video** (admin Hub): saat tombol **Tarung** diklik, MediaRecorder mulai otomatis bersama fight; status "Merekam fight…" tampil; saat fight selesai webm terunduh otomatis (lihat §3a). Default `false` — permainan normal tidak terganggu. |

### Perilaku saat config diterima (`onEmbedMessage`)

1. **Validasi origin** — pesan hanya diterima dari `EMBED_ALLOWED_ORIGINS` (lihat §7). Pesan dari origin lain diabaikan diam-diam.
2. `setFighters(left, right, { persist: false })` — petarung Hub **tidak** disimpan ke `localStorage`, supaya petarung user sendiri tetap utuh saat membuka arena secara mandiri.
3. `setMap(map)` kalau `map` string.
4. `embed.active = true`, `fightId`/`seed`/`duration`/`opts` disimpan, `document.body.classList.add('embed')` (builder + topbar + pemilih map + pengaturan fight + footer disembunyikan lewat CSS; arena + PBP + tombol Tarung tetap tampil).
5. **TIDAK auto-start.** User harus klik tombol **Tarung** di dalam iframe. Alasan: gestur klik harus berada di origin iframe supaya klip suara komentator + `AudioContext` diizinkan browser.

### 3a. Mode ekspor video (`autoRecord: true`)

Dipakai admin Hub (tombol "Ekspor Video" di riwayat pertandingan). Perilaku:

1. Status arena berubah jadi: *"Mode ekspor video: tekan Tarung — rekaman mulai otomatis, video terunduh saat fight selesai."*
2. Saat tombol **Tarung** diklik, `startFight()` memanggil `startRecording()` otomatis (MediaRecorder: canvas 30fps + audio SFX; status "Merekam fight… tunggu sampai selesai."). **Tanpa `autoRecord`, klik Tarung TIDAK merekam** — permainan normal tidak terganggu.
3. Saat fight selesai, `endFight()` menghentikan recorder → `finishRecording()` merakit webm (`stickman-fight-{seed}.webm`), mencoba unduh otomatis, DAN menampilkan link unduh manual "⬇ Unduh video" di status (unduhan otomatis sering diblokir browser karena dipicu tanpa gestur pengguna).
4. Batasan: ekspor berjalan **real-time di browser (~60 detik per video)**, satu per satu. Tidak ada render server (Vercel serverless tidak bisa render video latar). Rekaman butuh klik Tarung di iframe (gestur di origin iframe) supaya audio komentator/SFX ikut terekam; tanpa gestur itu AudioContext tersuspensi dan video jadi bisu.
5. **Iframe parent WAJIB menyertakan `allow-downloads` di atribut `sandbox`** (`GameArena.tsx`, `TrainingArena.tsx`) — tanpa itu SEMUA unduhan dari iframe diblokir (insiden 10 Nov 2026: video tidak pernah sampai ke perangkat walau status menulis "Video tersimpan").

Kirim `sfa-config` ulang kapan saja (mis. challenge baru) — state embed ditimpa, fight lama tidak otomatis jalan.

## 4. Objek fighter

Format engine (sama seperti preset di `js/presets.js`):

```json
{
  "name": "Nopan",          // string, wajib, dipotong maks 18 karakter
  "color": "#C8102E",        // string, wajib — warna BADAN (legacy; lihat `colors`)
  "style": "muaythai",       // string, wajib — Hub-enum atau engine-key (lihat §5)
  "colors": {                // opsional — warna RGB bebas PER BAGIAN (hex '#RRGGBB')
    "body": "#C8102E",       // warna badan (garis tubuh)
    "gloves": "#141210",    // warna sarung tangan
    "shoes": "#FBF8F1",     // warna sepatu
    "belt": "none",         // warna sabuk, atau "none" = tidak pakai sabuk
    "headband": "#FACC15",  // warna ikat kepala, atau "none" = tidak pakai
    "weapon": "#8B5E34"     // warna tongkat kayu
  },
  "gloves":  { "type": "boxing", "color": "#141210" },  // opsional (legacy)
  "weapon":  { "kind": "none", "hand": "right", "color": "#8B5E34" }, // opsional
  "shoes":   { "model": "sneakers", "color": "#FBF8F1" },// opsional (legacy)
  "belt":    { "color": "none" },                        // opsional (legacy)
  "headband":{ "color": "none" },                        // opsional (legacy)
  "accessories": {  // opsional — varian aksesoris PER BAGIAN (lihat bawah)
    "head": "headband", "hands": "boxing", "feet": "sneakers",
    "body": "none", "belt": "belt", "weapon": "none"
  },
  "signatureMove": "knee",  // opsional — jurus khas, bobot 2.5x di director
  "tempo": "agresif"         // opsional — 'agresif' | 'seimbang' | 'bertahan'
}
```

Field yang hilang diisi default (sarung tangan none, tanpa senjata, sepatu sneakers, tanpa sabuk/headband). `signatureMove` dan `tempo` diteruskan ke `buildFight` (lihat §6).

### Aksesoris per bagian (`accessories`) — HANYA visual

`fighter.accessories` memilih **varian** tiap bagian tubuh (bukan cuma warna).
Warna tiap bagian TETAP dari `colors`: kepala ← `headband`, tangan ← `gloves`,
kaki ← `shoes`, badan ← `body`, sabuk ← `belt`, senjata ← `weapon`.
Katalog ID (sama persis di Hub dan Arena — jangan diubah):

| Bagian | Field | ID yang dikenal |
|---|---|---|
| Kepala | `head` | `none` (tanpa aksesoris), `headband` (ikat kepala, tampilan lama), `bandana`, `cap` (topi), `crown` (mahkota), `helmet` (helm), `topknot` (kuncir) |
| Tangan | `hands` | `none` (kepalan kecil, tampilan lama), `boxing` (sarung tinju, tampilan lama), `big` (sarung besar), `mma` (sarung MMA, tampilan lama), `wraps` (perban tangan), `fingerless` (sarung tanpa jari) |
| Kaki | `feet` | `barefoot` (tanpa alas, tampilan lama), `sneakers` (sepatu, tampilan lama), `boots` (sepatu bot), `sandals` (sandal), `martial` (sepatu bela diri) |
| Badan | `body` | `none` (tanpa baju, tampilan lama), `shirt` (kaos), `singlet`, `jacket` (jaket), `gi` |
| Sabuk | `belt` | `none` (tanpa sabuk), `belt` (sabuk, tampilan lama), `champion` (sabuk juara + pelat emas), `rope` (tali pinggang) |
| Senjata | `weapon` | `none` (tanpa senjata), `stick` (tongkat, tampilan lama), `short-stick` (tongkat pendek), `wooden-sword` (pedang kayu), `nunchaku` |

Aturan fallback (`normalizeGear` di `js/film.js`):

- Kalau `accessories` ADA, ID yang dikenal menang atas field legacy **per bagian**.
  Kunci yang tidak ada di `accessories` memakai fallback legacy bagian itu.
- Kalau `accessories` TIDAK ADA, petakan field legacy: `gloves.type`
  `none`→`none`, `boxing`→`boxing`, `mma`→`mma`, `big`→`big`;
  `shoes.model` `barefoot`→`barefoot`, `sneakers`→`sneakers`, `boots`→`boots`;
  `weapon.kind` `kayu`→`stick`, `none`→`none`; `head` = `headband` kalau
  `colors.headband` terisi, kalau tidak `none`; `body` = `none`; `belt` =
  `belt` kalau `colors.belt` terisi, kalau tidak `none`.
- ID tidak dikenal → default bagian itu: `head`/`hands`/`body`/`belt`/`weapon`
  = `none`, `feet` = `sneakers`. Jadi fighter tanpa info apa pun tetap
  terlihat seperti tampilan lama (kepalan kecil, sepatu sneakers).
- Kalau varian kepala/sabuk butuh warna tapi `colors` bagian itu `none`:
  mahkota memakai emas (`#D4A017`), varian lain memakai warna badan.

**Aksesoris HANYA visual — tidak memengaruhi fight sama sekali.**
`buildFight`/verifikasi tidak membaca `accessories` (satu seed + satu config
= satu hasil yang sama, termasuk urutan serangan, dibuktikan tes §20):
senjata aksesoris digambar di tangan belakang sejak awal fight, TANPA event
ambil kayu dan TANPA gerakan tongkat baru. `weapon.kind` dari Hub tetap
`'none'` (game Hub tanpa senjata kayu), jadi `movesFor` tidak pernah membuka
`stickswing`/`stickchop` untuk fighter Hub. Perilaku preset Arena lama
(`weapon.kind: 'kayu'` + `pickupAt`) tidak berubah: tongkat baru digambar
setelah event ambil kayu.

### Warna per bagian (`colors`) — custom karakter

- **Bentuk kanonik warna adalah `fighter.colors`** — enam bagian, masing-masing
  hex RGB bebas (`'#RRGGBB'`, huruf besar/kecil bebas). Builder arena memakai
  input `type=color` + field hex untuk tiap bagian (bukan palet tetap), supaya
  tiap user bisa beda-beda. Bagian yang bisa diwarnai: **badan, sarung tangan,
  sepatu, sabuk, ikat kepala, senjata (tongkat)**. Warna lain yang tampil
  (shorts Muay Thai/brawler) diturunkan dari warna badan (digelapkan 0.7).
- **Warna yang dipilih BENAR-BENAR tampil di arena** (bukan tersimpan saja):
  badan = garis tubuh + sendi; sarung tangan = lingkaran glove di tiap tangan
  (glove mendekati hitam diganti warna badan supaya tidak terbaca sebagai
  kepala — lihat `film.js`); sepatu = elips di tiap kaki (kecuali barefoot);
  sabuk = garis di pinggang; ikat kepala = busur + ekor berkibar di kepala;
  senjata = tongkat di tangan (setelah diambil) dan tongkat di tepi ring
  (sebelum diambil) — keduanya memakai warna senjata yang sama.
- **Kompatibilitas mundur:** Hub boleh mengirim fighter LAMA tanpa `colors`
  (hanya `color` + warna di field legacy `gloves.color` / `shoes.color` /
  `belt.color` / `headband.color` / `weapon.color`) — arena membaca field itu
  sebagai fallback (`fighterColors()` di `js/moves.js`). Kalau `colors` ada,
  **`colors` selalu menang** atas field legacy. Arena menormalisasi fighter
  yang diterima (embed) dan yang dimuat (localStorage `sfa-fighters-v1`)
  sehingga `colors` selalu terisi + field legacy selalu sinkron — jadi objek
  fighter yang disimpan/dikirim ulang selalu membawa bentuk lengkap.
- **Poster + replay memakai objek fighter yang sama**, jadi warnanya konsisten
  otomatis: poster digambar dari canvas arena (frame akhir dengan gear
  berwarna), replay membangun ulang fight dari seed + config yang sama
  (termasuk `colors`), sehingga warna petarung di replay identik dengan fight
  aslinya. Warna tidak mengubah determinisme (satu seed + satu config = satu
  hasil yang sama, termasuk urutan serangan — dibuktikan tes §16).

## 5. Pemetaan gaya Hub-enum → engine-key

Arena menormalisasi style lewat `normalizeStyle()` di `js/moves.js` (alias + fallback). **Kirim Hub-enum apa adanya — arena yang memetakan.**

| Hub enum (kirim ini) | Engine key | Gaya |
|---|---|---|
| `tinju` | `tinju` | Tinju |
| `muay-thai` | `muaythai` | Muay Thai |
| `taekwondo` | `taekwondo` | Taekwondo |
| `silat` | `silat` | Silat |
| `gulat` | `gulat` | Gulat (tanpa pukulan/tendangan) |
| `brawler` | `brawler` | Street brawler |
| `kali-arnis` | `kali` | Kali Arnis |
| `judo` | `judo` | Judo (lemparan saja) |
| `kudo` | `kudo` | Kudo |
| `jeet-kune-do` | `jkd` | Jeet Kune Do |
| `karate` | `karate` | Karate — **bukan taekwondo** |
| `capoeira` | `capoeira` | Capoeira |
| `wushu` | `wushu` | Wushu / Kung Fu |
| `kung-fu` | `wushu` | alias Wushu |

Alias lain yang diterima: `muay thai` → `muaythai`, `jeet kune do` → `jkd`, `kali` → `kali`, `judo`/`kudo`/`karate`/`capoeira`/`wushu` langsung. Style yang **tidak dikenal → `brawler`** (tidak pernah error).

## 6. `buildFight` opts (passthrough `sfa-config.opts`)

Diteruskan ke `buildFight(left, right, duration, seed, opts)` — lihat `ENGINE.md` §opts.

- `weights: { R: { kind: bobot }, B: { kind: bobot } }` — pengali bobot saat memilih gerakan dari pool acak. Jurus khas fighter (`signatureMove`) = bobot 2.5x kalau `opts.weights` untuk sisi itu tidak ada. Weighted pick deterministik (satu draw rng; bobot seragam = perilaku lama persis).
- `tempo: { R: 'agresif'|'seimbang'|'bertahan', B: ... }` — `'seimbang'` = perilaku sekarang (jeda kontak 0.55–0.75 dtk). `'agresif'`: jeda 0.45–0.65 dtk + gerakan power ≥ 0.9 berbobot ×1.5. `'bertahan'`: jeda 0.65–0.90 dtk + gerakan power < 0.7 berbobot ×1.5. Jeda memakai tempo penyerang saat itu. `tempo` juga bisa ditulis di objek fighter (§4) — `opts.tempo` menang kalau keduanya ada.
- `forcedResult: { result: 'ko'|'decision', winner: 'R'|'B' } | null` — mengganti undian KO/decision + pemenang (undian rng tetap dikonsumsi dulu lalu ditimpa, supaya stream rng tetap sebanding). Nilai tidak valid diabaikan. **Fase 1 Hub tidak memakainya** (challenge = undian normal); titik ekstensi untuk gelar/turnamen.

Tanpa `opts` sama sekali, fight yang dihasilkan **identik** dengan pemanggilan lama (dibuktikan tes determinisme di `tests/run.mjs` §13).

## 7. Origin yang diizinkan (dua arah)

```js
const EMBED_ALLOWED_ORIGINS = [
  'https://streetfight.ranggafigo.com',  // Hub produksi (domain custom)
  'https://street-fight-hub.vercel.app', // Hub produksi (domain Vercel)
  'http://localhost:3000',               // Hub dev
];
```

> 2026-11-10: domain Vercel ditambahkan — halaman game yang dibuka lewat
> `street-fight-hub.vercel.app` sebelumnya ditolak diam-diam oleh
> `onEmbedMessage`, sehingga Arena jatuh ke layar setup standalone (pilih
> petarung Kiri/Kanan + seed) dan tombol TARUNG tidak bisa dipakai.

- **Masuk (iframe):** `onEmbedMessage` mengabaikan semua `message` yang `event.origin`-nya tidak ada di daftar. Hanya `type: 'sfa-config'` diproses.
- **Keluar (iframe → parent):** `sfa-result` dikirim dengan `postMessage(payload, embed.parentOrigin)` — origin yang tercatat dari pesan `sfa-config` yang diterima (selalu salah satu dari daftar). `sfa-ready` memakai targetOrigin `'*'` (tidak membawa data).
- Kalau Hub pindah domain, ubah konstanta ini + bagian ini, lalu redeploy arena.

## 8. `sfa-result` — iframe → parent (saat fight selesai)

Dikirim **sekali** dari `endFight` (setelah tombol/controls diaktifkan kembali, sebelum `waitForEnd` resolve). Dikirim ke `embed.parentOrigin`.

```json
{
  "type": "sfa-result",
  "fightId": "challenge-abc123",
  "seed": 123456,
  "winner": "R",
  "method": "decision",
  "score": { "a": 57, "b": 34 },
  "koTimeSec": null,
  "stats": {
    "accuracyA": 0.62, "accuracyB": 0.55,
    "damageDealtA": 66, "damageDealtB": 43,
    "strikesThrownA": 39, "strikesThrownB": 36,
    "strikesLandedA": 24, "strikesLandedB": 20,
    "knockdowns": 1
  },
  "keyMoments": {
    "biggestHit": { "by": "L", "move": "knee", "damage": 24, "timeSec": 31.2 },
    "finisher": null,
    "knockdowns": [{ "by": "R", "timeSec": 14.63 }],
    "leadChange": { "timeSec": 42.83, "by": "L" }
  },
  "posterDataUrl": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

| Field | Isi |
|---|---|
| `fightId` | Sama seperti di `sfa-config` (atau `null` kalau config tidak membawa). |
| `seed` | Seed fight yang baru selesai (`fight.seed`). |
| `winner` | `'R'` (kiri) / `'B'` (kanan) / `null` (seri — hanya kalau decision dengan HP sama persis). |
| `method` | `'KO'` (pemenang menghabiskan HP lawan) / `'decision'` (HP terbanyak saat bel) / `'draw'` (HP sama persis). |
| `score` | `{ a, b }` = HP akhir petarung kiri (R) dan kanan (B), 0–100. |
| `koTimeSec` | Detik KO dalam waktu simulasi (dibulatkan 2 desimal), atau `null` kalau decision/draw. |
| `stats` | Dari `fight.stats` (`fightStats(fight)` di `js/fight.js`): akurasi = landed/thrown (feint tidak dihitung), damage = jumlah damage serangan yang mendarat (rumus sama dengan `hpAt` di `js/film.js`; beda ≤ 1 dari `100 − HP lawan` karena blok chip +2), knockdowns = jumlah `fight.knockdowns`. |
| `keyMoments` | Dari `fight.keyMoments` (`keyMoments(fight)` di `js/fight.js`) — momen kunci untuk replay + breakdown (lihat §8a). |
| `posterDataUrl` | JPEG data URL frame akhir + overlay (nama kedua petarung, skor, metode). Kualitas diturunkan 0.85 → 0.7 → 0.6 sampai ukuran ≤ 200KB. Kalau tetap > 200KB di 0.6, field ini **`null`** dan hasil tetap dikirim tanpa poster. |

### 8a. `keyMoments` — momen kunci (replay + breakdown "kenapa menang/kalah")

```json
{
  "biggestHit": { "by": "L", "move": "knee", "damage": 24, "timeSec": 31.2 },
  "finisher": null,
  "knockdowns": [{ "by": "R", "timeSec": 14.63 }],
  "leadChange": { "timeSec": 42.83, "by": "L" }
}
```

| Field | Isi |
|---|---|
| `biggestHit` | Serangan mendarat (`outcome: 'hit'`, bukan feint) dengan damage terbesar (rumus `dmgOf` = sama dengan `hpAt`: `DMG_BASE[kind] × power`, ×1.5 untuk finisher-kind). `move` = kind engine (mis. `knee`, `flyknee`, `stickchop`); `damage` dibulatkan 1 desimal; `timeSec` = detik simulasi (2 desimal). Selalu ada (fight selalu punya hit). |
| `finisher` | Serangan penutup KO (satu-satunya serangan knockdown tepat di `koTimeSec`), atau `null` kalau decision/draw. `move` ∈ `finisher` / `flyknee` (Muay Thai) / `stickchop` (pemenang pegang kayu). |
| `knockdowns` | Daftar knockdown tengah fight + KO (urut waktu): `by` = **penyerang yang menjatuhkan**, `timeSec` = detik knockdown (`t + 0.4` dari serangan — momen petarung jatuh). Bisa kosong. |
| `leadChange` | **Momen balik**: terakhir kali pemimpin skor berganti — saat pemenang akhir merebut keunggulan untuk selamanya. Dihitung dari HP berjalan (damage kumulatif timeline, bukan simulasi ulang). `by` = pihak yang merebut keunggulan. `null` kalau tidak pernah ada pergantian pemimpin (pemenang memimpin dari awal). |

**Konvensi `by` di `keyMoments`: `'L'` = petarung kiri, `'R'` = petarung kanan.** Ini BERBEDA dari kode internal engine (`'R'` = kiri/red, `'B'` = kanan/blue) dan dari `winner` di payload yang sama (`'R'`/`'B'`). Dipakai `'L'`/`'R'` di sini karena Hub membaca momen sebagai kiri/kanan. Pemetaan: `L` = `winner: 'R'` = `score.a`; `R` = `winner: 'B'` = `score.b`.

### 8b. Payload result = data replay + breakdown (Hub)

Payload `sfa-result` ini adalah data yang dipakai Hub untuk **replay** dan
**breakdown "kenapa menang/kalah"** — bukan sekadar skor:

- **Replay (Fase 1: persiapan data; UI replay Fase 2, bukan tugas arena):**
  replay = jalankan ulang fight dari **seed + config yang tersimpan**
  (deterministik, tanpa simpan video). `buildFight` deterministik: satu seed +
  satu config (fighters + duration + opts) = satu hasil yang sama persis,
  termasuk urutan serangan (dibuktikan tes `tests/run.mjs` §2/§13). Hub cukup
  menyimpan `fightId`, `seed`, `fighters` (dari `sfa-config` yang dikirim),
  `map`, `duration`, dan `opts` — lalu memuat ulang arena dengan config yang
  sama untuk memutar ulang fight yang identik. `keyMoments` memberi titik
  lompat (biggestHit / finisher / knockdowns / leadChange) untuk navigasi
  replay.
- **Breakdown "kenapa menang/kalah":** `stats` (damage, akurasi, thrown/
  landed, knockdowns) + `keyMoments` (pukulan terbesar, finisher, knockdown,
  momen balik) + `score`/`method`/`koTimeSec`. Contoh narasi yang bisa
  dirangkai Hub dari data ini: "Nopan menang decision 57–34 — damage 66 vs
  43, akurasi 62% vs 55%, momen balik di detik 42,8 saat Nopan merebut
  keunggulan, pukulan terbesar knee 24 damage di detik 31,2."

### Catatan poster

- Ukuran dihitung dari panjang base64 (`panjang × 0.75 ≤ 200 × 1024`).
- Poster digambar dari canvas utama arena pada frame terakhir (`buildPoster` di `js/app.js` -> `drawPoster` di `js/poster.js`, 720x1280): header branding "STREET FIGHT HUB", foto frame akhir (crop pita aksi di sekitar ring), skor besar sebagai hero, pita pemenang merah (KO + detik / Decision / Hasil seri), panel krem dua komentator (gambar bersama `js/commentators.js`, sama dengan facecam saat fight), footer seed + tanggal + streetfight.ranggafigo.com. Kalau canvas tidak bisa digambar (mis. error), `posterDataUrl` = `null`.
- Parent sebaiknya menampilkan poster sebagai kartu hasil (bukan mengandalkan video export — export video tetap fitur arena mandiri).

## 9. `window.__fightApp` (API yang sudah ada — TIDAK berubah)

```js
window.__fightApp = {
  startFight, exportVideo, getState, waitForEnd,
  setFighters, fighters, setMap, getMap,
  voice, setVoiceMuted,
  lastExport,
  version: 2,
  embed: {
    isEmbed: () => boolean,        // true setelah sfa-config diterima
    getFightId: () => string|null,
    sendResult: () => payload|null, // kirim ulang sfa-result (debug/manual)
  },
};
```

`setFighters(l, r, opts)` sekarang menerima `opts.persist` (default `true`); embed memanggil dengan `{ persist: false }`.

## 10. Suara (catatan penting untuk Hub)

- Komentator **tanpa nama** — dibedakan hanya lewat warna (kuning = Komentator 1, energetik; cyan = Komentator 2, kalem) dan suara. Jangan tampilkan nama komentator di Hub.
- Suara komentator adalah **klip rekaman TTS** (`audio/vo/*.mp3`, voice C1 "Rushing Jetty" `avocado_v2:vg_id_m31`, C2 "Musing Mirror" `avocado_v2:vd2_r8_rep1k_0363_v068_28k_g5k`, bahasa Indonesia) — **bukan** Web Speech API. Klip diputar lewat WebAudio (`sfx.master` → `MediaStreamDestination`), sehingga ikut terekam saat export video.
- **Gestur wajib di iframe:** tombol Tarung harus diklik di dalam iframe (bukan dari parent) supaya browser mengizinkan klip suara + `AudioContext`. Jangan auto-start dari parent.
- Klip audio tidak pernah memuat nama petarung (nama/skor hanya teks di layar) — jadi klip yang sama dipakai untuk semua fight.

## 11. Cara parent memakai mode embed (contoh)

```html
<iframe id="arena" src="/arena/index.html" width="720" height="1280"></iframe>
<script>
  const arena = document.getElementById('arena');
  // Same-origin: origin arena = origin Hub sendiri.
  const ORIGIN = window.location.origin;
  window.addEventListener('message', (ev) => {
    if (ev.origin !== ORIGIN) return;
    if (ev.data?.type === 'sfa-ready') {
      arena.contentWindow.postMessage({
        type: 'sfa-config',
        fightId: 'challenge-abc123',
        fighters: {
          left:  { name: 'Nopan', color: '#C8102E', style: 'muaythai' },
          right: { name: 'Neon',  color: '#1D4ED8', style: 'kali-arnis' },
        },
        seed: 123456,
        map: 'gudang',
        duration: 60,
      }, ORIGIN);
    }
    if (ev.data?.type === 'sfa-result') {
      console.log('Hasil:', ev.data.winner, ev.data.method, ev.data.score, ev.data.stats);
      // ev.data.posterDataUrl -> tampilkan sebagai kartu hasil (bisa null).
    }
  });
</script>
```

Catatan: `sfa-ready` datang dari origin yang sama dengan Hub (`window.location.origin`); validasi `ev.origin` di parent seperti contoh di atas. Untuk dev lokal, origin Hub (`http://localhost:3000`) ada di `EMBED_ALLOWED_ORIGINS`.

## 12. Pengujian embed

- `tests/run.mjs` §15: tripwire statis — dokumen menyebut ketiga tipe pesan + origin Hub, `app.js` memuat origin yang diizinkan + pengiriman `sfa-ready`/`sfa-result` + batas poster 200KB.
- Uji Playwright (lokal, `/tmp/arena-embed-test/`): halaman tes memuat arena dalam iframe, kirim `sfa-config`, klik Tarung di iframe, tunggu `sfa-result`, verifikasi winner/method/score/stats + poster ≤ 200KB.
- Kalau `sfa-result` tidak datang: pastikan (1) origin parent ada di `EMBED_ALLOWED_ORIGINS`, (2) klik Tarung dilakukan di dalam iframe, (3) fight benar-benar selesai (60 detik waktu simulasi ≈ 60 detik nyata + intro/outro).
