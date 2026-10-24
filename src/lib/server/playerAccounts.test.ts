import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createManagedAccount,
  PlayerAccountError,
  requireSupervisor,
} from "./playerAccounts";

const sessionState = vi.hoisted(() => ({
  user: { id: "current-user" } as { id: string } | null,
  role: "teacher" as "teacher" | "student",
}));
const adminSentinel = vi.hoisted(() => ({ marker: "admin-client" }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({
        data: { user: sessionState.user },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { role: sessionState.role },
            error: null,
          }),
        }),
      }),
    }),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminSentinel,
}));

function fakeAdmin(createResult: unknown) {
  const profile = {
    id: "new-player",
    username: "Sara Ali",
    created_at: new Date(0).toISOString(),
  };
  const createUser = vi.fn().mockResolvedValue(createResult);
  const deleteUser = vi.fn().mockResolvedValue({ error: null });
  const single = vi.fn().mockResolvedValue({ data: profile, error: null });
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ upsert }));

  return {
    client: {
      auth: { admin: { createUser, deleteUser } },
      from,
    } as unknown as SupabaseClient,
    createUser,
    deleteUser,
    upsert,
    profile,
  };
}

describe("requireSupervisor", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    sessionState.user = { id: "current-user" };
    sessionState.role = "teacher";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the supervisor role", async () => {
    await expect(requireSupervisor()).resolves.toMatchObject({
      userId: "current-user",
      admin: adminSentinel,
    });
  });

  it("rejects students before returning the admin client", async () => {
    sessionState.role = "student";

    await expect(requireSupervisor()).rejects.toMatchObject({
      status: 403,
      code: "SUPERVISOR_ONLY",
    });
  });

  it("rejects signed-out callers", async () => {
    sessionState.user = null;

    await expect(requireSupervisor()).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });
});

describe("createManagedAccount", () => {
  it("creates a confirmed internal account and matching student profile", async () => {
    const fake = fakeAdmin({
      data: { user: { id: "new-player" } },
      error: null,
    });

    const player = await createManagedAccount(fake.client, {
      name: "  Sara   Ali ",
      code: "ABC12345",
      role: "student",
    });

    expect(player).toEqual({
      id: "new-player",
      name: "Sara Ali",
      created_at: new Date(0).toISOString(),
      disabled: false,
    });

    const createArgs = fake.createUser.mock.calls[0][0];
    expect(createArgs.email).toMatch(/^p-[a-f0-9]{40}@login\.1x1winner\.local$/);
    expect(createArgs.email.toLowerCase()).not.toContain("sara");
    expect(createArgs).toMatchObject({
      password: "ABC12345",
      email_confirm: true,
      user_metadata: { username: "Sara Ali", full_name: "Sara Ali" },
      app_metadata: { managed_account: true, managed_role: "student" },
    });
    expect(fake.upsert).toHaveBeenCalledWith(
      {
        id: "new-player",
        username: "Sara Ali",
        full_name: "Sara Ali",
        role: "student",
      },
      { onConflict: "id" },
    );
  });

  it("maps duplicate names to a conflict without creating a profile", async () => {
    const fake = fakeAdmin({
      data: { user: null },
      error: new Error("User already registered"),
    });

    await expect(
      createManagedAccount(fake.client, {
        name: "Sara Ali",
        code: "ABC12345",
        role: "student",
      }),
    ).rejects.toBeInstanceOf(PlayerAccountError);
    await expect(
      createManagedAccount(fake.client, {
        name: "Sara Ali",
        code: "ABC12345",
        role: "student",
      }),
    ).rejects.toMatchObject({ status: 409, code: "PLAYER_ALREADY_EXISTS" });
    expect(fake.upsert).not.toHaveBeenCalled();
  });

  it("requires a stronger code for a supervisor account", async () => {
    const fake = fakeAdmin({ data: { user: null }, error: null });

    await expect(
      createManagedAccount(fake.client, {
        name: "Supervisor",
        code: "123456",
        role: "teacher",
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_ACCESS_CODE" });
    expect(fake.createUser).not.toHaveBeenCalled();
  });
});
