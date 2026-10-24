import { describe, expect, it } from "vitest";
import {
  advancePosition,
  applyAnswerToRoom,
  clampFloor,
  earnBadges,
  floorToBottomPercent,
  getNextTurn,
  hasReachedTop,
  isCorrectAnswer,
} from "./gameLogic";
import { TOP_FLOOR, type Question, type RoomMatch } from "./types";

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

describe("scoring rules", () => {
  it("marks an answer correct only when the selected key matches", () => {
    expect(isCorrectAnswer(question, "A")).toBe(true);
    expect(isCorrectAnswer(question, "B")).toBe(false);
  });

  it("climbs exactly one floor on a correct answer", () => {
    expect(advancePosition(3, true)).toBe(4);
  });

  it("keeps the same floor on a wrong answer", () => {
    expect(advancePosition(3, false)).toBe(3);
  });

  it("never climbs past floor 10", () => {
    expect(advancePosition(TOP_FLOOR, true)).toBe(TOP_FLOOR);
    expect(clampFloor(99)).toBe(TOP_FLOOR);
    expect(clampFloor(-5)).toBe(0);
  });

  it("rotates turns A → B → A", () => {
    expect(getNextTurn("A")).toBe("B");
    expect(getNextTurn("B")).toBe("A");
  });

  it("detects the summit", () => {
    expect(hasReachedTop(9)).toBe(false);
    expect(hasReachedTop(10)).toBe(true);
  });

  it("maps floors to a bottom-offset percentage for the tower track", () => {
    expect(floorToBottomPercent(0)).toBe(0);
    expect(floorToBottomPercent(5)).toBe(50);
    expect(floorToBottomPercent(10)).toBe(100);
  });
});

describe("applyAnswerToRoom — client mirror of the submit_answer RPC", () => {
  it("advances the answering team and rotates the turn on a correct answer", () => {
    const next = applyAnswerToRoom(makeRoom(), {
      team: "A",
      playerId: "p-a",
      questionId: "q-1",
      selectedKey: "A",
      question,
      alreadyAnswered: false,
    });

    expect(next.team_a_position).toBe(1);
    expect(next.team_b_position).toBe(0);
    expect(next.current_turn).toBe("B");
    expect(next.version).toBe(2);
    expect(next.status).toBe("playing");
  });

  it("does not move the team on a wrong answer but still rotates the turn", () => {
    const next = applyAnswerToRoom(makeRoom({ current_turn: "B" }), {
      team: "B",
      playerId: "p-b",
      questionId: "q-1",
      selectedKey: "C",
      question,
      alreadyAnswered: false,
    });

    expect(next.team_b_position).toBe(0);
    expect(next.current_turn).toBe("A");
  });

  it("finishes the match and crowns a team that reaches floor 10", () => {
    const next = applyAnswerToRoom(
      makeRoom({ team_a_position: 9, current_turn: "A" }),
      {
        team: "A",
        playerId: "p-a",
        questionId: "q-1",
        selectedKey: "A",
        question,
        alreadyAnswered: false,
      },
    );

    expect(next.team_a_position).toBe(10);
    expect(next.status).toBe("finished");
    expect(next.winner).toBe("A");
    expect(next.finished_at).not.toBeNull();
  });

  it("rejects an answer when it is not the team's turn", () => {
    expect(() =>
      applyAnswerToRoom(makeRoom({ current_turn: "B" }), {
        team: "A",
        playerId: "p-a",
        questionId: "q-1",
        selectedKey: "A",
        question,
        alreadyAnswered: false,
      }),
    ).toThrow("NOT_YOUR_TURN");
  });

  it("rejects an answer for a stale question", () => {
    expect(() =>
      applyAnswerToRoom(makeRoom(), {
        team: "A",
        playerId: "p-a",
        questionId: "q-old",
        selectedKey: "A",
        question,
        alreadyAnswered: false,
      }),
    ).toThrow("QUESTION_MISMATCH");
  });

  it("rejects a player who does not belong to the team", () => {
    expect(() =>
      applyAnswerToRoom(makeRoom(), {
        team: "A",
        playerId: "p-b",
        questionId: "q-1",
        selectedKey: "A",
        question,
        alreadyAnswered: false,
      }),
    ).toThrow("NOT_TEAM_MEMBER");
  });

  it("rejects a duplicated answer (idempotency guard)", () => {
    expect(() =>
      applyAnswerToRoom(makeRoom(), {
        team: "A",
        playerId: "p-a",
        questionId: "q-1",
        selectedKey: "A",
        question,
        alreadyAnswered: true,
      }),
    ).toThrow("ANSWER_ALREADY_RECORDED");
  });

  it("rejects answers once the match is finished", () => {
    expect(() =>
      applyAnswerToRoom(makeRoom({ status: "finished", winner: "A" }), {
        team: "B",
        playerId: "p-b",
        questionId: "q-1",
        selectedKey: "A",
        question,
        alreadyAnswered: false,
      }),
    ).toThrow("MATCH_NOT_ACTIVE");
  });
});

describe("badges", () => {
  it("awards the summit badge to the winner plus extra badges for skill", () => {
    const room = makeRoom({
      status: "finished",
      winner: "A",
      team_a_position: 10,
    });
    const history = [
      { team: "A" as const, is_correct: true },
      { team: "A" as const, is_correct: true },
      { team: "A" as const, is_correct: true },
      { team: "A" as const, is_correct: true },
      { team: "A" as const, is_correct: true },
    ];

    const badges = earnBadges(room, history);
    expect(badges.map((b) => b.id)).toEqual(
      expect.arrayContaining(["summit", "sharp-shooter", "flawless"]),
    );
  });

  it("awards no badges while the match is still running", () => {
    expect(earnBadges(makeRoom(), [])).toEqual([]);
  });
});
