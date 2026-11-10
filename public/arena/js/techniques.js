// techniques.js v3 — keyframe tiap teknik dari TEKNIK-BELADIRI.md.
// Format: per kind, daftar key {t (detik relatif terhadap IMPACT, negatif = sebelum),
// pose (sparse override di atas guard), ease}.
// Easing: 'in' (ease-in, lambat->cepat), 'out' (ease-out kuat), 'lin' (linear),
// 'sstep' (smoothstep). Strike = 'lin' (lompatan besar), load = 'in', recoil = 'out'.
// Pose memakai field rig v3: lean, crouch, head, hipRot, shRot, sway, stretch,
// armF/armB {a,b}, legF/legB {a,k}, footF/footB {ang, pivot, lift}.
// Konvensi sudut rig: a diukur dari arah lurus ke bawah, positif ke arah hadap.
// Elbow interior = 180° - b(rad): b=1.5 -> interior ~90°, b=0.05 -> hampir lurus.
// Tendangan utama = kaki BELAKANG (legB); kaki depan (legF) = tumpu (Muay Thai).
// Semua durasi @60fps dari bible §13.
export const TECHNIQUE_KEYS = {
  // ---- JAB (1): total 20-24f. Load 2-3f, travel 6f, impact 1-2f, recoil 6-8f, recovery 2-3f.
  jab: [
    { t: -0.16, pose: { hipRot: -0.05, shRot: -0.08, sway: -2, armF: { a: 1.05, b: 1.7 }, armB: { a: 0.7, b: 2.0 } }, ease: 'in' },
    { t: -0.10, pose: { hipRot: 0.02, shRot: 0.05, sway: 2, armF: { a: 1.15, b: 1.55 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.28, crouch: 0.1, hipRot: 0.12, shRot: 0.2, sway: 8, armF: { a: 1.62, b: 0.05 }, armB: { a: 0.7, b: 2.0 }, legF: { a: 0.28, k: -0.15 }, legB: { a: -0.3, k: -0.4 } }, ease: 'lin' },
    { t: 0.05, pose: { lean: 0.28, crouch: 0.1, hipRot: 0.12, shRot: 0.2, sway: 8, armF: { a: 1.62, b: 0.05 } }, ease: 'lin' },
    { t: 0.18, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.05, shRot: 0.08, sway: 2, armF: { a: 1.3, b: 1.0 } }, ease: 'out' },
    { t: 0.32, pose: {}, ease: 'sstep' }, // kembali guard
  ],
  // ---- CROSS (2): total 26-30f. Load 3-4f, pivot 4-5f, ekstensi 5-6f, impact, recoil 7-9f.
  cross: [
    // ROTASI rear-hand: load = bahu belakang TARIK (positif), impact = bahu belakang MAJU (negatif). (Bug awal: tanda terbalik.)
    { t: -0.24, pose: { lean: -0.1, crouch: 0.25, hipRot: 0.4, shRot: 0.3, sway: -6, armB: { a: 0.4, b: 2.4 }, footB: { ang: -0.4, pivot: 0.9, lift: 0 } }, ease: 'in' },
    { t: -0.14, pose: { lean: 0.05, crouch: 0.15, hipRot: 0.15, shRot: 0.1, sway: -2, armB: { a: 0.6, b: 2.2 }, footB: { ang: -0.55, pivot: 1.35, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.32, crouch: 0.08, hipRot: -0.35, shRot: -0.4, sway: 10, armB: { a: 1.62, b: 0.05 }, armF: { a: 0.8, b: 2.4 }, legF: { a: 0.3, k: -0.12 }, legB: { a: -0.32, k: -0.42 }, footB: { ang: -0.55, pivot: 1.57, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: 0.32, crouch: 0.08, hipRot: -0.35, shRot: -0.4, sway: 10, armB: { a: 1.62, b: 0.05 }, footB: { ang: -0.55, pivot: 1.57, lift: 0 } }, ease: 'lin' },
    { t: 0.22, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.1, shRot: 0.05, sway: 2, armB: { a: 1.0, b: 1.4 }, footB: { ang: -0.3, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.42, pose: {}, ease: 'sstep' },
  ],
  // ---- HOOK lead (3): total 30-34f. Load 4-5f, pivot 5-6f, busur 6-7f, impact, recoil 7-9f.
  // Siku TETAP ~90° interior (b≈1.5) dari awal busur sampai impact.
  hook: [
    { t: -0.26, pose: { lean: -0.08, crouch: 0.25, hipRot: -0.3, shRot: -0.2, sway: -4, armF: { a: 0.9, b: 2.0 }, legF: { a: 0.2, k: -0.2 }, legB: { a: -0.24, k: -0.35 } }, ease: 'in' },
    { t: -0.12, pose: { lean: 0.05, crouch: 0.15, hipRot: 0.2, shRot: 0.15, sway: 2, armF: { a: 1.1, b: 1.5 }, footF: { ang: -0.5, pivot: 1.1, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.25, crouch: 0.12, hipRot: 0.55, shRot: 0.5, sway: 6, armF: { a: 1.35, b: 1.5 }, armB: { a: 0.7, b: 2.0 }, legF: { a: 0.28, k: -0.15 }, legB: { a: -0.3, k: -0.4 }, footF: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.09, pose: { lean: 0.25, crouch: 0.12, hipRot: 0.55, shRot: 0.5, sway: 6, armF: { a: 1.35, b: 1.5 }, footF: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.1, shRot: 0.05, sway: 0, armF: { a: 1.1, b: 1.7 }, footF: { ang: -0.2, pivot: 0.8, lift: 0 } }, ease: 'out' },
    { t: 0.46, pose: {}, ease: 'sstep' },
  ],
  // ---- UPPERCUT rear (6): total 30-32f. Dip 4-5f, drive 5-6f, vertikal 5-6f, impact, recoil 7-8f.
  // Lengan bawah VERTIKAL di impact (a+b ≈ 2.2), siku ~90° interior (b≈1.5).
  uppercut: [
    // ROTASI rear-hand: dip = bahu belakang tarik (positif), impact = bahu belakang maju+naik (negatif). (Bug awal: tanda terbalik.)
    { t: -0.28, pose: { lean: -0.05, crouch: 0.58, head: -0.05, hipRot: 0.15, shRot: 0.1, sway: -8, stretch: 0.92, armB: { a: 0.5, b: 2.0 }, legF: { a: 0.35, k: -0.5 }, legB: { a: -0.3, k: -0.7 } }, ease: 'in' },
    { t: -0.14, pose: { lean: 0.05, crouch: 0.3, hipRot: -0.05, shRot: 0.0, sway: -2, stretch: 0.97, armB: { a: 0.6, b: 1.8 }, armF: { a: 1.4, b: 1.5 }, footB: { ang: -0.5, pivot: 1.0, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.18, crouch: 0.05, head: -0.05, hipRot: -0.35, shRot: -0.3, sway: 6, stretch: 1.02, armB: { a: 0.7, b: 1.5 }, armF: { a: 0.8, b: 2.4 }, legF: { a: 0.15, k: -0.1 }, legB: { a: -0.35, k: -0.5 }, footB: { ang: -0.5, pivot: 1.1, lift: 0 } }, ease: 'lin' },
    { t: 0.09, pose: { lean: 0.18, crouch: 0.05, hipRot: -0.35, shRot: -0.3, sway: 6, armB: { a: 0.7, b: 1.5 }, footB: { ang: -0.5, pivot: 1.1, lift: 0 } }, ease: 'lin' },
    { t: 0.22, pose: { lean: 0.1, crouch: 0.15, hipRot: -0.1, shRot: -0.05, sway: 0, armB: { a: 0.6, b: 1.9 }, footB: { ang: -0.2, pivot: 0.7, lift: 0 } }, ease: 'out' },
    { t: 0.44, pose: {}, ease: 'sstep' },
  ],
  // ---- LOW KICK: total 30-36f. Step-in 6f, chamber 6f, turnover 6f, impact 2f, follow 4f, return 10-12f.
  // Tendangan kaki BELAKANG (legB). Chamber RENDAH, pivot 45-90°, tubuh MERENDAH.
  lowkick: [
    { t: -0.32, pose: { lean: -0.05, crouch: 0.2, hipRot: -0.1, shRot: -0.1, sway: 4, legB: { a: -0.1, k: -0.3 }, armB: { a: 0.6, b: 1.8 } }, ease: 'in' },
    { t: -0.20, pose: { lean: -0.08, crouch: 0.28, hipRot: 0.05, shRot: 0.05, sway: 2, legB: { a: 0.6, k: -1.6 }, armB: { a: 1.2, b: 1.4 }, footF: { ang: -0.5, pivot: 0.9, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.12, crouch: 0.3, hipRot: 0.5, shRot: 0.4, sway: 6, legB: { a: 1.1, k: -0.15 }, legF: { a: -0.1, k: -0.35 }, armB: { a: 2.0, b: 0.8 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.55, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.06, pose: { lean: -0.12, crouch: 0.3, hipRot: 0.55, shRot: 0.4, sway: 6, legB: { a: 1.25, k: -0.12 }, footF: { ang: -0.55, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.20, pose: { lean: -0.05, crouch: 0.2, hipRot: 0.2, shRot: 0.15, sway: 2, legB: { a: 0.3, k: -0.9 }, footF: { ang: -0.3, pivot: 0.9, lift: 0 } }, ease: 'out' },
    { t: 0.42, pose: {}, ease: 'sstep' },
  ],
  // ---- BODY KICK (roundhouse): total 36-42f. Step-out 6f, chamber 8f, turnover 7f, impact 2f, follow 5f, return 12-14f.
  // Chamber TINGGI, pivot 90-135°, hip turnover 90-120°, tubuh NAIK + lean away.
  bodykick: [
    { t: -0.36, pose: { lean: -0.05, crouch: 0.2, hipRot: -0.15, shRot: -0.1, sway: 4, legB: { a: -0.2, k: -0.4 }, armB: { a: 0.6, b: 1.8 } }, ease: 'in' },
    { t: -0.22, pose: { lean: -0.12, crouch: 0.08, hipRot: 0.1, shRot: 0.1, sway: 2, legB: { a: 1.3, k: -1.6 }, armB: { a: 1.4, b: 1.0 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.6, pivot: 1.4, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.2, crouch: 0.05, hipRot: 0.85, shRot: 0.65, sway: 8, stretch: 1.05, legB: { a: 1.5, k: -0.1 }, legF: { a: -0.12, k: -0.3 }, armB: { a: 2.0, b: 0.5 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.6, pivot: 1.9, lift: 0 } }, ease: 'lin' },
    { t: 0.07, pose: { lean: -0.2, crouch: 0.05, hipRot: 0.9, shRot: 0.65, sway: 8, legB: { a: 1.6, k: -0.08 }, footF: { ang: -0.6, pivot: 1.9, lift: 0 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: -0.1, crouch: 0.12, hipRot: 0.4, shRot: 0.3, sway: 4, legB: { a: 0.5, k: -0.8 }, footF: { ang: -0.4, pivot: 1.4, lift: 0 } }, ease: 'out' },
    { t: 0.52, pose: {}, ease: 'sstep' },
  ],
  // ---- HEAD KICK: total 42-50f. Step-out 6f, chamber 10f, turnover 8f, impact 2f, follow 6f, return 14-18f (goyah).
  // Gaya B (Saenchai): lutut tetap menekuk saat naik, kaki diluruskan 2-3f sebelum impact.
  // Chamber PALING TINGGI, pivot 135-180°, lean away 20-35°, recovery goyah.
  headkick: [
    { t: -0.42, pose: { lean: -0.08, crouch: 0.2, hipRot: -0.2, shRot: -0.15, sway: 4, legB: { a: -0.3, k: -0.5 }, armB: { a: 0.6, b: 1.8 } }, ease: 'in' },
    { t: -0.26, pose: { lean: -0.2, crouch: 0.08, hipRot: 0.15, shRot: 0.1, sway: 2, legB: { a: 1.9, k: -1.8 }, armB: { a: 1.5, b: 0.9 }, armF: { a: 1.4, b: 1.1 }, footF: { ang: -0.65, pivot: 1.8, lift: 0 } }, ease: 'in' },
    { t: -0.05, pose: { lean: -0.3, crouch: 0.05, hipRot: 0.7, shRot: 0.6, sway: 6, legB: { a: 0.9, k: -1.5 }, armB: { a: 1.9, b: 0.6 }, footF: { ang: -0.7, pivot: 2.4, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: -0.35, crouch: 0.05, head: 0, hipRot: 1.1, shRot: 0.85, sway: 8, stretch: 1.08, legB: { a: 1.9, k: -0.1 }, legF: { a: -0.12, k: -0.3 }, armB: { a: 2.0, b: 0.4 }, armF: { a: 1.4, b: 1.1 }, footF: { ang: -0.7, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: -0.35, crouch: 0.05, hipRot: 1.15, shRot: 0.85, sway: 8, legB: { a: 2.0, k: -0.08 }, footF: { ang: -0.7, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.28, pose: { lean: -0.2, crouch: 0.15, hipRot: 0.5, shRot: 0.4, sway: 4, legB: { a: 0.6, k: -1.0 }, footF: { ang: -0.4, pivot: 1.8, lift: 0 } }, ease: 'out' },
    { t: 0.55, pose: { lean: -0.05, crouch: 0.3, hipRot: 0.1, shRot: 0.1, sway: -4, legB: { a: 0.1, k: -0.6 }, armF: { a: 1.6, b: 1.6 }, armB: { a: 1.6, b: 1.6 }, footF: { ang: -0.2, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.80, pose: {}, ease: 'sstep' },
  ],
  // ---- FEINT: setengah jab — bahu bergerak + lengan menjulur setengah lalu tarik cepat.
  feint: [
    { t: -0.10, pose: { hipRot: -0.05, shRot: -0.05, armF: { a: 1.0, b: 1.8 } }, ease: 'in' },
    { t: -0.02, pose: { lean: 0.08, hipRot: 0.08, shRot: 0.12, sway: 4, armF: { a: 1.1, b: 1.5 } }, ease: 'lin' },
    { t: 0.10, pose: { hipRot: 0.0, shRot: 0.0, sway: 0, armF: { a: 1.15, b: 1.55 } }, ease: 'out' },
    { t: 0.24, pose: {}, ease: 'sstep' },
  ],
  // ---- FINISHER (cross berat, seperti v2 tapi dengan pivot + rotasi penuh + dip kecil).
  finisher: [
    // ROTASI rear cross berat: sama seperti cross (load positif, impact negatif).
    { t: -0.34, pose: { lean: -0.2, crouch: 0.4, hipRot: 0.5, shRot: 0.4, sway: -8, stretch: 0.92, armB: { a: 0.3, b: 2.5 }, footB: { ang: -0.5, pivot: 1.1, lift: 0 } }, ease: 'in' },
    { t: -0.16, pose: { lean: 0.05, crouch: 0.15, hipRot: 0.15, shRot: 0.1, sway: -2, armB: { a: 0.6, b: 2.2 }, footB: { ang: -0.6, pivot: 1.5, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.42, crouch: 0.05, hipRot: -0.4, shRot: -0.45, sway: 12, stretch: 1.03, armB: { a: 1.62, b: 0 }, armF: { a: 0.8, b: 2.4 }, legF: { a: 0.34, k: -0.1 }, legB: { a: -0.38, k: -0.5 }, footB: { ang: -0.6, pivot: 1.57, lift: 0 } }, ease: 'lin' },
    { t: 0.12, pose: { lean: 0.42, crouch: 0.05, hipRot: -0.4, shRot: -0.45, sway: 12, armB: { a: 1.62, b: 0 }, footB: { ang: -0.6, pivot: 1.57, lift: 0 } }, ease: 'lin' },
    { t: 0.34, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.1, shRot: 0.05, sway: 2, armB: { a: 1.0, b: 1.4 }, footB: { ang: -0.3, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.60, pose: {}, ease: 'sstep' },
  ],
  // ---- FRONT KICK / AP CHAGI (taekwondo): total 30-36f. Chamber lutut ke dada,
  // dorong bola kaki lurus ke depan, snap, rechamber. Kaki BELAKANG (legB).
  // Chamber: paha naik ke depan (a~0.9), lutut menekuk dalam (k~-1.9, tumit ke bokong);
  // impact: kaki lurus ke depan (a~1.5, k~-0.1), bola kaki sebagai permukaan pukul.
  frontkick: [
    { t: -0.30, pose: { lean: -0.05, crouch: 0.2, hipRot: -0.1, shRot: -0.1, sway: 2, legB: { a: -0.1, k: -0.4 }, armB: { a: 0.6, b: 1.8 } }, ease: 'in' },
    { t: -0.18, pose: { lean: -0.08, crouch: 0.15, hipRot: 0.05, shRot: 0.05, sway: 2, legB: { a: 0.9, k: -1.9 }, armB: { a: 1.2, b: 1.4 }, armF: { a: 1.2, b: 1.3 }, footF: { ang: -0.3, pivot: 0.9, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.1, crouch: 0.08, hipRot: 0.5, shRot: 0.4, sway: 6, stretch: 1.02, legB: { a: 1.5, k: -0.1 }, legF: { a: -0.1, k: -0.3 }, armB: { a: 2.0, b: 0.8 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.5, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.06, pose: { lean: -0.1, crouch: 0.08, hipRot: 0.55, shRot: 0.4, sway: 6, legB: { a: 1.55, k: -0.08 }, footF: { ang: -0.5, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.20, pose: { lean: -0.05, crouch: 0.15, hipRot: 0.2, shRot: 0.15, sway: 2, legB: { a: 0.9, k: -1.4 }, footF: { ang: -0.3, pivot: 0.9, lift: 0 } }, ease: 'out' },
    { t: 0.42, pose: {}, ease: 'sstep' },
  ],
  // ---- ROUNDHOUSE / DOLLYO CHAGI (taekwondo): total 36-42f. Chamber lutut naik
  // MENYILANG badan, pivot kaki tumpu 135-180°, punggung kaki (instep), melingkar.
  // Kaki BELAKANG (legB). Beda dari bodykick muay thai: chamber lebih menyilang
  // dan pivot lebih besar, tubuh lebih tegak (taekwondo memakai snap pinggul).
  roundhouse: [
    { t: -0.36, pose: { lean: -0.05, crouch: 0.2, hipRot: -0.15, shRot: -0.1, sway: 4, legB: { a: -0.2, k: -0.4 }, armB: { a: 0.6, b: 1.8 } }, ease: 'in' },
    { t: -0.22, pose: { lean: -0.1, crouch: 0.08, hipRot: 0.28, shRot: 0.2, sway: 2, legB: { a: 1.35, k: -1.7 }, armB: { a: 1.4, b: 1.0 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.6, pivot: 1.5, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.1, crouch: 0.05, hipRot: 0.85, shRot: 0.65, sway: 8, stretch: 1.05, legB: { a: 1.5, k: -0.1 }, legF: { a: -0.12, k: -0.3 }, armB: { a: 2.0, b: 0.5 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.6, pivot: 1.9, lift: 0 } }, ease: 'lin' },
    { t: 0.07, pose: { lean: -0.1, crouch: 0.05, hipRot: 0.9, shRot: 0.65, sway: 8, legB: { a: 1.6, k: -0.08 }, footF: { ang: -0.6, pivot: 1.9, lift: 0 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: -0.1, crouch: 0.12, hipRot: 0.4, shRot: 0.3, sway: 4, legB: { a: 0.5, k: -0.8 }, footF: { ang: -0.4, pivot: 1.4, lift: 0 } }, ease: 'out' },
    { t: 0.52, pose: {}, ease: 'sstep' },
  ],
  // ---- SPINNING BACK KICK / DWI CHAGI (taekwondo): total 40-46f. Putaran 180°
  // kompak: coil (badan memutar menjauh), lalu snap — tumit menusuk lurus ke
  // belakang. Rig TIDAK punya putaran badan penuh: diwakili coil dalam
  // (hipRot/shRot +0.6/+0.5) + pivot kaki tumpu ~150° + snap kaki + smear.
  // Kaki BELAKANG (legB); chamber di samping kaki tumpu, tumit lurus ke belakang.
  spinkick: [
    { t: -0.38, pose: { lean: -0.05, crouch: 0.3, hipRot: 0.7, shRot: 0.6, sway: -4, legB: { a: -0.2, k: -0.5 }, armB: { a: 0.7, b: 1.8 }, armF: { a: 0.9, b: 1.6 }, footF: { ang: -0.3, pivot: 1.2, lift: 0 } }, ease: 'in' },
    { t: -0.20, pose: { lean: 0.1, crouch: 0.15, hipRot: -0.5, shRot: -0.45, sway: 2, legB: { a: 0.1, k: -1.3 }, armB: { a: 1.2, b: 1.2 }, armF: { a: 1.2, b: 1.2 }, footF: { ang: -0.5, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: -0.15, crouch: 0.08, hipRot: -0.7, shRot: -0.6, sway: 6, stretch: 1.03, legB: { a: 1.35, k: -0.08 }, legF: { a: -0.12, k: -0.3 }, armB: { a: 2.0, b: 0.5 }, armF: { a: 1.4, b: 1.1 }, footF: { ang: -0.55, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: -0.15, crouch: 0.08, hipRot: -0.7, shRot: -0.6, sway: 6, legB: { a: 1.4, k: -0.08 }, footF: { ang: -0.55, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.26, pose: { lean: -0.08, crouch: 0.15, hipRot: -0.2, shRot: -0.15, sway: 2, legB: { a: 0.4, k: -1.0 }, footF: { ang: -0.3, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.55, pose: {}, ease: 'sstep' },
  ],
  // ---- AXE KICK / NAERYO CHAGI (taekwondo): total 42-48f. Chamber di dada,
  // kaki dijulurkan KE ATAS melewati kepala lawan, lalu tumit menebas KE BAWAH.
  // Kaki BELAKANG (legB). Extension a~2.7 menaruh kaki DI ATAS kepala lawan
  // (pinggul ~88 px + kaki 94 px -> ujung ~176 px di atas tanah, kepala ~166 px)
  // supaya strike IK turun ke target kepala (bukan naik) — tebasan, bukan tendangan naik.
  axekick: [
    { t: -0.38, pose: { lean: -0.05, crouch: 0.2, hipRot: -0.1, shRot: -0.1, sway: 2, legB: { a: -0.2, k: -0.4 }, armB: { a: 0.6, b: 1.8 } }, ease: 'in' },
    { t: -0.24, pose: { lean: -0.12, crouch: 0.08, hipRot: 0.1, shRot: 0.1, sway: 2, legB: { a: 1.6, k: -1.9 }, armB: { a: 1.5, b: 0.9 }, armF: { a: 1.4, b: 1.1 }, footF: { ang: -0.5, pivot: 1.0, lift: 0 } }, ease: 'in' },
    { t: -0.08, pose: { lean: -0.25, crouch: 0.05, hipRot: 0.3, shRot: 0.2, sway: 4, stretch: 1.06, legB: { a: 2.7, k: -0.1 }, armB: { a: 1.9, b: 0.6 }, armF: { a: 1.4, b: 1.1 }, footF: { ang: -0.6, pivot: 1.4, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: -0.2, crouch: 0.05, hipRot: 0.5, shRot: 0.4, sway: 6, stretch: 1.04, legB: { a: 2.2, k: -0.05 }, legF: { a: -0.12, k: -0.3 }, armB: { a: 2.0, b: 0.5 }, armF: { a: 1.4, b: 1.1 }, footF: { ang: -0.6, pivot: 1.4, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: -0.15, crouch: 0.1, hipRot: 0.4, shRot: 0.3, sway: 4, legB: { a: 1.9, k: -0.1 }, footF: { ang: -0.5, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.26, pose: { lean: -0.08, crouch: 0.15, hipRot: 0.15, shRot: 0.1, sway: 2, legB: { a: 0.5, k: -0.9 }, footF: { ang: -0.3, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.55, pose: {}, ease: 'sstep' },
  ],
  // ---- OVERHAND (petarung jalanan, tangan BELAKANG): total ~0.84 dtk.
  // Pukulan datang dari ATAS: load lengan ditarik ke belakang-atas, lalu
  // diayun melewati atas kepala ke bawah ke arah dagu lawan. a~1.85 di impact
  // (lengan hampir lurus menunjuk ke depan-atas), lean ke depan besar.
  // Lebih lambat dari cross (windup 0.34) tapi lebih berat — ciri khas brawler.
  overhand: [
    { t: -0.34, pose: { lean: -0.15, crouch: 0.3, hipRot: 0.45, shRot: 0.35, sway: -8, stretch: 0.92, armB: { a: 0.3, b: 2.2 }, footB: { ang: -0.4, pivot: 1.0, lift: 0 } }, ease: 'in' },
    { t: -0.16, pose: { lean: 0.0, crouch: 0.18, hipRot: 0.1, shRot: 0.05, sway: -2, armB: { a: 0.9, b: 1.2 }, footB: { ang: -0.5, pivot: 1.4, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.35, crouch: 0.05, hipRot: -0.4, shRot: -0.45, sway: 10, armB: { a: 1.85, b: 0.05 }, armF: { a: 0.8, b: 2.2 }, legF: { a: 0.32, k: -0.12 }, legB: { a: -0.34, k: -0.45 }, footB: { ang: -0.55, pivot: 1.57, lift: 0 } }, ease: 'lin' },
    { t: 0.10, pose: { lean: 0.35, crouch: 0.05, hipRot: -0.4, shRot: -0.45, sway: 10, armB: { a: 1.85, b: 0.05 }, footB: { ang: -0.55, pivot: 1.57, lift: 0 } }, ease: 'lin' },
    { t: 0.28, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.05, shRot: 0.0, sway: 2, armB: { a: 1.0, b: 1.4 }, footB: { ang: -0.3, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.50, pose: {}, ease: 'sstep' },
  ],
  // ---- HAYMAKER (petarung jalanan, tangan BELAKANG): total ~0.93 dtk.
  // Busur LEBAR: load lengan ditarik jauh ke belakang-samping (pinggul/bahu
  // memutar besar), lalu diayun melingkar lebar ke arah kepala lawan.
  // Windup paling panjang (0.38) — telegraf, tapi power terbesar; siku ~90°
  // interior di impact (b≈1.3) seperti hook, dari jarak yang lebih jauh.
  haymaker: [
    { t: -0.38, pose: { lean: -0.2, crouch: 0.35, hipRot: 0.6, shRot: 0.55, sway: -10, stretch: 0.9, armB: { a: 0.5, b: 2.3 }, legF: { a: 0.22, k: -0.25 }, legB: { a: -0.26, k: -0.4 } }, ease: 'in' },
    { t: -0.18, pose: { lean: 0.0, crouch: 0.2, hipRot: 0.3, shRot: 0.25, sway: -2, armB: { a: 1.0, b: 1.6 }, footB: { ang: -0.4, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.3, crouch: 0.1, hipRot: 0.6, shRot: 0.55, sway: 8, armB: { a: 1.5, b: 1.3 }, armF: { a: 0.7, b: 2.0 }, legF: { a: 0.3, k: -0.15 }, legB: { a: -0.32, k: -0.42 }, footF: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.10, pose: { lean: 0.3, crouch: 0.1, hipRot: 0.6, shRot: 0.55, sway: 8, armB: { a: 1.5, b: 1.3 }, footF: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.30, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.1, shRot: 0.05, sway: 0, armB: { a: 1.0, b: 1.7 }, footF: { ang: -0.2, pivot: 0.8, lift: 0 } }, ease: 'out' },
    { t: 0.55, pose: {}, ease: 'sstep' },
  ],
  // ---- SHOVE (dorongan dua tangan, petarung jalanan): total ~0.55 dtk.
  // Kedua tangan mendorong dada/badan lawan sekaligus — bukan pukulan:
  // knockback besar, damage kecil. Load singkat, dorong lurus ke depan,
  // kedua lengan hampir lurus (a~1.5, b~0.2), badan condong ke depan.
  shove: [
    { t: -0.20, pose: { lean: -0.1, crouch: 0.25, hipRot: 0.0, shRot: 0.0, sway: -4, armF: { a: 0.9, b: 2.0 }, armB: { a: 0.9, b: 2.0 }, legF: { a: 0.2, k: -0.2 }, legB: { a: -0.24, k: -0.35 } }, ease: 'in' },
    { t: 0.00, pose: { lean: 0.35, crouch: 0.1, hipRot: 0.0, shRot: 0.0, sway: 12, armF: { a: 1.5, b: 0.2 }, armB: { a: 1.5, b: 0.2 }, legF: { a: 0.3, k: -0.12 }, legB: { a: -0.3, k: -0.4 } }, ease: 'lin' },
    { t: 0.10, pose: { lean: 0.35, crouch: 0.1, hipRot: 0.0, shRot: 0.0, sway: 12, armF: { a: 1.5, b: 0.2 }, armB: { a: 1.5, b: 0.2 } }, ease: 'lin' },
    { t: 0.25, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 2, armF: { a: 1.0, b: 1.6 }, armB: { a: 0.9, b: 1.8 } }, ease: 'out' },
    { t: 0.35, pose: {}, ease: 'sstep' },
  ],
  // ---- BODYSHOT (tinju): hook DEPAN ke badan — sama seperti hook tapi bidikan
  // lebih rendah (lengan a~1.15, bukan 1.35) dan crouch sedikit lebih dalam.
  // Siku TETAP ~90° interior (b≈1.5) dari awal busur sampai impact.
  bodyshot: [
    { t: -0.26, pose: { lean: -0.08, crouch: 0.3, hipRot: -0.3, shRot: -0.2, sway: -4, armF: { a: 0.9, b: 2.0 }, legF: { a: 0.2, k: -0.25 }, legB: { a: -0.24, k: -0.4 } }, ease: 'in' },
    { t: -0.12, pose: { lean: 0.08, crouch: 0.2, hipRot: 0.2, shRot: 0.15, sway: 2, armF: { a: 1.05, b: 1.5 }, footF: { ang: -0.5, pivot: 1.1, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.3, crouch: 0.15, hipRot: 0.55, shRot: 0.5, sway: 6, armF: { a: 1.15, b: 1.5 }, armB: { a: 0.7, b: 2.0 }, legF: { a: 0.28, k: -0.15 }, legB: { a: -0.3, k: -0.4 }, footF: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.09, pose: { lean: 0.3, crouch: 0.15, hipRot: 0.55, shRot: 0.5, sway: 6, armF: { a: 1.15, b: 1.5 }, footF: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.1, shRot: 0.05, sway: 0, armF: { a: 1.1, b: 1.7 }, footF: { ang: -0.2, pivot: 0.8, lift: 0 } }, ease: 'out' },
    { t: 0.46, pose: {}, ease: 'sstep' },
  ],
  // ---- TEEP (Muay Thai, tendangan dorong depan): "kicking version of the jab".
  // Kaki BELAKANG (legB) didorong lurus ke badan lawan, telapak kaki sebagai
  // permukaan pukul (bukan punggung kaki seperti taekwondo). Chamber lebih
  // rendah dari frontkick, dorongan pinggul lebih besar. Total ~0.72 dtk.
  teep: [
    { t: -0.30, pose: { lean: -0.05, crouch: 0.2, hipRot: -0.1, shRot: -0.1, sway: 2, legB: { a: -0.1, k: -0.4 }, armB: { a: 0.6, b: 1.8 } }, ease: 'in' },
    { t: -0.18, pose: { lean: -0.08, crouch: 0.15, hipRot: 0.05, shRot: 0.05, sway: 2, legB: { a: 0.8, k: -1.7 }, armB: { a: 1.2, b: 1.4 }, armF: { a: 1.2, b: 1.3 }, footF: { ang: -0.3, pivot: 0.9, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.12, crouch: 0.08, hipRot: 0.5, shRot: 0.4, sway: 8, stretch: 1.03, legB: { a: 1.45, k: -0.1 }, legF: { a: -0.1, k: -0.3 }, armB: { a: 2.0, b: 0.8 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.5, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.06, pose: { lean: -0.12, crouch: 0.08, hipRot: 0.55, shRot: 0.4, sway: 8, legB: { a: 1.5, k: -0.08 }, footF: { ang: -0.5, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.20, pose: { lean: -0.05, crouch: 0.15, hipRot: 0.2, shRot: 0.15, sway: 2, legB: { a: 0.8, k: -1.2 }, footF: { ang: -0.3, pivot: 0.9, lift: 0 } }, ease: 'out' },
    { t: 0.42, pose: {}, ease: 'sstep' },
  ],
  // ---- KNEE / KHAO TRONG (Muay Thai, lutut lurus dari clinch): total ~0.78 dtk.
  // Dari plum (kedua tangan menarik kepala lawan ke bawah), lutut BELAKANG
  // (legB) didorong lurus ke atas ke badan. Yang memukul adalah LUTUT, bukan
  // kaki — film.js memakai IK khusus lutut (kneePoint) untuk kind ini.
  // Chamber: paha naik (a~1.0), tulang kering terlipat dalam (k~-1.9).
  knee: [
    { t: -0.30, pose: { lean: -0.05, crouch: 0.25, hipRot: -0.1, shRot: -0.1, sway: 2, legB: { a: -0.1, k: -0.4 }, armF: { a: 1.3, b: 0.5 }, armB: { a: 1.1, b: 0.9 } }, ease: 'in' },
    { t: -0.16, pose: { lean: -0.08, crouch: 0.35, hipRot: 0.1, shRot: 0.1, sway: 4, legB: { a: 1.0, k: -1.9 }, armF: { a: 1.3, b: 0.5 }, armB: { a: 1.1, b: 0.9 }, footF: { ang: -0.4, pivot: 0.9, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: 0.1, crouch: 0.1, hipRot: 0.4, shRot: 0.3, sway: 8, stretch: 1.03, legB: { a: 1.6, k: -1.8 }, legF: { a: -0.1, k: -0.3 }, armF: { a: 1.3, b: 0.5 }, armB: { a: 1.1, b: 0.9 }, footF: { ang: -0.5, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: 0.1, crouch: 0.1, hipRot: 0.4, shRot: 0.3, sway: 8, legB: { a: 1.6, k: -1.8 }, footF: { ang: -0.5, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: -0.05, crouch: 0.2, hipRot: 0.1, shRot: 0.05, sway: 2, legB: { a: 0.5, k: -1.2 }, footF: { ang: -0.3, pivot: 0.9, lift: 0 } }, ease: 'out' },
    { t: 0.48, pose: {}, ease: 'sstep' },
  ],
  // ---- ELBOW / SOK TAD (Muay Thai, siku horizontal, tangan BELAKANG):
  // total ~0.72 dtk. Senjata jarak dekat — masuk setelah pukulan/clinch membuka
  // guard. Yang memukul adalah SIKU (elbowPoint di film.js): lengan atas
  // menunjuk ke target, lengan bawah terlipat (b~2.0) sehingga siku memimpin.
  elbow: [
    { t: -0.26, pose: { lean: -0.08, crouch: 0.25, hipRot: 0.4, shRot: 0.35, sway: -4, armB: { a: 0.5, b: 2.3 }, armF: { a: 1.0, b: 2.0 }, legF: { a: 0.2, k: -0.2 }, legB: { a: -0.24, k: -0.35 } }, ease: 'in' },
    { t: -0.12, pose: { lean: 0.05, crouch: 0.15, hipRot: 0.15, shRot: 0.1, sway: 0, armB: { a: 0.9, b: 2.0 }, footB: { ang: -0.5, pivot: 1.1, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.25, crouch: 0.1, hipRot: -0.5, shRot: -0.45, sway: 8, armB: { a: 1.9, b: 2.0 }, armF: { a: 0.8, b: 2.4 }, legF: { a: 0.28, k: -0.15 }, legB: { a: -0.3, k: -0.4 }, footB: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.09, pose: { lean: 0.25, crouch: 0.1, hipRot: -0.5, shRot: -0.45, sway: 8, armB: { a: 1.9, b: 2.0 }, footB: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 0, armB: { a: 1.0, b: 1.8 }, footB: { ang: -0.2, pivot: 0.8, lift: 0 } }, ease: 'out' },
    { t: 0.46, pose: {}, ease: 'sstep' },
  ],
  // ---- FLYING KNEE / KHAO LOI (Muay Thai, lutut terbang): total ~1.1 dtk.
  // Loncat ke depan dari kaki belakang, lutut BELAKANG (legB) didorong ke muka
  // lawan di puncak lompatan. Momentum horizontal lebih penting dari tinggi
  // lompatan; target dagu/muka. Lompatan dipicu film.js di ph=-0.35
  // (vy=-380, puncak ~0.39 dtk kemudian = tepat saat impact). Yang memukul
  // adalah LUTUT (kneePoint), bukan kaki.
  flyknee: [
    { t: -0.50, pose: { lean: -0.1, crouch: 0.55, hipRot: -0.1, shRot: -0.1, sway: -4, stretch: 0.94, legB: { a: -0.1, k: -0.4 }, legF: { a: 0.3, k: -0.5 }, armF: { a: 0.5, b: 2.0 }, armB: { a: 0.4, b: 2.2 } }, ease: 'in' },
    { t: -0.35, pose: { lean: -0.05, crouch: 0.7, hipRot: 0.0, shRot: 0.0, sway: -2, stretch: 0.92, legB: { a: 0.2, k: -0.8 }, legF: { a: 0.35, k: -0.6 }, armF: { a: 0.8, b: 1.8 }, armB: { a: 0.7, b: 1.9 } }, ease: 'in' },
    { t: -0.20, pose: { lean: 0.05, crouch: 0.1, hipRot: 0.2, shRot: 0.15, sway: 4, stretch: 1.02, legB: { a: 1.2, k: -1.9 }, legF: { a: -0.2, k: -0.4 }, armF: { a: 1.2, b: 1.6 }, armB: { a: 1.1, b: 1.7 } }, ease: 'lin' },
    { t: -0.06, pose: { lean: 0.12, crouch: 0.05, hipRot: 0.35, shRot: 0.25, sway: 6, stretch: 1.05, legB: { a: 1.6, k: -1.8 }, legF: { a: -0.25, k: -0.5 }, armF: { a: 1.3, b: 1.4 }, armB: { a: 1.2, b: 1.5 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.15, crouch: 0.05, hipRot: 0.4, shRot: 0.3, sway: 8, stretch: 1.05, legB: { a: 1.7, k: -1.9 }, legF: { a: -0.25, k: -0.5 }, armF: { a: 1.3, b: 1.4 }, armB: { a: 1.2, b: 1.5 } }, ease: 'lin' },
    { t: 0.12, pose: { lean: 0.15, crouch: 0.05, hipRot: 0.4, shRot: 0.3, sway: 8, legB: { a: 1.7, k: -1.9 }, legF: { a: -0.25, k: -0.5 } }, ease: 'lin' },
    { t: 0.30, pose: { lean: 0.05, crouch: 0.3, hipRot: 0.1, shRot: 0.05, sway: 2, legB: { a: 0.6, k: -1.2 }, legF: { a: 0.1, k: -0.4 } }, ease: 'out' },
    { t: 0.60, pose: {}, ease: 'sstep' },
  ],
  // ---- JAB KANAN / JABR (Saky, tangan BELAKANG — gaya Ma Taesoo): total ~0.48 dtk.
  // Jab dengan tangan kanan (bukan tangan depan): rotasi bahu seperti cross
  // (load bahu belakang tarik, impact bahu belakang maju), tapi lebih cepat
  // dan pendek dari cross. Tangan kiri tetap di guard.
  jabR: [
    { t: -0.16, pose: { hipRot: 0.25, shRot: 0.2, sway: -2, armB: { a: 0.5, b: 2.3 }, armF: { a: 0.8, b: 2.4 } }, ease: 'in' },
    { t: -0.10, pose: { hipRot: 0.08, shRot: 0.05, sway: 2, armB: { a: 0.7, b: 2.0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.28, crouch: 0.1, hipRot: -0.3, shRot: -0.35, sway: 8, armB: { a: 1.62, b: 0.05 }, armF: { a: 0.8, b: 2.4 }, legF: { a: 0.28, k: -0.15 }, legB: { a: -0.3, k: -0.4 }, footB: { ang: -0.55, pivot: 1.57, lift: 0 } }, ease: 'lin' },
    { t: 0.05, pose: { lean: 0.28, crouch: 0.1, hipRot: -0.3, shRot: -0.35, sway: 8, armB: { a: 1.62, b: 0.05 }, footB: { ang: -0.55, pivot: 1.57, lift: 0 } }, ease: 'lin' },
    { t: 0.18, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 2, armB: { a: 1.3, b: 1.0 }, footB: { ang: -0.3, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.32, pose: {}, ease: 'sstep' },
  ],
  // ---- HOOK KANAN / HOOKR (Saky, tangan BELAKANG): total ~0.72 dtk.
  // Cerminan hook depan: load bahu belakang tarik (positif), impact bahu
  // belakang maju (negatif). Siku TETAP ~90° interior (b≈1.5).
  hookR: [
    { t: -0.26, pose: { lean: -0.08, crouch: 0.25, hipRot: 0.4, shRot: 0.3, sway: -4, armB: { a: 0.9, b: 2.0 }, legF: { a: 0.2, k: -0.2 }, legB: { a: -0.24, k: -0.35 } }, ease: 'in' },
    { t: -0.12, pose: { lean: 0.05, crouch: 0.15, hipRot: -0.2, shRot: -0.15, sway: 2, armB: { a: 1.1, b: 1.5 }, footB: { ang: -0.5, pivot: 1.1, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.25, crouch: 0.12, hipRot: -0.55, shRot: -0.5, sway: 6, armB: { a: 1.35, b: 1.5 }, armF: { a: 0.7, b: 2.0 }, legF: { a: 0.28, k: -0.15 }, legB: { a: -0.3, k: -0.4 }, footB: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.09, pose: { lean: 0.25, crouch: 0.12, hipRot: -0.55, shRot: -0.5, sway: 6, armB: { a: 1.35, b: 1.5 }, footB: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 0, armB: { a: 1.1, b: 1.7 }, footB: { ang: -0.2, pivot: 0.8, lift: 0 } }, ease: 'out' },
    { t: 0.46, pose: {}, ease: 'sstep' },
  ],
  // ---- BODYSHOT KANAN / BODYSHOTR (Saky, hook BELAKANG ke badan): total ~0.72 dtk.
  // Cerminan bodyshot depan: bidikan lebih rendah (a~1.15), siku ~90° interior.
  bodyshotR: [
    { t: -0.26, pose: { lean: -0.08, crouch: 0.3, hipRot: 0.4, shRot: 0.3, sway: -4, armB: { a: 0.9, b: 2.0 }, legF: { a: 0.2, k: -0.25 }, legB: { a: -0.24, k: -0.4 } }, ease: 'in' },
    { t: -0.12, pose: { lean: 0.08, crouch: 0.2, hipRot: -0.2, shRot: -0.15, sway: 2, armB: { a: 1.05, b: 1.5 }, footB: { ang: -0.5, pivot: 1.1, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.3, crouch: 0.15, hipRot: -0.55, shRot: -0.5, sway: 6, armB: { a: 1.15, b: 1.5 }, armF: { a: 0.7, b: 2.0 }, legF: { a: 0.28, k: -0.15 }, legB: { a: -0.3, k: -0.4 }, footB: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.09, pose: { lean: 0.3, crouch: 0.15, hipRot: -0.55, shRot: -0.5, sway: 6, armB: { a: 1.15, b: 1.5 }, footB: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 0, armB: { a: 1.1, b: 1.7 }, footB: { ang: -0.2, pivot: 0.8, lift: 0 } }, ease: 'out' },
    { t: 0.46, pose: {}, ease: 'sstep' },
  ],
  // ---- TAKEDOWN (gulat, DOUBLE LEG — kind generik = double leg per brief §4.1):
  // total ~0.95 dtk pre-kompresi. Level change dalam,
  // shoot ke kaki lawan, angkat, banting. Impact = momen slam (lawan jatuh
  // ditangani director via event fall, bukan pose ini).
  takedown: [
    { t: -0.42, pose: { lean: 0.15, crouch: 0.5, hipRot: 0.05, shRot: 0.05, sway: -4, stretch: 0.94, armF: { a: 1.0, b: 1.8 }, armB: { a: 0.9, b: 1.9 }, legF: { a: 0.35, k: -0.55 }, legB: { a: -0.3, k: -0.6 } }, ease: 'in' },
    { t: -0.20, pose: { lean: 0.25, crouch: 0.42, hipRot: 0.1, shRot: 0.1, sway: 12, armF: { a: 1.5, b: 0.6 }, armB: { a: 1.4, b: 0.7 }, legF: { a: 0.5, k: -0.3 }, legB: { a: -0.35, k: -0.5 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.3, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 14, stretch: 1.03, armF: { a: 1.2, b: 1.0 }, armB: { a: 1.1, b: 1.1 }, legF: { a: 0.3, k: -0.15 }, legB: { a: -0.3, k: -0.4 } }, ease: 'lin' },
    { t: 0.10, pose: { lean: 0.3, crouch: 0.15, sway: 14, armF: { a: 1.2, b: 1.0 }, armB: { a: 1.1, b: 1.1 } }, ease: 'lin' },
    { t: 0.28, pose: { lean: 0.1, crouch: 0.2, sway: 4, armF: { a: 1.0, b: 1.6 }, armB: { a: 0.9, b: 1.8 } }, ease: 'out' },
    { t: 0.50, pose: {}, ease: 'sstep' },
  ],
  // ---- CLINCH (gulat / muay thai): total ~0.6 dtk pre-kompresi. Kedua tangan
  // merangkul kepala lawan, tarik ke bawah, kontrol. Damage kecil.
  clinch: [
    { t: -0.18, pose: { lean: 0.1, crouch: 0.25, hipRot: 0.05, shRot: 0.05, sway: 4, armF: { a: 1.2, b: 0.8 }, armB: { a: 1.1, b: 0.9 }, legF: { a: 0.25, k: -0.25 }, legB: { a: -0.25, k: -0.4 } }, ease: 'in' },
    { t: 0.00, pose: { lean: 0.18, crouch: 0.3, hipRot: 0.0, shRot: 0.0, sway: 8, armF: { a: 1.35, b: 0.4 }, armB: { a: 1.3, b: 0.5 }, legF: { a: 0.28, k: -0.2 }, legB: { a: -0.28, k: -0.4 } }, ease: 'lin' },
    { t: 0.10, pose: { lean: 0.18, crouch: 0.3, sway: 8, armF: { a: 1.35, b: 0.4 }, armB: { a: 1.3, b: 0.5 } }, ease: 'lin' },
    { t: 0.25, pose: { lean: 0.1, crouch: 0.2, sway: 2, armF: { a: 1.2, b: 0.8 }, armB: { a: 1.1, b: 0.9 } }, ease: 'out' },
    { t: 0.40, pose: {}, ease: 'sstep' },
  ],
  // ---- SWEEP / SAPUAN (silat): total ~0.7 dtk pre-kompresi. Kaki menyapu
  // rendah, tubuh merendah, pivot kaki tumpu. Target kaki lawan — jatuhkan.
  sweep: [
    { t: -0.30, pose: { lean: -0.05, crouch: 0.35, hipRot: -0.1, shRot: -0.1, sway: 2, legB: { a: -0.2, k: -0.5 }, armB: { a: 0.6, b: 1.8 } }, ease: 'in' },
    { t: -0.14, pose: { lean: -0.08, crouch: 0.4, hipRot: 0.3, shRot: 0.2, sway: 2, legB: { a: 0.3, k: -1.2 }, armB: { a: 1.2, b: 1.4 }, footF: { ang: -0.5, pivot: 0.9, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.1, crouch: 0.38, hipRot: 0.7, shRot: 0.5, sway: 6, legB: { a: 0.85, k: -0.08 }, legF: { a: -0.1, k: -0.35 }, armB: { a: 2.0, b: 0.8 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.55, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: -0.1, crouch: 0.38, hipRot: 0.7, shRot: 0.5, sway: 6, legB: { a: 0.9, k: -0.08 }, footF: { ang: -0.55, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: -0.05, crouch: 0.25, hipRot: 0.3, shRot: 0.2, sway: 2, legB: { a: 0.4, k: -0.8 }, footF: { ang: -0.3, pivot: 0.9, lift: 0 } }, ease: 'out' },
    { t: 0.45, pose: {}, ease: 'sstep' },
  ],
  // ---- STICKSWING (tongkat kayu, ayunan horizontal): total ~0.8 dtk.
  // Seperti hook tapi lengan hampir lurus (b~0.2) — tongkat jadi perpanjangan
  // lengan. Hanya dipakai bila petarung memegang kayu.
  stickswing: [
    { t: -0.30, pose: { lean: -0.1, crouch: 0.3, hipRot: 0.5, shRot: 0.45, sway: -8, stretch: 0.94, armB: { a: 0.6, b: 2.0 }, legF: { a: 0.22, k: -0.25 }, legB: { a: -0.26, k: -0.4 } }, ease: 'in' },
    { t: -0.12, pose: { lean: 0.0, crouch: 0.2, hipRot: 0.2, shRot: 0.15, sway: -2, armB: { a: 1.1, b: 1.0 }, footB: { ang: -0.4, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.3, crouch: 0.1, hipRot: -0.5, shRot: -0.45, sway: 10, armB: { a: 1.55, b: 0.2 }, armF: { a: 0.7, b: 2.0 }, legF: { a: 0.3, k: -0.15 }, legB: { a: -0.32, k: -0.42 }, footB: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.10, pose: { lean: 0.3, crouch: 0.1, hipRot: -0.5, shRot: -0.45, sway: 10, armB: { a: 1.55, b: 0.2 }, footB: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.28, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 2, armB: { a: 1.0, b: 1.2 }, footB: { ang: -0.3, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.50, pose: {}, ease: 'sstep' },
  ],
  // ---- STICKCHOP (tongkat kayu, tebas dari atas): total ~0.85 dtk.
  // Lengan terangkat ke atas (a~2.6), lalu menebas ke bawah ke kepala lawan.
  stickchop: [
    { t: -0.34, pose: { lean: -0.15, crouch: 0.4, hipRot: 0.3, shRot: 0.25, sway: -8, stretch: 0.92, armB: { a: 2.4, b: 0.6 }, legF: { a: 0.22, k: -0.3 }, legB: { a: -0.26, k: -0.45 } }, ease: 'in' },
    { t: -0.14, pose: { lean: -0.05, crouch: 0.2, hipRot: 0.1, shRot: 0.05, sway: -2, armB: { a: 2.6, b: 0.3 }, footB: { ang: -0.4, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.35, crouch: 0.08, hipRot: -0.3, shRot: -0.25, sway: 10, armB: { a: 1.5, b: 0.3 }, armF: { a: 0.7, b: 2.0 }, legF: { a: 0.3, k: -0.15 }, legB: { a: -0.32, k: -0.42 }, footB: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.10, pose: { lean: 0.35, crouch: 0.08, hipRot: -0.3, shRot: -0.25, sway: 10, armB: { a: 1.5, b: 0.3 }, footB: { ang: -0.5, pivot: 1.3, lift: 0 } }, ease: 'lin' },
    { t: 0.28, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 2, armB: { a: 1.0, b: 1.4 }, footB: { ang: -0.3, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.52, pose: {}, ease: 'sstep' },
  ],
  // ---- GAYA BARU (2026-11-07, Fase 1 Hub) ----
  // Keyframe mengikuti konvensi di atas: t relatif terhadap impact (0),
  // kaki tendang = legB, lutut satu arah (k negatif, tidak menekuk ke belakang).
  // Durasi mentah: pukulan ~0.44–0.76 dtk (skala 0.55 → total ~0.24–0.42 dtk),
  // tendangan/bantingan ~0.82–1.06 dtk (skala 0.6 → total ~0.49–0.64 dtk).
  // ---- ABANIKO (kali): jentikan kipas pergelangan 180° — tercepat, nyaris tanpa windup.
  abaniko: [
    { t: -0.14, pose: { hipRot: -0.05, shRot: -0.08, sway: -2, armF: { a: 1.0, b: 1.6 } }, ease: 'in' },
    { t: -0.05, pose: { hipRot: 0.05, shRot: 0.1, sway: 2, armF: { a: 1.3, b: 1.2 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.15, crouch: 0.1, hipRot: 0.15, shRot: 0.2, sway: 6, armF: { a: 1.55, b: 0.3 }, armB: { a: 0.7, b: 2.0 }, legF: { a: 0.25, k: -0.15 }, legB: { a: -0.28, k: -0.4 } }, ease: 'lin' },
    { t: 0.05, pose: { lean: 0.15, crouch: 0.1, hipRot: 0.15, shRot: 0.2, sway: 6, armF: { a: 1.55, b: 0.3 } }, ease: 'lin' },
    { t: 0.16, pose: { lean: 0.08, crouch: 0.12, hipRot: 0.05, shRot: 0.05, sway: 0, armF: { a: 1.2, b: 1.4 } }, ease: 'out' },
    { t: 0.30, pose: {}, ease: 'sstep' },
  ],
  // ---- SINAWALI (kali): anyaman dua tongkat — dua busur silih berganti (diwakili satu busur besar + balik).
  sinawali: [
    { t: -0.22, pose: { lean: -0.08, crouch: 0.25, hipRot: -0.35, shRot: -0.3, sway: -4, armB: { a: 0.9, b: 1.9 }, armF: { a: 0.9, b: 1.9 } }, ease: 'in' },
    { t: -0.10, pose: { lean: 0.05, crouch: 0.15, hipRot: 0.25, shRot: 0.2, sway: 2, armB: { a: 1.2, b: 1.3 }, armF: { a: 1.1, b: 1.5 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.28, crouch: 0.1, hipRot: -0.45, shRot: -0.4, sway: 8, armB: { a: 1.55, b: 0.25 }, armF: { a: 1.3, b: 1.0 }, legF: { a: 0.28, k: -0.15 }, legB: { a: -0.3, k: -0.4 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: 0.28, crouch: 0.1, hipRot: -0.45, shRot: -0.4, sway: 8, armB: { a: 1.55, b: 0.25 }, armF: { a: 1.3, b: 1.0 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 0, armB: { a: 1.1, b: 1.6 }, armF: { a: 1.0, b: 1.7 } }, ease: 'out' },
    { t: 0.44, pose: {}, ease: 'sstep' },
  ],
  // ---- REDONDA (kali): tebasan melingkar ke bawah, lengan terangkat lalu memutar penuh.
  redonda: [
    { t: -0.28, pose: { lean: -0.12, crouch: 0.35, hipRot: 0.4, shRot: 0.35, sway: -6, armB: { a: 2.4, b: 0.7 }, legF: { a: 0.22, k: -0.25 }, legB: { a: -0.26, k: -0.4 } }, ease: 'in' },
    { t: -0.12, pose: { lean: 0.0, crouch: 0.2, hipRot: 0.1, shRot: 0.05, sway: -2, armB: { a: 2.6, b: 0.4 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.32, crouch: 0.08, hipRot: -0.4, shRot: -0.35, sway: 10, armB: { a: 1.5, b: 0.25 }, armF: { a: 0.7, b: 2.0 }, legF: { a: 0.3, k: -0.15 }, legB: { a: -0.32, k: -0.42 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: 0.32, crouch: 0.08, hipRot: -0.4, shRot: -0.35, sway: 10, armB: { a: 1.5, b: 0.25 } }, ease: 'lin' },
    { t: 0.26, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 2, armB: { a: 1.0, b: 1.4 } }, ease: 'out' },
    { t: 0.48, pose: {}, ease: 'sstep' },
  ],
  // ---- SEOI NAGE (judo): kuzushi (tarik) → tsukuri (putar 180° masuk, hipRot 0.55)
  // → kake (luruskan kaki + bungkuk ke depan dalam, lengan TETAP menarik ke bawah-depan —
  // bukan lengan slam seperti takedown). Punggung jadi tumpu, lawan terangkat melewati bahu.
  seoinage: [
    { t: -0.42, pose: { lean: 0.15, crouch: 0.5, hipRot: 0.3, shRot: 0.25, sway: -4, stretch: 0.94, armF: { a: 1.0, b: 1.8 }, armB: { a: 0.9, b: 1.9 }, legF: { a: 0.35, k: -0.55 }, legB: { a: -0.3, k: -0.6 } }, ease: 'in' },
    { t: -0.20, pose: { lean: 0.25, crouch: 0.4, hipRot: 0.55, shRot: 0.5, sway: 10, armF: { a: 1.5, b: 0.6 }, armB: { a: 1.4, b: 0.7 }, legF: { a: 0.45, k: -0.35 }, legB: { a: -0.35, k: -0.5 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.3, crouch: 0.15, hipRot: 0.1, shRot: 0.0, sway: 14, stretch: 1.03, armF: { a: 1.0, b: 1.5 }, armB: { a: 0.9, b: 1.6 }, legF: { a: 0.3, k: -0.15 }, legB: { a: -0.3, k: -0.4 } }, ease: 'lin' },
    { t: 0.10, pose: { lean: 0.3, crouch: 0.15, sway: 14, armF: { a: 1.0, b: 1.5 }, armB: { a: 0.9, b: 1.6 } }, ease: 'lin' },
    { t: 0.28, pose: { lean: 0.25, crouch: 0.25, sway: 4, armF: { a: 1.1, b: 1.4 }, armB: { a: 1.0, b: 1.5 } }, ease: 'out' },
    { t: 0.50, pose: {}, ease: 'sstep' },
  ],
  // ---- OSOTO GARI (judo): sabit kaki luar — langkah rapat, kaki belakang menyabit rendah.
  osotogari: [
    { t: -0.32, pose: { lean: -0.05, crouch: 0.3, hipRot: -0.1, shRot: -0.1, sway: 2, legB: { a: -0.2, k: -0.5 }, armB: { a: 0.6, b: 1.8 }, armF: { a: 1.1, b: 1.0 } }, ease: 'in' },
    { t: -0.16, pose: { lean: -0.08, crouch: 0.35, hipRot: 0.25, shRot: 0.2, sway: 2, legB: { a: 0.35, k: -1.1 }, armB: { a: 1.2, b: 1.4 }, armF: { a: 1.3, b: 0.8 }, footF: { ang: -0.5, pivot: 0.9, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.1, crouch: 0.28, hipRot: 0.65, shRot: 0.5, sway: 6, legB: { a: 1.15, k: -0.1 }, legF: { a: -0.1, k: -0.35 }, armB: { a: 2.0, b: 0.8 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.55, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: -0.1, crouch: 0.28, hipRot: 0.65, shRot: 0.5, sway: 6, legB: { a: 1.2, k: -0.08 }, footF: { ang: -0.55, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.26, pose: { lean: -0.05, crouch: 0.25, hipRot: 0.3, shRot: 0.2, sway: 2, legB: { a: 0.4, k: -0.8 }, footF: { ang: -0.3, pivot: 0.9, lift: 0 } }, ease: 'out' },
    { t: 0.50, pose: {}, ease: 'sstep' },
  ],
  // ---- UCHI MATA (judo): sapu paha dalam — kaki belakang terangkat lurus ke dalam sambil putar pinggul.
  uchimata: [
    { t: -0.36, pose: { lean: -0.05, crouch: 0.25, hipRot: -0.15, shRot: -0.1, sway: 4, legB: { a: -0.2, k: -0.5 }, armB: { a: 0.6, b: 1.8 }, armF: { a: 1.1, b: 1.0 } }, ease: 'in' },
    { t: -0.18, pose: { lean: -0.12, crouch: 0.15, hipRot: 0.2, shRot: 0.15, sway: 2, legB: { a: 0.7, k: -1.5 }, armB: { a: 1.4, b: 1.0 }, armF: { a: 1.3, b: 0.9 }, footF: { ang: -0.55, pivot: 1.1, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.18, crouch: 0.08, hipRot: 0.8, shRot: 0.6, sway: 8, stretch: 1.05, legB: { a: 1.6, k: -0.25 }, legF: { a: -0.12, k: -0.3 }, armB: { a: 2.0, b: 0.5 }, armF: { a: 1.4, b: 1.0 }, footF: { ang: -0.6, pivot: 1.6, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: -0.18, crouch: 0.08, hipRot: 0.85, shRot: 0.6, sway: 8, legB: { a: 1.65, k: -0.2 }, footF: { ang: -0.6, pivot: 1.6, lift: 0 } }, ease: 'lin' },
    { t: 0.28, pose: { lean: -0.1, crouch: 0.15, hipRot: 0.35, shRot: 0.25, sway: 4, legB: { a: 0.5, k: -0.9 }, footF: { ang: -0.4, pivot: 1.2, lift: 0 } }, ease: 'out' },
    { t: 0.54, pose: {}, ease: 'sstep' },
  ],
  // ---- HEADBUTT (kudo): sundulan — merunduk lalu kepala mendorong ke depan, tangan tetap guard.
  headbutt: [
    { t: -0.16, pose: { lean: -0.05, crouch: 0.4, head: 0.1, hipRot: 0.0, shRot: 0.0, sway: -4, armF: { a: 1.0, b: 1.8 }, armB: { a: 0.9, b: 1.9 }, legF: { a: 0.3, k: -0.4 }, legB: { a: -0.28, k: -0.5 } }, ease: 'in' },
    { t: -0.06, pose: { lean: 0.1, crouch: 0.25, head: -0.1, sway: 0, armF: { a: 1.1, b: 1.6 }, armB: { a: 1.0, b: 1.7 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.35, crouch: 0.1, head: -0.25, hipRot: 0.05, shRot: 0.05, sway: 8, armF: { a: 1.2, b: 1.4 }, armB: { a: 1.1, b: 1.5 }, legF: { a: 0.3, k: -0.15 }, legB: { a: -0.3, k: -0.4 } }, ease: 'lin' },
    { t: 0.05, pose: { lean: 0.35, crouch: 0.1, head: -0.25, sway: 8, armF: { a: 1.2, b: 1.4 } }, ease: 'lin' },
    { t: 0.16, pose: { lean: 0.1, crouch: 0.15, head: 0.0, sway: 0, armF: { a: 1.0, b: 1.8 } }, ease: 'out' },
    { t: 0.30, pose: {}, ease: 'sstep' },
  ],
  // ---- YOKO GERI (kudo/karate): tendangan samping — chamber lutut menyilang, tumit menusuk lurus ke samping.
  yokogeri: [
    { t: -0.36, pose: { lean: -0.05, crouch: 0.2, hipRot: -0.2, shRot: -0.15, sway: 4, legB: { a: -0.2, k: -0.5 }, armB: { a: 0.6, b: 1.8 } }, ease: 'in' },
    { t: -0.20, pose: { lean: -0.1, crouch: 0.12, hipRot: 0.3, shRot: 0.2, sway: 2, legB: { a: 1.0, k: -1.8 }, armB: { a: 1.4, b: 1.0 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.6, pivot: 1.4, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.15, crouch: 0.05, hipRot: 0.9, shRot: 0.7, sway: 10, stretch: 1.04, legB: { a: 1.5, k: -0.08 }, legF: { a: -0.12, k: -0.3 }, armB: { a: 2.0, b: 0.5 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.6, pivot: 1.9, lift: 0 } }, ease: 'lin' },
    { t: 0.07, pose: { lean: -0.15, crouch: 0.05, hipRot: 0.95, shRot: 0.7, sway: 10, legB: { a: 1.55, k: -0.08 }, footF: { ang: -0.6, pivot: 1.9, lift: 0 } }, ease: 'lin' },
    { t: 0.26, pose: { lean: -0.08, crouch: 0.12, hipRot: 0.4, shRot: 0.3, sway: 4, legB: { a: 0.5, k: -0.9 }, footF: { ang: -0.4, pivot: 1.3, lift: 0 } }, ease: 'out' },
    { t: 0.55, pose: {}, ease: 'sstep' },
  ],
  // ---- STRAIGHT LEAD (jkd): pukulan lurus tangan depan — windup nyaris nol, tercepat di engine.
  straightlead: [
    { t: -0.10, pose: { hipRot: -0.02, shRot: -0.04, sway: -1, armF: { a: 1.05, b: 1.7 }, armB: { a: 0.7, b: 2.0 } }, ease: 'in' },
    { t: -0.04, pose: { hipRot: 0.05, shRot: 0.08, sway: 3, armF: { a: 1.25, b: 1.4 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.3, crouch: 0.08, hipRot: 0.12, shRot: 0.2, sway: 9, armF: { a: 1.62, b: 0.05 }, armB: { a: 0.7, b: 2.0 }, legF: { a: 0.3, k: -0.12 }, legB: { a: -0.32, k: -0.4 } }, ease: 'lin' },
    { t: 0.05, pose: { lean: 0.3, crouch: 0.08, hipRot: 0.12, shRot: 0.2, sway: 9, armF: { a: 1.62, b: 0.05 } }, ease: 'lin' },
    { t: 0.14, pose: { lean: 0.1, crouch: 0.12, hipRot: 0.05, shRot: 0.08, sway: 2, armF: { a: 1.3, b: 1.0 } }, ease: 'out' },
    { t: 0.28, pose: {}, ease: 'sstep' },
  ],
  // ---- SIDE KICK (jkd): tendangan samping tumit — senjata jarak terjauh, dorong lurus tanpa putaran.
  sidekick: [
    { t: -0.30, pose: { lean: -0.05, crouch: 0.2, hipRot: -0.15, shRot: -0.1, sway: 2, legB: { a: -0.1, k: -0.4 }, armB: { a: 0.6, b: 1.8 } }, ease: 'in' },
    { t: -0.16, pose: { lean: -0.08, crouch: 0.12, hipRot: 0.2, shRot: 0.15, sway: 2, legB: { a: 0.95, k: -1.85 }, armB: { a: 1.2, b: 1.4 }, armF: { a: 1.2, b: 1.3 }, footF: { ang: -0.4, pivot: 1.1, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.1, crouch: 0.06, hipRot: 0.7, shRot: 0.55, sway: 7, stretch: 1.03, legB: { a: 1.5, k: -0.08 }, legF: { a: -0.1, k: -0.3 }, armB: { a: 2.0, b: 0.7 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.55, pivot: 1.5, lift: 0 } }, ease: 'lin' },
    { t: 0.06, pose: { lean: -0.1, crouch: 0.06, hipRot: 0.75, shRot: 0.55, sway: 7, legB: { a: 1.55, k: -0.08 }, footF: { ang: -0.55, pivot: 1.5, lift: 0 } }, ease: 'lin' },
    { t: 0.22, pose: { lean: -0.05, crouch: 0.12, hipRot: 0.3, shRot: 0.2, sway: 2, legB: { a: 0.7, k: -1.2 }, footF: { ang: -0.35, pivot: 1.1, lift: 0 } }, ease: 'out' },
    { t: 0.48, pose: {}, ease: 'sstep' },
  ],
  // ---- SHUTO (karate): tebasan tangan pisau — lengan hampir lurus, sisi telapak jadi permukaan pukul.
  shuto: [
    { t: -0.20, pose: { lean: -0.05, crouch: 0.2, hipRot: -0.2, shRot: -0.15, sway: -3, armF: { a: 0.8, b: 1.9 }, armB: { a: 0.7, b: 2.0 } }, ease: 'in' },
    { t: -0.08, pose: { lean: 0.05, crouch: 0.12, hipRot: 0.15, shRot: 0.1, sway: 2, armF: { a: 1.2, b: 1.0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.25, crouch: 0.1, hipRot: 0.4, shRot: 0.35, sway: 7, armF: { a: 1.5, b: 0.4 }, armB: { a: 0.7, b: 2.0 }, legF: { a: 0.28, k: -0.15 }, legB: { a: -0.3, k: -0.4 } }, ease: 'lin' },
    { t: 0.06, pose: { lean: 0.25, crouch: 0.1, hipRot: 0.4, shRot: 0.35, sway: 7, armF: { a: 1.5, b: 0.4 } }, ease: 'lin' },
    { t: 0.20, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.1, shRot: 0.05, sway: 0, armF: { a: 1.1, b: 1.5 } }, ease: 'out' },
    { t: 0.38, pose: {}, ease: 'sstep' },
  ],
  // ---- GYAKU ZUKI (karate): pukulan balik tangan belakang — putaran pinggul penuh, snap di ujung.
  gyakuzuki: [
    { t: -0.26, pose: { lean: -0.1, crouch: 0.32, hipRot: 0.45, shRot: 0.35, sway: -6, armB: { a: 0.35, b: 2.45 }, legF: { a: 0.34, k: -0.18 }, footB: { ang: -0.5, pivot: 1.1, lift: 0 } }, ease: 'in' },
    { t: -0.12, pose: { lean: 0.05, crouch: 0.18, hipRot: 0.15, shRot: 0.1, sway: -2, armB: { a: 0.6, b: 2.2 }, legF: { a: 0.34, k: -0.15 }, footB: { ang: -0.55, pivot: 1.4, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.32, crouch: 0.12, hipRot: -0.38, shRot: -0.42, sway: 10, armB: { a: 1.62, b: 0.05 }, armF: { a: 0.8, b: 2.4 }, legF: { a: 0.34, k: -0.12 }, legB: { a: -0.32, k: -0.42 }, footB: { ang: -0.55, pivot: 1.57, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: 0.32, crouch: 0.08, hipRot: -0.38, shRot: -0.42, sway: 10, armB: { a: 1.62, b: 0.05 }, footB: { ang: -0.55, pivot: 1.57, lift: 0 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.1, shRot: 0.05, sway: 2, armB: { a: 1.0, b: 1.4 }, footB: { ang: -0.3, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.46, pose: {}, ease: 'sstep' },
  ],
  // ---- MAE GERI (karate): tendangan depan snap — chamber lutut ke dada, snap bola kaki.
  maegeri: [
    { t: -0.28, pose: { lean: -0.05, crouch: 0.2, hipRot: -0.1, shRot: -0.1, sway: 2, legB: { a: -0.1, k: -0.4 }, armB: { a: 0.6, b: 1.8 } }, ease: 'in' },
    { t: -0.20, pose: { lean: -0.08, crouch: 0.12, hipRot: 0.05, shRot: 0.05, sway: 2, legB: { a: 0.95, k: -1.9 }, armB: { a: 1.2, b: 1.4 }, armF: { a: 1.2, b: 1.3 }, footF: { ang: -0.3, pivot: 0.9, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.1, crouch: 0.06, hipRot: 0.45, shRot: 0.35, sway: 6, stretch: 1.02, legB: { a: 1.5, k: -0.08 }, legF: { a: -0.1, k: -0.3 }, armB: { a: 2.0, b: 0.8 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.5, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.06, pose: { lean: -0.1, crouch: 0.06, hipRot: 0.5, shRot: 0.35, sway: 6, legB: { a: 1.55, k: -0.08 }, footF: { ang: -0.5, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.20, pose: { lean: -0.05, crouch: 0.12, hipRot: 0.2, shRot: 0.15, sway: 2, legB: { a: 0.95, k: -1.9 }, footF: { ang: -0.3, pivot: 0.9, lift: 0 } }, ease: 'out' },
    { t: 0.44, pose: {}, ease: 'sstep' },
  ],
  // ---- ARMADA (capoeira): tendangan bulan sabit berputar 360° — coil lalu putaran penuh, kaki lurus.
  armada: [
    { t: -0.40, pose: { lean: -0.05, crouch: 0.3, hipRot: 0.7, shRot: 0.6, sway: -4, legB: { a: -0.2, k: -0.5 }, armB: { a: 0.7, b: 1.8 }, armF: { a: 0.9, b: 1.6 }, footF: { ang: -0.3, pivot: 1.2, lift: 0 } }, ease: 'in' },
    { t: -0.20, pose: { lean: 0.05, crouch: 0.15, hipRot: -0.55, shRot: -0.5, sway: 2, legB: { a: 0.2, k: -1.2 }, armB: { a: 1.2, b: 1.2 }, armF: { a: 1.2, b: 1.2 }, footF: { ang: -0.5, pivot: 2.4, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: -0.18, crouch: 0.06, hipRot: -0.85, shRot: -0.7, sway: 8, stretch: 1.05, legB: { a: 1.6, k: -0.1 }, legF: { a: -0.12, k: -0.3 }, armB: { a: 2.0, b: 0.5 }, armF: { a: 1.4, b: 1.1 }, footF: { ang: -0.55, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: -0.18, crouch: 0.06, hipRot: -0.85, shRot: -0.7, sway: 8, legB: { a: 1.65, k: -0.08 }, footF: { ang: -0.55, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.30, pose: { lean: -0.08, crouch: 0.15, hipRot: -0.3, shRot: -0.2, sway: 4, legB: { a: 0.5, k: -0.9 }, footF: { ang: -0.35, pivot: 1.2, lift: 0 } }, ease: 'out' },
    { t: 0.62, pose: {}, ease: 'sstep' },
  ],
  // ---- MEIA LUA DE COMPASSO (capoeira): setengah bulan kompas — badan membungkuk, tangan ke tanah, tumit menyapu.
  meialua: [
    { t: -0.38, pose: { lean: 0.1, crouch: 0.35, hipRot: -0.2, shRot: -0.15, sway: 4, legB: { a: -0.25, k: -0.5 }, armB: { a: 0.7, b: 1.8 }, armF: { a: 1.0, b: 1.5 } }, ease: 'in' },
    { t: -0.20, pose: { lean: 0.25, crouch: 0.45, hipRot: 0.3, shRot: 0.25, sway: 2, legB: { a: 0.4, k: -1.3 }, armB: { a: 1.5, b: 1.0 }, armF: { a: 1.6, b: 0.8 }, footF: { ang: -0.5, pivot: 1.0, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: 0.35, crouch: 0.4, hipRot: 0.75, shRot: 0.6, sway: 8, legB: { a: 1.35, k: -0.12 }, legF: { a: -0.15, k: -0.4 }, armB: { a: 1.9, b: 0.6 }, armF: { a: 1.7, b: 0.7 }, footF: { ang: -0.6, pivot: 1.8, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: 0.35, crouch: 0.4, hipRot: 0.8, shRot: 0.6, sway: 8, legB: { a: 1.4, k: -0.1 }, footF: { ang: -0.6, pivot: 1.8, lift: 0 } }, ease: 'lin' },
    { t: 0.28, pose: { lean: 0.15, crouch: 0.3, hipRot: 0.35, shRot: 0.25, sway: 4, legB: { a: 0.5, k: -0.9 }, footF: { ang: -0.4, pivot: 1.2, lift: 0 } }, ease: 'out' },
    { t: 0.58, pose: {}, ease: 'sstep' },
  ],
  // ---- QUEIXADA (capoeira): tendangan sabit dalam→luar — langkah silang, kaki menyapu dari dalam ke luar.
  queixada: [
    { t: -0.34, pose: { lean: -0.05, crouch: 0.2, hipRot: -0.25, shRot: -0.2, sway: 4, legB: { a: -0.2, k: -0.45 }, armB: { a: 0.6, b: 1.8 }, armF: { a: 1.0, b: 1.5 }, footF: { ang: -0.4, pivot: 0.5, lift: 0 } }, ease: 'in' },
    { t: -0.18, pose: { lean: -0.1, crouch: 0.1, hipRot: 0.2, shRot: 0.15, sway: 2, legB: { a: 1.1, k: -1.6 }, armB: { a: 1.4, b: 1.0 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.55, pivot: 1.3, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.18, crouch: 0.06, hipRot: 0.8, shRot: 0.65, sway: 8, stretch: 1.04, legB: { a: 1.55, k: -0.1 }, legF: { a: -0.12, k: -0.3 }, armB: { a: 2.0, b: 0.5 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.6, pivot: 1.8, lift: 0 } }, ease: 'lin' },
    { t: 0.07, pose: { lean: -0.18, crouch: 0.06, hipRot: 0.85, shRot: 0.65, sway: 8, legB: { a: 1.6, k: -0.08 }, footF: { ang: -0.6, pivot: 1.8, lift: 0 } }, ease: 'lin' },
    { t: 0.26, pose: { lean: -0.1, crouch: 0.12, hipRot: 0.4, shRot: 0.3, sway: 4, legB: { a: 0.5, k: -0.85 }, footF: { ang: -0.4, pivot: 1.3, lift: 0 } }, ease: 'out' },
    { t: 0.54, pose: {}, ease: 'sstep' },
  ],
  // ---- TORNADO KICK / XUANFENGJIAO (wushu): tendangan tornado melompat — lompat + putar 360° + kaki lurus.
  tornadokick: [
    { t: -0.42, pose: { lean: -0.05, crouch: 0.35, hipRot: 0.7, shRot: 0.6, sway: -4, stretch: 0.94, legB: { a: -0.2, k: -0.6 }, armB: { a: 0.7, b: 1.8 }, armF: { a: 0.9, b: 1.6 }, footF: { ang: -0.3, pivot: 1.2, lift: 0 } }, ease: 'in' },
    { t: -0.22, pose: { lean: 0.0, crouch: 0.15, hipRot: -0.5, shRot: -0.45, sway: 2, stretch: 1.06, legB: { a: 0.3, k: -1.3 }, armB: { a: 1.3, b: 1.1 }, armF: { a: 1.3, b: 1.1 }, footF: { ang: -0.5, pivot: 2.4, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: -0.15, crouch: 0.05, hipRot: -0.8, shRot: -0.65, sway: 8, stretch: 1.12, legB: { a: 1.75, k: -0.08 }, legF: { a: -0.1, k: -0.25 }, armB: { a: 2.0, b: 0.5 }, armF: { a: 1.5, b: 1.0 }, footF: { ang: -0.55, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: -0.15, crouch: 0.05, hipRot: -0.8, shRot: -0.65, sway: 8, stretch: 1.1, legB: { a: 1.8, k: -0.08 }, footF: { ang: -0.55, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.30, pose: { lean: -0.08, crouch: 0.2, hipRot: -0.3, shRot: -0.2, sway: 4, stretch: 1.0, legB: { a: 0.5, k: -0.9 }, footF: { ang: -0.35, pivot: 1.2, lift: 0 } }, ease: 'out' },
    { t: 0.64, pose: {}, ease: 'sstep' },
  ],
  // ---- BUTTERFLY KICK / XUANZI (wushu): tendangan kupu-kupu — tubuh hampir horizontal, putar di udara.
  butterflykick: [
    { t: -0.40, pose: { lean: -0.05, crouch: 0.3, hipRot: 0.5, shRot: 0.45, sway: -4, legB: { a: -0.2, k: -0.5 }, armB: { a: 0.8, b: 1.7 }, armF: { a: 1.0, b: 1.5 }, footF: { ang: -0.3, pivot: 1.1, lift: 0 } }, ease: 'in' },
    { t: -0.20, pose: { lean: 0.15, crouch: 0.2, hipRot: -0.4, shRot: -0.35, sway: 2, stretch: 1.05, legB: { a: 0.6, k: -1.4 }, armB: { a: 1.6, b: 0.9 }, armF: { a: 1.5, b: 1.0 }, footF: { ang: -0.5, pivot: 1.8, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.3, crouch: 0.1, hipRot: -0.7, shRot: -0.6, sway: 8, stretch: 1.08, legB: { a: 1.5, k: -0.15 }, legF: { a: -0.1, k: -0.3 }, armB: { a: 1.9, b: 0.6 }, armF: { a: 1.7, b: 0.8 }, footF: { ang: -0.5, pivot: 2.2, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: 0.3, crouch: 0.1, hipRot: -0.7, shRot: -0.6, sway: 8, stretch: 1.08, legB: { a: 1.55, k: -0.12 }, footF: { ang: -0.5, pivot: 2.2, lift: 0 } }, ease: 'lin' },
    { t: 0.30, pose: { lean: 0.1, crouch: 0.2, hipRot: -0.3, shRot: -0.2, sway: 4, legB: { a: 0.5, k: -0.9 }, footF: { ang: -0.35, pivot: 1.2, lift: 0 } }, ease: 'out' },
    { t: 0.60, pose: {}, ease: 'sstep' },
  ],
  // ---- LOTUS KICK / BAILIAN (wushu): tendangan lotus — sabit luar melingkar ke kepala, kaki lurus.
  lotuskick: [
    { t: -0.34, pose: { lean: -0.05, crouch: 0.2, hipRot: -0.2, shRot: -0.15, sway: 4, legB: { a: -0.2, k: -0.45 }, armB: { a: 0.6, b: 1.8 }, armF: { a: 1.0, b: 1.5 } }, ease: 'in' },
    { t: -0.18, pose: { lean: -0.1, crouch: 0.1, hipRot: 0.2, shRot: 0.15, sway: 2, legB: { a: 1.2, k: -1.5 }, armB: { a: 1.4, b: 1.0 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.55, pivot: 1.4, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.18, crouch: 0.06, hipRot: 0.85, shRot: 0.65, sway: 8, stretch: 1.04, legB: { a: 1.6, k: -0.1 }, legF: { a: -0.12, k: -0.3 }, armB: { a: 2.0, b: 0.5 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.6, pivot: 1.9, lift: 0 } }, ease: 'lin' },
    { t: 0.07, pose: { lean: -0.18, crouch: 0.06, hipRot: 0.9, shRot: 0.65, sway: 8, legB: { a: 1.65, k: -0.08 }, footF: { ang: -0.6, pivot: 1.9, lift: 0 } }, ease: 'lin' },
    { t: 0.26, pose: { lean: -0.1, crouch: 0.12, hipRot: 0.4, shRot: 0.3, sway: 4, legB: { a: 0.5, k: -0.85 }, footF: { ang: -0.4, pivot: 1.3, lift: 0 } }, ease: 'out' },
    { t: 0.54, pose: {}, ease: 'sstep' },
  ],
  // ---- KIND BARU 2026-11-08 (14 kind, riset §7) ----
  // Aturan yang sama: t relatif terhadap impact, kaki tendang = legB,
  // lutut satu arah (k <= 0), impact di-hold 1-2 frame, kembali guard.
  // ---- DOUBLE LEG TAKEDOWN (gulat): level change -> shoot (kepala di dada
  // lawan, kedua lengan memeluk PAHA) -> drive ke depan -> slam. Kepala
  // NAIK menatap lurus (head 0.1), bukan menunduk.
  doubleleg: [
    { t: -0.42, pose: { lean: 0.15, crouch: 0.5, head: 0.1, hipRot: 0.05, shRot: 0.05, sway: -4, stretch: 0.94, armF: { a: 1.0, b: 1.8 }, armB: { a: 0.9, b: 1.9 }, legF: { a: 0.35, k: -0.55 }, legB: { a: -0.3, k: -0.6 } }, ease: 'in' },
    { t: -0.20, pose: { lean: 0.25, crouch: 0.42, head: 0.1, hipRot: 0.1, shRot: 0.1, sway: 12, armF: { a: 1.5, b: 0.6 }, armB: { a: 1.4, b: 0.7 }, legF: { a: 0.5, k: -0.3 }, legB: { a: -0.35, k: -0.5 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.3, crouch: 0.15, head: 0.1, hipRot: 0.0, shRot: 0.0, sway: 14, stretch: 1.03, armF: { a: 1.2, b: 1.0 }, armB: { a: 1.1, b: 1.1 }, legF: { a: 0.3, k: -0.15 }, legB: { a: -0.3, k: -0.4 } }, ease: 'lin' },
    { t: 0.10, pose: { lean: 0.3, crouch: 0.15, sway: 14, armF: { a: 1.2, b: 1.0 }, armB: { a: 1.1, b: 1.1 } }, ease: 'lin' },
    { t: 0.28, pose: { lean: 0.1, crouch: 0.2, sway: 4, armF: { a: 1.0, b: 1.6 }, armB: { a: 0.9, b: 1.8 } }, ease: 'out' },
    { t: 0.50, pose: {}, ease: 'sstep' },
  ],
  // ---- SINGLE LEG TAKEDOWN (gulat): tangkap SATU kaki (armF memeluk,
  // armB mengontrol badan) -> finish BACK TRIP: kaki belakang menyapu
  // rendah ke kaki tumpu lawan + sway menyamping (bukan lurus).
  singleleg: [
    { t: -0.40, pose: { lean: 0.12, crouch: 0.45, hipRot: 0.1, shRot: 0.05, sway: -2, stretch: 0.95, armF: { a: 1.0, b: 1.8 }, armB: { a: 0.9, b: 1.9 }, legF: { a: 0.35, k: -0.5 }, legB: { a: -0.3, k: -0.55 } }, ease: 'in' },
    { t: -0.18, pose: { lean: 0.2, crouch: 0.35, hipRot: 0.25, shRot: 0.2, sway: 8, armF: { a: 1.5, b: 0.5 }, armB: { a: 1.1, b: 1.0 }, legF: { a: 0.45, k: -0.3 }, legB: { a: -0.3, k: -0.5 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.25, crouch: 0.2, hipRot: 0.6, shRot: 0.45, sway: 10, stretch: 1.02, armF: { a: 1.4, b: 0.6 }, armB: { a: 1.2, b: 0.9 }, legF: { a: 0.3, k: -0.2 }, legB: { a: 0.85, k: -0.08 }, footF: { ang: -0.5, pivot: 1.1, lift: 0 } }, ease: 'lin' },
    { t: 0.09, pose: { lean: 0.25, crouch: 0.2, hipRot: 0.6, shRot: 0.45, sway: 10, armF: { a: 1.4, b: 0.6 }, legB: { a: 0.85, k: -0.08 } }, ease: 'lin' },
    { t: 0.26, pose: { lean: 0.1, crouch: 0.2, hipRot: 0.2, shRot: 0.15, sway: 2, armF: { a: 1.0, b: 1.6 }, legB: { a: 0.4, k: -0.8 } }, ease: 'out' },
    { t: 0.48, pose: {}, ease: 'sstep' },
  ],
  // ---- SUPLEX / GERMAN SUPLEX (gulat): body lock dari belakang (kedua
  // lengan memeluk pinggang, NOL celah) -> angkat lewat kaki+pinggul ->
  // ARCH ke belakang (lean negatif BESAR + head ke belakang + stretch > 1)
  // -> lawan lewat atas kepala (overlay film.js 'over').
  suplex: [
    { t: -0.40, pose: { lean: 0.2, crouch: 0.45, hipRot: 0.05, shRot: 0.05, sway: -2, stretch: 0.95, armF: { a: 1.2, b: 1.0 }, armB: { a: 1.2, b: 1.0 }, legF: { a: 0.35, k: -0.5 }, legB: { a: -0.3, k: -0.55 } }, ease: 'in' },
    { t: -0.18, pose: { lean: 0.1, crouch: 0.1, hipRot: 0.0, shRot: 0.0, sway: 6, stretch: 1.03, armF: { a: 1.3, b: 0.9 }, armB: { a: 1.3, b: 0.9 }, legF: { a: 0.3, k: -0.2 }, legB: { a: -0.3, k: -0.4 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: -0.35, crouch: 0.05, head: -0.2, hipRot: -0.2, shRot: -0.15, sway: 4, stretch: 1.06, armF: { a: 1.4, b: 0.8 }, armB: { a: 1.4, b: 0.8 }, legF: { a: 0.25, k: -0.15 }, legB: { a: -0.35, k: -0.4 } }, ease: 'lin' },
    { t: 0.10, pose: { lean: -0.3, crouch: 0.05, head: -0.2, sway: 4, stretch: 1.05, armF: { a: 1.4, b: 0.8 }, armB: { a: 1.4, b: 0.8 } }, ease: 'lin' },
    { t: 0.30, pose: { lean: 0.1, crouch: 0.25, head: 0.0, sway: 0, stretch: 1.0, armF: { a: 1.0, b: 1.6 }, armB: { a: 0.9, b: 1.8 } }, ease: 'out' },
    { t: 0.55, pose: {}, ease: 'sstep' },
  ],
  // ---- BODY SLAM / SCOOP SLAM (gulat, pro wrestling): scoop (satu lengan
  // di antara kaki, satu melingkari punggung) -> angkat HORIZONTAL ->
  // banting vertikal ke bawah (penyerang ikut jatuh ke belakang, lean
  // negatif RINGAN — bukan arch besar seperti suplex).
  bodyslam: [
    { t: -0.38, pose: { lean: 0.15, crouch: 0.5, hipRot: 0.05, shRot: 0.05, sway: -2, stretch: 0.94, armF: { a: 1.2, b: 0.8 }, armB: { a: 1.3, b: 0.7 }, legF: { a: 0.35, k: -0.55 }, legB: { a: -0.3, k: -0.6 } }, ease: 'in' },
    { t: -0.18, pose: { lean: 0.1, crouch: 0.1, hipRot: 0.0, shRot: 0.0, sway: 8, stretch: 1.04, armF: { a: 1.4, b: 0.6 }, armB: { a: 1.4, b: 0.6 }, legF: { a: 0.3, k: -0.2 }, legB: { a: -0.3, k: -0.4 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: -0.15, crouch: 0.3, hipRot: 0.0, shRot: 0.0, sway: 6, stretch: 0.98, armF: { a: 1.0, b: 1.2 }, armB: { a: 1.0, b: 1.2 }, legF: { a: 0.3, k: -0.25 }, legB: { a: -0.3, k: -0.45 } }, ease: 'lin' },
    { t: 0.10, pose: { lean: -0.15, crouch: 0.3, sway: 6, armF: { a: 1.0, b: 1.2 }, armB: { a: 1.0, b: 1.2 } }, ease: 'lin' },
    { t: 0.28, pose: { lean: 0.05, crouch: 0.25, sway: 2, armF: { a: 1.0, b: 1.6 }, armB: { a: 0.9, b: 1.8 } }, ease: 'out' },
    { t: 0.52, pose: {}, ease: 'sstep' },
  ],
  // ---- KNEE DIAGONAL / KHAO CHIANG (muay thai): seperti knee lurus tapi
  // pinggul MEMUTAR seperti roundhouse (hipRot 0.75 vs 0.4) + lean
  // menyamping, target rusuk. Lutut TETAP terlipat (k ~ -1.8); tangan
  // TIDAK turun (tetap menarik/mengontrol).
  kneediag: [
    { t: -0.30, pose: { lean: -0.05, crouch: 0.25, hipRot: -0.1, shRot: -0.1, sway: 2, legB: { a: -0.1, k: -0.4 }, armF: { a: 1.3, b: 0.5 }, armB: { a: 1.1, b: 0.9 } }, ease: 'in' },
    { t: -0.16, pose: { lean: 0.0, crouch: 0.3, hipRot: 0.3, shRot: 0.25, sway: 4, legB: { a: 1.0, k: -1.9 }, armF: { a: 1.3, b: 0.5 }, armB: { a: 1.1, b: 0.9 }, footF: { ang: -0.4, pivot: 1.2, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: 0.18, crouch: 0.1, hipRot: 0.75, shRot: 0.6, sway: 8, stretch: 1.03, legB: { a: 1.6, k: -1.8 }, legF: { a: -0.1, k: -0.3 }, armF: { a: 1.3, b: 0.5 }, armB: { a: 1.1, b: 0.9 }, footF: { ang: -0.5, pivot: 1.6, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: 0.18, crouch: 0.1, hipRot: 0.75, shRot: 0.6, sway: 8, legB: { a: 1.6, k: -1.8 }, footF: { ang: -0.5, pivot: 1.6, lift: 0 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: -0.05, crouch: 0.2, hipRot: 0.2, shRot: 0.15, sway: 2, legB: { a: 0.5, k: -1.2 }, footF: { ang: -0.3, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.48, pose: {}, ease: 'sstep' },
  ],
  // ---- ELBOW UPPERCUT / SOK NGAD (muay thai): seperti uppercut tapi SIKU
  // yang naik — lengan bawah TERLIPAT (b ~ 2.0), tangan dekat kepala
  // ("menyisir rambut", jangan lewati garis rambut). Putaran pinggul KECIL.
  // Berhenti di puncak (hold), jangan lanjut melewati kepala.
  elbowup: [
    { t: -0.26, pose: { lean: -0.05, crouch: 0.5, head: -0.05, hipRot: 0.15, shRot: 0.1, sway: -6, stretch: 0.93, armB: { a: 0.5, b: 2.0 }, armF: { a: 1.0, b: 2.0 }, legF: { a: 0.35, k: -0.5 }, legB: { a: -0.3, k: -0.7 } }, ease: 'in' },
    { t: -0.12, pose: { lean: 0.05, crouch: 0.25, hipRot: -0.05, shRot: 0.0, sway: -2, stretch: 0.97, armB: { a: 0.6, b: 1.9 }, armF: { a: 1.2, b: 1.8 }, footB: { ang: -0.5, pivot: 1.0, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.18, crouch: 0.05, head: -0.05, hipRot: -0.25, shRot: -0.2, sway: 6, stretch: 1.02, armB: { a: 0.7, b: 2.0 }, armF: { a: 0.8, b: 2.4 }, legF: { a: 0.15, k: -0.1 }, legB: { a: -0.35, k: -0.5 }, footB: { ang: -0.5, pivot: 1.1, lift: 0 } }, ease: 'lin' },
    { t: 0.09, pose: { lean: 0.18, crouch: 0.05, hipRot: -0.25, shRot: -0.2, sway: 6, armB: { a: 0.7, b: 2.0 }, footB: { ang: -0.5, pivot: 1.1, lift: 0 } }, ease: 'lin' },
    { t: 0.22, pose: { lean: 0.1, crouch: 0.15, hipRot: -0.05, shRot: 0.0, sway: 0, armB: { a: 0.6, b: 1.9 }, footB: { ang: -0.2, pivot: 0.7, lift: 0 } }, ease: 'out' },
    { t: 0.44, pose: {}, ease: 'sstep' },
  ],
  // ---- SPINNING ELBOW / SOK KLAP (muay thai): coil (badan memutar
  // menjauh, siku belakang ditarik) -> putar 180° penuh -> siku belakang
  // menghantam (bagian BELAKANG siku). Spin TETAP DI TENGAH, guard naik,
  // lalu rewind ke stance. Seperti spinkick tapi LENGAN yang memutar.
  elbowspin: [
    { t: -0.38, pose: { lean: -0.05, crouch: 0.3, hipRot: 0.7, shRot: 0.6, sway: -4, legB: { a: -0.2, k: -0.5 }, armB: { a: 0.7, b: 1.8 }, armF: { a: 0.9, b: 1.6 }, footF: { ang: -0.3, pivot: 1.2, lift: 0 } }, ease: 'in' },
    { t: -0.20, pose: { lean: 0.1, crouch: 0.15, hipRot: -0.5, shRot: -0.45, sway: 2, armB: { a: 1.2, b: 2.0 }, armF: { a: 1.2, b: 1.2 }, footF: { ang: -0.5, pivot: 2.4, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.2, crouch: 0.08, hipRot: -0.7, shRot: -0.6, sway: 6, stretch: 1.03, armB: { a: 1.9, b: 2.0 }, armF: { a: 0.8, b: 2.4 }, legF: { a: -0.12, k: -0.3 }, legB: { a: -0.3, k: -0.4 }, footF: { ang: -0.55, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: 0.2, crouch: 0.08, hipRot: -0.7, shRot: -0.6, sway: 6, armB: { a: 1.9, b: 2.0 }, footF: { ang: -0.55, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.26, pose: { lean: 0.05, crouch: 0.15, hipRot: -0.2, shRot: -0.15, sway: 2, armB: { a: 1.0, b: 1.8 }, footF: { ang: -0.3, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.55, pose: {}, ease: 'sstep' },
  ],
  // ---- SPINNING HOOK KICK / DWI HURYEO CHAGI (taekwondo): putar 360°
  // penuh (kepala menoleh DULU, head 0.1 di coil) -> chamber -> kaki
  // terentang HORIZONTAL lalu tumit MENGKAIT (busur, bukan menusuk lurus
  // seperti spinkick: hipRot -0.9 vs -0.7, legB a 1.6).
  spinhookkick: [
    { t: -0.40, pose: { lean: -0.05, crouch: 0.3, head: 0.1, hipRot: 0.7, shRot: 0.6, sway: -4, legB: { a: -0.2, k: -0.5 }, armB: { a: 0.7, b: 1.8 }, armF: { a: 0.9, b: 1.6 }, footF: { ang: -0.3, pivot: 1.2, lift: 0 } }, ease: 'in' },
    { t: -0.22, pose: { lean: 0.05, crouch: 0.15, head: 0.1, hipRot: -0.5, shRot: -0.45, sway: 2, legB: { a: 0.4, k: -1.5 }, armB: { a: 1.2, b: 1.2 }, armF: { a: 1.2, b: 1.2 }, footF: { ang: -0.5, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: -0.15, crouch: 0.06, hipRot: -0.9, shRot: -0.7, sway: 8, stretch: 1.04, legB: { a: 1.6, k: -0.1 }, legF: { a: -0.12, k: -0.3 }, armB: { a: 2.0, b: 0.5 }, armF: { a: 1.4, b: 1.1 }, footF: { ang: -0.55, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: -0.15, crouch: 0.06, hipRot: -0.9, shRot: -0.7, sway: 8, legB: { a: 1.65, k: -0.08 }, footF: { ang: -0.55, pivot: 2.6, lift: 0 } }, ease: 'lin' },
    { t: 0.26, pose: { lean: -0.08, crouch: 0.15, hipRot: -0.3, shRot: -0.2, sway: 2, legB: { a: 0.4, k: -1.0 }, footF: { ang: -0.3, pivot: 1.0, lift: 0 } }, ease: 'out' },
    { t: 0.55, pose: {}, ease: 'sstep' },
  ],
  // ---- MEIA-LUA DE FRENTE (capoeira): busur LUAR->DALAM (kebalikan
  // queixada: hipRot negatif di impact, bukan +0.8) — kaki TETAP LURUS,
  // kaki tumpu diputar ke luar, lengan ayun searah lalu berlawanan
  // (counter-balance), kembali ke paralelo/ginga.
  meialuafrente: [
    { t: -0.34, pose: { lean: -0.05, crouch: 0.2, hipRot: 0.25, shRot: 0.2, sway: 4, legB: { a: -0.2, k: -0.45 }, armB: { a: 0.6, b: 1.8 }, armF: { a: 1.0, b: 1.5 }, footF: { ang: -0.4, pivot: 0.5, lift: 0 } }, ease: 'in' },
    { t: -0.18, pose: { lean: -0.1, crouch: 0.1, hipRot: -0.2, shRot: -0.15, sway: 2, legB: { a: 1.1, k: -1.6 }, armB: { a: 1.4, b: 1.0 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.55, pivot: 1.3, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: -0.18, crouch: 0.06, hipRot: -0.8, shRot: -0.65, sway: 8, stretch: 1.04, legB: { a: 1.55, k: -0.1 }, legF: { a: -0.12, k: -0.3 }, armB: { a: 2.0, b: 0.5 }, armF: { a: 1.3, b: 1.2 }, footF: { ang: -0.6, pivot: 1.8, lift: 0 } }, ease: 'lin' },
    { t: 0.07, pose: { lean: -0.18, crouch: 0.06, hipRot: -0.85, shRot: -0.65, sway: 8, legB: { a: 1.6, k: -0.08 }, footF: { ang: -0.6, pivot: 1.8, lift: 0 } }, ease: 'lin' },
    { t: 0.26, pose: { lean: -0.1, crouch: 0.12, hipRot: -0.4, shRot: -0.3, sway: 4, legB: { a: 0.5, k: -0.85 }, footF: { ang: -0.4, pivot: 1.3, lift: 0 } }, ease: 'out' },
    { t: 0.54, pose: {}, ease: 'sstep' },
  ],
  // ---- GINGA (capoeira — STANCE, bukan serangan): siklus base sisi A ->
  // paralelo -> base sisi B -> paralelo. Sway bolak-balik (-6 -> +6),
  // crouch RINGAN (0.15-0.25), lengan berganti melindungi wajah, kaki
  // TIDAK menyilang & tidak pernah menendang (legB.a < 0.6 di semua key).
  // Impact (t=0) hanyalah base sisi B — tidak ada kontak, dmg 0.
  ginga: [
    { t: -0.30, pose: { lean: 0.1, crouch: 0.2, hipRot: -0.1, shRot: -0.05, sway: -6, legF: { a: 0.3, k: -0.3 }, legB: { a: -0.2, k: -0.35 }, armF: { a: 1.2, b: 1.0 }, armB: { a: 0.9, b: 1.4 } }, ease: 'in' },
    { t: -0.15, pose: { lean: 0.05, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 0, legF: { a: 0.25, k: -0.25 }, legB: { a: -0.15, k: -0.3 }, armF: { a: 1.1, b: 1.2 }, armB: { a: 1.1, b: 1.2 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.1, crouch: 0.2, hipRot: 0.1, shRot: 0.05, sway: 6, legF: { a: 0.25, k: -0.25 }, legB: { a: -0.2, k: -0.35 }, armF: { a: 0.9, b: 1.4 }, armB: { a: 1.2, b: 1.0 } }, ease: 'lin' },
    { t: 0.15, pose: { lean: 0.05, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 0, legF: { a: 0.25, k: -0.25 }, legB: { a: -0.15, k: -0.3 }, armF: { a: 1.1, b: 1.2 }, armB: { a: 1.1, b: 1.2 } }, ease: 'lin' },
    { t: 0.30, pose: {}, ease: 'sstep' },
  ],
  // ---- PILANTIK / PILANTÍK (kali arnis): tongkat dicambuk 360°
  // BERGANTIAN di ATAS KEPALA, dari pergelangan (bukan bahu) — untuk
  // jarak grappling. Lengan terangkat (a >= 2.0) + snap cepat; badan
  // stabil (tidak ada ayunan badan besar seperti redonda). BUTUH REVIEW
  // VISUAL — ref. hanya definisi teks + 1 Reel tanpa narasi (§7.11/§8).
  pilantik: [
    { t: -0.24, pose: { lean: -0.05, crouch: 0.25, hipRot: 0.3, shRot: 0.25, sway: -4, armB: { a: 2.4, b: 0.7 }, armF: { a: 1.5, b: 1.0 }, legF: { a: 0.22, k: -0.25 }, legB: { a: -0.26, k: -0.4 } }, ease: 'in' },
    { t: -0.10, pose: { lean: 0.0, crouch: 0.15, hipRot: 0.1, shRot: 0.05, sway: -2, armB: { a: 2.6, b: 0.4 }, armF: { a: 1.8, b: 0.8 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.2, crouch: 0.1, hipRot: -0.3, shRot: -0.25, sway: 6, armB: { a: 2.2, b: 0.3 }, armF: { a: 2.0, b: 0.5 }, legF: { a: 0.28, k: -0.15 }, legB: { a: -0.3, k: -0.4 } }, ease: 'lin' },
    { t: 0.06, pose: { lean: 0.2, crouch: 0.1, hipRot: -0.3, shRot: -0.25, sway: 6, armB: { a: 2.6, b: 0.4 }, armF: { a: 1.6, b: 0.9 } }, ease: 'lin' },
    { t: 0.20, pose: { lean: 0.1, crouch: 0.15, hipRot: 0.0, shRot: 0.0, sway: 0, armB: { a: 1.6, b: 1.2 }, armF: { a: 1.0, b: 1.6 } }, ease: 'out' },
    { t: 0.40, pose: {}, ease: 'sstep' },
  ],
  // ---- ARMBAR / JUJI-GATAME (judo, ground): isolasi lengan -> pinggul
  // TEGAK LURUS lengan lawan (kaki menyilang dada) -> tarik pergelangan
  // ke dada + bridge pinggul ke atas (lean negatif = badan melengkung ke
  // belakang). CAVEAT: rig berdiri tidak bisa menunjukkan posisi ground
  // T yang sebenarnya (dua karakter terbaring) — pose ini deep-crouch
  // lock; pose ground dua karakter butuh sistem baru di film.js.
  armbar: [
    { t: -0.36, pose: { lean: 0.15, crouch: 0.4, hipRot: 0.1, shRot: 0.05, sway: 4, armF: { a: 1.2, b: 1.2 }, armB: { a: 1.1, b: 1.3 }, legF: { a: 0.35, k: -0.5 }, legB: { a: -0.3, k: -0.55 } }, ease: 'in' },
    { t: -0.18, pose: { lean: -0.05, crouch: 0.55, hipRot: 0.25, shRot: 0.2, sway: 6, armF: { a: 1.0, b: 1.5 }, armB: { a: 0.9, b: 1.6 }, legF: { a: 0.6, k: -1.2 }, legB: { a: 0.5, k: -1.0 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: -0.25, crouch: 0.45, hipRot: 0.3, shRot: 0.25, sway: 6, stretch: 1.02, armF: { a: 0.9, b: 1.6 }, armB: { a: 0.8, b: 1.7 }, legF: { a: 0.7, k: -1.3 }, legB: { a: 0.6, k: -1.1 } }, ease: 'lin' },
    { t: 0.10, pose: { lean: -0.25, crouch: 0.45, sway: 6, armF: { a: 0.9, b: 1.6 }, armB: { a: 0.8, b: 1.7 } }, ease: 'lin' },
    { t: 0.28, pose: { lean: 0.0, crouch: 0.3, sway: 2, armF: { a: 1.0, b: 1.5 }, armB: { a: 0.9, b: 1.6 } }, ease: 'out' },
    { t: 0.52, pose: {}, ease: 'sstep' },
  ],
  // ---- ANKLE PICK (gulat): sentak CEPAT satu tangan ke pergelangan kaki
  // (armF a 1.8, b 0.3 — lengan terentang ke bawah) sementara tangan lain
  // TETAP mengontrol badan lawan -> dorong badan KE DEPAN melewati
  // pergelangan (bukan hanya mengangkat). Crouch dalam, sway diagonal.
  anklepick: [
    // Kaki yang mengait (legB), BUKAN tangan: tangan tidak bisa mencapai
    // pergelangan lawan (bahu->lutut ~105px vs lengan 66px) — yang mengait
    // pergelangan adalah kaki (kait rendah ke depan), tangan meraih ke
    // BAWAH (armF a~0.6, bukan a~1.8 ke depan) sebagai sentakan.
    { t: -0.32, pose: { lean: 0.1, crouch: 0.35, hipRot: 0.05, shRot: 0.05, sway: 2, armF: { a: 1.0, b: 1.8 }, armB: { a: 0.9, b: 1.9 }, legF: { a: 0.3, k: -0.45 }, legB: { a: -0.28, k: -0.5 } }, ease: 'in' },
    { t: -0.16, pose: { lean: 0.25, crouch: 0.5, hipRot: 0.15, shRot: 0.1, sway: 6, armF: { a: 0.6, b: 0.3 }, armB: { a: 1.2, b: 0.9 }, legF: { a: 0.4, k: -0.5 }, legB: { a: -0.3, k: -0.6 } }, ease: 'lin' },
    { t: 0.00, pose: { lean: 0.3, crouch: 0.3, hipRot: 0.2, shRot: 0.15, sway: 10, armF: { a: 0.6, b: 0.3 }, armB: { a: 1.4, b: 0.8 }, legF: { a: 0.35, k: -0.3 }, legB: { a: 0.9, k: -0.1 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: 0.3, crouch: 0.3, sway: 10, armF: { a: 0.6, b: 0.3 }, armB: { a: 1.4, b: 0.8 }, legB: { a: 0.9, k: -0.1 } }, ease: 'lin' },
    { t: 0.24, pose: { lean: 0.1, crouch: 0.2, sway: 2, armF: { a: 1.0, b: 1.6 }, armB: { a: 0.9, b: 1.8 } }, ease: 'out' },
    { t: 0.46, pose: {}, ease: 'sstep' },
  ],
  // ---- OUTSIDE TRIP (gulat): dari BODY LOCK (bukan grip judo) -> potong
  // sudut -> kaki mengait RENDAH di belakang kaki lawan (legB a 0.6, bukan
  // 1.15 menyabit tinggi seperti osoto gari) -> tarik badan ke sisi lemah
  // + runtuh ke lutut. Bedakan dari osotogari lewat kaki trip RENDAH.
  outsidetrip: [
    { t: -0.34, pose: { lean: 0.15, crouch: 0.3, hipRot: 0.05, shRot: 0.05, sway: 4, armF: { a: 1.3, b: 0.5 }, armB: { a: 1.2, b: 0.6 }, legF: { a: 0.25, k: -0.3 }, legB: { a: -0.25, k: -0.45 } }, ease: 'in' },
    { t: -0.16, pose: { lean: 0.15, crouch: 0.3, hipRot: 0.4, shRot: 0.3, sway: 6, armF: { a: 1.25, b: 0.6 }, armB: { a: 1.15, b: 0.7 }, legF: { a: 0.3, k: -0.3 }, legB: { a: 0.3, k: -0.9 }, footF: { ang: -0.5, pivot: 0.9, lift: 0 } }, ease: 'in' },
    { t: 0.00, pose: { lean: 0.2, crouch: 0.3, hipRot: 0.65, shRot: 0.5, sway: 8, armF: { a: 1.2, b: 0.8 }, armB: { a: 1.1, b: 0.9 }, legF: { a: 0.28, k: -0.25 }, legB: { a: 0.6, k: -0.1 }, footF: { ang: -0.55, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.08, pose: { lean: 0.2, crouch: 0.3, hipRot: 0.65, shRot: 0.5, sway: 8, legB: { a: 0.65, k: -0.08 }, footF: { ang: -0.55, pivot: 1.2, lift: 0 } }, ease: 'lin' },
    { t: 0.26, pose: { lean: 0.1, crouch: 0.25, hipRot: 0.3, shRot: 0.2, sway: 2, legB: { a: 0.4, k: -0.8 }, footF: { ang: -0.3, pivot: 0.9, lift: 0 } }, ease: 'out' },
    { t: 0.50, pose: {}, ease: 'sstep' },
  ],
};

// ---- KOMPRESI CF2 ("SATSET") ----
// Semua keyframe di atas dikompres WAKTUNYA saja — pose & sudut TIDAK berubah,
// hanya tempo: pukulan x0.55, tendangan x0.6. Yang berubah adalah kecepatan,
// bukan anatomi (lutut tetap clamp [-2.27, 0], rantai kinetik tetap urut).
// Durasi total sesudah kompresi: jab 0.26, cross 0.36, hook 0.40,
// uppercut 0.40, lowkick 0.44, roundhouse 0.53, teep 0.43, headkick 0.73 dtk.
// Diterapkan saat module load, SEBELUM windupDurOf/totalDurOf/techniquePose
// dipakai — semua pembaca TECHNIQUE_KEYS melihat nilai terkompres.
// Urutan key tetap terjaga (faktor skala positif, t=0 impact tetap 0).
// (Disalin verbatim dari cinematic-fight-2/js-film/js-film/techniques.js,
// 2026-11-07 — perbaikan pacing NF4 v2.)
export const CF2_TIME_SCALE = {
  jab: 0.55, jabR: 0.55, cross: 0.55, hook: 0.55, hookR: 0.55,
  uppercut: 0.55, bodyshot: 0.55, bodyshotR: 0.55, finisher: 0.55,
  overhand: 0.55, haymaker: 0.55, shove: 0.55, feint: 0.55,
  lowkick: 0.6, roundhouse: 0.6, bodykick: 0.6, headkick: 0.6,
  frontkick: 0.6, teep: 0.6, knee: 0.6, flyknee: 0.6, spinkick: 0.6,
  axekick: 0.6, elbow: 0.6,
  takedown: 0.6, clinch: 0.55, sweep: 0.6, stickswing: 0.55, stickchop: 0.55,
  // Gaya baru 2026-11-07 (CF2 §17: tangan cepat x0.55, tendangan/bantingan x0.6).
  abaniko: 0.55, sinawali: 0.55, redonda: 0.55,
  seoinage: 0.6, osotogari: 0.6, uchimata: 0.6,
  headbutt: 0.55, yokogeri: 0.6,
  straightlead: 0.55, sidekick: 0.6,
  shuto: 0.55, gyakuzuki: 0.55, maegeri: 0.6,
  armada: 0.6, meialua: 0.6, queixada: 0.6,
  tornadokick: 0.6, butterflykick: 0.6, lotuskick: 0.6,
  // Kind baru 2026-11-08 (CF2 §17: tangan cepat x0.55, tendangan/bantingan x0.6).
  // Pukulan/siku/tongkat x0.55: elbowup, elbowspin, pilantik, ginga (stance,
  // gerak badan/lengan — bukan tendangan/bantingan).
  // Tendangan/lutut/bantingan x0.6: doubleleg, singleleg, suplex, bodyslam,
  // anklepick, outsidetrip, armbar, kneediag, spinhookkick, meialuafrente.
  doubleleg: 0.6, singleleg: 0.6, suplex: 0.6, bodyslam: 0.6,
  anklepick: 0.6, outsidetrip: 0.6, armbar: 0.6,
  kneediag: 0.6, elbowup: 0.55, elbowspin: 0.55,
  spinhookkick: 0.6, meialuafrente: 0.6, ginga: 0.55, pilantik: 0.55,
};
for (const [kind, f] of Object.entries(CF2_TIME_SCALE)) {
  const keys = TECHNIQUE_KEYS[kind];
  if (keys) for (const k of keys) k.t *= f;
}

// Durasi windup (detik dari key pertama sampai impact) per kind.
export function windupDurOf(kind) {
  const keys = TECHNIQUE_KEYS[kind];
  if (!keys) return 0.16;
  return -keys[0].t;
}
// Durasi total teknik (detik dari key pertama sampai kembali guard).
export function totalDurOf(kind) {
  const keys = TECHNIQUE_KEYS[kind];
  if (!keys) return 0.5;
  return keys[keys.length - 1].t - keys[0].t;
}
// Strike travel: 0.06 dtk sebelum impact (dipakai whoosh + smear).
export const STRIKE_TRAVEL = 0.06;

// --- interpolasi keyframe ---
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export function easeVal(kind, p) {
  p = clamp01(p);
  if (kind === 'in') return p * p;
  if (kind === 'out') return 1 - Math.pow(1 - p, 3);
  if (kind === 'lin') return p;
  return p * p * (3 - 2 * p); // sstep
}
export function lerpNum(a, b, k) { return a + (b - a) * k; }
// Gabungkan pose sparse di atas pose dasar (guard): field yang tidak ada di override
// diambil dari dasar. Mengembalikan pose penuh (deep copy dangkal per bagian).
export function mergePose(base, over) {
  const o = {
    lean: over.lean ?? base.lean, crouch: over.crouch ?? base.crouch, head: over.head ?? base.head,
    hipRot: over.hipRot ?? base.hipRot, shRot: over.shRot ?? base.shRot,
    sway: over.sway ?? base.sway, stretch: over.stretch ?? base.stretch,
    armF: { a: over.armF?.a ?? base.armF.a, b: over.armF?.b ?? base.armF.b },
    armB: { a: over.armB?.a ?? base.armB.a, b: over.armB?.b ?? base.armB.b },
    legF: { a: over.legF?.a ?? base.legF.a, k: over.legF?.k ?? base.legF.k },
    legB: { a: over.legB?.a ?? base.legB.a, k: over.legB?.k ?? base.legB.k },
    footF: { ang: over.footF?.ang ?? base.footF.ang, pivot: over.footF?.pivot ?? base.footF.pivot, lift: over.footF?.lift ?? base.footF.lift },
    footB: { ang: over.footB?.ang ?? base.footB.ang, pivot: over.footB?.pivot ?? base.footB.pivot, lift: over.footB?.lift ?? base.footB.lift },
  };
  return o;
}
export function lerpPoseFull(a, b, k) {
  // Sudut sendi di-lerp lewat BUSUR TERPENDEK (riset arcs 2026-11-08):
  // sudut itu periodik — lerp linear naif dari a=-2,94 ke 0,80 menempuh
  // Δ=+3,74 rad (214°, jalan panjang lewat bawah) padahal busur terpendek
  // adalah -2,54 rad (145°, lewat atas). Tanpa ini, lengan "windmill"
  // 78 px/frame saat pulih dari hook yang di-block (IK elbow-up
  // meninggalkan pose di cabang a≈-2,9, b≈-2,5). Keyframe techniquePose
  // tidak berubah: semua pasangan keyframe punya |Δa|,|Δb| < π.
  const o = {
    lean: lerpNum(a.lean, b.lean, k), crouch: lerpNum(a.crouch, b.crouch, k),
    head: lerpNum(a.head, b.head, k), hipRot: lerpNum(a.hipRot, b.hipRot, k),
    shRot: lerpNum(a.shRot, b.shRot, k), sway: lerpNum(a.sway, b.sway, k),
    stretch: lerpNum(a.stretch, b.stretch, k),
    armF: { a: lerpAngle(a.armF.a, b.armF.a, k), b: lerpAngle(a.armF.b, b.armF.b, k) },
    armB: { a: lerpAngle(a.armB.a, b.armB.a, k), b: lerpAngle(a.armB.b, b.armB.b, k) },
    legF: { a: lerpAngle(a.legF.a, b.legF.a, k), k: lerpNum(a.legF.k, b.legF.k, k) },
    legB: { a: lerpAngle(a.legB.a, b.legB.a, k), k: lerpNum(a.legB.k, b.legB.k, k) },
    footF: { ang: lerpNum(a.footF.ang, b.footF.ang, k), pivot: lerpNum(a.footF.pivot, b.footF.pivot, k), lift: lerpNum(a.footF.lift, b.footF.lift, k) },
    footB: { ang: lerpNum(a.footB.ang, b.footB.ang, k), pivot: lerpNum(a.footB.pivot, b.footB.pivot, k), lift: lerpNum(a.footB.lift, b.footB.lift, k) },
  };
  return o;
}
// Delta sudut terpendek (∈ [-π, π]) + normalisasi ke [-π, π].
// Normalisasi menjaga lerp(..., k=1) == target persis (pose win memakai k=1).
// DIEKSPOR (2026-11-10): film.js §34 (lag ekor ikat kepala) mengimpor
// keduanya; tanpa export, module graph Arena gagal link
// ("does not provide an export named 'normAng'"), app.js tidak jalan sama
// sekali, dan halaman game 1v1 stuck di layar setup (Kiri/Kanan + seed).
const TAU = Math.PI * 2;
export function wrapDelta(d) {
  d %= TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}
export function normAng(a) {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
}
// Lerp sudut lewat busur terpendek (shortest-arc): dari -2,94 ke 0,80
// menempuh -2,54 rad (lewat atas), bukan +3,74 rad (lewat bawah).
export function lerpAngle(a, b, k) { return normAng(a + wrapDelta(b - a) * k); }
// Pose teknik pada dt detik relatif terhadap impact (dt negatif = sebelum impact).
// guard = pose guard penuh. Di luar rentang keys, kembalikan guard.
export function techniquePose(kind, dt, guard) {
  const keys = TECHNIQUE_KEYS[kind];
  if (!keys) return guard;
  if (dt < keys[0].t) return guard;
  if (dt >= keys[keys.length - 1].t) return guard;
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i], k1 = keys[i + 1];
    if (dt >= k0.t && dt < k1.t) {
      const p = easeVal(k1.ease, (dt - k0.t) / (k1.t - k0.t));
      const p0 = mergePose(guard, k0.pose);
      const p1 = mergePose(guard, k1.pose);
      return lerpPoseFull(p0, p1, p);
    }
  }
  return guard;
}
