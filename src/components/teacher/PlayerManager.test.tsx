import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedPlayer } from "@/lib/types";
import { PlayerManager } from "./PlayerManager";

const fetchMock = vi.fn();
let players: ManagedPlayer[];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("<PlayerManager />", () => {
  beforeEach(() => {
    players = [
      {
        id: "player-1",
        name: "Sara Ali",
        created_at: new Date(0).toISOString(),
        disabled: false,
      },
    ];

    fetchMock.mockReset();
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/admin/players" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ players });
      }

      if (path === "/api/admin/players" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { name: string; code: string };
        const player: ManagedPlayer = {
          id: "player-2",
          name: body.name,
          created_at: new Date(0).toISOString(),
          disabled: false,
        };
        players = [...players, player];
        return jsonResponse({ player }, 201);
      }

      if (path.startsWith("/api/admin/players/") && init?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ error: "Not found" }, 404);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("loads the supervisor-managed player list", async () => {
    render(<PlayerManager />);

    expect(await screen.findByText("Sara Ali")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/players",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("creates a player with a name and code and shows the one-time code", async () => {
    render(<PlayerManager />);
    await screen.findByTestId("player-table");

    await userEvent.type(screen.getByLabelText("Player name"), "  Omar   Ali  ");
    await userEvent.type(screen.getByLabelText("Access code"), "OMAR2468");
    await userEvent.click(screen.getByRole("button", { name: /add player/i }));

    expect(await screen.findByText(/player added/i)).toBeInTheDocument();
    expect(screen.getByText("OMAR2468")).toBeInTheDocument();

    const postCall = fetchMock.mock.calls.find(
      ([path, init]) => path === "/api/admin/players" && init?.method === "POST",
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      name: "Omar Ali",
      code: "OMAR2468",
    });
    expect(await screen.findAllByText("Omar Ali")).toHaveLength(2);
  });

  it("blocks a short code before calling the create API", async () => {
    render(<PlayerManager />);
    await screen.findByTestId("player-table");

    await userEvent.type(screen.getByLabelText("Player name"), "Omar Ali");
    await userEvent.type(screen.getByLabelText("Access code"), "123");
    await userEvent.click(screen.getByRole("button", { name: /add player/i }));

    expect(await screen.findByText(/at least 6 characters/i)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);
  });

  it("resets a player's access code", async () => {
    render(<PlayerManager />);
    await screen.findByTestId("player-table");

    await userEvent.type(
      screen.getByLabelText("New code for Sara Ali"),
      "NEWCODE9",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reset code for Sara Ali" }),
    );

    expect(await screen.findByText(/access code reset/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/players/player-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ action: "reset_code", code: "NEWCODE9" }),
        }),
      ),
    );
  });

  it("disables a player account", async () => {
    render(<PlayerManager />);
    await screen.findByTestId("player-table");

    await userEvent.click(screen.getByRole("button", { name: "Disable Sara Ali" }));

    expect(await screen.findByText("Disabled")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/players/player-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "set_disabled", disabled: true }),
      }),
    );
  });
});
