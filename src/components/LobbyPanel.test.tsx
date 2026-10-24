import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WaitingRoomRow } from "@/lib/types";
import { LobbyPanel } from "./LobbyPanel";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function createLobbyMock(rooms: WaitingRoomRow[]) {
  const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
    if (name === "list_waiting_rooms") return { data: rooms, error: null };
    if (name === "create_room") {
      return { data: { room_code: "NEW001" }, error: null };
    }
    if (name === "join_room") {
      const code = (args?.p_code as string) ?? "";
      if (code === "FULL99") {
        return { data: null, error: new Error("ROOM_FULL") };
      }
      return { data: { room_code: code }, error: null };
    }
    return { data: null, error: new Error("UNEXPECTED_RPC") };
  });

  return { rpc };
}

let mock: ReturnType<typeof createLobbyMock>;

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseClient: () => ({
    rpc: (name: string, args?: Record<string, unknown>) => mock.rpc(name, args),
  }),
}));

describe("<LobbyPanel />", () => {
  beforeEach(() => {
    push.mockReset();
    mock = createLobbyMock([
      {
        room_code: "AB42CD",
        team_a_username: "Aisha",
        team_b_username: null,
        free_slot: "B",
        created_at: new Date(0).toISOString(),
      },
    ]);
  });

  it("lists open rooms and joins one when its row is clicked", async () => {
    render(<LobbyPanel username="Aisha" />);

    const roomButton = await screen.findByRole("button", { name: /AB42CD/ });
    await userEvent.click(roomButton);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/room/AB42CD"));
    expect(mock.rpc).toHaveBeenCalledWith("join_room", { p_code: "AB42CD" });
  });

  it("normalises a typed code to uppercase before joining", async () => {
    render(<LobbyPanel username="Aisha" />);

    const input = screen.getByLabelText(/room code/i);
    await userEvent.type(input, "ab42cd");
    expect(input).toHaveValue("AB42CD");

    await userEvent.click(screen.getByRole("button", { name: /join room/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/room/AB42CD"));
  });

  it("rejects an incomplete code without calling the RPC", async () => {
    render(<LobbyPanel username="Aisha" />);

    await userEvent.type(screen.getByLabelText(/room code/i), "AB");
    await userEvent.click(screen.getByRole("button", { name: /join room/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    const joinCalls = mock.rpc.mock.calls.filter(([name]) => name === "join_room");
    expect(joinCalls).toHaveLength(0);
  });

  it("creates a room and navigates into it", async () => {
    render(<LobbyPanel username="Aisha" />);

    await userEvent.click(screen.getByRole("button", { name: /create a new room/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/room/NEW001"));
    expect(mock.rpc).toHaveBeenCalledWith("create_room", undefined);
  });

  it("shows a friendly message when the room is full", async () => {
    render(<LobbyPanel username="Aisha" />);

    await userEvent.type(screen.getByLabelText(/room code/i), "FULL99");
    await userEvent.click(screen.getByRole("button", { name: /join room/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /already has two teams/i,
    );
    expect(push).not.toHaveBeenCalled();
  });
});
