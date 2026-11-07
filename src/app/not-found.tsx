import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { ButtonLink } from "@/components/Button";

/**
 * Halaman 404 dengan gaya situs (gelap + kaca + amber), bukan halaman
 * default Next.js yang teksnya nyaris tak terbaca di latar gelap.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <GlassCard className="max-w-lg px-6 py-10 text-center">
        <p className="font-display text-7xl uppercase leading-none tracking-wide text-amber-brand">
          404
        </p>
        <h1 className="mt-4 font-display text-3xl uppercase tracking-wide">
          Halaman Tidak Ditemukan
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-paper-dim">
          Arena yang kamu cari tidak ada — mungkin tautannya sudah berubah,
          atau turnamennya sudah dihapus.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/">Kembali ke Beranda</ButtonLink>
          <Link
            href="/turnamen"
            className="text-sm font-bold text-amber-brand hover:underline"
          >
            Lihat semua turnamen →
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
