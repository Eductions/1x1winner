/**
 * Pure validation/normalisation helpers for lobby forms and shared error
 * copy. Kept framework-free so they are trivially unit-testable.
 */

export const ROOM_CODE_LENGTH = 6;

/** Room codes are 6 uppercase alphanumeric characters (no I/O to avoid mixups). */
export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return new RegExp(`^[A-HJ-NP-Z0-9]{${ROOM_CODE_LENGTH}}$`).test(code);
}

/** Maps Postgres/RPC/API error messages to friendly UI copy. */
export function friendlyErrorMessage(message: string): string {
  const map: Record<string, string> = {
    ROOM_NOT_FOUND: "No room exists with this code.",
    ROOM_FULL: "This room already has two teams.",
    ROOM_NOT_JOINABLE: "This match has already started.",
    MATCH_NOT_ACTIVE: "The match is not active anymore.",
    NOT_YOUR_TURN: "It is the other team's turn.",
    QUESTION_MISMATCH: "This question has expired — a new one is on its way.",
    ANSWER_ALREADY_RECORDED: "This answer was already recorded.",
    NOT_TEAM_MEMBER: "You are not a member of this team.",
    INVALID_LOGIN_CREDENTIALS: "Incorrect name or access code.",
    SUPERVISOR_ONLY: "Only the supervisor can manage player accounts.",
    PLAYER_ALREADY_EXISTS: "A player with this name already exists.",
    PLAYER_NOT_FOUND: "This player account could not be found.",
    SETUP_ALREADY_COMPLETED: "Supervisor setup is already complete.",
    SETUP_NOT_CONFIGURED:
      "Supervisor setup is not configured on the server yet.",
    INVALID_SETUP_SECRET: "The setup key is incorrect.",
    SECURE_LOGIN_UNAVAILABLE:
      "Secure sign-in is unavailable in this browser context. Open the HTTPS site and try again.",
  };
  for (const [code, friendly] of Object.entries(map)) {
    if (message.includes(code)) return friendly;
  }
  if (message.includes("Invalid login credentials")) {
    return map.INVALID_LOGIN_CREDENTIALS;
  }
  if (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("already been registered")
  ) {
    return map.PLAYER_ALREADY_EXISTS;
  }
  return message;
}
