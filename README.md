# Street Fight Tournament Hub

Platform turnamen stickman fight (UI Bahasa Indonesia): user daftar, buat
fighter, join turnamen single-elimination; hasil pertandingan diundi
(seed­ed) oleh sistem; video tiap pertandingan di-upload ke Instagram
[@streetfightstickman](https://www.instagram.com/streetfightstickman).

Stack: Next.js 15 App Router + TypeScript + Tailwind v4 + Mongoose +
bcryptjs + jose (JWT) + @google/generative-ai (Gemini).

> Detail kontrak (model, API, bracket, draw, auth): `CONTRACT.md` — satu-satunya
> sumber kebenaran.

## Cara jalan lokal

```bash
npm install
cp .env.example .env.local   # lalu isi nilai sebenarnya
npm run dev                  # http://localhost:3000
```

## Env yang dibutuhkan (`.env.local`, JANGAN di-commit)

| Variabel | Keterangan |
| --- | --- |
| `MONGODB_URI` | Connection string MongoDB Atlas, database `street-fight-hub` |
| `GEMINI_API_KEY` | Google Gemini API key (generate persona fighter) |
| `JWT_SECRET` | String acak panjang (min 32 karakter) untuk tanda tangan sesi |
| `ADMIN_SLUG` | Slug rahasia path admin, mis. `arena-control-xxxx` (tanpa slash) |
| `ADMIN_USERNAME` | Username admin awal (dipakai `npm run seed`) |
| `ADMIN_PASSWORD` | Password admin awal (dipakai `npm run seed`) |

Contoh placeholder ada di `.env.example` — tanpa nilai asli.

## Cara seed

```bash
npm run seed
```

Membuat/reset akun admin dari `ADMIN_USERNAME` + `ADMIN_PASSWORD`, dan
1 turnamen contoh **"Night Fight Championship #1"** (status `upcoming`,
`regOpenAt` = sekarang, `regCloseAt` = +7 hari, `bracketSize` 32, tanpa
peserta). Idempotent — jalan 2x tidak membuat duplikat. Jika env kosong,
seed berhenti dengan pesan error yang jelas.

## Cara test

```bash
npm test          # vitest run (unit + integration)
npm run test:watch
npm run typecheck # tsc --noEmit
npm run lint
```

Unit test (tanpa DB, selalu jalan):

- `src/lib/__tests__/bracket.test.ts` — `largestPowerOfTwo`, `buildBracket`
  (shrink + bye: `byes = 2*target - n`, error jika peserta < 4),
  `roundNameForTarget`, `nextRound`.
- `src/lib/__tests__/draw.test.ts` — `mulberry32` + `simulateFight`
  (deterministik per seed, KO time 35–55, seri menghasilkan advancer).

Integration test (`src/lib/__tests__/api.integration.test.ts`) menjalankan
alur penuh dengan `mongodb-memory-server`: register → buat fighter →
buat turnamen (admin) → join 4 fighter → generate bracket → draw SF → draw
F → juara + videoTask. Test ini butuh download binary MongoDB; kalau
download gagal di VM ini, test SKIP dengan pesan jelas dan tidak memblokir
unit test.

## Struktur folder (backend)

```
src/lib/
  db.ts           Koneksi Mongoose (cache global); throw jelas jika MONGODB_URI kosong
  auth.ts         bcryptjs 12 rounds, JWT HS256 (jose, 30 hari), cookie httpOnly
                  sfh_token, throttling login (5 gagal / 15 mnt), cek Origin (CSRF),
                  guard admin (role + header x-admin-path == ADMIN_SLUG → 404)
  validation.ts   Validasi server-side (username, password, fighter, turnamen, persona)
  bracket.ts      Fungsi murni: largestPowerOfTwo, buildBracket, roundNameForTarget, nextRound
  draw.ts         mulberry32, damage model, simulateFight, decideMatch, advanceWinners
  gemini.ts       generatePersona (gemini-3.8-flash, JSON, validasi + 1x retry)
  audit.ts        Helper audit() → AdminAuditLog
  http.ts         Respons JSON seragam { ok, data } / { ok:false, error:{code,message} }
src/models/       User, Fighter, Tournament, TournamentEntry, Match,
                  VideoTask, Announcement, AdminAuditLog
src/app/api/
  auth/           register, login, logout, me
  fighters/       create, list klasemen, [id] (GET/PATCH), [id]/ai-generate
  tournaments/    list, [slug], [slug]/join, [slug]/leave, [slug]/bracket
  matches/[id]    detail match
  announcements/active
  admin/          tournaments, generate-bracket, draw-round, video-tasks,
                  users, fighters, announce, stats
scripts/seed.ts   Seed admin + turnamen contoh
```

## Struktur folder (frontend)

```
src/app/
  layout.tsx      Layout global + metadata + font (Anton + Inter via Google Fonts link)
  page.tsx        Home: hero, banner pengumuman, turnamen upcoming/live/selesai, top fighter
  turnamen/       List (filter status) + detail [slug] (countdown, peserta, bracket, join/leave)
  pertandingan/[id]  Detail match (dua fighter, hasil, skor, KO time, Reel embed)
  fighter/[id]    Profil publik fighter (persona, rekor, riwayat, badge)
  fighter-saya/   Buat/edit fighter + generate persona AI (maks 3x regenerate)
  klasemen/       Leaderboard (menang → KO → paling sedikit kalah, filter style)
  daftar/ masuk/  Register + login
  [adminSlug]/    Admin (path rahasia dari env ADMIN_SLUG, TIDAK di-link publik):
                  dashboard, turnamen, video, fighter, pengumuman (+ login admin)
  robots.ts       Disallow: /<ADMIN_SLUG> (force-dynamic supaya slug runtime terpakai)
  sitemap.ts      Sitemap publik (tanpa path admin)
src/components/   Navbar, Footer, GlassCard, Badge, Button, Input, Modal, Countdown,
                  BracketView, FighterCard, StatChip, EmptyState, LoadingSkeleton,
                  api.ts (clientApi + helper), server-api.ts (serverApiGet + dataOr),
                  types.ts (tipe bersama, dicerminkan dari CONTRACT.md)
src/app/globals.css  Token Tailwind v4 (deep charcoal + amber + red, 1 aksen cool),
                  .glass/.glass-strong, animasi transform/opacity, reduced-motion
```

**Konvensi bentuk `data` (lihat CONTRACT.md §4 — WAJIB):** `data` selalu objek
bernama (`{ tournaments: [...] }`, `{ fighter, history }`, `{ match }`, ...),
tidak pernah array/objek model telanjang. Frontend wajib unwrap field
bernama di call site. Mismatch ini pernah terjadi saat integrasi (frontend
mengira `data` = array langsung) dan sudah diperbaiki di semua call site.

## Format respons API

Sukses: `{ "ok": true, "data": ... }`
Gagal: `{ "ok": false, "error": { "code": "...", "message": "..." } }`

Kode status: 400 validasi, 401 belum login, 403 role salah, 404 tidak
ditemukan / slug admin salah, 409 konflik, 429 rate limit, 503 AI/DB belum
siap.

## Catatan / kekurangan yang diketahui

- **MongoDB Atlas tidak bisa diakses dari VM ini** (port 27017 diblokir
  egress proxy). Jalankan `npm run dev` / `npm run seed` dari mesin yang
  bisa mencapai Atlas, atau pakai MongoDB lokal (`MONGODB_URI` ke
  `mongodb://localhost:27017/...`).
- **Integration test** butuh download binary `mongodb-memory-server`; kalau
  gagal, test skip dengan catatan (lihat atas).
- **Throttling login in-memory**: reset saat server restart; untuk
  multi-instance perlu store eksternal (mis. Redis).
- **CSRF**: mengandalkan cookie `SameSite=Lax` + cek header `Origin`/`Referer`
  pada POST/PATCH/DELETE. Request tanpa Origin (server-to-server) diizinkan.
- **Draw ronde**: `advanceWinners` memasangkan pemenang berurutan sesuai
  urutan pembuatan match. Bye dihitung sebagai match decided sejak
  generate-bracket, jadi pemenang bye ikut dipasangkan di ronde berikut.
- **Fitur banned user DITUNDA (MVP)**: `PATCH /api/admin/users/[id]` hanya
  mengubah role; body berisi `banned` → 400.
- **Gemini**: jika `GEMINI_API_KEY` kosong, `POST /api/fighters/[id]/ai-generate`
  → 503 `"AI belum dikonfigurasi"`. Regenerate persona maks 3x per fighter.
- **Verifikasi integrasi (2026-11-07)**: `npm run build` lolos, `typecheck` +
  `lint` bersih, 20 unit test lolos (2 integration test SKIP — butuh binary
  MongoDB, lihat atas). Server smoke test tanpa DB: home + 5 halaman publik
  → 200 (empty state), API tanpa DB → 503 `DB_UNAVAILABLE`, admin guard →
  404 tanpa slug / 401 tanpa auth, `robots.txt` memblokir path admin.
- **Verifikasi live dengan DB nyata (2026-11-07, SELESAI)**: E2E penuh
  terhadap deployment Vercel + Atlas — register/login 4 user, buat 4
  fighter, join turnamen TEST (bracket 8 menyusut jadi 4), generate
  bracket (2 SF), draw SF (2 decided, skor tersimpan), draw final
  (juara terkoronasi, turnamen completed, 3 videoTask queued), admin
  guard (tanpa slug → 404, slug salah → 404, user biasa → 403, admin
  stats → 200), cek visual browser (home, detail turnamen, profil
  fighter, klasemen). Data TEST sudah dibersihkan — yang tersisa hanya
  admin + turnamen contoh "Night Fight Championship #1".
- **Persona AI TERVERIFIKASI 2026-11-07 14:08**: key Gemini asli rangga
  (AQ., proyek 267485516177) dipasang sebagai `GEMINI_API_KEY`; model
  diganti `gemini-2.0-flash` → `gemini-3.8-flash` (model lama
  dipensiunkan Google, API 404). Tes live: fighter tes mendapat persona
  lengkap Bahasa Indonesia (nickname "Si Kilat Simpang Lima"); data tes
  dibersihkan. Catatan: free-tier Gemini kadang 503 overload (sementara);
  regenerate persona maks 3x/fighter (percobaan yang timeout di sisi
  klien tetap menghabiskan jatah).
  Perbaikan pasca-verifikasi: semua skema Mongoose didaftarkan di
  `src/lib/db.ts` (dulu `populate()` gagal `MissingSchemaError` di
  serverless instance dingin → halaman detail turnamen 404 acak),
  riwayat fighter berbentuk datar `FightHistoryItem`, `championId`
  di-populate, halaman 404 kustom.
- **`npm audit` diblokir** oleh registry policy VM ini (`policy_denied`) —
  audit dependensi belum dilakukan; Next.js sudah 15.5.29 (naik dari
  15.5.6 karena `VULNERABLE_NEXTJS_VERSION` di Vercel).
- **Draw decision-winner**: pemenang decision = skor lebih tinggi (roll
  winner hanya menentukan pemenang KO) — didokumentasikan di CONTRACT.md
  §6; dikonfirmasi parent (rangga) 2026-11-07.
