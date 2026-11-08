import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminFightRowCard, type AdminFightRow } from "@/app/[adminSlug]/pertandingan/AdminFights";

/**
 * Baris riwayat admin: tiap baris WAJIB punya tombol "Ekspor Video" yang
 * membuka replay dengan mode export aktif (?export=1), plus unduh poster
 * satuan dengan nama file yang benar.
 * Render lewat renderToStaticMarkup (node env, tanpa jsdom) — komponen ini
 * presentasional (tanpa fetch/effect).
 */
const ROW: AdminFightRow = {
  fightId: "691234567890abcdef123456",
  fighterA: { displayName: "Pitung", igUsername: "sadiasyar" },
  fighterB: { displayName: "Jamal geng sebelah", igUsername: "jamalgeng" },
  score: { a: 15, b: 0 },
  method: "KO",
  status: "completed",
  isTitleFight: false,
  createdAt: "2026-11-07T17:30:00.000Z",
  completedAt: "2026-11-07T17:30:00.000Z",
  hasPoster: true,
  posterDataUrl: "data:image/jpeg;base64,AAAA",
  posterFile: "2026-11-08_pitung-vs-jamal-geng-sebelah_15-0.jpg",
};

describe("AdminFightRowCard", () => {
  it("tombol Ekspor Video ada dan membuka replay dengan mode export aktif", () => {
    const html = renderToStaticMarkup(<AdminFightRowCard f={ROW} />);
    expect(html).toContain("Ekspor Video");
    expect(html).toContain(`/game/${ROW.fightId}?export=1`);
  });

  it("unduh poster satuan ada dengan nama file yang benar", () => {
    const html = renderToStaticMarkup(<AdminFightRowCard f={ROW} />);
    expect(html).toContain("Unduh poster");
    expect(html).toContain(`download="${ROW.posterFile}"`);
  });

  it("nama kedua fighter + skor tampil", () => {
    const html = renderToStaticMarkup(<AdminFightRowCard f={ROW} />);
    expect(html).toContain("Pitung");
    expect(html).toContain("Jamal geng sebelah");
    expect(html).toContain("15 - 0");
  });

  it("tanpa poster: tidak ada tombol unduh poster, tombol ekspor tetap ada", () => {
    const html = renderToStaticMarkup(
      <AdminFightRowCard f={{ ...ROW, hasPoster: false, posterDataUrl: null }} />,
    );
    expect(html).not.toContain("Unduh poster");
    expect(html).toContain("Ekspor Video");
    expect(html).toContain(`/game/${ROW.fightId}?export=1`);
  });
});
