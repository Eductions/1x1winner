/**
 * Pure validation/normalisation helpers for auth and lobby forms.
 * Kept framework-free so they are trivially unit-testable.
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

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

export function validateUsername(username: string): string | null {
  const value = username.trim();
  if (value.length < 3) return "Username must be at least 3 characters.";
  if (value.length > 30) return "Username must be 30 characters or fewer.";
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
    return "Use letters, numbers, dots, dashes or underscores only.";
  }
  return null;
}

/** Maps Postgres/RPC error messages to friendly UI copy. */
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
    INVALID_LOGIN_CREDENTIALS: "Incorrect email or password.",
  };
  for (const [code, friendly] of Object.entries(map)) {
    if (message.includes(code)) return friendly;
  }
  if (message.includes("Invalid login credentials")) {
    return map.INVALID_LOGIN_CREDENTIALS;
  }
  if (message.includes("already registered") || message.includes("already exists")) {
    return "An account with this email already exists — try signing in.";
  }
  return message;
}
