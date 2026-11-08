"use client";

import { ARENA_IMAGES } from "@/components/arena-images";
import { MAP_LABELS } from "@/components/api";
import CheckMark from "@/components/CheckMark";

/**
 * Pemilih arena bersama (dipakai /tantangan langkah 02 dan /obrolan
 * tantangan terbuka). Kartu radio per arena: gambar preview (thumbnail
 * WebP di-inline sebagai data URI — push konektor tidak bisa push file
 * biner), nama arena + deskripsi 1 baris. Nilai map tetap
 * "ring"/"gudang"/"jalanan"/"dojo" (MAP_LABELS) supaya submit tidak berubah.
 * Satu-satunya momen warna di form: thumbnail-nya sendiri yang bicara
 * (ring terang, gudang hangat gelap, jalanan neon, dojo kayu tenang) —
 * kartu tetap gelap + amber seperti bahasa visual Hub.
 */

/** Deskripsi 1 baris per arena, sesuai suasananya. */
export const ARENA_DESCRIPTIONS: Record<string, string> = {
  ring: "Klasik terang",
  gudang: "Gelap hangat",
  jalanan: "Neon malam",
  dojo: "Tenang kayu",
};

type ArenaPickerProps = {
  /** Nilai map terpilih ("ring" | "gudang" | "jalanan" | "dojo"). */
  value: string;
  onChange: (value: string) => void;
  /** Nama grup radio (default "map"). */
  name?: string;
  /** id elemen yang melabeli radiogroup (aria-labelledby). */
  labelledBy?: string;
};

export default function ArenaPicker({
  value,
  onChange,
  name = "map",
  labelledBy,
}: ArenaPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-2 gap-2"
    >
      {Object.entries(MAP_LABELS).map(([arena, label]) => {
        const selected = value === arena;
        return (
          <label
            key={arena}
            className={`min-w-0 cursor-pointer rounded-xl border p-2 transition-colors duration-150 focus-within:ring-2 focus-within:ring-amber-brand/60 ${
              selected
                ? "border-amber-brand bg-amber-brand/10"
                : "border-white/10 bg-white/[0.03] hover:border-white/25"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={arena}
              checked={selected}
              onChange={() => onChange(arena)}
              className="sr-only"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ARENA_IMAGES[arena] ?? ""}
              alt=""
              width={480}
              height={270}
              className="aspect-video w-full rounded-lg object-cover"
            />
            <span className="mt-2 flex items-start justify-between gap-2 px-1 pb-1">
              <span className="min-w-0">
                <span
                  className={`block truncate font-display text-base uppercase leading-tight tracking-wide ${
                    selected ? "text-paper" : "text-paper-dim"
                  }`}
                >
                  {label}
                </span>
                <span className="mt-0.5 block text-xs text-paper-dim">
                  {ARENA_DESCRIPTIONS[arena] ?? ""}
                </span>
              </span>
              <CheckMark checked={selected} />
            </span>
          </label>
        );
      })}
    </div>
  );
}
