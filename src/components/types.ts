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
  | "other"
  | "kali-arnis"
  | "judo"
  | "kudo"
  | "jeet-kune-do"
  | "capoeira"
  | "wushu"
  | "kung-fu";

export type FighterTempo = "agresif" | "seimbang" | "bertahan";

import type { FighterAccessories } from "@/lib/game/accessories";

export type { FighterAccessories };

export interface FighterColors {
  body: string;
  gloves: string;
  shoes: string;
  belt: string;
  headband: string;
  weapon: string;
}

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
  record: FighterRecord;
  status?: "active" | "retired";
  createdAt?: string;
  updatedAt?: string;
  /** Game kasual (Fase 1). */
  rating?: number;
  casualRecord?: FighterRecord;
  signatureMove?: string | null;
  tempo?: FighterTempo;
  colors?: FighterColors;
  /** Aksesoris per bagian (katalog Hub); kosong = fallback turunan warna. */
  accessories?: FighterAccessories;
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
  gameHistory?: GameHistoryItem[];
  titleHistory?: TitleHistoryItem[];
}

/** Satu fight game kasual di riwayat fighter. */
export interface GameHistoryItem {
  fightId?: string;
  opponentId?: string | null;
  opponentName?: string | null;
  result?: "win" | "loss" | "draw";
  method?: "KO" | "decision" | "draw" | null;
  score?: { a: number; b: number } | null;
  koTimeSec?: number | null;
  isTitleFight?: boolean;
  status?: string;
  completedAt?: string | null;
}

/** Satu event riwayat gelar untuk satu fighter. */
export interface TitleHistoryItem {
  id?: string;
  type?: "race_10_win" | "race_7_win" | "takeover" | "vacated_inactivity";
  at?: string;
  fightId?: string | null;
  score?: number | null;
  defensesAtEnd?: number | null;
  raceStartAt?: string | null;
  role?: "won" | "lost";
}

/* ------------------------------------------------------------------ */
/* Game (Fase 1)                                                       */
/* ------------------------------------------------------------------ */

export type ChallengeStatus = "pending" | "accepted" | "declined" | "expired";

export interface Challenge {
  id?: string;
  _id?: string;
  challengerFighterId?: string | FighterSummary;
  challengedFighterId?: string | FighterSummary;
  status?: ChallengeStatus;
  gameFightId?: string | { id?: string; status?: string } | null;
  map?: string;
  message?: string | null;
  respondedAt?: string | null;
  expiresAt?: string;
  createdAt?: string;
}

export type GameFightStatus = "pending" | "playing" | "completed" | "disputed";

export interface GameFight {
  id?: string;
  _id?: string;
  fighterAId?: string | FighterSummary;
  fighterBId?: string | FighterSummary;
  challengeId?: string | null;
  seed?: number;
  map?: string;
  durationSec?: number;
  status?: GameFightStatus;
  result?: {
    winnerSide?: "R" | "B" | null;
    winnerFighterId?: string | null;
    method?: "KO" | "decision" | "draw" | null;
    score?: { a: number; b: number } | null;
    koTimeSec?: number | null;
  } | null;
  stats?: {
    accuracyA?: number;
    accuracyB?: number;
    damageDealtA?: number;
    damageDealtB?: number;
    strikesThrownA?: number;
    strikesThrownB?: number;
    strikesLandedA?: number;
    strikesLandedB?: number;
    knockdowns?: number;
  } | null;
  keyMoments?: {
    biggestHit?: { by: "L" | "R"; move: string; damage?: number; timeSec: number } | null;
    finisher?: { by: "L" | "R"; move: string; timeSec: number } | null;
    knockdowns?: { by: "L" | "R"; timeSec: number }[];
    leadChange?: { timeSec: number; by: "L" | "R" } | null;
  } | null;
  posterDataUrl?: string | null;
  isTitleFight?: boolean;
  disputeReason?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}

export type NotificationType =
  | "challenge_received"
  | "challenge_accepted"
  | "challenge_declined"
  | "fight_result"
  | "title_won"
  | "title_lost"
  | "title_vacant";

export interface AppNotification {
  id?: string;
  _id?: string;
  type?: NotificationType;
  relatedId?: string | null;
  read?: boolean;
  createdAt?: string;
  /** Detail tantangan (nama fighter) — dilampirkan GET /api/notifications. */
  detail?: {
    challengerName?: string | null;
    challengedName?: string | null;
    kind?: string | null;
    map?: string | null;
  } | null;
}

export interface TitlePublic {
  holder?: {
    id?: string;
    displayName?: string;
    igUsername?: string;
    style?: string;
    styleOther?: string | null;
    rating?: number;
    casualRecord?: FighterRecord;
  } | null;
  wonAt?: string | null;
  lastFightAt?: string | null;
  defenses?: number;
  raceTarget?: number;
  raceStartAt?: string | null;
  everVacated?: boolean;
  vacant?: boolean;
  vacatesAt?: string | null;
  raceStandings?: { fighterId: string; displayName: string; wins: number }[];
}

export interface TitleHistoryEvent {
  id?: string;
  type?: "race_10_win" | "race_7_win" | "takeover" | "vacated_inactivity";
  previousHolderFighterId?: string | FighterSummary | null;
  newHolderFighterId?: string | FighterSummary | null;
  at?: string;
  fightId?: string | { id?: string; status?: string } | null;
  score?: number | null;
  defensesAtEnd?: number | null;
  raceStartAt?: string | null;
}

export interface ChatMessageItem {
  id?: string;
  text?: string;
  createdAt?: string;
  username?: string;
}

export interface LeaderboardEntry {
  rank?: number;
  fighterId?: string;
  displayName?: string;
  igUsername?: string;
  style?: string;
  rating?: number;
  casualRecord?: FighterRecord;
}

export interface VideoTask {
  id?: string;
  _id?: string;
  matchId?: string | MatchItem;
  match?: MatchItem;
  kind?: "match" | "title";
  gameFightId?: string | GameFight;
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
