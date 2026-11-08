import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatBadge } from "../FloatingChat";

/**
 * Badge notifikasi tombol chat (presentasional): lingkaran merah + angka
 * putih. Render lewat renderToStaticMarkup (node env, tanpa jsdom).
 */
describe("ChatBadge", () => {
  it("angka benar: 3 -> '3', merah + putih", () => {
    const html = renderToStaticMarkup(<ChatBadge count={3} />);
    expect(html).toContain(">3<");
    expect(html).toContain("bg-red-brand");
    expect(html).toContain("text-white");
  });

  it("badge hilang saat 0 (tidak render apa-apa)", () => {
    expect(renderToStaticMarkup(<ChatBadge count={0} />)).toBe("");
  });

  it("'9+' saat >9", () => {
    expect(renderToStaticMarkup(<ChatBadge count={10} />)).toContain(">9+<");
    expect(renderToStaticMarkup(<ChatBadge count={99} />)).toContain(">9+<");
    expect(renderToStaticMarkup(<ChatBadge count={9} />)).toContain(">9<");
  });

  it("menempel di pojok kanan atas tombol (absolute, -top-1 -right-1)", () => {
    const html = renderToStaticMarkup(<ChatBadge count={1} />);
    expect(html).toContain("absolute");
    expect(html).toContain("-top-1");
    expect(html).toContain("-right-1");
  });
});
