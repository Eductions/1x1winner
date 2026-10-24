/**
 * Pure helpers for supervisor-managed "name + access code" accounts.
 *
 * Users never see or need an email address. For Supabase Auth's
 * email/password engine we derive a deterministic, non-deliverable internal
 * identifier from the normalized player name and use the access code as the
 * password. The derivation is intentionally one-way (SHA-256): the stored
 * internal identifier does not reveal or encode the player's typed name.
 */

export const INTERNAL_LOGIN_DOMAIN = "login.1x1winner.local";
export const MIN_PLAYER_ACCESS_CODE_LENGTH = 6;
export const MIN_SUPERVISOR_ACCESS_CODE_LENGTH = 8;
export const MAX_ACCESS_CODE_LENGTH = 72;

/** Display/login spelling chosen by the supervisor, with tidy spacing. */
export function canonicalPlayerName(raw: string): string {
  return raw.normalize("NFKC").trim().replace(/\s+/g, " ");
}

/** Case-insensitive login identity used to derive the internal identifier. */
export function normalizeLoginName(raw: string): string {
  return canonicalPlayerName(raw).toLowerCase();
}

export function validatePlayerName(raw: string): string | null {
  const value = canonicalPlayerName(raw);
  const length = [...value].length;

  if (length < 3) return "Name must be at least 3 characters.";
  if (length > 30) return "Name must be 30 characters or fewer.";
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ._-]*$/u.test(value)) {
    return "Use a name with letters or numbers only (spaces, dots and dashes are allowed).";
  }

  return null;
}

export function validateAccessCode(
  code: string,
  options: { supervisor?: boolean } = {},
): string | null {
  const minimum = options.supervisor
    ? MIN_SUPERVISOR_ACCESS_CODE_LENGTH
    : MIN_PLAYER_ACCESS_CODE_LENGTH;

  if (!code) return "Access code is required.";
  if (/\s/.test(code)) return "Access code cannot contain spaces.";
  if (code.length < minimum) {
    return `Access code must be at least ${minimum} characters.`;
  }
  if (code.length > MAX_ACCESS_CODE_LENGTH) {
    return `Access code must be ${MAX_ACCESS_CODE_LENGTH} characters or fewer.`;
  }

  return null;
}

/**
 * Derives the internal Supabase identifier for a player name.
 *
 * Requires Web Crypto, which is available in Node and in secure browser
 * contexts (HTTPS / localhost) used by the deployed app.
 */
export async function internalEmailForName(rawName: string): Promise<string> {
  const normalized = normalizeLoginName(rawName);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("SECURE_LOGIN_UNAVAILABLE");

  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`1x1winner-login-v1:${normalized}`),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  // 160 bits is far beyond classroom-scale collision risk and keeps the
  // email local-part comfortably within provider limits.
  return `p-${hex.slice(0, 40)}@${INTERNAL_LOGIN_DOMAIN}`;
}

/** Generates an easy-to-read code for the supervisor to hand to a player. */
export function generateAccessCode(length = 8): string {
  const safeLength = Math.max(MIN_PLAYER_ACCESS_CODE_LENGTH, Math.min(length, 32));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(safeLength);
  globalThis.crypto.getRandomValues(bytes);

  // The alphabet has 32 characters, so byte % 32 is unbiased.
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
