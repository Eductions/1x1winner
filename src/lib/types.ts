// Shared domain types — mirror the Supabase schema in supabase/schema.sql

export const FLOOR_COUNT = 10;
export const GROUND_FLOOR = 0;
export const TOP_FLOOR = FLOOR_COUNT;

export type TeamSide = "A" | "B";
export type MatchStatus = "waiting" | "playing" | "finished" | "cancelled";
export type UserRole = "student" | "teacher";
export type QuestionCategory =
  | "grammar"
  | "vocabulary"
  | "reading"
  | "listening"
  | "writing";
export type AnswerKey = "A" | "B" | "C" | "D";

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface QuestionOption {
  key: AnswerKey;
  text: string;
}

export interface Question {
  id: string;
  floor_level: number;
  category: QuestionCategory;
  prompt: string;
  options: QuestionOption[];
  correct_key: AnswerKey;
  explanation: string | null;
  is_active: boolean;
}

export interface RoomMatch {
  id: string;
  room_code: string;
  status: MatchStatus;
  created_by: string;
  team_a_player_id: string | null;
  team_b_player_id: string | null;
  team_a_position: number;
  team_b_position: number;
  current_turn: TeamSide;
  current_question_id: string | null;
  winner: TeamSide | null;
  /** Optimistic-concurrency counter; higher = newer state. */
  version: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomAnswer {
  id: string;
  room_id: string;
  question_id: string;
  team: TeamSide;
  player_id: string;
  selected_key: AnswerKey;
  is_correct: boolean;
  created_at: string;
}

/** Question shape safe to send to a player — no correct_key/explanation. */
export interface SafeQuestion {
  id: string;
  floor_level: number;
  category: QuestionCategory;
  prompt: string;
  options: QuestionOption[];
}

/** Composite row returned by the answer_question RPC. */
export interface AnswerResult {
  room: RoomMatch;
  is_correct: boolean;
  correct_key: AnswerKey;
  explanation: string | null;
}

/** Row returned by the list_waiting_rooms RPC. */
export interface WaitingRoomRow {
  room_code: string;
  team_a_username: string | null;
  team_b_username: string | null;
  free_slot: TeamSide;
  created_at: string;
}

/** A player tracked through Realtime Presence on a room channel. */
export interface PresenceUser {
  user_id: string;
  username: string;
  online_at: string;
}

export const QUESTION_TIME_SECONDS = 20;

/** Full question row as seen by teachers through teacher_list_questions(). */
export interface TeacherQuestion extends Question {
  created_by: string | null;
  created_at: string;
}

/** Payload of the teacher create/update question form. */
export interface QuestionInput {
  floor_level: number;
  category: QuestionCategory;
  prompt: string;
  options: QuestionOption[];
  correct_key: AnswerKey;
  explanation: string;
}

export interface PlayerStats {
  matches_played: number;
  matches_won: number;
  answers_total: number;
  answers_correct: number;
}

export interface LeaderboardEntry {
  username: string;
  matches_played: number;
  matches_won: number;
  answers_total: number;
  answers_correct: number;
  accuracy: number;
}

export interface MatchHistoryRow {
  room_code: string;
  status: MatchStatus;
  my_team: TeamSide;
  my_position: number;
  winner: TeamSide | null;
  finished_at: string | null;
}

export const QUESTION_CATEGORIES: QuestionCategory[] = [
  "grammar",
  "vocabulary",
  "reading",
  "listening",
  "writing",
];

/** Payload of a PostgreSQL change event delivered by Supabase Realtime. */
export interface RoomChangePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: RoomMatch | Record<string, never>;
  old: Partial<RoomMatch>;
}

export const TEAM_META: Record<
  TeamSide,
  { name: string; color: string; softColor: string; ring: string }
> = {
  A: {
    name: "Team A",
    color: "bg-sky-500",
    softColor: "bg-sky-500/15",
    ring: "ring-sky-400",
  },
  B: {
    name: "Team B",
    color: "bg-rose-500",
    softColor: "bg-rose-500/15",
    ring: "ring-rose-400",
  },
};
