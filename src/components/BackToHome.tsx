import Link from "next/link";

/**
 * Tautan kembali kecil yang konsisten di semua halaman dalam Hub.
 * Satu-satunya jalan pulang yang selalu terlihat: Beranda ("/") atau
 * halaman hub lain (mis. Profil dari /fighter-saya).
 *
 * @param href tujuan kembali, default "/" (Beranda).
 * @param label teks tautan, default "Beranda".
 */
export default function BackToHome({
  href = "/",
  label = "Beranda",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-bold text-amber-brand transition-colors hover:bg-white/5 hover:underline"
    >
      <span aria-hidden="true">←</span> {label}
    </Link>
  );
}
