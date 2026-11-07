// moves.js — Move library per bela diri.
// Tiap gerakan: kind (kunci di techniques.js), label tampilan, dmg (cermin
// DMG_BASE film.js), range, power (ambang smear/speed-lines & besar SFX),
// target, dan catatan teknik singkat.
// Damage dihitung ulang oleh fight director; block = chip 2 (BLOCK_CHIP).
// Durasi & pacing mengikuti CF2_TIME_SCALE di techniques.js (jab 0.26 dtk
// dst.) — JANGAN ubah angka di sini untuk pacing, itu milik techniques.js.

export const STYLES = {
  tinju: {
    label: 'Tinju',
    desc: 'Pukulan + footwork + head movement, tanpa tendangan.',
    moves: [
      { kind: 'jab',       label: 'Jab',            dmg: 8,  range: 'mid',  power: 0.5, target: 'head', note: 'Pukulan tercepat, ukur jarak.' },
      { kind: 'cross',     label: 'Cross',          dmg: 10, range: 'mid',  power: 0.7, target: 'head', note: 'Pukulan tenaga, pivot tumit belakang 90°.' },
      { kind: 'hook',      label: 'Hook',           dmg: 12, range: 'close', power: 0.8, target: 'head', note: 'Busur horizontal, siku tetap ~90°.' },
      { kind: 'uppercut',  label: 'Uppercut',       dmg: 14, range: 'close', power: 0.8, target: 'head', note: 'Dari bawah, load dari lutut bukan tangan.' },
      { kind: 'bodyshot',  label: 'Bodyshot',       dmg: 12, range: 'close', power: 0.7, target: 'body', note: 'Hook ke badan, tekuk lutut turun level.' },
      { kind: 'feint',     label: 'Feint',          dmg: 0,  range: 'mid',  power: 0.1, target: 'head', note: 'Pancingan setengah jab.' },
      { kind: 'finisher',  label: 'Cross Berat',    dmg: 20, range: 'mid',  power: 1.0, target: 'head', note: 'Finisher KO — hanya di akhir jalur KO.' },
    ],
  },
  muaythai: {
    label: 'Muay Thai',
    desc: 'Tendangan + lutut + siku + clinch. Senjata: tulang kering.',
    moves: [
      { kind: 'jab',       label: 'Jab',            dmg: 8,  range: 'mid',  power: 0.5, target: 'head', note: 'Jab Muay Thai, guard tetap naik.' },
      { kind: 'cross',     label: 'Cross',          dmg: 10, range: 'mid',  power: 0.7, target: 'head', note: 'Straight lurus menembus guard.' },
      { kind: 'hook',      label: 'Hook',           dmg: 12, range: 'close', power: 0.8, target: 'head', note: 'Hook pendek, siku 90°.' },
      { kind: 'lowkick',   label: 'Low Kick',       dmg: 14, range: 'mid',  power: 0.7, target: 'leg',  note: 'Tebas paha luar, tulang kering.' },
      { kind: 'bodykick',  label: 'Body Kick',      dmg: 16, range: 'mid',  power: 0.9, target: 'body', note: 'Roundhouse ke rusuk/liver, pivot 90-135°.' },
      { kind: 'headkick',  label: 'Head Kick',      dmg: 18, range: 'mid',  power: 1.0, target: 'head', note: 'Finisher — naik dulu baru chop ke bawah.' },
      { kind: 'teep',      label: 'Teep',           dmg: 10, range: 'long', power: 0.5, target: 'body', note: 'Tendangan dorong, jaga jarak.' },
      { kind: 'knee',      label: 'Knee',           dmg: 16, range: 'close', power: 0.9, target: 'body', note: 'Lutut lurus dari clinch (plum).' },
      { kind: 'elbow',     label: 'Elbow',          dmg: 14, range: 'close', power: 0.9, target: 'head', note: 'Siku horizontal jarak dekat.' },
      { kind: 'flyknee',   label: 'Flying Knee',    dmg: 20, range: 'mid',  power: 1.0, target: 'head', note: 'Lutut terbang — finisher KO.' },
      { kind: 'finisher',  label: 'Cross Berat',    dmg: 20, range: 'mid',  power: 1.0, target: 'head', note: 'Finisher KO — hanya di akhir jalur KO.' },
    ],
  },
  taekwondo: {
    label: 'Taekwondo',
    desc: 'Tendangan cepat + jaga jarak. Tangan hanya jab pengukur.',
    moves: [
      { kind: 'frontkick', label: 'Front Kick',     dmg: 10, range: 'long', power: 0.6, target: 'body', note: 'Ap chagi — dorong bola kaki lurus.' },
      { kind: 'roundhouse',label: 'Roundhouse',     dmg: 16, range: 'mid',  power: 0.9, target: 'body', note: 'Dollyo chagi — chamber menyilang, pivot 135-180°.' },
      { kind: 'spinkick',  label: 'Spinning Kick',  dmg: 18, range: 'mid',  power: 0.9, target: 'body', note: 'Dwi chagi — putaran 180° kompak, tumit menusuk.' },
      { kind: 'axekick',   label: 'Axe Kick',       dmg: 16, range: 'mid',  power: 0.9, target: 'head', note: 'Naeryo chagi — kaki naik lalu tumit menebas ke bawah.' },
      { kind: 'lowkick',   label: 'Low Kick',       dmg: 14, range: 'mid',  power: 0.7, target: 'leg',  note: 'Tebas paha, chamber rendah.' },
      { kind: 'jab',       label: 'Jab',            dmg: 8,  range: 'mid',  power: 0.5, target: 'head', note: 'Jab pengukur jarak.' },
      { kind: 'teep',      label: 'Teep',           dmg: 10, range: 'long', power: 0.5, target: 'body', note: 'Dorong jaga jarak.' },
      { kind: 'headkick',  label: 'Head Kick',      dmg: 18, range: 'mid',  power: 1.0, target: 'head', note: 'Finisher — tendangan tinggi.' },
    ],
  },
  silat: {
    label: 'Silat',
    desc: 'Pukulan, sikutan, tendangan, dan sapuan kaki khas pencak silat.',
    moves: [
      { kind: 'jab',       label: 'Jab',            dmg: 8,  range: 'mid',  power: 0.5, target: 'head', note: 'Pukulan depan cepat.' },
      { kind: 'cross',     label: 'Cross',          dmg: 10, range: 'mid',  power: 0.7, target: 'head', note: 'Pukulan lurus tenaga.' },
      { kind: 'elbow',     label: 'Sikutan',        dmg: 14, range: 'close', power: 0.9, target: 'head', note: 'Siku menyilang jarak dekat.' },
      { kind: 'lowkick',   label: 'Tendangan Bawah',dmg: 14, range: 'mid',  power: 0.7, target: 'leg',  note: 'Tendangan ke paha/kaki.' },
      { kind: 'roundhouse',label: 'Tendangan Putar',dmg: 16, range: 'mid',  power: 0.9, target: 'body', note: 'Tendangan melingkar ke badan.' },
      { kind: 'sweep',     label: 'Sapuan',         dmg: 12, range: 'close', power: 0.8, target: 'leg',  note: 'Sapuan kaki — jatuhkan lawan dari bawah.' },
      { kind: 'knee',      label: 'Dengkulan',      dmg: 16, range: 'close', power: 0.9, target: 'body', note: 'Lutut ke badan dari jarak dekat.' },
      { kind: 'finisher',  label: 'Pukulan Berat',  dmg: 20, range: 'mid',  power: 1.0, target: 'head', note: 'Finisher KO.' },
    ],
  },
  gulat: {
    label: 'Gulat',
    desc: 'Takedown, angkat-banting, clinch, grapple. Tanpa pukulan/tendangan — menang lewat bantingan dan kontrol.',
    moves: [
      { kind: 'takedown',  label: 'Takedown',       dmg: 16, range: 'close', power: 0.9, target: 'body', note: 'Shoot ke kaki, angkat, banting.' },
      { kind: 'takedown',  label: 'Suplex',         dmg: 18, range: 'close', power: 1.0, target: 'body', note: 'Angkat lawan ke atas bahu, banting ke belakang.' },
      { kind: 'clinch',    label: 'Clinch',         dmg: 6,  range: 'close', power: 0.5, target: 'body', note: 'Rangkul kepala + badan, kontrol posisi.' },
      { kind: 'shove',     label: 'Dorongan',       dmg: 4,  range: 'close', power: 0.4, target: 'body', note: 'Dorong dua tangan — knockback besar, damage kecil.' },
      { kind: 'stickswing',label: 'Ayunan Kayu',    dmg: 18, range: 'mid',  power: 1.0, target: 'head', note: 'Hanya bila pegang tongkat kayu — ayunan horizontal.' },
      { kind: 'stickchop', label: 'Tebasan Kayu',   dmg: 18, range: 'mid',  power: 1.0, target: 'head', note: 'Hanya bila pegang tongkat kayu — tebas dari atas.' },
      { kind: 'finisher',  label: 'Bantingan Berat',dmg: 20, range: 'close', power: 1.0, target: 'body', note: 'Finisher KO — slam penuh.' },
    ],
  },
  brawler: {
    label: 'Brawler Jalanan',
    desc: 'Gaya jalanan: overhand, haymaker, dorongan. Telegraf tapi berat.',
    moves: [
      { kind: 'jab',       label: 'Jab',            dmg: 8,  range: 'mid',  power: 0.5, target: 'head', note: 'Jab jalanan.' },
      { kind: 'cross',     label: 'Cross',          dmg: 10, range: 'mid',  power: 0.7, target: 'head', note: 'Straight kasar.' },
      { kind: 'overhand',  label: 'Overhand',       dmg: 13, range: 'mid',  power: 0.8, target: 'head', note: 'Datang dari atas, windup panjang.' },
      { kind: 'haymaker',  label: 'Haymaker',       dmg: 15, range: 'mid',  power: 0.9, target: 'head', note: 'Busur lebar — telegraf, power terbesar.' },
      { kind: 'shove',     label: 'Dorongan',       dmg: 4,  range: 'close', power: 0.4, target: 'body', note: 'Dorong dua tangan.' },
      { kind: 'bodyshot',  label: 'Bodyshot',       dmg: 12, range: 'close', power: 0.7, target: 'body', note: 'Hook ke badan.' },
      { kind: 'lowkick',   label: 'Tendangan',      dmg: 14, range: 'mid',  power: 0.7, target: 'leg',  note: 'Tendangan kasar ke paha.' },
      { kind: 'finisher',  label: 'Haymaker Berat', dmg: 20, range: 'mid',  power: 1.0, target: 'head', note: 'Finisher KO.' },
    ],
  },
  // ---- GAYA BARU (Fase 1 Hub, 2026-11-07) ----
  // Riset teknik asli tiap gaya diringkas di ENGINE.md ("Riset gaya baru").
  kali: {
    label: 'Kali Arnis',
    desc: 'Seni bela diri Filipina: tongkat, pisau, tangan kosong. Sinawali, abaniko, redonda + footwork segitiga.',
    moves: [
      { kind: 'abaniko',   label: 'Abaniko',        dmg: 8,  range: 'close', power: 0.5, target: 'head', note: 'Kibasan kipas — jentikan pergelangan 180°, cepat dari sudut tak terduga.' },
      { kind: 'sinawali',  label: 'Sinawali',       dmg: 14, range: 'mid',  power: 0.8, target: 'head', note: 'Anyaman dua tongkat — rentetan serangan silih berganti.' },
      { kind: 'redonda',   label: 'Redonda',        dmg: 14, range: 'mid',  power: 0.8, target: 'head', note: 'Tebasan melingkar ke bawah, kembali ke titik awal.' },
      { kind: 'jab',       label: 'Jab',            dmg: 8,  range: 'mid',  power: 0.5, target: 'head', note: 'Pukulan lurus tangan depan.' },
      { kind: 'cross',     label: 'Cross',          dmg: 10, range: 'mid',  power: 0.7, target: 'head', note: 'Pukulan silang tangan belakang.' },
      { kind: 'lowkick',   label: 'Tendangan Bawah',dmg: 14, range: 'mid',  power: 0.7, target: 'leg',  note: 'Tendangan ke paha.' },
      { kind: 'stickswing',label: 'Ayunan Tongkat', dmg: 18, range: 'mid',  power: 1.0, target: 'head', note: 'Hanya bila pegang tongkat — ayunan horizontal.' },
      { kind: 'stickchop', label: 'Tebasan Tongkat',dmg: 18, range: 'mid',  power: 1.0, target: 'head', note: 'Hanya bila pegang tongkat — tebas dari atas.' },
      { kind: 'finisher',  label: 'Tebasan Berat',  dmg: 20, range: 'mid',  power: 1.0, target: 'head', note: 'Finisher KO.' },
    ],
  },
  judo: {
    label: 'Judo',
    desc: 'Lemparan + kuncian Kodokan (Jigoro Kano, 1882). Tanpa pukulan/tendangan — menang lewat kuzushi dan bantingan.',
    moves: [
      { kind: 'seoinage',  label: 'Seoi Nage',      dmg: 16, range: 'close', power: 0.9, target: 'body', note: 'Bahu jadi tumpu, lawan terangkat melewati bahu.' },
      { kind: 'osotogari', label: 'Osoto Gari',     dmg: 16, range: 'close', power: 0.9, target: 'leg',  note: 'Sabit kaki luar sambil dorong badan ke belakang.' },
      { kind: 'uchimata',  label: 'Uchi Mata',      dmg: 18, range: 'close', power: 1.0, target: 'body', note: 'Sapu paha dalam sambil putar pinggul — pencetak ippon terbanyak.' },
      { kind: 'clinch',    label: 'Clinch',         dmg: 6,  range: 'close', power: 0.5, target: 'body', note: 'Rangkul + kontrol posisi, cari celah lempar.' },
      { kind: 'shove',     label: 'Dorongan',       dmg: 4,  range: 'close', power: 0.4, target: 'body', note: 'Dorong dua tangan — rusak keseimbangan lawan.' },
      { kind: 'finisher',  label: 'Bantingan Berat',dmg: 20, range: 'close', power: 1.0, target: 'body', note: 'Finisher KO — lemparan penuh.' },
    ],
  },
  kudo: {
    label: 'Kudo',
    desc: 'Hibrida Jepang (Daido Juku, Takashi Azuma 1981): karate + judo + gulat. Pukulan, tendangan, bantingan — dengan pelindung kepala.',
    moves: [
      { kind: 'cross',     label: 'Gyaku Tsuki',    dmg: 10, range: 'mid',  power: 0.7, target: 'head', note: 'Pukulan balik tangan belakang, tenaga pinggul.' },
      { kind: 'frontkick', label: 'Mae Geri',       dmg: 10, range: 'long', power: 0.6, target: 'body', note: 'Tendangan depan, bola kaki.' },
      { kind: 'yokogeri',  label: 'Yoko Geri',      dmg: 14, range: 'mid',  power: 0.7, target: 'body', note: 'Tendangan samping, tumit sebagai permukaan pukul.' },
      { kind: 'headbutt',  label: 'Sundulan',       dmg: 12, range: 'close', power: 0.8, target: 'head', note: 'Sundulan kepala — legal di Kudo berkat pelindung kepala.' },
      { kind: 'elbow',     label: 'Siku',           dmg: 14, range: 'close', power: 0.9, target: 'head', note: 'Siku horizontal jarak dekat.' },
      { kind: 'seoinage',  label: 'Seoi Nage',      dmg: 16, range: 'close', power: 0.9, target: 'body', note: 'Bantingan bahu dari kurikulum judo Kudo.' },
      { kind: 'sweep',     label: 'Ashi Barai',     dmg: 12, range: 'close', power: 0.8, target: 'leg',  note: 'Sapuan kaki — jatuhkan lawan dari bawah.' },
      { kind: 'finisher',  label: 'Pukulan Berat',  dmg: 20, range: 'mid',  power: 1.0, target: 'head', note: 'Finisher KO.' },
    ],
  },
  jkd: {
    label: 'Jeet Kune Do',
    desc: '"Way of the Intercepting Fist" (Bruce Lee, 1964–1973). Stop-hit: potong serangan lawan di tengah persiapan — lurus, cepat, tanpa telegraf.',
    moves: [
      { kind: 'straightlead', label: 'Straight Lead', dmg: 10, range: 'mid',  power: 0.6, target: 'head', note: 'Pukulan lurus tangan depan — "tulang punggung semua pukulan JKD".' },
      { kind: 'sidekick',  label: 'Side Kick',      dmg: 16, range: 'long', power: 0.9, target: 'body', note: 'Tendangan samping tumit — senjata jarak terjauh JKD.' },
      { kind: 'lowkick',   label: 'Oblique Kick',   dmg: 14, range: 'mid',  power: 0.7, target: 'leg',  note: 'Tendangan miring ke lutut lawan untuk memotong langkah.' },
      { kind: 'hook',      label: 'Hook',           dmg: 12, range: 'close', power: 0.8, target: 'head', note: 'Busur horizontal, siku tetap ~90°.' },
      { kind: 'cross',     label: 'Cross',          dmg: 10, range: 'mid',  power: 0.7, target: 'head', note: 'Straight lurus menembus guard.' },
      { kind: 'feint',     label: 'Feint',          dmg: 0,  range: 'mid',  power: 0.1, target: 'head', note: 'Pancingan setengah pukulan.' },
      { kind: 'finisher',  label: 'Straight Berat', dmg: 20, range: 'mid',  power: 1.0, target: 'head', note: 'Finisher KO.' },
    ],
  },
  karate: {
    label: 'Karate',
    desc: 'Kihon Shotokan: gyaku-zuki, mawashi-geri, shuto — pukulan lurus bertenaga pinggul + tendangan snap.',
    moves: [
      { kind: 'gyakuzuki', label: 'Gyaku Zuki',     dmg: 12, range: 'mid',  power: 0.8, target: 'head', note: 'Pukulan balik tangan belakang, tenaga dari putaran pinggul.' },
      { kind: 'shuto',     label: 'Shuto Uchi',     dmg: 12, range: 'close', power: 0.8, target: 'head', note: 'Tebasan tangan pisau ke leher/kepala.' },
      { kind: 'maegeri',   label: 'Mae Geri',       dmg: 12, range: 'long', power: 0.7, target: 'body', note: 'Tendangan depan snap, bola kaki.' },
      { kind: 'roundhouse',label: 'Mawashi Geri',   dmg: 16, range: 'mid',  power: 0.9, target: 'body', note: 'Tendangan melingkar ke badan.' },
      { kind: 'lowkick',   label: 'Gedan Mawashi',  dmg: 14, range: 'mid',  power: 0.7, target: 'leg',  note: 'Tendangan ke paha.' },
      { kind: 'knee',      label: 'Hiza Geri',      dmg: 16, range: 'close', power: 0.9, target: 'body', note: 'Lutut ke badan dari jarak dekat.' },
      { kind: 'sweep',     label: 'Ashi Barai',     dmg: 12, range: 'close', power: 0.8, target: 'leg',  note: 'Sapuan kaki — jatuhkan lawan dari bawah.' },
      { kind: 'finisher',  label: 'Gyaku Zuki Berat', dmg: 20, range: 'mid', power: 1.0, target: 'head', note: 'Finisher KO.' },
    ],
  },
  capoeira: {
    label: 'Capoeira',
    desc: 'Seni Afro-Brasil: ginga tanpa henti, tendangan putar akrobatik, sapuan. Tangan menjaga wajah — kaki yang berbicara.',
    moves: [
      { kind: 'armada',    label: 'Armada',         dmg: 18, range: 'mid',  power: 1.0, target: 'head', note: 'Tendangan bulan sabit berputar 360°, tumit sebagai ujung.' },
      { kind: 'meialua',   label: 'Meia Lua de Compasso', dmg: 16, range: 'mid', power: 0.9, target: 'head', note: 'Setengah bulan kompas — putar sambil tangan menyentuh tanah.' },
      { kind: 'queixada',  label: 'Queixada',       dmg: 14, range: 'mid',  power: 0.8, target: 'head', note: 'Tendangan sabit luar-dalam dari langkah silang.' },
      { kind: 'headkick',  label: 'Martelo',        dmg: 18, range: 'mid',  power: 1.0, target: 'head', note: 'Tendangan palu — roundhouse ke kepala.' },
      { kind: 'frontkick', label: 'Bênção',         dmg: 10, range: 'long', power: 0.6, target: 'body', note: 'Tendangan dorong lurus ke dada.' },
      { kind: 'sweep',     label: 'Rasteira',       dmg: 12, range: 'close', power: 0.8, target: 'leg',  note: 'Sapuan kaki dari ginga.' },
      { kind: 'finisher',  label: 'Armada Berat',   dmg: 20, range: 'mid',  power: 1.0, target: 'head', note: 'Finisher KO — armada penuh.' },
    ],
  },
  wushu: {
    label: 'Wushu / Kung Fu',
    desc: 'Kung fu utara / Changquan: tendangan akrobatik + pukulan panjang. Tornado, butterfly, lotus — kaki yang melayang.',
    moves: [
      { kind: 'tornadokick',  label: 'Tornado Kick',   dmg: 20, range: 'mid',  power: 1.0, target: 'head', note: 'Xuanfengjiao — tendangan tornado melompat berputar 360°.' },
      { kind: 'butterflykick',label: 'Butterfly Kick', dmg: 18, range: 'mid',  power: 1.0, target: 'head', note: 'Xuanzi — tubuh hampir horizontal, putar di udara.' },
      { kind: 'lotuskick',    label: 'Lotus Kick',     dmg: 16, range: 'mid',  power: 0.9, target: 'head', note: 'Bailian — sabit luar melingkar ke kepala.' },
      { kind: 'frontkick',    label: 'Tendangan Depan',dmg: 10, range: 'long', power: 0.6, target: 'body', note: 'Tendangan depan lurus.' },
      { kind: 'hook',         label: 'Pukulan Panjang',dmg: 12, range: 'close', power: 0.8, target: 'head', note: 'Pukulan busur ala Changquan.' },
      { kind: 'sweep',        label: 'Sapuan',         dmg: 12, range: 'close', power: 0.8, target: 'leg',  note: 'Sapuan kaki rendah.' },
      { kind: 'finisher',     label: 'Tornado Berat',  dmg: 20, range: 'mid',  power: 1.0, target: 'head', note: 'Finisher KO — tornado penuh.' },
    ],
  },
};

// Gerakan yang hanya boleh dipakai kalau petarung memegang senjata kayu.
export const WEAPON_MOVES = new Set(['stickswing', 'stickchop']);
// Gerakan finisher (hanya di akhir jalur KO).
export const FINISHER_KINDS = new Set(['finisher', 'flyknee', 'headkick']);
// Damage chip saat block — re-export dari js/damage.js (sumber kebenaran
// tunggal; dulu didefinisikan duplikat di sini dengan nilai yang sama).
export { BLOCK_CHIP } from './damage.js';

// Pemetaan Hub-enum -> engine-key (Fase 1 Hub, 2026-11-07).
// Hub mengirim style sebagai enum ber-strip ('kali-arnis', 'jeet-kune-do',
// 'karate', ...); engine memakai key pendek ('kali', 'jkd', 'karate', ...).
// Karate dipetakan ke 'karate' — BUKAN ke taekwondo.
// Tabel lengkap (termasuk gaya lama) ada di EMBED-CONTRACT.md.
export const STYLE_ALIASES = {
  'kali-arnis': 'kali', kali: 'kali', eskrima: 'kali', arnis: 'kali',
  judo: 'judo', kudo: 'kudo',
  'jeet-kune-do': 'jkd', jkd: 'jkd',
  karate: 'karate', capoeira: 'capoeira',
  wushu: 'wushu', 'kung-fu': 'wushu', kungfu: 'wushu',
  tinju: 'tinju', muaythai: 'muaythai', taekwondo: 'taekwondo',
  silat: 'silat', gulat: 'gulat', brawler: 'brawler',
};

// Normalisasi style apa pun (Hub enum / engine key / tak dikenal) ke engine key.
// Tak dikenal -> 'brawler' (perilaku lama movesFor).
export function normalizeStyle(style) {
  return STYLE_ALIASES[style] || 'brawler';
}

// Ambil daftar gerakan yang bisa dipakai petarung ini (senjata kayu membuka
// gerakan tongkat; tanpa kayu, gerakan tongkat disaring).
export function movesFor(fighter) {
  const style = STYLES[normalizeStyle(fighter.style)] || STYLES.brawler;
  const hasStick = fighter.weapon && fighter.weapon.kind === 'kayu';
  return style.moves.filter((m) => {
    if (WEAPON_MOVES.has(m.kind) && !hasStick) return false;
    if (m.kind === 'finisher') return false; // finisher hanya dipanggil director
    return true;
  });
}

// ---------------- warna per bagian (custom karakter, 2026-11-07 ~20:44) ----------------
// Bentuk kanonik: fighter.colors = { body, gloves, shoes, belt, headband, weapon }
// (hex RGB bebas — builder memakai input type=color + field hex, BUKAN palet
// tetap — supaya tiap user bisa beda-beda). 'none' = bagian tidak dipakai
// (sabuk/ikat kepala boleh tidak ada; weapon hanya tampil kalau ada senjata).
// KOMPATIBILITAS MUNDUR: fighter lama (localStorage sfa-fighters-v1, preset
// lama, config embed lama) hanya punya `color` + warna di field legacy
// (gloves.color, shoes.color, belt.color, headband.color, weapon.color) —
// fighterColors() membaca field itu sebagai fallback, jadi fighter lama tetap
// valid tanpa migrasi. `colors` (kalau ada) SELALU menang atas field legacy.
export const COLOR_DEFAULTS = {
  body: '#C8102E', gloves: '#141210', shoes: '#FBF8F1',
  belt: 'none', headband: 'none', weapon: '#8B5E34',
};

const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

// Baca warna per bagian dari fighter apa pun (baru/lama/parsial).
export function fighterColors(f) {
  const c = (f && f.colors && typeof f.colors === 'object') ? f.colors : {};
  const pick = (cVal, legacyVal, dflt) => {
    if (typeof cVal === 'string') return cVal === 'none' ? 'none' : (isHex(cVal) ? cVal : dflt);
    if (typeof legacyVal === 'string') return legacyVal === 'none' ? 'none' : (isHex(legacyVal) ? legacyVal : dflt);
    return dflt;
  };
  return {
    body: pick(c.body, f?.color, COLOR_DEFAULTS.body),
    gloves: pick(c.gloves, f?.gloves?.color, COLOR_DEFAULTS.gloves),
    shoes: pick(c.shoes, f?.shoes?.color, COLOR_DEFAULTS.shoes),
    belt: pick(c.belt, f?.belt?.color, COLOR_DEFAULTS.belt),
    headband: pick(c.headband, f?.headband?.color, COLOR_DEFAULTS.headband),
    weapon: pick(c.weapon, f?.weapon?.color, COLOR_DEFAULTS.weapon),
  };
}

// Tulis warna per bagian ke fighter: isi `colors` + sinkronkan field legacy
// (f.color, f.gloves.color, dst.) supaya kode lama yang membaca field itu
// tetap benar. Mengembalikan fighter yang sama (mutasi).
export function setFighterColors(f, colors = {}) {
  const next = { ...fighterColors(f), ...colors };
  f.colors = { ...next };
  f.color = next.body;
  f.gloves = { ...(f.gloves || { type: 'none' }), color: next.gloves };
  f.shoes = { ...(f.shoes || { model: 'sneakers' }), color: next.shoes };
  f.belt = { color: next.belt };
  f.headband = { color: next.headband };
  f.weapon = { ...(f.weapon || { kind: 'none', hand: 'right' }), color: next.weapon };
  return f;
}
