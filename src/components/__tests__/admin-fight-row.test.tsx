import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AdminFightRowCard,
  isValidReelUrl,
  shiftWibDate,
  type AdminFightRow,
} from "@/app/[adminSlug]/pertandingan/AdminFights";

/**
 * Baris riwayat admin: tiap baris WAJIB punya tombol "Ekspor Video" yang
 * membuka replay dengan mode export aktif (?export=1), tombol "Lihat"
 * (replay biasa), unduh poster satuan dengan nama file yang benar, badge
 * status + pemenang, dan kontrol "Tandai Terunggah" untuk fight selesai.
 * Render lewat renderToStaticMarkup (node env, tanpa jsdom) — komponen ini
 * presentasional saat render awal (fetch hanya di handler klik).
 */
const ROW: AdminFightRow = {
  fightId: "691234567890abcdef123456",
  fighterA: { displayName: "Pitung", igUsername: "sadiasyar" },
  fighterB: { displayName: "Jamal geng sebelah", igUsername: "jamalgeng" },
  winnerName: "Pitung",
  score: { a: 15, b: 0 },
  method: "KO",
  status: "completed",
  isTitleFight: false,
  createdAt: "2026-11-07T17:30:00.000Z",
  completedAt: "2026-11-07T17:30:00.000Z",
  hasPoster: true,
  posterDataUrl: "data:image/jpeg;base64,AAAA",
  posterFile: "2026-11-08_pitung-vs-jamal-geng-sebelah_15-0.jpg",
  videoTask: null,
};

describe("AdminFightRowCard", () => {
  it("tombol Ekspor Video ada dan membuka replay dengan mode export aktif", () => {
    const html = renderToStaticMarkup(<AdminFightRowCard f={ROW} slug="admin-slug" />);
    expect(html).toContain("Ekspor Video");
    expect(html).toContain(`/game/${ROW.fightId}?export=1`);
  });

  it("tombol Lihat membuka replay biasa (tanpa ?export=1)", () => {
    const html = renderToStaticMarkup(<AdminFightRowCard f={ROW} slug="admin-slug" />);
    expect(html).toContain(`href="/game/${ROW.fightId}"`);
  });

  it("unduh poster satuan ada dengan nama file yang benar", () => {
    const html = renderToStaticMarkup(<AdminFightRowCard f={ROW} slug="admin-slug" />);
    expect(html).toContain("Unduh poster");
    expect(html).toContain(`download="${ROW.posterFile}"`);
  });

  it("nama kedua fighter + @ig + skor + pemenang tampil", () => {
    const html = renderToStaticMarkup(<AdminFightRowCard f={ROW} slug="admin-slug" />);
    expect(html).toContain("Pitung");
    expect(html).toContain("Jamal geng sebelah");
    expect(html).toContain("@sadiasyar");
    expect(html).toContain("@jamalgeng");
    expect(html).toContain("15 - 0");
    expect(html).toContain("Pemenang:");
  });

  it("badge status Selesai tampil untuk fight completed", () => {
    const html = renderToStaticMarkup(<AdminFightRowCard f={ROW} slug="admin-slug" />);
    expect(html).toContain("Selesai");
  });

  it("badge Perebutan gelar tampil untuk title fight", () => {
    const html = renderToStaticMarkup(
      <AdminFightRowCard f={{ ...ROW, isTitleFight: true }} slug="admin-slug" />,
    );
    expect(html).toContain("Perebutan gelar");
  });

  it("tanpa poster: tidak ada tombol unduh poster, tombol ekspor tetap ada", () => {
    const html = renderToStaticMarkup(
      <AdminFightRowCard f={{ ...ROW, hasPoster: false, posterDataUrl: null }} slug="admin-slug" />,
    );
    expect(html).not.toContain("Unduh poster");
    expect(html).toContain("Ekspor Video");
    expect(html).toContain(`/game/${ROW.fightId}?export=1`);
  });

  it("fight selesai tanpa videoTask: input URL Reel + tombol Tandai Terunggah tampil", () => {
    const html = renderToStaticMarkup(<AdminFightRowCard f={ROW} slug="admin-slug" />);
    expect(html).toContain("URL Reel Instagram");
    expect(html).toContain("Tandai Terunggah");
    expect(html).toContain("https://www.instagram.com/reel/");
  });

  it("fight selesai dengan videoTask uploaded: tautan Reel tampil, bukan form", () => {
    const html = renderToStaticMarkup(
      <AdminFightRowCard
        f={{
          ...ROW,
          videoTask: {
            id: "691234567890abcdef999999",
            status: "uploaded",
            reelUrl: "https://www.instagram.com/reel/Df123456/",
          },
        }}
        slug="admin-slug"
      />,
    );
    expect(html).toContain("Lihat Reel terunggah");
    expect(html).toContain("https://www.instagram.com/reel/Df123456/");
    expect(html).toContain("Video terunggah");
    expect(html).not.toContain("Tandai Terunggah");
  });

  it("fight pending: tidak ada form Tandai Terunggah, ada petunjuk menunggu selesai", () => {
    const html = renderToStaticMarkup(
      <AdminFightRowCard
        f={{ ...ROW, status: "pending", score: { a: null, b: null }, method: null, winnerName: null }}
        slug="admin-slug"
      />,
    );
    expect(html).not.toContain("Tandai Terunggah");
    expect(html).toContain("Video bisa ditandai terunggah setelah fight selesai.");
    expect(html).toContain("Menunggu");
  });
});

describe("shiftWibDate", () => {
  it("geser ±1 hari dan melintasi batas bulan", () => {
    expect(shiftWibDate("2026-11-08", -1)).toBe("2026-11-07");
    expect(shiftWibDate("2026-11-08", 1)).toBe("2026-11-09");
    expect(shiftWibDate("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftWibDate("2026-11-08", 0)).toBe("2026-11-08");
  });

  it("tanggal tidak valid dikembalikan apa adanya", () => {
    expect(shiftWibDate("bukan-tanggal", 1)).toBe("bukan-tanggal");
  });
});

describe("isValidReelUrl", () => {
  it("menerima instagram.com/reel dan /p (https)", () => {
    expect(isValidReelUrl("https://www.instagram.com/reel/Df123456/")).toBe(true);
    expect(isValidReelUrl("https://instagram.com/p/AbC123/")).toBe(true);
  });

  it("menolak http, domain lain, dan path lain", () => {
    expect(isValidReelUrl("http://instagram.com/reel/Df123456/")).toBe(false);
    expect(isValidReelUrl("https://www.youtube.com/watch?v=x")).toBe(false);
    expect(isValidReelUrl("https://www.instagram.com/streetfightstickman")).toBe(false);
    expect(isValidReelUrl("")).toBe(false);
  });
});
