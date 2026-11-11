/**
 * Penanda tutorial halaman /tantangan.
 * Tutorial "Cara Bertarung" tampil sekali untuk pengguna yang baru
 * pertama kali membuka /tantangan; pilihan sudah-dilihat disimpan di
 * localStorage supaya tidak muncul lagi di kunjungan berikutnya.
 * Fungsi di sini MURNI (kecuali akses localStorage yang dibungkus
 * try/catch) supaya bisa dites unit tanpa DOM penuh — pola yang sama
 * seperti src/lib/chat-badge.ts. Di SSR (tanpa localStorage) akses
 * melempar ReferenceError yang ditangkap catch, jadi aman.
 */

export const TANTANGAN_TUTORIAL_SEEN_KEY = "sfh_tutorial_tantangan_seen";

/** True kalau tutorial sudah pernah dilihat (flag tersimpan). */
export function hasSeenTantanganTutorial(): boolean {
  try {
    return localStorage.getItem(TANTANGAN_TUTORIAL_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Tandai tutorial sudah dilihat (disimpan permanen di browser ini). */
export function markTantanganTutorialSeen(): void {
  try {
    localStorage.setItem(TANTANGAN_TUTORIAL_SEEN_KEY, "1");
  } catch {
    // localStorage tidak tersedia — abaikan, tutorial bisa muncul lagi.
  }
}

/** Hapus penanda (dipakai tes; tombol "?" di halaman tidak memakainya). */
export function clearTantanganTutorialSeen(): void {
  try {
    localStorage.removeItem(TANTANGAN_TUTORIAL_SEEN_KEY);
  } catch {
    // localStorage tidak tersedia — abaikan.
  }
}
