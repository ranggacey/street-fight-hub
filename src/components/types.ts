/**
 * Tipe bersama frontend — dicerminkan dari CONTRACT.md §2 dan §4.
 * Bentuk `data` respons API SELALU objek bernama (lihat CONTRACT.md §4
 * "Bentuk data (wrapper)"): list → { tournaments | fighters | videoTasks |
 * users: [...] }, detail → { tournament, entries, bracket, participantCount }
 * / { fighter, history } / { match }. Call site WAJIB unwrap field bernama
 * itu — jangan pernah menganggap `data` sebagai array/objek model langsung.
 */

export type StyleKey =
  | "boxing"
  | "taekwondo"
  | "muay-thai"
  | "street"
  | "karate"
  | "silat"
  | "wrestling"
  | "other";

export type RoundKey = "R32" | "R16" | "QF" | "SF" | "F";

export type TournamentStatus =
  | "upcoming"
  | "closed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type MatchStatus = "scheduled" | "decided" | "video_done";
export type MatchMethod = "KO" | "decision" | "draw" | "bye";
export type VideoTaskStatus = "queued" | "in_production" | "uploaded" | "blocked";

export interface ApiError {
  code: string;
  message: string;
  /** Status HTTP dari respons (diisi clientApi bila tersedia). */
  status?: number;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface SessionUser {
  id: string;
  username: string;
  role: "user" | "admin";
}

export interface AiPersona {
  nickname: string;
  styleSummary: string;
  strengths: string[];
  weakness: string;
  signatureMove: string;
  introLine: string;
  color: string;
  gear: string;
}

export interface FighterRecord {
  wins: number;
  losses: number;
  draws: number;
  kos: number;
}

export interface Fighter {
  id?: string;
  _id?: string;
  userId?: string;
  displayName: string;
  igUsername: string;
  style: StyleKey;
  styleOther?: string;
  selfDescription?: string;
  aiPersona?: AiPersona | null;
  record: FighterRecord;
  status?: "active" | "retired";
  regenCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Ringkasan fighter seperti yang di-populate di bracket/match. */
export type FighterSummary = Fighter;

export interface TournamentEntry {
  id?: string;
  _id?: string;
  tournamentId?: string;
  fighterId?: string | FighterSummary;
  fighter?: FighterSummary;
  joinedAt?: string;
  seed?: number | null;
  status?: "active" | "eliminated" | "champion" | "withdrawn";
}

export interface Tournament {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  format?: "single-elim";
  bracketSize: 8 | 16 | 32;
  regOpenAt: string;
  regCloseAt: string;
  status: TournamentStatus;
  rules?: string;
  championId?: string | FighterSummary | null;
  bracketSeed?: number | null;
  participantCount?: number;
  createdAt?: string;
}

export interface TournamentDetail extends Tournament {
  entries?: TournamentEntry[];
  bracket?: MatchItem[] | Record<string, MatchItem[]>;
}

export interface MatchItem {
  id?: string;
  _id?: string;
  tournamentId?: string | { name?: string; slug?: string };
  tournament?: { name?: string; slug?: string };
  round: RoundKey;
  fighterAId?: string | FighterSummary | null;
  fighterBId?: string | FighterSummary | null;
  fighterA?: FighterSummary | null;
  fighterB?: FighterSummary | null;
  winnerId?: string | null;
  method?: MatchMethod | null;
  score?: { a: number; b: number } | null;
  koTimeSec?: number | null;
  drawSeed?: number;
  drawAdvancerId?: string | FighterSummary | null;
  drawReRollSeed?: number | null;
  isBye?: boolean;
  status?: MatchStatus;
  reelUrl?: string | null;
  decidedAt?: string | null;
}

export interface FightHistoryItem {
  matchId?: string;
  tournamentId?: string;
  tournamentName?: string;
  tournamentSlug?: string;
  round?: RoundKey;
  opponentId?: string;
  opponentName?: string;
  result?: "win" | "loss" | "draw" | "bye";
  method?: MatchMethod | null;
  score?: { a: number; b: number } | null;
  reelUrl?: string | null;
  decidedAt?: string | null;
}

export interface FighterDetail extends Fighter {
  history?: FightHistoryItem[];
  matches?: FightHistoryItem[];
}

export interface VideoTask {
  id?: string;
  _id?: string;
  matchId?: string | MatchItem;
  match?: MatchItem;
  status: VideoTaskStatus;
  note?: string;
  reelUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Announcement {
  id?: string;
  _id?: string;
  text: string;
  active?: boolean;
  createdAt?: string;
}

export interface AdminUserRow {
  id?: string;
  _id?: string;
  username: string;
  role: "user" | "admin";
  fighter?: FighterSummary | null;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export interface AdminStats {
  liveTournaments: number;
  totalFighters: number;
  totalUsers: number;
  videoQueueDepth: number;
  pendingTasks: number;
}
