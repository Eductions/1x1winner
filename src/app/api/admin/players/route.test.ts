import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerAccountError } from "@/lib/server/playerAccounts";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  requireSupervisor: vi.fn(),
  createManagedAccount: vi.fn(),
  listStudentAccounts: vi.fn(),
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
    ...mocks,
    PlayerAccountError: MockPlayerAccountError,
  };
});

const admin = { id: "admin-client" };
const player = {
  id: "player-1",
  name: "Sara Ali",
  created_at: new Date(0).toISOString(),
  disabled: false,
};

describe("player account API", () => {
  beforeEach(() => {
    mocks.requireSupervisor.mockReset().mockResolvedValue({
      userId: "supervisor-1",
      admin,
    });
    mocks.createManagedAccount.mockReset().mockResolvedValue(player);
    mocks.listStudentAccounts.mockReset().mockResolvedValue([player]);
  });

  it("lists players only after supervisor authorization", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ players: [player] });
    expect(mocks.requireSupervisor).toHaveBeenCalledTimes(1);
    expect(mocks.listStudentAccounts).toHaveBeenCalledWith(admin);
  });

  it("always creates a student even if a teacher role is sent by the browser", async () => {
    const request = new NextRequest("http://localhost/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Sara Ali",
        code: "ABC12345",
        role: "teacher",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mocks.createManagedAccount).toHaveBeenCalledWith(admin, {
      name: "Sara Ali",
      code: "ABC12345",
      role: "student",
    });
  });

  it("returns the supervisor-only error without creating an account", async () => {
    mocks.requireSupervisor.mockRejectedValue(
      new PlayerAccountError(403, "SUPERVISOR_ONLY"),
    );
    const request = new NextRequest("http://localhost/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sara Ali", code: "ABC12345" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUPERVISOR_ONLY",
    });
    expect(mocks.createManagedAccount).not.toHaveBeenCalled();
  });
});
