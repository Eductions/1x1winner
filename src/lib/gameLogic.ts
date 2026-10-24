import {
  FLOOR_COUNT,
  GROUND_FLOOR,
  TOP_FLOOR,
  type AnswerKey,
  type Question,
  type RoomMatch,
  type TeamSide,
} from "./types";

/**
 * Pure game rules. No Supabase, no React — every rule the database enforces
 * (see submit_answer RPC in supabase/schema.sql) is mirrored here so the UI
 * can render optimistic updates and the behaviour can be unit-tested in TDD.
 */

export function isCorrectAnswer(
  question: Pick<Question, "correct_key">,
  selectedKey: AnswerKey,
): boolean {
  return question.correct_key === selectedKey;
}

/** A correct answer climbs exactly one floor, never past the top. */
export function advancePosition(
  currentPosition: number,
  correct: boolean,
): number {
  if (!correct) return clampFloor(currentPosition);
  return clampFloor(currentPosition + 1);
}

export function clampFloor(position: number): number {
  return Math.min(Math.max(position, GROUND_FLOOR), TOP_FLOOR);
}

export function getNextTurn(turn: TeamSide): TeamSide {
  return turn === "A" ? "B" : "A";
}

export function hasReachedTop(position: number): boolean {
  return position >= TOP_FLOOR;
}

export function getTeamPosition(room: RoomMatch, team: TeamSide): number {
  return team === "A" ? room.team_a_position : room.team_b_position;
}

/**
 * Client-side mirror of the submit_answer RPC. Used for optimistic updates;
 * the server response (or a Realtime event) remains the source of truth and
 * will correct any divergence through mergeRoomState().
 *
 * Throws the same error codes as the RPC guards so callers handle one set.
 */
export function applyAnswerToRoom(
  room: RoomMatch,
  params: {
    team: TeamSide;
    playerId: string;
    questionId: string;
    selectedKey: AnswerKey;
    question: Pick<Question, "correct_key">;
    /** Ids of (roomId, questionId, team) answers already recorded. */
    alreadyAnswered: boolean;
  },
): RoomMatch {
  const { team, playerId, questionId, selectedKey, question, alreadyAnswered } =
    params;

  if (room.status !== "playing") throw new Error("MATCH_NOT_ACTIVE");
  if (room.current_turn !== team) throw new Error("NOT_YOUR_TURN");
  if (room.current_question_id !== questionId)
    throw new Error("QUESTION_MISMATCH");

  const playerOnTeam =
    team === "A"
      ? room.team_a_player_id === playerId
      : room.team_b_player_id === playerId;
  if (!playerOnTeam) throw new Error("NOT_TEAM_MEMBER");
  if (alreadyAnswered) throw new Error("ANSWER_ALREADY_RECORDED");

  const correct = isCorrectAnswer(question, selectedKey);
  const currentPosition = getTeamPosition(room, team);
  const newPosition = advancePosition(currentPosition, correct);
  const reachedTop = hasReachedTop(newPosition);

  const next: RoomMatch = {
    ...room,
    team_a_position:
      team === "A" ? newPosition : room.team_a_position,
    team_b_position:
      team === "B" ? newPosition : room.team_b_position,
    current_turn: getNextTurn(team),
    status: reachedTop ? "finished" : room.status,
    winner: reachedTop ? team : room.winner,
    finished_at: reachedTop ? new Date(0).toISOString() : room.finished_at,
    version: room.version + 1,
    updated_at: new Date(0).toISOString(),
  };

  return next;
}

/**
 * Merge a Realtime/initial-fetch snapshot into local state.
 * A higher `version` always wins, which makes out-of-order delivery (a stale
 * UPDATE arriving after a newer one) harmless. Equal versions keep the
 * existing state to avoid useless re-renders.
 */
export function mergeRoomState(
  current: RoomMatch | null,
  incoming: RoomMatch,
): RoomMatch {
  if (current === null) return incoming;
  if (incoming.version > current.version) return incoming;
  return current;
}

/** Percentage offset from the bottom of the tower track for a given floor. */
export function floorToBottomPercent(position: number): number {
  return (clampFloor(position) / FLOOR_COUNT) * 100;
}

/** Badges unlocked at the end of a match (drives the celebration modal). */
export function earnBadges(
  room: RoomMatch,
  answerHistory: Array<{ team: TeamSide; is_correct: boolean }>,
): Array<{ id: string; label: string; description: string }> {
  const badges: Array<{ id: string; label: string; description: string }> = [];
  if (!room.winner) return badges;

  const winnerHistory = answerHistory.filter((a) => a.team === room.winner);
  const correctCount = winnerHistory.filter((a) => a.is_correct).length;
  const flawless =
    winnerHistory.length > 0 && winnerHistory.every((a) => a.is_correct);

  badges.push({
    id: "summit",
    label: "Summit Climber",
    description: "Reached Floor 10 and won the round",
  });
  if (correctCount >= 5) {
    badges.push({
      id: "sharp-shooter",
      label: "Sharp Shooter",
      description: "Answered 5+ questions correctly",
    });
  }
  if (flawless) {
    badges.push({
      id: "flawless",
      label: "Flawless Run",
      description: "Every single answer was correct",
    });
  }
  return badges;
}
