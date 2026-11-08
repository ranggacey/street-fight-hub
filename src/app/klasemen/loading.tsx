import FightLoader from "@/components/FightLoader";

/**
 * Fallback navigasi ke /klasemen: tampil selama server component klasemen
 * mengambil data leaderboard, lalu hilang begitu klasemen siap.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <FightLoader label="Memuat klasemen…" />
    </div>
  );
}
