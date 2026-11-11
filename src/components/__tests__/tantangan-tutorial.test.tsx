import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TantanganTutorial from "../TantanganTutorial";

/**
 * TantanganTutorial: modal "Cara Bertarung" untuk pengguna pertama
 * di /tantangan. Render lewat renderToStaticMarkup (node env, tanpa
 * jsdom) — efek (Escape, kunci scroll) tidak jalan di server, jadi
 * yang dites adalah markup: judul, 4 langkah, tombol, dan link.
 */
describe("TantanganTutorial", () => {
  it("open=true: menampilkan judul, 4 langkah, tombol Mengerti + Lewati", () => {
    const html = renderToStaticMarkup(
      <TantanganTutorial open={true} onClose={() => {}} />,
    );
    expect(html).toContain("Cara");
    expect(html).toContain("Bertarung");
    expect(html).toContain("Siapkan deck dulu");
    expect(html).toContain("Pilih lawan");
    expect(html).toContain("Pilih arena");
    expect(html).toContain("Kirim tantangan");
    expect(html).toContain("Mengerti");
    expect(html).toContain("Lewati");
  });

  it("open=true: tepat 4 langkah bernomor 1 sampai 4", () => {
    const html = renderToStaticMarkup(
      <TantanganTutorial open={true} onClose={() => {}} />,
    );
    for (const n of ["1", "2", "3", "4"]) {
      expect(html).toContain(`>${n}<`);
    }
  });

  it("open=true: langkah 1 menyebut deck/latihan + link ke /latihan", () => {
    const html = renderToStaticMarkup(
      <TantanganTutorial open={true} onClose={() => {}} />,
    );
    expect(html).toContain("deck");
    expect(html).toContain("latihan");
    expect(html).toContain('href="/latihan"');
    expect(html).toContain("Buka halaman latihan");
  });

  it("open=true: langkah 4 menjelaskan yang menerima duluan yang bertarung", () => {
    const html = renderToStaticMarkup(
      <TantanganTutorial open={true} onClose={() => {}} />,
    );
    expect(html).toContain("Yang menerima duluan yang bertarung");
  });

  it("open=false: render kosong", () => {
    const html = renderToStaticMarkup(
      <TantanganTutorial open={false} onClose={() => {}} />,
    );
    expect(html).toBe("");
  });
});
