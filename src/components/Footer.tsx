import Link from "next/link";
import { IG_URL } from "./api";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-950/80">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-display text-2xl uppercase tracking-wide">
              Street Fight <span className="text-amber-brand">Hub</span>
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-paper-dim">
              Arena turnamen stickman fight. Buat fighter-mu, ikut turnamen,
              dan tonton pertarunganmu di Instagram.
            </p>
          </div>
          <nav aria-label="Tautan footer" className="flex flex-col gap-2 text-sm">
            <Link href="/turnamen" className="min-h-[32px] text-paper-dim hover:text-amber-brand">
              Turnamen
            </Link>
            <Link href="/klasemen" className="min-h-[32px] text-paper-dim hover:text-amber-brand">
              Klasemen
            </Link>
            <Link href="/fighter-saya" className="min-h-[32px] text-paper-dim hover:text-amber-brand">
              Fighter Saya
            </Link>
            <a
              href={IG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[32px] font-semibold text-amber-brand hover:underline"
            >
              Instagram @streetfightstickman
            </a>
          </nav>
        </div>
        <div className="mt-8 border-t border-white/10 pt-5 text-xs leading-relaxed text-paper-mute">
          <p>Bukan situs resmi Instagram.</p>
          <p className="mt-1">
            © 2026 Street Fight Tournament Hub. Semua pertarungan diundi
            secara acak — kalah menang, tetap sportif.
          </p>
        </div>
      </div>
    </footer>
  );
}
