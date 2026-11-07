# Street Fight Tournament Hub — CONTRACT (single source of truth)

Stack: Next.js 15 App Router + TypeScript + Tailwind CSS v4 + Mongoose + bcryptjs + jose + @google/generative-ai. UI Bahasa Indonesia. Semua tanggal/waktu WIB di UI (tampilkan dengan zona Asia/Jakarta).

## 0. File ownership (jangan sentuh file orang lain)
- BACKEND (agen backend): `package.json` (deps), `src/lib/**`, `src/models/**`, `src/app/api/**`, `scripts/seed.ts`, `vitest.config.ts`, `src/lib/__tests__/**`, `src/app/api/**/*.test.ts` (boleh), `.env.example`, `README.md` (bagian backend/run).
- FRONTEND (agen frontend): `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/turnamen/**`, `src/app/pertandingan/**`, `src/app/fighter/**`, `src/app/klasemen/**`, `src/app/daftar/**`, `src/app/masuk/**`, `src/app/fighter-saya/**`, `src/app/[adminSlug]/**`, `src/components/**`, `src/app/robots.ts`, `src/app/sitemap.ts`, `public/**`.
- SHARED (sudah dibuat induk, JANGAN ubah): `CONTRACT.md`, `tsconfig.json`, `next.config.ts`, `tailwind` setup dari scaffold (Tailwind v4, `@import "tailwindcss"` di globals.css).

## 1. Design tokens (Tailwind v4 @theme di globals.css — SATU sumber kebenaran)
Palet: warm analogous — deep charcoal + amber + red, 1 aksen cool terkontrol (cyan, HANYA untuk komentator/aksen kecil).
- `--color-ink-950: #0c0a09` (bg halaman), `--color-ink-900: #171412`, `--color-ink-800: #221d1a`, `--color-ink-700: #332b26`
- `--color-amber-brand: #f5a623` (primary), on-primary `#1a1206` (teks di atas amber, kontras 4.5:1+)
- `--color-red-brand: #e5382e` (danger/aksen keras), `--color-cyan-accent: #22d3ee` (aksen cool, hanya badge/komentator)
- `--color-paper: #faf5ec` (teks utama di atas ink), `--color-paper-dim: #d6cdbd` (teks sekunder), `--color-paper-mute: #a89e8c` (muted)
- Glass: `.glass` = `background: rgba(255,255,255,0.06); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.12); border-radius: 1rem; box-shadow: 0 8px 32px rgba(0,0,0,0.35)`. `.glass-strong` blur 20px, bg 0.10.
- Font: display `Anton` (next/font/google, fallback `Arial Narrow, sans-serif`), body `Inter` (fallback system). `font-display` untuk heading besar, `uppercase tracking-wide`.
- Backdrop halaman: gradient radial amber/red glow + pola grain (CSS, tanpa gambar eksternal). Animasi hanya transform/opacity; `@media (prefers-reduced-motion: reduce)` matikan semua animasi/transisi.
- Touch target min 44px. Breakpoint mobile-first: 360 / 768 / 1280 / 1920. Bracket: mobile horizontal snap-scroll, desktop grid kolom per ronde.
- Kontras: semua pasangan teks/kaca dicek WCAG AA (teks normal 4.5:1, besar 3:1). Jangan letakkan teks `--color-paper-mute` di atas kaca tipis tanpa lapisan gelap.

## 2. Model data (Mongoose, nama field PERSIS doc §7 + tambahan yang ditulis di sini)
- `users`: username (unique, lowercase, 3-20, /^[a-z0-9_]+$/), passwordHash, role 'user'|'admin', createdAt, lastLoginAt. Index username unique.
- `fighters`: userId (ref User, unique — satu fighter aktif per akun), displayName (1-30), igUsername (tanpa @, 1-30, /^[A-Za-z0-9._]+$/), style enum ['boxing','taekwondo','muay-thai','street','karate','silat','wrestling','other'], styleOther (string, wajib jika style='other'), selfDescription (maks 600 karakter, tanpa minimum — 2026-11-07), record { wins, losses, draws, kos } default 0, status 'active'|'retired', createdAt, updatedAt. Persona AI DIHAPUS 2026-11-07 (perintah rangga — generate AI menggantung 10 menit); warna kartu fighter diambil dari gaya bertarung (styleColor). Index userId unique.
- `tournaments`: name, slug (unique, auto dari name + nomor), format 'single-elim', bracketSize 8|16|32, regOpenAt, regCloseAt, status 'upcoming'|'closed'|'in_progress'|'completed'|'cancelled', rules (string), championId (ref Fighter, null), bracketSeed (number|null), createdBy (ref User), createdAt. Index slug unique.
- `tournamentEntries`: tournamentId, fighterId, joinedAt, seed (number|null), status 'active'|'eliminated'|'champion'|'withdrawn'. Index (tournamentId, fighterId) unique.
- `matches`: tournamentId, round 'R32'|'R16'|'QF'|'SF'|'F', fighterAId, fighterBId (null = bye), winnerId (null), method 'KO'|'decision'|'draw'|'bye'|null, score {a:number,b:number}|null, koTimeSec (number|null), drawSeed (number), drawAdvancerId (ref Fighter|null, null jika bukan seri), drawReRollSeed (number|null), isBye (boolean default false), status 'scheduled'|'decided'|'video_done', reelUrl (string|null), decidedAt (Date|null). Index (tournamentId, round).
- `videoTasks`: matchId (ref, unique — satu task per match), status 'queued'|'in_production'|'uploaded'|'blocked', note (string), reelUrl (string|null), createdAt, updatedAt.
- `announcements`: text (max 200), active (boolean), createdBy, createdAt. (Satu yang active dipakai homepage.)
- `adminAuditLogs`: adminUserId, action (string), targetType (string), targetId (string), detail (string), createdAt.

### Aturan model Mongoose (bug nyata, ditemukan 2026-11-07)
- **Semua skema WAJIB terdaftar di `src/lib/db.ts`** (import semua file
  `src/models/*`). Setiap route handler hanya mengimpor model yang
  dipakainya sendiri, jadi tanpa ini `populate()` ke model lain gagal
  dengan `MissingSchemaError: Schema hasn't been registered` di serverless
  instance yang dingin — route yang sama kadang 200 (instance hangat)
  kadang 500 (instance dingin); halaman yang memanggil API itu lalu 404.
  Model memakai guard `mongoose.models.X || mongoose.model(...)`, jadi
  import ganda aman.
- `GET /api/tournaments/[slug]` me-populate `championId` (nama juara
  untuk kartu Champion + "Juara Terakhir" di home).
- `GET /api/fighters/[id]` mengembalikan riwayat dalam bentuk DATAR
  `FightHistoryItem` (`tournamentId` string, `tournamentName`,
  `tournamentSlug`, `opponentId`, `opponentName`) — BUKAN objek
  bersarang. Halaman profil membaca field datar itu.

## 3. Auth (lib/auth.ts)
- bcryptjs hash 12 rounds. JWT HS256 via jose, secret dari env JWT_SECRET, payload { sub: userId, username, role }, exp 30 hari. Cookie `sfh_token`, httpOnly, SameSite=Lax, Secure jika production, Path=/, maxAge 30d.
- Helper: `hashPassword`, `verifyPassword`, `signToken(user)`, `getSession()` (baca cookie di server component/route, return {userId, username, role} | null), `requireAuth()` (throw/return 401), `requireAdmin()` (401 jika tak login, 403 jika role bukan admin).
- Login throttling in-memory: maks 5 percobaan gagal per username+IP per 15 menit → 429.
- CSRF: cookie SameSite=Lax + cek header Origin/Referer pada semua POST/PATCH/DELETE API (tolak jika origin ada dan host-nya bukan host sendiri). Helper `checkOrigin(req)`.

## 4. API routes (Route Handlers, respons JSON seragam `{ ok: true, data }` / `{ ok: false, error: { code, message } }`)
- `POST /api/auth/register` { username, password } → 201 { user: {id, username, role} } + set cookie. Validasi: username 3-20 /^[a-z0-9_]+$/, password min 8. 409 jika username dipakai.
- `POST /api/auth/login` { username, password } → 200 + set cookie. 401 jika salah.
- `POST /api/auth/logout` → hapus cookie.
- `GET /api/auth/me` → { user } atau 401.
- `POST /api/fighters` (auth) body { displayName, igUsername, style, styleOther?, selfDescription } → 201 fighter. Satu fighter aktif per user → 409 jika sudah ada.
- `GET /api/fighters/[id]` publik → fighter + record + riwayat match (populate ringkas: tournament name, round, lawan, hasil, reelUrl).
- `PATCH /api/fighters/[id]` (owner) → edit identitas (displayName, igUsername, style, styleOther, selfDescription). Hanya owner.
- `GET /api/fighters?sort=wins&style=` → standings list (sort: wins desc, lalu kos desc, lalu losses asc; filter style opsional).
- `GET /api/tournaments?status=` → list ringkas + participantCount.
- `GET /api/tournaments/[slug]` → detail + entries (populate fighter ringkas) + bracket (matches populate fighter ringkas) + participantCount + countdown (regCloseAt).
- `POST /api/tournaments/[slug]/join` (auth) → cek: fighter aktif milik user ada (400 jika tidak), belum join (409), status turnamen 'upcoming', sekarang < regCloseAt, peserta < bracketSize. Buat entry. 200 { entry }.
- `POST /api/tournaments/[slug]/leave` (auth) → hanya sebelum regCloseAt; entry status 'withdrawn' (hapus dari daftar aktif). 200.
- `GET /api/tournaments/[slug]/bracket` → matches per ronde + byes.
- `GET /api/matches/[id]` → match + kedua fighter (nama + record) + reelUrl + turnamen.
- Admin API — SEMUA wajib: (a) role admin, (b) header `x-admin-path` == env ADMIN_SLUG, kalau tidak ada/salah → 404 (bukan 403, supaya path tidak bocor). Prefix `/api/admin/`:
  - `POST /api/admin/tournaments` { name, bracketSize, regOpenAt, regCloseAt, rules } → slug auto `night-fight-championship-N` (N = nomor urut turnamen, mulai 1). 201.
  - `PATCH /api/admin/tournaments/[id]` → edit name/rules/window; aksi khusus body { action: 'close' } → status 'closed'; { action: 'cancel' } → status 'cancelled' (hanya jika belum in_progress).
  - `POST /api/admin/tournaments/[id]/generate-bracket` → lib/bracket.ts (lihat §5). 400 jika peserta < 4 (pesan: turnamen butuh min 4 peserta) atau bracket sudah ada. Set status 'in_progress' (atau 'closed'→'in_progress'), simpan bracketSeed.
- `POST /api/admin/tournaments/[id]/reshuffle-bracket` → acak ulang pasangan ronde pertama dengan seed baru (2026-11-07, permintaan rangga). Hanya sebelum ada match non-bye yang decided (guard `canReshuffle` di lib/bracket.ts); match lama dihapus, match baru dibuat, seed entry + bracketSeed diperbarui. 400 jika sudah ada yang diundi.
  - `POST /api/admin/tournaments/[id]/draw-round` { round } → lib/draw.ts (§6): putuskan semua match 'scheduled' di ronde itu (bye tidak di-draw), buat videoTask per match yang diputuskan, majukan pemenang ke ronde berikut (buat match ronde berikut bila kedua slot terisi; jika ronde = F → set champion, status 'completed', entry champion). 400 jika ronde belum siap / sudah diputuskan.
  - `PATCH /api/admin/video-tasks/[id]` { status, reelUrl?, note? } → status 'uploaded' wajib reelUrl (valid URL instagram.com/reel atau instagram.com/p); set match reelUrl + status 'video_done'. 'blocked' wajib note. 'in_production' tanpa syarat.
  - `GET /api/admin/video-tasks?status=` → list + match + fighter ringkas.
  - `GET /api/admin/users` (query ?q=) → list user ringkas + fighter-nya. `PATCH /api/admin/users/[id]` { role?, banned? } — MVP: hanya ubah role user↔admin (banned ditunda; JANGAN implementasi banned). `GET /api/admin/fighters` → list + search. `PATCH /api/admin/fighters/[id]` → edit data fighter (moderasi).
  - `POST /api/admin/announce` { text } → nonaktifkan pengumuman lama, buat baru active. `GET /api/announcements/active` (publik) → pengumuman aktif atau null.
  - `GET /api/admin/stats` → { tournaments live, totalFighters, totalUsers, videoQueueDepth, pendingTasks }.
  - Setiap aksi admin tulis AdminAuditLog (helper `audit(adminUserId, action, targetType, targetId, detail)`).
- Validasi: semua input divalidasi di server (tipe, panjang, enum). Error: 400 validasi, 401 tak login, 403 role salah (non-admin API), 404 tak ditemukan / slug admin salah, 409 konflik, 429 rate limit, 503 AI belum siap.
- **Bentuk `data` (konvensi wrapper — WAJIB diikuti frontend DAN backend):** `data` SELALU objek bernama, tidak pernah array telanjang atau objek model telanjang.
  - List: `{ tournaments: [...] }`, `{ fighters: [...] }`, `{ videoTasks: [...] }`, `{ users: [...] }`.
  - Detail: `GET /api/tournaments/[slug]` → `{ tournament, entries, bracket, participantCount }`; `GET /api/fighters/[id]` → `{ fighter, history }`; `GET /api/matches/[id]` → `{ match }`; `GET /api/announcements/active` → `{ announcement }` (null bila tidak ada).
  - Single create/update: `{ fighter }`, `{ tournament }`, `{ videoTask }`, `{ announcement }`, `{ user }`, `{ entry }`.
    - Frontend wajib unwrap field bernama ini di call site (server: `dataOr(res, { tournaments: [] }).tournaments`; client: `res.data.tournaments`). Jangan pernah menganggap `data` sebagai array/objek model langsung.

## 5. Bracket (lib/bracket.ts) — fungsi murni, WAJIB unit test
- `largestPowerOfTwo(n)`: terbesar 2^k ≤ n, min 4 (n<4 → throw).
- `buildBracket(entries: string[]): { target, rounds, matches, byes }` — entries = fighterId acak (shuffle Fisher-Yates dengan seed acak; kembalikan juga `bracketSeed`).
  - target = largestPowerOfTwo(n); n===target → 0 bye, semua masuk ronde pertama (roundName dari target: 32→'R32', 16→'R16', 8→'QF').
  - n>target → matchesR1 = n - target, byes = 2*target - n. Ronde pertama berisi matchesR1 match + byes fighter yang langsung lolos ke ronde berikut. Match bye: fighterBId null, isBye true, winnerId = fighterAId, method 'bye', status 'decided', drawSeed 0.
  - Ronde berikut dibuat kosong (slot terisi saat draw ronde sebelumnya) — ATAU dibuat penuh dengan placeholder null: PILIHAN: buat match ronde berikut hanya saat kedua pemenang diketahui (fungsi `advanceWinners(tournamentId, round)` di lib/draw.ts).
- `roundNameForTarget(target)`: 32→['R32','R16','QF','SF','F'], 16→['R16','QF','SF','F'], 8→['QF','SF','F'].
- `nextRound(round)`: R32→R16, R16→QF, QF→SF, SF→F, F→null.

## 6. Draw (lib/draw.ts) — fungsi murni, seeded RNG, WAJIB unit test
- `mulberry32(seed: number): () => number` (0..1).
- Damage model: jab 8, cross 10, hook 12, uppercut 14, lowKick 14, bodyKick 16, headKick 18, blockChip 2. Strike pool (bobot sama): ['jab','cross','hook','uppercut','lowKick','bodyKick','headKick'].
- `simulateFight(seed): { method, winner: 'A'|'B', scoreA, scoreB, koTimeSec|null, rolls }`:
  - rng = mulberry32(seed). method = rng()<0.5 ? 'KO' : 'decision'. winner = rng()<0.5 ? 'A' : 'B'.
  - Simulasi per 5 detik (12 tick untuk 60 dtk): tiap tick tiap fighter pilih strike acak; lawan block dengan peluang 0.3 → damage = 2, kalau tidak block → damage penuh strike. Akumulasi scoreA/scoreB = total damage yang DIBERIKAN.
  - Jika KO: koTimeSec = 35 + floor(rng()*21) (35–55). Simulasi hanya sampai tick koTimeSec; pukulan terakhir pemenang = KO blow (pastikan score pemenang > score lawan; jika tidak, tambah damage pukulan KO secukupnya). Skor akhir = damage sampai KO. **Pemenang KO = hasil roll winner (rng kedua).**
  - Jika decision: skor penuh 60 dtk. **Pemenang decision = skor lebih tinggi (bukan roll winner) — roll winner hanya dipakai untuk KO.** Jika scoreA === scoreB → method 'draw', winner null; lalu re-roll advancer: advancer = rng()<0.5 ? 'A' : 'B', drawReRollSeed = floor(rng()*2**31).
  - Kembalikan juga `rolls` (array angka roll mentah) untuk audit.
- `decideMatch(match, seed)` (service, pakai DB): set winnerId/method/score/koTimeSec/drawSeed/drawAdvancerId/drawReRollSeed/status 'decided'/decidedAt; update record kedua fighter (wins/losses/draws/kos); buat videoTask (kecuali bye); panggil advanceWinners.
- Aturan rekor: KO → pemenang wins+1 & kos+1, kalah losses+1. Decision → wins+1 / losses+1. Draw → keduanya draws+1 (advancer tetap maju bracket).

## 7. Persona AI — DIHAPUS 2026-11-07
- Perintah rangga ("Jgn kasih persona persona" + "Hapus"): fitur persona AI dihapus total — route `POST /api/fighters/[id]/ai-generate`, `src/lib/gemini.ts`, field `aiPersona` + `regenCount` di model, semua tampilan persona (form, profil, kartu, bracket, klasemen, admin), dan env `GEMINI_API_KEY` di Vercel. Latar belakang: generate persona menggantung ~10 menit (model Gemini overload 503 + tidak ada timeout) — sempat diperbaiki (model lite + timeout 45/75 dtk, deploy-main7), lalu dihapus atas perintahnya sebelum dipakai.
- Fighter sekarang hanya: displayName, igUsername, style (+styleOther), selfDescription. Warna kartu = `styleColor(style)` (components/api.ts).


## 8. Seed (scripts/seed.ts, jalankan `npm run seed`)
- Butuh env: MONGODB_URI, ADMIN_USERNAME, ADMIN_PASSWORD (JANGAN hardcode; jika kosong → error jelas dan berhenti).
- Buat/reset admin user (role admin, username dari env) + 1 turnamen contoh "Night Fight Championship #1" status upcoming, regOpenAt = sekarang, regCloseAt = +7 hari, bracketSize 32, rules default, TANPA peserta. Idempotent (jalan 2x tidak duplikat).
- `package.json` scripts: `dev`, `build`, `start`, `lint`, `test` (vitest run), `test:watch`, `seed` (tsx scripts/seed.ts), `typecheck` (tsc --noEmit).

## 9. Admin UI (frontend, path rahasia)
- Route dinamis top-level `src/app/[adminSlug]/` — tiap page cek `params.adminSlug === process.env.ADMIN_SLUG` (server component; jika tidak sama → `notFound()`). JANGAN hardcode slug di kode manapun. JANGAN link ke path admin dari halaman publik manapun. `robots.ts`: disallow `/${ADMIN_SLUG}` (baca dari env; jika env kosong → disallow `/*admin*` generik? TIDAK — jika env kosong, robots tetap sediakan `Disallow: /` untuk path yang mengandung 'arena-control'; sederhananya: robots.ts selalu disallow path admin dari env, dan jika env kosong, jangan expose apapun).
- Halaman admin: login (form username+password → POST /api/auth/login; cek role admin di client, tolak jika bukan admin), dashboard (stats + ringkasan), turnamen (list + buat + edit + tutup/batal + generate bracket + draw round + lihat bracket), video tasks (queue + filter status + attach Reel URL + tandai blocked/in_production), fighter & user (cari + lihat data fighter), pengumuman (buat banner). Semua fetch admin kirim header `x-admin-path: <slug dari URL>` (client baca dari pathname segment pertama).
- Middleware TIDAK dipakai untuk proteksi admin (cek di tiap page + API). `middleware.ts` TIDAK dibuat (hindari konflik).

## 10. Halaman publik (frontend)
- `/` home: hero display besar "NIGHT FIGHT CHAMPIONSHIP", banner pengumuman aktif, turnamen upcoming/live, juara terakhir, top 5 klasemen, CTA daftar/buat fighter, link IG @streetfightstickman (https://www.instagram.com/streetfightstickman).
- `/turnamen`: list + filter status.
- `/turnamen/[slug]`: detail + countdown deadline (client component, update tiap detik) + jumlah peserta live + daftar peserta + bracket pohon interaktif (garis siku + kolom Juara, 2026-11-07) + tombol Join/Leave (auth; konfirmasi 1x via window.confirm atau modal kecil). Pasangan ronde pertama diacak otomatis saat bracket dibuat.
- `/pertandingan/[id]`: dua fighter berdampingan, hasil, Reel (link + embed sederhana bila URL instagram), skor/KO time.
- `/fighter/[id]`: profil publik (rekor, badge Champion/KO Artist/Undefeated, riwayat fight + link video, deskripsi diri).
- `/klasemen`: leaderboard + filter style.
- `/daftar`, `/masuk`: form auth (validasi client + tampilkan error server).
- `/fighter-saya`: form buat fighter (4 isian: nama tampil, IG, gaya, deskripsi) + CTA "Gabung Turnamen" setelah dibuat; edit fighter yang sudah ada.
- Semua halaman data: loading, error, empty state. Semua teks Indonesia. Satu H1 per halaman. Metadata unik per halaman (title/description).
- Navbar: logo "STREET FIGHT HUB", link Turnamen, Klasemen, Fighter Saya (jika login), Masuk/Daftar atau username + Keluar. Mobile: menu hamburger. Footer: link IG, "Bukan situs resmi Instagram", copyright.

## 11. Env & file pendukung
- `.env.example`: MONGODB_URI, GEMINI_API_KEY, JWT_SECRET, ADMIN_SLUG, ADMIN_USERNAME, ADMIN_PASSWORD — NAMA + placeholder contoh saja, TANPA nilai asli. `.env.local` di `.gitignore` (scaffold default sudah).
- `README.md`: cara jalan lokal, env yang dibutuhkan, cara seed, cara test, struktur folder, catatan kekurangan.
- `public/robots.txt` JANGAN dibuat statis (pakai `src/app/robots.ts`). `src/app/sitemap.ts`: URL publik saja (home, turnamen list, klasemen; detail turnamen/fighter dinamis — sertakan bila mudah dari DB, kalau tidak, skip dinamis).
