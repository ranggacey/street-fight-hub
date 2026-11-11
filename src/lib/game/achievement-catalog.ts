/**
 * Katalog achievement — definisi statis (bukan model DB).
 *
 * Dicek di dalam awardFightOutcome (progress.ts) setiap kali fight
 * selesai. Yang disimpan di FighterProgress hanyalah daftar id yang
 * sudah terbuka (achievements: string[]) + angka-angka pendukung
 * (totalFights, currentWinStreak, activityStreakDays).
 *
 * Konteks pengecekan (AchievementContext) diisi dari data yang SUDAH
 * ada: record Fighter (wins/kos), totalFights + streak dari progress,
 * dan status pemegang gelar dari Title. Tidak ada query tambahan yang
 * mahal — semua angka sudah tersedia di awardFightOutcome.
 */

export interface AchievementDefinition {
  id: string;
  label: string;
  description: string;
  /** Ikon emoji untuk grid achievement di profil. */
  icon: string;
}

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  { id: 'first-win', label: 'Kemenangan Pertama', description: 'Menang untuk pertama kalinya.', icon: '🥇' },
  { id: 'wins-10', label: '10 Kemenangan', description: 'Kumpulkan 10 kemenangan.', icon: '🏆' },
  { id: 'first-ko', label: 'KO Pertama', description: 'Menang KO untuk pertama kalinya.', icon: '💥' },
  { id: 'kos-5', label: '5 KO', description: 'Kumpulkan 5 kemenangan KO.', icon: '🔥' },
  { id: 'title-holder', label: 'Pemegang Gelar', description: 'Pernah memegang sabuk Juara Street Fight.', icon: '👑' },
  { id: 'streak-7', label: 'Aktif 7 Hari', description: 'Bertarung 7 hari beruntun.', icon: '📅' },
  { id: 'fights-100', label: '100 Pertarungan', description: 'Jalani 100 pertarungan.', icon: '💯' },
  { id: 'undefeated-5', label: 'Tak Terkalahkan 5x', description: 'Menang 5 kali beruntun tanpa kalah.', icon: '🛡️' },
];

export function achievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_CATALOG.find((a) => a.id === id);
}

/** Angka-angka yang dipakai untuk mengecek achievement. */
export interface AchievementContext {
  /** Total kemenangan (dari Fighter.record.wins, setelah fight ini). */
  wins: number;
  /** Total KO (dari Fighter.record.kos, setelah fight ini). */
  kos: number;
  /** Total fight yang dijalani (dari FighterProgress.totalFights). */
  totalFights: number;
  /** Kemenangan beruntun saat ini. */
  currentWinStreak: number;
  /** Hari beruntun ada fight. */
  activityStreakDays: number;
  /** Apakah fighter ini sedang memegang gelar juara. */
  isTitleHolder: boolean;
  /** Achievement yang sudah terbuka sebelumnya (tidak dicek ulang). */
  alreadyUnlocked: string[];
}

/**
 * Achievement yang BARU terbuka dari konteks ini (murni, tanpa DB).
 * Mengembalikan id-id yang belum ada di alreadyUnlocked.
 */
export function checkAchievements(ctx: AchievementContext): string[] {
  const out: string[] = [];
  const has = (id: string) => ctx.alreadyUnlocked.includes(id);
  if (ctx.wins >= 1 && !has('first-win')) out.push('first-win');
  if (ctx.wins >= 10 && !has('wins-10')) out.push('wins-10');
  if (ctx.kos >= 1 && !has('first-ko')) out.push('first-ko');
  if (ctx.kos >= 5 && !has('kos-5')) out.push('kos-5');
  if (ctx.isTitleHolder && !has('title-holder')) out.push('title-holder');
  if (ctx.activityStreakDays >= 7 && !has('streak-7')) out.push('streak-7');
  if (ctx.totalFights >= 100 && !has('fights-100')) out.push('fights-100');
  if (ctx.currentWinStreak >= 5 && !has('undefeated-5')) out.push('undefeated-5');
  return out;
}
