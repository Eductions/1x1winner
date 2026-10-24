import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PresenceUser } from "@/lib/types";
import { useRoomPresence } from "./useRoomPresence";

function createPresenceMock() {
  const handlers: Record<string, () => void> = {};
  let state: Record<string, PresenceUser[]> = {};

  const channel = {
    on: vi.fn((_event, { event }: { event: string }, cb: () => void) => {
      handlers[event] = cb;
      return channel;
    }),
    subscribe: vi.fn((cb: (status: string) => void) => {
      cb("SUBSCRIBED");
      return channel;
    }),
    track: vi.fn(() => Promise.resolve("ok")),
    presenceState: vi.fn(() => state),
  };

  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(() => Promise.resolve()),
  };

  return {
    client,
    channel,
    setState: (next: Record<string, PresenceUser[]>) => {
      state = next;
    },
    emit: (event: string) => handlers[event](),
  };
}

type Mock = ReturnType<typeof createPresenceMock>;
let mock: Mock;

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseClient: () => mock.client,
}));

describe("useRoomPresence", () => {
  beforeEach(() => {
    mock = createPresenceMock();
  });

  it("does not subscribe without a room or user", () => {
    const { result } = renderHook(() =>
      useRoomPresence({ roomId: null, user: null }),
    );
    expect(result.current).toEqual([]);
    expect(mock.client.channel).not.toHaveBeenCalled();
  });

  it("aggregates and de-duplicates presence state on sync", async () => {
    const user = { user_id: "p-a", username: "Aisha", online_at: "" };
    const { result } = renderHook(() =>
      useRoomPresence({ roomId: "room-1", user }),
    );

    await waitFor(() => expect(mock.channel.track).toHaveBeenCalled());

    act(() => {
      mock.setState({
        key1: [{ user_id: "p-a", username: "Aisha", online_at: "t1" }],
        // Duplicate user reported from a second socket/channel key.
        key2: [{ user_id: "p-a", username: "Aisha", online_at: "t1" }],
        key3: [{ user_id: "p-b", username: "Omar", online_at: "t2" }],
      });
      mock.emit("sync");
    });

    expect(result.current).toHaveLength(2);
    expect(result.current.map((u) => u.user_id).sort()).toEqual(["p-a", "p-b"]);
  });

  it("updates on join and leave events", () => {
    const user = { user_id: "p-a", username: "Aisha", online_at: "" };
    const { result } = renderHook(() =>
      useRoomPresence({ roomId: "room-1", user }),
    );

    act(() => {
      mock.setState({
        key1: [{ user_id: "p-a", username: "Aisha", online_at: "t1" }],
      });
      mock.emit("join");
    });
    expect(result.current).toHaveLength(1);

    act(() => {
      mock.setState({});
      mock.emit("leave");
    });
    expect(result.current).toEqual([]);
  });
});
