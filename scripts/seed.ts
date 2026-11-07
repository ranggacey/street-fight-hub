/**
 * Seed awal: buat/reset akun admin + 1 turnamen contoh.
 * Jalankan: `npm run seed`
 *
 * Env yang dibutuhkan (dari .env.local):
 *   MONGODB_URI, ADMIN_USERNAME, ADMIN_PASSWORD
 * JANGAN hardcode password di file ini.
 * Idempotent: jalan 2x tidak membuat duplikat.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Tournament } from '../src/models/Tournament';
import { User } from '../src/models/User';

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!uri) {
    console.error('ERROR: MONGODB_URI belum diisi (lihat .env.example).');
    process.exit(1);
  }
  if (!adminUsername || !adminPassword) {
    console.error('ERROR: ADMIN_USERNAME / ADMIN_PASSWORD belum diisi (lihat .env.example).');
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: 'street-fight-hub' });

  // Admin: buat baru, atau reset password + role jika sudah ada.
  const username = adminUsername.toLowerCase();
  const passwordHash = await bcrypt.hash(adminPassword, await bcrypt.genSalt(12));
  let admin = await User.findOne({ username });
  if (admin) {
    admin.passwordHash = passwordHash;
    admin.role = 'admin';
    await admin.save();
    console.log(`Admin "${username}" sudah ada — password & role diperbarui.`);
  } else {
    admin = await User.create({ username, passwordHash, role: 'admin' });
    console.log(`Admin "${username}" dibuat.`);
  }

  // Turnamen contoh (tanpa peserta).
  const slug = 'night-fight-championship-1';
  const existing = await Tournament.findOne({ slug });
  if (existing) {
    console.log('Turnamen contoh sudah ada — dilewati.');
  } else {
    const now = new Date();
    await Tournament.create({
      name: 'Night Fight Championship #1',
      slug,
      format: 'single-elim',
      bracketSize: 32,
      regOpenAt: now,
      regCloseAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      status: 'upcoming',
      rules:
        'Turnamen single-elimination. Satu fighter per akun. ' +
        'Hasil pertandingan diundi secara acak (seeded) oleh sistem. ' +
        'Pemenang tiap ronde maju ke ronde berikut sampai final. ' +
        'Video tiap pertandingan di-upload ke Instagram @streetfightstickman.',
      championId: null,
      bracketSeed: null,
      createdBy: admin._id,
    });
    console.log('Turnamen contoh dibuat: Night Fight Championship #1 (upcoming, tanpa peserta).');
  }

  await mongoose.disconnect();
  console.log('Seed selesai.');
}

main().catch((err) => {
  console.error('Seed gagal:', err);
  process.exit(1);
});
