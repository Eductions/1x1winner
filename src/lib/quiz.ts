import {
  QUESTION_TIME_SECONDS,
  type AnswerKey,
  type AnswerResult,
  type RoomMatch,
  type SafeQuestion,
  type TeamSide,
} from "./types";

/**
 * Pure reducer modelling one question round in the game screen.
 * The database stays the source of truth for positions/turns; this reducer
 * only owns the local UI lifecycle of the current question.
 */

export type QuizPhase =
  | "idle"
  | "loading"
  | "active"
  | "submitted"
  | "timeout";

export interface QuizState {
  phase: QuizPhase;
  question: SafeQuestion | null;
  questionId: string | null;
  selectedKey: AnswerKey | null;
  isCorrect: boolean | null;
  correctKey: AnswerKey | null;
  explanation: string | null;
  error: string | null;
}

export type QuizAction =
  | { type: "LOAD_QUESTION"; questionId: string }
  | { type: "QUESTION_READY"; question: SafeQuestion }
  | { type: "SELECT_ANSWER"; key: AnswerKey }
  | { type: "ANSWER_CONFIRMED"; result: AnswerResult }
  | { type: "ANSWER_FAILED"; message: string }
  | { type: "EXPIRE" }
  | { type: "RESET" };

export const initialQuizState: QuizState = {
  phase: "idle",
  question: null,
  questionId: null,
  selectedKey: null,
  isCorrect: null,
  correctKey: null,
  explanation: null,
  error: null,
};

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case "LOAD_QUESTION":
      return {
        ...initialQuizState,
        phase: "loading",
        questionId: action.questionId,
      };
    case "QUESTION_READY":
      // Guard against a late fetch resolving after the room already moved on.
      if (state.questionId !== action.question.id) return state;
      return {
        ...state,
        phase: "active",
        question: action.question,
      };
    case "SELECT_ANSWER":
      if (state.phase !== "active") return state;
      return { ...state, selectedKey: action.key };
    case "ANSWER_CONFIRMED":
      return {
        ...state,
        phase: "submitted",
        isCorrect: action.result.is_correct,
        correctKey: action.result.correct_key,
        explanation: action.result.explanation,
        error: null,
      };
    case "ANSWER_FAILED":
      // Keep playing; surface the error without locking the board.
      return { ...state, error: action.message, selectedKey: null };
    case "EXPIRE":
      if (state.phase !== "active") return state;
      return { ...state, phase: "timeout", selectedKey: null };
    case "RESET":
      return initialQuizState;
    default:
      return state;
  }
}

/** Which team slot the current user occupies in a room (or null). */
export function teamOfUser(
  room: Pick<RoomMatch, "team_a_player_id" | "team_b_player_id">,
  userId: string,
): TeamSide | null {
  if (room.team_a_player_id === userId) return "A";
  if (room.team_b_player_id === userId) return "B";
  return null;
}

/** First free slot a joining player should request. */
export function pickAvailableTeam(
  room: Pick<RoomMatch, "team_a_player_id" | "team_b_player_id">,
): TeamSide | null {
  if (!room.team_a_player_id) return "A";
  if (!room.team_b_player_id) return "B";
  return null;
}

/** mm:ss formatting for the countdown (e.g. 00:17). */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export const QUESTION_DURATION = QUESTION_TIME_SECONDS;
