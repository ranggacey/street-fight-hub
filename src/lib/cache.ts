/**
 * Cache in-memory TTL pendek per instance serverless — untuk data yang
 * sering dibaca tapi jarang berubah (mis. leaderboard). TTL harus
 * belasan detik supaya data tetap segar: kalau instance di-recycle
 * Vercel, cache ikut hilang (aman — hanya berarti satu query segar lagi).
 * BUKAN cache antar-instance: tiap instance punya salinannya sendiri.
 */
export class TtlCache<T> {
  private value: T | undefined = undefined;
  private storedAt = 0;

  constructor(private readonly ttlMs: number) {}

  get(now: number = Date.now()): T | undefined {
    if (this.value === undefined) return undefined;
    if (now - this.storedAt >= this.ttlMs) {
      this.value = undefined;
      return undefined;
    }
    return this.value;
  }

  set(value: T, now: number = Date.now()): void {
    this.value = value;
    this.storedAt = now;
  }

  clear(): void {
    this.value = undefined;
    this.storedAt = 0;
  }
}
