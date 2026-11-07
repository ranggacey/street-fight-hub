/**
 * Fetch API dari Server Component. Hanya dipakai di server — JANGAN di-import
 * dari client component (memakai next/headers).
 */
import { headers } from "next/headers";
import type { ApiResult } from "./types";

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * GET ke API internal. Mengembalikan null kalau server/API belum tersedia
 * (mis. backend belum jalan) — halaman wajib menangani null dengan
 * loading/error/empty state, bukan crash.
 */
export async function serverApiGet<T>(
  path: string,
): Promise<ApiResult<T> | null> {
  try {
    const res = await fetch(new URL(path, await baseUrl()), {
      cache: "no-store",
    });
    const json: unknown = await res.json().catch(() => null);
    if (json && typeof json === "object" && "ok" in json) {
      return json as ApiResult<T>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Ambil data dari ApiResult, atau fallback kalau gagal. */
export function dataOr<T>(result: ApiResult<T> | null, fallback: T): T {
  if (result && result.ok) return result.data;
  return fallback;
}
