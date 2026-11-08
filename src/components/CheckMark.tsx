/** Lingkaran centang untuk baris/kartu yang terpilih (pola lama dari TantanganClient). */
export default function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
        checked
          ? "border-amber-brand bg-amber-brand text-ink-950"
          : "border-white/25 text-transparent"
      }`}
    >
      <svg viewBox="0 0 12 10" className="h-3 w-3" fill="none">
        <path
          d="M1 5.5 4.5 9 11 1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
