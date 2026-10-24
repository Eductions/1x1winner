import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerAccountError } from "@/lib/server/playerAccounts";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createManagedAccount: vi.fn(),
  ensureSupervisorSetupOpen: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/server/playerAccounts", () => {
  class MockPlayerAccountError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message = code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  return {
    createManagedAccount: mocks.createManagedAccount,
    ensureSupervisorSetupOpen: mocks.ensureSupervisorSetupOpen,
    PlayerAccountError: MockPlayerAccountError,
  };
});

const admin = { id: "admin-client" };
const secret = "12345678901234567890";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/setup/supervisor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("supervisor setup API", () => {
  beforeEach(() => {
    vi.stubEnv("SUPERVISOR_SETUP_SECRET", secret);
    mocks.createAdminClient.mockReset().mockReturnValue(admin);
    mocks.createManagedAccount.mockReset().mockResolvedValue({
      id: "supervisor-1",
      name: "Ms Sara",
      created_at: new Date(0).toISOString(),
      disabled: false,
    });
    mocks.ensureSupervisorSetupOpen.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates the first supervisor with the correct owner setup key", async () => {
    const response = await POST(
      request({ setupSecret: secret, name: "Ms Sara", code: "SUPER1234" }),
    );

    expect(response.status).toBe(201);
    expect(mocks.ensureSupervisorSetupOpen).toHaveBeenCalledWith(admin);
    expect(mocks.createManagedAccount).toHaveBeenCalledWith(admin, {
      name: "Ms Sara",
      code: "SUPER1234",
      role: "teacher",
    });
  });

  it("rejects a wrong setup key before creating anything", async () => {
    const response = await POST(
      request({ setupSecret: "wrong", name: "Ms Sara", code: "SUPER1234" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_SETUP_SECRET",
    });
    expect(mocks.createManagedAccount).not.toHaveBeenCalled();
  });

  it("locks setup when a supervisor already exists", async () => {
    mocks.ensureSupervisorSetupOpen.mockRejectedValue(
      new PlayerAccountError(409, "SETUP_ALREADY_COMPLETED"),
    );

    const response = await POST(
      request({ setupSecret: secret, name: "Other", code: "SUPER1234" }),
    );

    expect(response.status).toBe(409);
    expect(mocks.createManagedAccount).not.toHaveBeenCalled();
  });
});
