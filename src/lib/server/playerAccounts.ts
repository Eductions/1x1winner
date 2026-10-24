import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canonicalPlayerName,
  internalEmailForName,
  validateAccessCode,
  validatePlayerName,
} from "@/lib/accessCredentials";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ManagedPlayer, UserRole } from "@/lib/types";

export class PlayerAccountError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = "PlayerAccountError";
    this.status = status;
    this.code = code;
  }
}

function configurationError(): PlayerAccountError {
  return new PlayerAccountError(
    503,
    "ADMIN_NOT_CONFIGURED",
    "Player account management is not configured on the server yet.",
  );
}

function mapCreateError(message: string): PlayerAccountError {
  const lower = message.toLowerCase();
  if (
    lower.includes("already registered") ||
    lower.includes("already exists") ||
    lower.includes("duplicate") ||
    lower.includes("profiles_username")
  ) {
    return new PlayerAccountError(409, "PLAYER_ALREADY_EXISTS");
  }
  if (lower.includes("password")) {
    return new PlayerAccountError(400, "INVALID_ACCESS_CODE", message);
  }
  if (lower.includes("managed_accounts_only")) {
    return new PlayerAccountError(
      500,
      "MANAGED_ACCOUNT_SETUP_FAILED",
      "The managed-account database migration has not been applied correctly.",
    );
  }
  return new PlayerAccountError(500, "PLAYER_CREATE_FAILED", message);
}

/**
 * Authorizes the current browser session as the supervisor. The database
 * still stores this historical role as `teacher`; user-facing copy says
 * supervisor.
 */
export async function requireSupervisor(): Promise<{
  userId: string;
  admin: SupabaseClient;
}> {
  if (!isSupabaseConfigured()) throw configurationError();

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new PlayerAccountError(401, "UNAUTHENTICATED", "Sign in first.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new PlayerAccountError(500, "PROFILE_LOOKUP_FAILED", profileError.message);
  }
  if (profile?.role !== "teacher") {
    throw new PlayerAccountError(403, "SUPERVISOR_ONLY");
  }

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    throw configurationError();
  }

  return { userId: user.id, admin };
}

interface CreateManagedAccountInput {
  name: string;
  code: string;
  role: UserRole;
}

export async function createManagedAccount(
  admin: SupabaseClient,
  { name, code, role }: CreateManagedAccountInput,
): Promise<ManagedPlayer> {
  const displayName = canonicalPlayerName(name);
  const nameError = validatePlayerName(displayName);
  if (nameError) throw new PlayerAccountError(400, "INVALID_PLAYER_NAME", nameError);

  const codeError = validateAccessCode(code, { supervisor: role === "teacher" });
  if (codeError) throw new PlayerAccountError(400, "INVALID_ACCESS_CODE", codeError);

  const email = await internalEmailForName(displayName);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: code,
    email_confirm: true,
    user_metadata: {
      username: displayName,
      full_name: displayName,
    },
    app_metadata: {
      managed_account: true,
      managed_role: role,
    },
  });

  if (error) throw mapCreateError(error.message);
  if (!data.user) {
    throw new PlayerAccountError(500, "PLAYER_CREATE_FAILED", "No user was returned.");
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: data.user.id,
        username: displayName,
        full_name: displayName,
        role,
      },
      { onConflict: "id" },
    )
    .select("id, username, created_at")
    .single();

  if (profileError || !profile) {
    // Best-effort cleanup so a profile failure does not leave a login that
    // can authenticate but cannot participate in the game.
    await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    throw mapCreateError(profileError?.message ?? "Profile creation failed.");
  }

  return {
    id: profile.id,
    name: profile.username,
    created_at: profile.created_at,
    disabled: false,
  };
}

async function bannedUserIds(admin: SupabaseClient): Promise<Set<string>> {
  const banned = new Set<string>();
  const now = Date.now();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error || !data) break;

    for (const user of data.users) {
      const bannedUntil = (user as { banned_until?: string | null }).banned_until;
      if (bannedUntil && new Date(bannedUntil).getTime() > now) {
        banned.add(user.id);
      }
    }

    if (!data.nextPage || data.users.length === 0) break;
  }

  return banned;
}

export async function listStudentAccounts(
  admin: SupabaseClient,
): Promise<ManagedPlayer[]> {
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, username, created_at")
    .eq("role", "student")
    .order("username", { ascending: true });

  if (error) {
    throw new PlayerAccountError(500, "PLAYER_LIST_FAILED", error.message);
  }

  const banned = await bannedUserIds(admin);
  return (profiles ?? []).map((profile) => ({
    id: profile.id,
    name: profile.username,
    created_at: profile.created_at,
    disabled: banned.has(profile.id),
  }));
}

async function requireStudent(admin: SupabaseClient, id: string) {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, username, role, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new PlayerAccountError(500, "PLAYER_LOOKUP_FAILED", error.message);
  }
  if (!profile) throw new PlayerAccountError(404, "PLAYER_NOT_FOUND");
  if (profile.role !== "student") {
    throw new PlayerAccountError(
      403,
      "CANNOT_MANAGE_SUPERVISOR",
      "Supervisor accounts cannot be managed from the player list.",
    );
  }

  return profile;
}

export async function resetStudentAccessCode(
  admin: SupabaseClient,
  id: string,
  code: string,
): Promise<void> {
  const codeError = validateAccessCode(code);
  if (codeError) throw new PlayerAccountError(400, "INVALID_ACCESS_CODE", codeError);

  await requireStudent(admin, id);
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: code,
  });
  if (error) {
    throw new PlayerAccountError(500, "PLAYER_CODE_RESET_FAILED", error.message);
  }
}

export async function setStudentDisabled(
  admin: SupabaseClient,
  id: string,
  disabled: boolean,
): Promise<void> {
  await requireStudent(admin, id);
  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: disabled ? "876000h" : "none",
  });
  if (error) {
    throw new PlayerAccountError(500, "PLAYER_STATUS_FAILED", error.message);
  }
}

export async function ensureSupervisorSetupOpen(
  admin: SupabaseClient,
): Promise<void> {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "teacher");

  if (error) {
    throw new PlayerAccountError(500, "SETUP_CHECK_FAILED", error.message);
  }
  if ((count ?? 0) > 0) {
    throw new PlayerAccountError(409, "SETUP_ALREADY_COMPLETED");
  }
}
