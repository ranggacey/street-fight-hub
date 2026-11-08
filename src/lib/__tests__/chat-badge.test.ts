import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_LAST_READ_KEY,
  countUnreadMessages,
  formatBadgeCount,
  latestMessageAt,
  loadLastReadAt,
  saveLastReadAt,
  totalBadgeCount,
} from "../chat-badge";

/**
 * Badge notifikasi chat: hitung pesan belum dibaca + format angka.
 * Murni — localStorage di-mock dengan Map sederhana.
 */
describe("chat badge helpers", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const msgs = [
    { createdAt: "2026-11-08T10:00:00.000Z" },
    { createdAt: "2026-11-08T10:05:00.000Z" },
    { createdAt: "2026-11-08T10:10:00.000Z" },
  ];

  it("countUnreadMessages: hanya pesan setelah penanda yang dihitung", () => {
    expect(countUnreadMessages(msgs, "2026-11-08T10:00:00.000Z")).toBe(2);
    expect(countUnreadMessages(msgs, "2026-11-08T10:10:00.000Z")).toBe(0);
    expect(countUnreadMessages(msgs, "2026-11-08T09:00:00.000Z")).toBe(3);
  });

  it("countUnreadMessages: tanpa penanda -> 0 (diinisialisasi saat load pertama)", () => {
    expect(countUnreadMessages(msgs, null)).toBe(0);
  });

  it("countUnreadMessages: pesan tanpa createdAt dilewati, penanda invalid -> 0", () => {
    expect(countUnreadMessages([{}, { createdAt: "2026-11-08T10:05:00.000Z" }], "2026-11-08T10:00:00.000Z")).toBe(1);
    expect(countUnreadMessages(msgs, "bukan-tanggal")).toBe(0);
  });

  it("latestMessageAt: waktu pesan terbaru (bukan urutan array)", () => {
    expect(latestMessageAt([msgs[2], msgs[0], msgs[1]])).toBe("2026-11-08T10:10:00.000Z");
    expect(latestMessageAt([])).toBeNull();
    expect(latestMessageAt([{}])).toBeNull();
  });

  it("save/loadLastReadAt: bolak-balik lewat localStorage", () => {
    expect(loadLastReadAt()).toBeNull();
    saveLastReadAt("2026-11-08T10:10:00.000Z");
    expect(loadLastReadAt()).toBe("2026-11-08T10:10:00.000Z");
    expect(store.get(CHAT_LAST_READ_KEY)).toBe("2026-11-08T10:10:00.000Z");
  });

  it("totalBadgeCount: pesan belum dibaca + tantangan pending", () => {
    expect(totalBadgeCount(2, 1)).toBe(3);
    expect(totalBadgeCount(0, 0)).toBe(0);
    expect(totalBadgeCount(0, 2)).toBe(2);
    expect(totalBadgeCount(-1, -2)).toBe(0);
  });

  it("formatBadgeCount: 0 -> null (sembunyi), 1-9 -> angka, >9 -> 9+", () => {
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(9)).toBe("9");
    expect(formatBadgeCount(10)).toBe("9+");
    expect(formatBadgeCount(99)).toBe("9+");
  });

  it("skenario: buka pop-up (tandai dibaca) -> badge nol; pesan baru -> badge naik; buka lagi -> nol", () => {
    // Awal: penanda di pesan ke-2 (10:05), ada 1 pesan baru (10:10).
    saveLastReadAt("2026-11-08T10:05:00.000Z");
    expect(totalBadgeCount(countUnreadMessages(msgs, loadLastReadAt()), 0)).toBe(1);
    // Buka pop-up: penanda maju ke pesan terbaru.
    saveLastReadAt(latestMessageAt(msgs)!);
    expect(totalBadgeCount(countUnreadMessages(msgs, loadLastReadAt()), 0)).toBe(0);
    // Pesan baru masuk saat pop-up tertutup.
    const more = [...msgs, { createdAt: "2026-11-08T10:12:00.000Z" }];
    expect(totalBadgeCount(countUnreadMessages(more, loadLastReadAt()), 0)).toBe(1);
    // + 2 tantangan pending -> total 3.
    expect(totalBadgeCount(countUnreadMessages(more, loadLastReadAt()), 2)).toBe(3);
    // Buka pop-up lagi -> nol (pesan baru ikut ditandai dibaca).
    saveLastReadAt(latestMessageAt(more)!);
    expect(totalBadgeCount(countUnreadMessages(more, loadLastReadAt()), 0)).toBe(0);
  });

  it("skenario: pesan baru saat pop-up terbuka tidak menambah badge (penanda ikut maju)", () => {
    // Pop-up terbuka: GlobalChat memperbarui penanda setiap pesan tampil.
    saveLastReadAt("2026-11-08T10:10:00.000Z");
    const more = [...msgs, { createdAt: "2026-11-08T10:12:00.000Z" }];
    // Penanda ikut maju karena pesan tampil di pop-up yang terbuka.
    saveLastReadAt(latestMessageAt(more)!);
    expect(countUnreadMessages(more, loadLastReadAt())).toBe(0);
  });
});
