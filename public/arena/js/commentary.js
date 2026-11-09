// commentary.js — Play-by-play generator (teks).
// Aturan KOMENTATOR.md: VO natural (kalimat pendek, seruan spontan), PBP
// SATSET (panggil serangan saat dilancarkan / sesaat sebelum kena — karena
// timeline sudah digenerate, baris PBP dijadwalkan di windup start, jadi
// seruan jatuh TEPAT di frame kontak), dan komentator TIDAK BOLEH DIAM
// (jeda sunyi maksimal ~2 detik — celah diisi analisis/hype/obrolan).
// Dua komentator TANPA NAMA (aturan user 2026-11-07 ~20:32): Komentator 1
// (energik, kuning) dan Komentator 2 (energik, cyan) — dibedakan HANYA lewat
// warna dan suara. Suara = klip rekaman TTS (Rushing Jetty + Vibrant Boulder),
// BUKAN Web Speech API (lihat js/voice.js + js/vo-manifest.js).
// Setiap baris membawa `clips` (id klip suara yang diputar untuk baris itu);
// teks tampil boleh memuat nama petarung, tapi AUDIO tidak pernah memuat
// nama (nama/skor hanya tampil sebagai teks di layar).
//
// ATURAN PENAMAAN (audit PBP 2026-11-08, seed 982809 — "Butterfly kick!"
// padahal tidak ada tendangan, "Tapi diblock!" 2x, "Jab masuk!" padahal
// di-slip):
//  1. Seruan memanggil USAHA serangan, BUKAN hasil — kata hasil ("masuk",
//     "kena", "jatuh", "dibanting", "didorong mundur") DILARANG di pool
//     CALLS, karena ~30% serangan berakhir dodge (slip/duck/roll/sidestep/
//     parry/flinch) dan seruan jatuh di awal windup, SEBELUM hasil diketahui.
//     Hasil hanya muncul lewat sufiks eksplisit: block -> BLOCKED,
//     knockdown -> "Jatuh! Knockdown!" (keduanya fakta dari event).
//  2. Penamaan Indonesia yang KONSISTEN per gerakan: tiap kind punya SATU
//     nama Indonesia kanonik (dipakai >= 3 dari 5 varian). Nama teknik asli
//     (Seoi Nage, Osoto Gari, Gyaku Zuki, ...) dan istilah yang sudah baku
//     di komentar Indonesia (Jab, Hook, Uppercut, Cross, Clinch, Feint,
//     Takedown, Teep) boleh muncul sebagai SATU varian. Nama tendangan
//     SELALU Indonesia ("Tendangan kupu-kupu!", BUKAN "Butterfly kick!").
//  3. TIDAK ADA pengulangan beruntun: varian yang sama untuk kind yang sama
//     tidak boleh muncul dua kali berturut-turut, dan teks yang sama persis
//     tidak boleh muncul dua baris berturut-turut (antar kind bisa berbagi
//     teks generik). Dilacak lewat lastViByKind + lastCallText.
//  4. NADA ENERGIK: seruan + hype ("WOW!", "GILA!", "DUAAR!") supaya TTS
//     membawakannya dengan semangat, bukan dingin.
import { normalizeStyle } from './moves.js';

export const COMMENTATORS = {
  c1: { color: '#EAB308', tone: 'energik' },
  c2: { color: '#22D3EE', tone: 'energik' },
};

export const CALLS = {
  jab: ['Jab!', 'Jab cepat!', 'WOW, jab kilat!', 'Jab lurus!', 'Jab, cepat banget!'],
  jabR: ['Jab kanan!', 'Jab tangan kanan!', 'WOW, jab kanan!', 'Jab kanan cepat!', 'Pukulan kanan lurus!'],
  cross: ['Pukulan silang!', 'Cross keras!', 'WOW, straight!', 'Pukulan lurus keras!', 'Silang, DUAAR!'],
  hook: ['Hook!', 'Hook melayang!', 'WOW, hook!', 'Pukulan kait!', 'Hook, keras banget!'],
  hookR: ['Hook kanan!', 'Hook kanan melayang!', 'WOW, hook kanan!', 'Pukulan kait kanan!', 'Hook kanan, DUAAR!'],
  uppercut: ['Uppercut!', 'Uppercut dari bawah!', 'WOW, uppercut!', 'Pukulan dari bawah!', 'Uppercut ke dagu!'],
  bodyshot: ['Pukulan ke badan!', 'Hook ke rusuk!', 'WOW, ke badan!', 'Bodyshot keras!', 'Hantam rusuk!'],
  bodyshotR: ['Hook kanan ke badan!', 'Pukulan kanan ke rusuk!', 'WOW, hook kanan!', 'Bodyshot kanan!', 'Hantam rusuk kanan!'],
  lowkick: ['Tendangan ke paha!', 'Tebas paha!', 'WOW, tebas paha!', 'Tendangan bawah!', 'Tebas paha luar!'],
  bodykick: ['Tendangan ke badan!', 'Tendangan ke rusuk!', 'WOW, ke rusuk!', 'Tulang kering ke badan!', 'Tendangan melingkar!'],
  headkick: ['Tendangan ke kepala!', 'Tendangan tinggi!', 'WOW, tinggi banget!', 'GILA, tendangan kepala!', 'Tendangan tinggi, keras!'],
  teep: ['Teep!', 'Tendangan dorong!', 'WOW, didorong!', 'Teep jaga jarak!', 'Dorong ke depan!'],
  knee: ['Lutut!', 'Lutut ke badan!', 'WOW, lutut!', 'Dengkulan keras!', 'Lutut naik!'],
  elbow: ['Sikut!', 'Sikut tajam!', 'Sikut keras!', 'Siku menyilang!', 'Sikut, tajam banget!'],
  flyknee: ['Lutut terbang!', 'WOW, lutut terbang!', 'GILA, terbang!', 'Lutut terbang ke muka!', 'Lompat, lutut!'],
  frontkick: ['Tendangan depan!', 'WOW, tendangan depan!', 'Dorong bola kaki!', 'Tendangan lurus!', 'Tendangan depan, keras!'],
  roundhouse: ['Tendangan memutar!', 'WOW, memutar!', 'Tendangan berputar!', 'Putaran kaki!', 'Tendangan memutar, keras!'],
  spinkick: ['Tendangan putar!', 'WOW, putaran 180!', 'Tendangan putar cepat!', 'Putar, tendang!', 'Tendangan putar, DUAAR!'],
  axekick: ['Tendangan kapak!', 'WOW, kapak!', 'Tebasan dari atas!', 'Tendangan tebas!', 'Kapak turun!'],
  overhand: ['Overhand!', 'Pukulan dari atas!', 'WOW, dari atas!', 'Ayunan dari atas!', 'Pukulan menukik!'],
  haymaker: ['Haymaker!', 'Ayunan lebar!', 'WOW, ayunan lebar!', 'Pukulan lebar!', 'Ayunan besar!'],
  shove: ['Dorongan!', 'Dorong dua tangan!', 'WOW, didorong!', 'Dorongan keras!', 'Dorong, kuat!'],
  takedown: ['Takedown!', 'Shoot ke kaki!', 'WOW, takedown!', 'Serbu ke kaki!', 'Coba banting!'],
  clinch: ['Clinch!', 'Clinch, rapat!', 'WOW, clinch!', 'Rangkul kepala!', 'Clinch, kontrol!'],
  sweep: ['Sapuan!', 'Sapuan rendah!', 'WOW, sapuan!', 'Sapu kaki!', 'Sapuan kaki!'],
  stickswing: ['Ayunan kayu!', 'Kayu berputar!', 'WOW, kayu!', 'Ayunan tongkat!', 'Kayu melayang!'],
  stickchop: ['Tebasan kayu!', 'Kayu dari atas!', 'WOW, tebasan kayu!', 'Tebas kayu!', 'Kayu menebas!'],
  feint: ['Feint!', 'Pancingan!', 'WOW, pancingan!', 'Gerakan tipu!', 'Tipuan!'],
  finisher: ['FINISHER!', 'WOW, FINISHER!', 'Ini dia!', 'Pukulan penutup!', 'DUAAR, finisher!'],
  // Kind baru gaya Fase 1 Hub (2026-11-07).
  abaniko: ['Abaniko!', 'Kibasan kipas!', 'WOW, abaniko!', 'Jentikan kipas!', 'Kibasan cepat!'],
  sinawali: ['Anyaman!', 'Anyaman cepat!', 'WOW! Anyaman!', 'Anyaman tangan!', 'Rentetan anyaman!'],
  redonda: ['Redonda!', 'Putaran melingkar!', 'WOW, redonda!', 'Tebasan melingkar!', 'Putaran penuh!'],
  seoinage: ['Seoi nage!', 'Lemparan bahu!', 'WOW, seoi nage!', 'Putar, angkat!', 'Bantingan bahu!'],
  osotogari: ['Osoto gari!', 'Sabit luar!', 'WOW, osoto gari!', 'Sabit kaki luar!', 'Sabit dari luar!'],
  uchimata: ['Uchi mata!', 'Sapu paha dalam!', 'WOW, uchi mata!', 'Sapuan paha!', 'Uchi mata, sapu!'],
  headbutt: ['Sundulan!', 'Sundulan kepala!', 'WOW, sundulan!', 'Kepala maju!', 'Sundul!'],
  yokogeri: ['Tendangan samping!', 'Yoko geri!', 'WOW, tendangan samping!', 'Tendangan tumit!', 'Samping, keras!'],
  straightlead: ['Pukulan lurus cepat!', 'Straight lead!', 'WOW, lurus!', 'Lurus, cepat!', 'Pukulan depan lurus!'],
  sidekick: ['Tendangan samping JKD!', 'WOW, tendangan jauh!', 'Tendangan tumit!', 'Tendangan jauh!', 'Samping, DUAAR!'],
  shuto: ['Shuto!', 'Tangan pisau!', 'WOW, shuto!', 'Tebasan tangan!', 'Tangan pisau, tebas!'],
  gyakuzuki: ['Gyaku zuki!', 'Pukulan balik!', 'WOW, gyaku zuki!', 'Pukulan pinggul!', 'Balik, keras!'],
  maegeri: ['Mae geri!', 'Tendangan depan karate!', 'WOW, mae geri!', 'Tendangan snap!', 'Geri depan!'],
  armada: ['Armada!', 'Putaran 360!', 'WOW, armada!', 'Tendangan 360!', 'Putaran 360, tendang!'],
  meialua: ['Meia lua!', 'Setengah bulan!', 'WOW, meia lua!', 'Tendangan kompas!', 'Bulan sabit!'],
  queixada: ['Queixada!', 'Tendangan sabit!', 'WOW, queixada!', 'Sabit luar dalam!', 'Tendangan silang!'],
  tornadokick: ['Tendangan tornado!', 'WOW, tornado!', 'Putaran tornado!', 'GILA, tornado!', 'Tornado, putar!'],
  butterflykick: ['Tendangan kupu-kupu!', 'WOW, kupu-kupu!', 'Tendangan melayang!', 'GILA, kupu-kupu!', 'Kupu-kupu terbang!'],
  lotuskick: ['Tendangan lotus!', 'WOW, lotus!', 'Tendangan sabit lotus!', 'Sabit melingkar!', 'Lotus, melingkar!'],
  // Kind baru 2026-11-08 (5 varian tiap kind, Indonesia, seruan USAHA
  // bukan hasil — tanpa "masuk/kena/jatuh/dibanting"; nama teknik asli
  // boleh jadi SATU varian, seperti 'Seoi nage!').
  doubleleg: ['Double leg!', 'Shoot dua kaki!', 'WOW, double leg!', 'Peluk dua paha!', 'Dorong ke depan!'],
  singleleg: ['Single leg!', 'Tangkap satu kaki!', 'WOW, single leg!', 'Angkat satu kaki!', 'Lari ke sudut!'],
  suplex: ['Suplex!', 'WOW, suplex!', 'Angkat ke belakang!', 'German suplex!', 'Lengkung ke belakang!'],
  bodyslam: ['Body slam!', 'WOW, body slam!', 'Angkat horizontal!', 'Scoop slam!', 'Banting ke matras!'],
  kneediag: ['Lutut diagonal!', 'Lutut menyilang!', 'WOW, lutut diagonal!', 'Lutut ke rusuk!', 'Dengkul menyilang!'],
  elbowup: ['Sikut atas!', 'Sikut dari bawah!', 'WOW, sikut atas!', 'Sikut ke dagu!', 'Sikut naik!'],
  elbowspin: ['Sikut memutar!', 'Spinning elbow!', 'WOW, sikut putar!', 'Putar, sikut!', 'Sikut berputar!'],
  spinhookkick: ['Tendangan kait putar!', 'Spinning hook kick!', 'WOW, tendangan kait!', 'Tumit mengait!', 'Tendangan kait berputar!'],
  meialuafrente: ['Meia lua de frente!', 'Bulan sabit depan!', 'WOW, meia lua!', 'Sabit depan!', 'Tendangan bulan sabit!'],
  ginga: ['Ginga!', 'Goyang ginga!', 'WOW, ginga!', 'Ayunan capoeira!', 'Ginga, bergerak terus!'],
  pilantik: ['Pilantik!', 'Cambukan pilantik!', 'WOW, pilantik!', 'Putaran di atas kepala!', 'Cambuk 360!'],
  armbar: ['Armbar!', 'Kuncian lengan!', 'WOW, armbar!', 'Juji gatame!', 'Kunci lengan!'],
  anklepick: ['Ankle pick!', 'Sentak pergelangan!', 'WOW, ankle pick!', 'Tangkap pergelangan!', 'Sentak kaki!'],
  outsidetrip: ['Outside trip!', 'Kait kaki luar!', 'WOW, outside trip!', 'Trip dari clinch!', 'Kait dari luar!'],
};

// Sufiks hasil saat serangan di-block (fakta dari event — BUKAN klaim).
// 3 varian supaya "Tapi diblock!" tidak berulang verbatim tiap block
// (temuan audit seed 982809). Dipilih dengan pelacak anti-ulang yang sama.
export const BLOCKED = ['Tapi diblock!', 'Tapi ditahan guard!', 'Kena guard, tidak tembus!'];

export const FILLERS = [
  // Reaksi
  ['c1', 'Wah, jual beli serangan terus!'],
  ['c2', 'Keduanya belum mau mundur.'],
  ['c1', 'Penonton bersorak, suasananya panas!'],
  ['c2', 'Jaga jarak dulu, cari celah.'],
  ['c1', 'Siapa yang lebih sabar di sini?'],
  ['c2', 'Guard tetap naik, disiplin banget.'],
  // Analisis
  ['c1', 'Kakinya ringan banget, footwork-nya bagus!'],
  ['c2', 'Dia tunggu momen, tidak asal pukul.'],
  ['c1', 'Stance-nya rapat, susah ditembus!'],
  ['c2', 'Napasnya masih teratur, stamina aman.'],
  ['c1', 'Satu kesalahan kecil bisa berakibat fatal!'],
  ['c2', 'Perhatikan pivot kakinya, itu kuncinya.'],
  // Hype / penonton
  ['c1', 'Arena bergemuruh!'],
  ['c2', 'Sorakan makin kencang!'],
  ['c1', 'Ini yang penonton mau!'],
  ['c2', 'Duel yang ketat, susah ditebak!'],
  // Obrolan antar komentator
  ['c1', 'Menurutmu siapa yang unggul sejauh ini?'],
  ['c2', 'Masih imbang, tapi momentum mulai bergeser.'],
  ['c1', 'Setuju, satu pukulan bersih bisa mengubah segalanya.'],
  ['c2', 'Benar, di sini tidak ada yang aman.'],
  ['c1', 'Kamu lihat tadi? Hampir kena!'],
  ['c2', 'Iya, selisih beberapa senti saja.'],
  // Tambahan (audit 2026-11-08: 22 -> 40 supaya filler tidak cepat berulang)
  ['c1', 'WAH, tempo makin panas!'],
  ['c2', 'Dua-duanya masih segar, ini masih panjang.'],
  ['c1', 'Lihat footwork-nya, tidak diam sedetik pun!'],
  ['c2', 'Dia baca gerakan lawan dengan sabar.'],
  ['c1', 'Satu kombinasi bersih bisa menutup ronde ini!'],
  ['c2', 'Tangan tetap di atas, dagu terlindungi.'],
  ['c1', 'Penonton berdiri semua, luar biasa!'],
  ['c2', 'Ritme fight-nya cepat banget malam ini.'],
  ['c1', 'Siapa yang tahan lebih lama, dia yang menang!'],
  ['c2', 'Jangan lengah, satu celah saja cukup.'],
  ['c1', 'WOW, hampir saja! Penonton menahan napas!'],
  ['c2', 'Keduanya saling menghormati, tapi tidak ada yang mengalah.'],
  ['c1', 'Ini baru fight! Tidak ada yang main aman!'],
  ['c2', 'Perhatikan napasnya, masih stabil.'],
  ['c1', 'Satu serangan lagi bisa mengubah segalanya!'],
  ['c2', 'Disiplin banget, tidak ada pukulan sia-sia.'],
  ['c1', 'Suasana makin panas, arena berguncang!'],
  ['c2', 'Masih imbang, juri pasti sulit menilai.'],
];

// Pilih satu baris dari pool dengan RNG seed (deterministik).
// (Dipakai generatePBP lewat indeks vi di bawah; helper ini dipertahankan
// untuk pemakaian luar — jangan hapus tanpa cek importir.)
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate daftar baris PBP dari timeline fight.
// fight: { events: [{t, type:'attack'|'pickup'|'ko'|'end', attacker, move, ...}],
//          introEnd, fightEnd, winnerName, loserName, result, fighters }
// windupDurOf dipakai untuk menaruh seruan di awal windup (bukan setelah kena).
export function generatePBP(fight, windupDurOf, rng) {
  const lines = [];
  const { left, right } = fight.fighters;
  let lastT = 0;
  let turn = 0; // giliran komentator
  let fillerIdx = Math.floor(rng() * FILLERS.length);
  // --- Anti-ulang (audit 2026-11-08) ---
  // lastCallText = teks baris terakhir yang diucapkan (apa pun jenisnya);
  // lastViByKind = indeks varian terakhir per kind; lastBlockedIdx =
  // indeks sufiks block terakhir. Seruan yang sama tidak boleh muncul
  // dua baris berturut-turut, dan varian yang sama untuk kind yang sama
  // tidak boleh muncul dua kali berturut-turut.
  let lastCallText = '';
  const lastViByKind = {};
  let lastBlockedIdx = -1;

  const say = (t, who, text, clips = []) => {
    lines.push({ t, who, text, clips });
    lastT = Math.max(lastT, t);
    lastCallText = text;
  };

  // Pilih varian seruan untuk satu kind, tanpa mengulang varian terakhir
  // kind itu dan tanpa mengulang teks baris sebelumnya. Deterministik:
  // tidak ada tarikan rng tambahan — geser indeks secara siklis.
  const pickCall = (kind) => {
    const variants = CALLS[kind];
    if (!variants) return { call: 'Masuk!', vi: -1, variants: null };
    let vi = Math.floor(rng() * variants.length);
    if (variants.length > 1 && vi === lastViByKind[kind]) vi = (vi + 1) % variants.length;
    let guard = 0;
    while (variants[vi] === lastCallText && guard++ < variants.length) vi = (vi + 1) % variants.length;
    lastViByKind[kind] = vi;
    return { call: variants[vi], vi, variants };
  };

  // Pilih sufiks block, tanpa mengulang sufiks block sebelumnya.
  const pickBlocked = () => {
    let bi = Math.floor(rng() * BLOCKED.length);
    if (BLOCKED.length > 1 && bi === lastBlockedIdx) bi = (bi + 1) % BLOCKED.length;
    lastBlockedIdx = bi;
    return { text: BLOCKED[bi], bi };
  };

  // Intro (selama dash masuk). Teks tampil boleh memuat nama; klip audio
  // TIDAK memuat nama (lihat daftar klip tetap di scripts/gen_vo.mjs).
  say(0.2, 'c1', `Selamat datang di Street Fight! ${left.name} lawan ${right.name}!`, ['c1-intro-welcome']);
  say(1.4, 'c2', `${left.name} gaya ${styleLabel(left.style)}, ${right.name} gaya ${styleLabel(right.style)}.`, ['c2-intro-styles']);
  say(2.4, 'c1', 'Dua-duanya sudah siap. Ini dia!', ['c1-intro-ready']);

  // Serangan: seruan di awal windup.
  for (const ev of fight.events) {
    if (ev.type === 'pickup') {
      say(ev.t - 0.2, 'c1', `Wah, ${ev.fighter} ambil kayu!`, ['c1-pickup-wood']);
      say(ev.t + 0.6, 'c2', 'Pertarungan berubah, sekarang ada senjata.', ['c2-pickup-weapon']);
      continue;
    }
    if (ev.type !== 'attack') continue;
    const windup = windupDurOf(ev.move.kind);
    const callT = Math.max(0, ev.t - windup);
    const who = turn % 2 === 0 ? 'c1' : 'c2';
    turn++;
    const { call, vi, variants } = pickCall(ev.move.kind);
    const callClip = variants
      ? `${who}-${ev.move.kind}-${vi + 1}`
      : `${who}-masuk`;
    // Isi celah sunyi: filler tiap jeda > 1.6 detik sebelum serangan ini.
    // (gapStart HARUS dibaca SEBELUM say() — kalau sesudah, gap selalu 0.)
    const gapStart = lastT;
    if (callT - gapStart > 1.6) {
      let fi = fillerIdx % FILLERS.length;
      let [fwho, ftext] = FILLERS[fi];
      // Filler tidak boleh mengulang teks baris sebelumnya.
      if (ftext === lastCallText) {
        fillerIdx++;
        fi = fillerIdx % FILLERS.length;
        [fwho, ftext] = FILLERS[fi];
      }
      fillerIdx++;
      say(callT - 1.1, fwho, ftext, [`${fwho}-filler-${fi + 1}`]);
    }
    if (ev.blocked) {
      const { text: bText, bi } = pickBlocked();
      say(callT, who, `${call} ${bText}`, [callClip, `${who}-blocked-${bi + 1}`]);
    } else {
      say(callT, who, call, [callClip]);
    }
    if (ev.knockdown) {
      const other = who === 'c1' ? 'c2' : 'c1';
      say(ev.t + 0.15, other, 'Jatuh! Knockdown!', [`${other}-knockdown`]);
    }
  }

  // Akhir fight.
  const endT = fight.fightEnd;
  if (fight.result === 'ko') {
    say(endT + 0.3, 'c1', `KO! ${fight.winnerName} menang!`, ['c1-ko-win']);
    say(endT + 1.6, 'c2', 'Wasit menghitung, tidak bangun. Selesai!', ['c2-ko-count']);
  } else if (fight.result === 'draw') {
    // Seri (10% undian, 2026-11-08): winnerName tidak ada — jangan pakai
    // nama pemenang di sini (app.js mengisi nama kanan bila winner null).
    say(endT + 0.3, 'c1', 'Seri! Juri memutuskan imbang!', ['c1-draw']);
    say(endT + 1.6, 'c2', 'Tidak ada pemenang, skor sama kuat!', ['c2-draw']);
  } else {
    say(endT + 0.3, 'c1', 'Bel berbunyi, fight selesai!', ['c1-end-bell']);
    say(endT + 1.6, 'c2', `Juri memutuskan: ${fight.winnerName} menang angka!`, ['c2-decision-win']);
  }
  say(endT + 3.0, 'c1', 'Sampai jumpa di fight berikutnya!', ['c1-outro-bye']);

  // Urutkan, dan pastikan tidak ada dua baris di detik yang sama persis.
  lines.sort((a, b) => a.t - b.t);
  return lines;
}

function styleLabel(style) {
  const key = normalizeStyle(style);
  return {
    tinju: 'Tinju', muaythai: 'Muay Thai', taekwondo: 'Taekwondo',
    silat: 'Silat', gulat: 'Gulat', brawler: 'Brawler Jalanan',
    kali: 'Kali Arnis', judo: 'Judo', kudo: 'Kudo', jkd: 'Jeet Kune Do',
    karate: 'Karate', capoeira: 'Capoeira', wushu: 'Wushu',
  }[key] || style;
}

// Baris yang sedang aktif pada waktu sim t (yang terakhir dimulai).
export function activeLine(lines, t) {
  let cur = null;
  for (const l of lines) {
    if (l.t <= t) cur = l;
    else break;
  }
  return cur;
}
