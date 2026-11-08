/**
 * FightLoader — indikator loading reusable: GIF stickman gelud (loop mulus).
 *
 * GIF dibuat sendiri secara prosedural (PIL, joint-based ala karakter
 * Arena v3 — bukan gambar AI): dua stickman (amber vs cyan) adu jab-cross
 * lalu kembali ke guard. Siklus 1,6 dtk, 20 frame, 280x175, loop=0.
 * Frame terakhir = frame pertama (pose guard, 0% piksel berbeda — lihat
 * ~/workspace/hub-build/fight-loader-gif/render_loader.py + hasil
 * verifikasinya di sana), jadi tidak ada lompatan di titik loop.
 *
 * GIF di-inline sebagai data URI (pola BELT_IMAGE di src/app/gelar/page.tsx)
 * karena push via konektor GitHub hanya menerima konten string — file biner
 * tidak bisa di-push. File GIF asli diarsipkan di
 * ~/workspace/hub-build/fight-loader-gif/fight-loader.gif (bukan di repo).
 * Ukuran GIF: 14.420 byte.
 */
const FIGHT_LOADER_GIF =
  "data:image/gif;base64,R0lGODlhGAGvAIIAAP////r17CLT7vWmIzMrJhcUEgAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQACAAAACwAAAAAGAGvAAAI"
  + "/wALCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJsqTJkyhTqlzJsqXLlzBjypxJs6bNmzhz6tzJs6fPn0CD"
  + "Ch1KtKjRo0iTKl3KtKnTp1CjSp1KtarVq1izat3KtavXr2DDih1LtqzZs2jTql3Ltq3bt3Djyp1Lt67du3jz6t3Lt6/fv4ADCx5M"
  + "uLDhhAMSKx7wVIDjxwIOx1xMeXFSyJghS2ZZuXPio5lDO96c0rPpoqJTkxZpurXnnalji17N0bVtyzpl69ZMW+Pt37B37+7t+7ft"
  + "4MJlE89o/Hju5MqXX2zuGjn02dItVn64/Tnvhpmza//HzZ08TswR0YunSHkhgPcD23sfLfA9gIXq10uUj9A+/AL8ncebf/cllJ9+"
  + "EAVoEIECKWiTegwa+B2C5SmmUIQO1gShfwodSGFD3fX3X4gCDvgfQuF9mKB5C2X44IT4wagiQyQi5qKGHqKY44wK1YhQZQHwlGKM"
  + "MvLYo4/xeRakdY9JuKORR9Zo25LzwYgdlCtSRxmVVQoXAJdYgqjllj1d9xiYYUY5ZmJolnhdm2katOZicN5kpmN1xtngnGwGZWae"
  + "eippHKA44pkcoWkKOuVPmQVwqJ5q0nkbojCJ5qiXkP5oWgCuUepSbJfu5qmRnW4qJKiPQjrml1uOypKooqr/OmcBX9bqE6y6uSod"
  + "n6jhmpquy/FqlJe/BjorUl6GiiewwR6LbLK1Nhmns5fdSV+iazZlbWTTZuuUmZl6O1V04WpZlWqZEmQuVeimq65x517pro2dxRva"
  + "vC2+xq68+Mqp77j89vtuvfveK7C/BNs75MF7JlzwwgyfZlW7DAP478NP4iuxwhm729rEFB/8MccdpzsyxiWXe7FUsVWcpMMst1xx"
  + "dQDLLLJzUQ13M81QJScwvI2laPC8+sJcbX4BGxui0aAtnHSYFzPdq4dPY2m01EINTVDVPK7cMItDaV2Q2FZjjfWtEG9NNqlIvgw2"
  + "UGurnfaMXhd0dpfcElnkh3Uj//w2k9fqvTeCffttIdxz65j4eoUb/hmjix/EdXZ3O85YmZErnnJvjWt640xxMxR6s23TWLpMo3eY"
  + "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"
  + "i19VeOOQG6b24yApXqHetwYEADs=";

const SIZE_CLASS = {
  sm: "w-[140px]",
  md: "w-[220px]",
  lg: "w-[280px]",
} as const;

export type FightLoaderSize = keyof typeof SIZE_CLASS;

/**
 * Loader ringan: GIF + teks. Tidak menghalangi — parent yang mengatur
 * kapan komponen ini tampil, dan Next/halaman yang melepasnya begitu
 * konten siap. `role="status"` supaya screen reader mengumumkan loading.
 */
export default function FightLoader({
  label = "Memuat\u2026",
  size = "md",
  className = "",
}: {
  label?: string;
  size?: FightLoaderSize;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`flex flex-col items-center justify-center px-4 py-6 text-center ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={FIGHT_LOADER_GIF}
        alt="Dua stickman sedang bertarung"
        width={280}
        height={175}
        className={`h-auto max-w-full ${SIZE_CLASS[size]}`}
      />
      <p className="mt-3 font-display text-lg uppercase tracking-wide text-amber-brand">
        {label}
      </p>
    </div>
  );
}
