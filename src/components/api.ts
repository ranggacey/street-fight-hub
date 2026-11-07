/**
 * Helper client + util murni (AMAN di-import dari client component).
 * Jangan import next/headers di sini — itu ada di ./server-api.ts.
 */
import type {
  ApiResult,
  FighterSummary,
  MatchItem,
  RoundKey,
} from "./types";

/* ------------------------------------------------------------------ */
/* Fetch client (cookie sfh_token ikut otomatis, same-origin)          */
/* ------------------------------------------------------------------ */

export async function clientApi<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    return {
      ok: false,
      error: {
        code: "NETWORK",
        message: "Gagal menghubungi server. Periksa koneksi lalu coba lagi.",
      },
    };
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (json && typeof json === "object" && "ok" in json) {
    const result = json as ApiResult<T>;
    if (!result.ok) {
      result.error.status = res.status;
    }
    return result;
  }
  return {
    ok: false,
    error: {
      code: `HTTP_${res.status}`,
      message: res.ok
        ? "Respons server tidak dikenali."
        : `Server mengembalikan status ${res.status}.`,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Normalisasi id / fighter populate (backend bisa kirim id atau obj)  */
/* ------------------------------------------------------------------ */

export function getId(
  obj: { id?: string; _id?: string } | string | null | undefined,
): string {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj.id ?? obj._id ?? "";
}

/** Ambil objek fighter dari field yang bisa berisi id string / objek / null. */
export function asFighter(
  v: FighterSummary | string | null | undefined,
): FighterSummary | null {
  if (!v || typeof v === "string") return null;
  return v;
}

/** Normalisasi bracket: array match, atau objek per ronde. */
export function normalizeBracket(
  raw: MatchItem[] | Record<string, MatchItem[]> | null | undefined,
): MatchItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const out: MatchItem[] = [];
  for (const round of Object.keys(raw)) {
    const list = raw[round];
    if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

export const ROUND_ORDER: RoundKey[] = ["R32", "R16", "QF", "SF", "F"];

/* ------------------------------------------------------------------ */
/* Label Bahasa Indonesia                                              */
/* ------------------------------------------------------------------ */

export const STYLE_LABELS: Record<string, string> = {
  boxing: "Tinju",
  taekwondo: "Taekwondo",
  "muay-thai": "Muay Thai",
  street: "Street Fight",
  karate: "Karate",
  silat: "Silat",
  wrestling: "Gulat",
  other: "Lainnya",
};

export const STYLE_OPTIONS: { value: string; label: string }[] = Object.entries(
  STYLE_LABELS,
).map(([value, label]) => ({ value, label }));

export const ROUND_LABELS: Record<RoundKey, string> = {
  R32: "32 Besar",
  R16: "16 Besar",
  QF: "Perempat Final",
  SF: "Semifinal",
  F: "Final",
};

export const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  upcoming: "Pendaftaran Dibuka",
  closed: "Pendaftaran Ditutup",
  in_progress: "Berlangsung",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export const METHOD_LABELS: Record<string, string> = {
  KO: "KO",
  decision: "Keputusan Juri",
  draw: "Seri",
  bye: "Bye",
};

export const VIDEO_STATUS_LABELS: Record<string, string> = {
  queued: "Antre",
  in_production: "Diproduksi",
  uploaded: "Terunggah",
  blocked: "Terblokir",
};

export function styleLabel(style?: string, styleOther?: string): string {
  if (style === "other" && styleOther) return styleOther;
  return STYLE_LABELS[style ?? ""] ?? style ?? "-";
}

/* ------------------------------------------------------------------ */
/* Format waktu WIB (Asia/Jakarta)                                     */
/* ------------------------------------------------------------------ */

const dtf = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dtfDate = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatWIB(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${dtf.format(d)} WIB`;
}

export function formatDateWIB(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return dtfDate.format(d);
}

/** Sisa waktu menuju target. Dipakai Countdown (client). */
export function timeLeft(target: string): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
} {
  const diff = new Date(target).getTime() - Date.now();
  if (Number.isNaN(diff) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  }
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    past: false,
  };
}

/** Ambil kode dari URL Reel/post Instagram untuk embed sederhana. */
export function instagramEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const kind = url.includes("/reel/") ? "reel" : "p";
  return `https://www.instagram.com/${kind}/${m[1]}/embed/`;
}

export const IG_URL = "https://www.instagram.com/streetfightstickman";
export const MAX_REGEN = 3;
