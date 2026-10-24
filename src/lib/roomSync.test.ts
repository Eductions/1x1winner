import { describe, expect, it } from "vitest";
import { applyAnswerToRoom, mergeRoomState } from "./gameLogic";
import type { Question, RoomMatch } from "./types";

function makeRoom(overrides: Partial<RoomMatch> = {}): RoomMatch {
  return {
    id: "room-1",
    room_code: "ABC123",
    status: "playing",
    created_by: "p-a",
    team_a_player_id: "p-a",
    team_b_player_id: "p-b",
    team_a_position: 0,
    team_b_position: 0,
    current_turn: "A",
    current_question_id: "q-1",
    winner: null,
    version: 1,
    started_at: null,
    finished_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    ...overrides,
  };
}

const question: Pick<Question, "correct_key"> = { correct_key: "A" };

describe("mergeRoomState — Realtime event ordering", () => {
  it("returns the incoming snapshot when there is no local state", () => {
    const incoming = makeRoom({ version: 1 });
    expect(mergeRoomState(null, incoming)).toBe(incoming);
  });

  it("accepts a newer snapshot with a higher version", () => {
    const current = makeRoom({ version: 3, team_a_position: 2 });
    const incoming = makeRoom({ version: 4, team_a_position: 3 });
    expect(mergeRoomState(current, incoming)).toBe(incoming);
  });

  it("ignores a stale snapshot delivered out of order", () => {
    const current = makeRoom({ version: 5, team_a_position: 4 });
    const stale = makeRoom({ version: 2, team_a_position: 1 });
    expect(mergeRoomState(current, stale)).toBe(current);
  });

  it("treats equal versions as a no-op echo (Realtime re-delivery)", () => {
    const current = makeRoom({ version: 5 });
    const echo = makeRoom({ version: 5, team_b_position: 9 });
    expect(mergeRoomState(current, echo)).toBe(current);
  });
});

describe("race-condition simulation — two answers submitted in the same tick", () => {
  /**
   * Models what happens inside the database when two answers are POSTed
   * before either client receives a Realtime update. The Postgres RPC
   * serialises them with SELECT ... FOR UPDATE, so the second transaction
   * evaluates its guards against the already-committed state and fails.
   * Here we model that serialisation by applying attempts against evolving
   * state.
   */
  it("never lets a double submission climb two floors", () => {
    let room = makeRoom(); // current_turn = A

    const answerForA = () =>
      applyAnswerToRoom(room, {
        team: "A",
        playerId: "p-a",
        questionId: "q-1",
        selectedKey: "A",
        question,
        alreadyAnswered: false,
      });

    // First request acquires the row lock and commits.
    room = answerForA();
    expect(room.current_turn).toBe("B");
    expect(room.version).toBe(2);

    // The duplicated request (double click / network retry) is unblocked
    // after the lock releases, sees the rotated turn, and is rejected.
    expect(answerForA).toThrow("NOT_YOUR_TURN");

    // Only one floor was climbed in total.
    expect(room.team_a_position).toBe(1);
    expect(room.team_b_position).toBe(0);
  });

  it("rejects the other team answering while it is not their turn", () => {
    const room = makeRoom(); // current_turn = A

    expect(() =>
      applyAnswerToRoom(room, {
        team: "B",
        playerId: "p-b",
        questionId: "q-1",
        selectedKey: "A",
        question,
        alreadyAnswered: false,
      }),
    ).toThrow("NOT_YOUR_TURN");
  });

  it("rejects a re-delivered answer via the idempotency guard even before turn rotation", () => {
    const room = makeRoom();

    // Same room state, but the (room, question, team) answer row already
    // exists — mirroring the unique constraint in room_answers.
    expect(() =>
      applyAnswerToRoom(room, {
        team: "A",
        playerId: "p-a",
        questionId: "q-1",
        selectedKey: "A",
        question,
        alreadyAnswered: true,
      }),
    ).toThrow("ANSWER_ALREADY_RECORDED");
  });

  it("a burst of interleaved Realtime snapshots converges to the highest version", () =>
    {
      let state: RoomMatch | null = null;

      // Events arrive shuffled: v1, v3, v2, v5, v4
      const events = [1, 3, 2, 5, 4].map((version) =>
        makeRoom({ version, team_a_position: version }),
      );

      for (const event of events) {
        state = mergeRoomState(state, event);
      }

      expect(state).not.toBeNull();
      expect(state?.version).toBe(5);
      expect(state?.team_a_position).toBe(5);
    });
});
