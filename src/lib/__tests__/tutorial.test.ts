import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TANTANGAN_TUTORIAL_SEEN_KEY,
  clearTantanganTutorialSeen,
  hasSeenTantanganTutorial,
  markTantanganTutorialSeen,
} from "../tutorial";

/**
 * Helper tutorial /tantangan: flag sudah-dilihat di localStorage.
 * localStorage di-stub dengan objek fake sederhana (Map) yang
 * dipasang ke globalThis sebelum tes dan dilepas setelahnya.
 * Tanpa stub (SSR / node polos) helper tetap aman: akses localStorage
 * yang tidak ada melempar ReferenceError yang ditangkap try/catch.
 */
describe("tutorial helpers", () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };

  beforeEach(() => {
    store.clear();
    (globalThis as unknown as { localStorage: typeof fakeStorage }).localStorage =
      fakeStorage;
  });

  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  });

  it("kunci flag memakai nama yang disepakati", () => {
    expect(TANTANGAN_TUTORIAL_SEEN_KEY).toBe("sfh_tutorial_tantangan_seen");
  });

  it("belum ada flag -> false", () => {
    expect(hasSeenTantanganTutorial()).toBe(false);
  });

  it("setelah mark -> true", () => {
    markTantanganTutorialSeen();
    expect(hasSeenTantanganTutorial()).toBe(true);
    expect(store.get(TANTANGAN_TUTORIAL_SEEN_KEY)).toBe("1");
  });

  it("mark idempotent: dipanggil dua kali tetap true, nilai tetap '1'", () => {
    markTantanganTutorialSeen();
    markTantanganTutorialSeen();
    expect(hasSeenTantanganTutorial()).toBe(true);
    expect(store.get(TANTANGAN_TUTORIAL_SEEN_KEY)).toBe("1");
  });

  it("clear menghapus flag -> false lagi", () => {
    markTantanganTutorialSeen();
    expect(hasSeenTantanganTutorial()).toBe(true);
    clearTantanganTutorialSeen();
    expect(hasSeenTantanganTutorial()).toBe(false);
  });

  it("nilai flag selain '1' dianggap belum dilihat", () => {
    store.set(TANTANGAN_TUTORIAL_SEEN_KEY, "0");
    expect(hasSeenTantanganTutorial()).toBe(false);
  });

  it("getItem melempar -> false, tidak crash", () => {
    (globalThis as unknown as { localStorage: typeof fakeStorage }).localStorage = {
      ...fakeStorage,
      getItem: () => {
        throw new Error("storage diblokir");
      },
    };
    expect(hasSeenTantanganTutorial()).toBe(false);
  });

  it("setItem melempar -> mark tidak crash, hasSeen tetap false", () => {
    (globalThis as unknown as { localStorage: typeof fakeStorage }).localStorage = {
      ...fakeStorage,
      setItem: () => {
        throw new Error("storage penuh");
      },
    };
    expect(() => markTantanganTutorialSeen()).not.toThrow();
    expect(hasSeenTantanganTutorial()).toBe(false);
  });

  it("tanpa localStorage sama sekali (SSR) -> false, tidak crash", () => {
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    expect(hasSeenTantanganTutorial()).toBe(false);
    expect(() => markTantanganTutorialSeen()).not.toThrow();
    expect(() => clearTantanganTutorialSeen()).not.toThrow();
  });
});
