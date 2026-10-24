import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomChangePayload, RoomMatch } from "@/lib/types";
import { useRoomChannel } from "./useRoomChannel";

/** A controllable fake of the Supabase Realtime + PostgREST client. */
function createMockSupabase() {
  const postgresHandlers: Array<(payload: RoomChangePayload) => void> = [];
  let subscribeCb: ((status: string, err?: Error) => void) | null = null;

  const roomRow: RoomMatch = {
    id: "room-1",
    room_code: "ABC123",
    status: "playing",
    created_by: "p-a",
    team_a_player_id: "p-a",
    team_b_player_id: "p-b",
    team_a_position: 1,
    team_b_position: 0,
    current_turn: "B",
    current_question_id: "q-1",
    winner: null,
    version: 2,
    started_at: null,
    finished_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  const channel = {
    on: vi.fn((_event, _filter, handler) => {
      postgresHandlers.push(handler);
      return channel;
    }),
    subscribe: vi.fn((cb) => {
      subscribeCb = cb;
      return channel;
    }),
  };

  const client = {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: roomRow, error: null }),
        }),
      }),
    })),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(() => Promise.resolve({ error: null })),
    rpc: vi.fn((name: string) =>
      Promise.resolve({
        data:
          name === "submit_answer"
            ? { ...roomRow, version: 3, team_a_position: 2, current_turn: "B" }
            : null,
        error: null,
      }),
    ),
  };

  return {
    client,
    roomRow,
    emitPostgresChange: (payload: RoomChangePayload) => {
      for (const handler of postgresHandlers) handler(payload);
    },
    notifySubscribed: () => subscribeCb?.("SUBSCRIBED"),
  };
}

type MockSupabase = ReturnType<typeof createMockSupabase>;
let mock: MockSupabase;

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseClient: () => mock.client,
}));

describe("useRoomChannel — Realtime room state sync", () => {
  beforeEach(() => {
    mock = createMockSupabase();
  });

  it("hydrates the room with the initial REST snapshot and subscribes", async () => {
    const { result } = renderHook(() => useRoomChannel("room-1"));

    await waitFor(() => expect(result.current.room).not.toBeNull());
    expect(result.current.room?.team_a_position).toBe(1);

    act(() => mock.notifySubscribed());
    expect(result.current.isConnected).toBe(true);
    expect(mock.client.channel).toHaveBeenCalledWith(
      "room:room-1",
      expect.objectContaining({ config: expect.any(Object) }),
    );
  });

  it("updates team positions instantly when a postgres_changes event arrives", async () => {
    const { result } = renderHook(() => useRoomChannel("room-1"));
    await waitFor(() => expect(result.current.room).not.toBeNull());

    act(() => {
      mock.emitPostgresChange({
        eventType: "UPDATE",
        new: { ...mock.roomRow, version: 3, team_b_position: 4 },
        old: {},
      });
    });

    expect(result.current.room?.version).toBe(3);
    expect(result.current.room?.team_b_position).toBe(4);
  });

  it("discards a stale event whose version is older than local state", async () => {
    const { result } = renderHook(() => useRoomChannel("room-1"));
    await waitFor(() => expect(result.current.room).not.toBeNull());

    act(() => {
      mock.emitPostgresChange({
        eventType: "UPDATE",
        // Newer event first.
        new: { ...mock.roomRow, version: 5, team_a_position: 5 },
        old: {},
      });
    });
    act(() => {
      mock.emitPostgresChange({
        eventType: "UPDATE",
        // Late, out-of-order stale event.
        new: { ...mock.roomRow, version: 3, team_a_position: 2 },
        old: {},
      });
    });

    expect(result.current.room?.version).toBe(5);
    expect(result.current.room?.team_a_position).toBe(5);
  });

  it("resets the board when the room row is deleted", async () => {
    const { result } = renderHook(() => useRoomChannel("room-1"));
    await waitFor(() => expect(result.current.room).not.toBeNull());

    act(() => {
      mock.emitPostgresChange({ eventType: "DELETE", new: {}, old: { id: "room-1" } });
    });

    expect(result.current.room).toBeNull();
  });

  it("stays idle when no room id is provided", () => {
    const { result } = renderHook(() => useRoomChannel(null));
    expect(result.current.status).toBe("IDLE");
    expect(mock.client.channel).not.toHaveBeenCalled();
  });

  it("submitAnswer calls the atomic RPC and merges the returned row", async () => {
    const { result } = renderHook(() => useRoomChannel("room-1"));
    await waitFor(() => expect(result.current.room).not.toBeNull());

    await act(async () => {
      await result.current.submitAnswer({
        team: "A",
        questionId: "q-1",
        selectedKey: "A",
      });
    });

    expect(mock.client.rpc).toHaveBeenCalledWith("submit_answer", {
      p_room_id: "room-1",
      p_team: "A",
      p_question_id: "q-1",
      p_selected_key: "A",
    });
    expect(result.current.room?.version).toBe(3);
    expect(result.current.room?.team_a_position).toBe(2);
  });
});
