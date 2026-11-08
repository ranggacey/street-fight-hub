import FightLoader from "@/components/FightLoader";

/**
 * Fallback navigasi antar halaman (App Router): tampil selama halaman
 * tujuan belum siap, lalu hilang begitu konten siap. Navbar + footer tetap
 * terlihat — hanya isi halaman yang diganti loader.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <FightLoader label="Memuat…" />
    </div>
  );
}
