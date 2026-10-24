import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  initialQuizState,
  pickAvailableTeam,
  quizReducer,
  teamOfUser,
  type QuizState,
} from "./quiz";
import type { AnswerResult, RoomMatch, SafeQuestion } from "./types";

function makeQuestion(overrides: Partial<SafeQuestion> = {}): SafeQuestion {
  return {
    id: "q-1",
    floor_level: 1,
    category: "grammar",
    prompt: "Pick the correct sentence",
    options: [
      { key: "A", text: "She goes" },
      { key: "B", text: "She go" },
      { key: "C", text: "She going" },
      { key: "D", text: "She gone" },
    ],
    ...overrides,
  };
}

function makeRoom(overrides: Partial<RoomMatch> = {}): RoomMatch {
  return {
    id: "room-1",
    room_code: "ABC123",
    status: "waiting",
    created_by: "p-a",
    team_a_player_id: "p-a",
    team_b_player_id: null,
    team_a_position: 0,
    team_b_position: 0,
    current_turn: "A",
    current_question_id: null,
    winner: null,
    version: 1,
    started_at: null,
    finished_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("quizReducer", () => {
  it("enters the loading phase for a new question", () => {
    const next = quizReducer(initialQuizState, {
      type: "LOAD_QUESTION",
      questionId: "q-9",
    });
    expect(next.phase).toBe("loading");
    expect(next.questionId).toBe("q-9");
    expect(next.selectedKey).toBeNull();
  });

  it("activates once the safe question payload arrives", () => {
    const loading = quizReducer(initialQuizState, {
      type: "LOAD_QUESTION",
      questionId: "q-1",
    });
    const ready = quizReducer(loading, {
      type: "QUESTION_READY",
      question: makeQuestion(),
    });
    expect(ready.phase).toBe("active");
    expect(ready.question?.prompt).toContain("correct sentence");
  });

  it("discards a question payload whose round has already moved on", () => {
    const state: QuizState = {
      ...initialQuizState,
      phase: "loading",
      questionId: "q-2",
    };
    const next = quizReducer(state, {
      type: "QUESTION_READY",
      question: makeQuestion({ id: "q-1" }),
    });
    expect(next.phase).toBe("loading");
    expect(next.question).toBeNull();
  });

  it("records the selected option only while active", () => {
    const active: QuizState = {
      ...initialQuizState,
      phase: "active",
      questionId: "q-1",
      question: makeQuestion(),
    };
    expect(quizReducer(active, { type: "SELECT_ANSWER", key: "C" }).selectedKey).toBe("C");

    const submitted: QuizState = { ...active, phase: "submitted" };
    expect(quizReducer(submitted, { type: "SELECT_ANSWER", key: "D" })).toBe(submitted);
  });

  it("stores the RPC feedback including the revealed correct key", () => {
    const active: QuizState = {
      ...initialQuizState,
      phase: "active",
      questionId: "q-1",
      selectedKey: "A",
    };
    const result: AnswerResult = {
      room: makeRoom(),
      is_correct: false,
      correct_key: "B",
      explanation: "Third person singular needs -es.",
    };
    const next = quizReducer(active, { type: "ANSWER_CONFIRMED", result });
    expect(next.phase).toBe("submitted");
    expect(next.isCorrect).toBe(false);
    expect(next.correctKey).toBe("B");
    expect(next.explanation).toContain("singular");
  });

  it("surfaces a failed RPC without locking the board", () => {
    const active: QuizState = {
      ...initialQuizState,
      phase: "active",
      questionId: "q-1",
      selectedKey: "A",
    };
    const next = quizReducer(active, {
      type: "ANSWER_FAILED",
      message: "It is the other team's turn.",
    });
    expect(next.phase).toBe("active");
    expect(next.error).toContain("other team");
    expect(next.selectedKey).toBeNull();
  });

  it("only expires an active round and can be reset", () => {
    const active: QuizState = { ...initialQuizState, phase: "active" };
    expect(quizReducer(active, { type: "EXPIRE" }).phase).toBe("timeout");
    const timedOut: QuizState = { ...active, phase: "timeout" };
    expect(quizReducer(timedOut, { type: "EXPIRE" })).toBe(timedOut);
    expect(quizReducer(timedOut, { type: "RESET" })).toEqual(initialQuizState);
  });
});

describe("team helpers", () => {
  it("resolves which team the current user belongs to", () => {
    const room = makeRoom();
    expect(teamOfUser(room, "p-a")).toBe("A");
    expect(teamOfUser(room, "p-b")).toBeNull();
  });

  it("suggests the first free slot when joining", () => {
    expect(pickAvailableTeam(makeRoom())).toBe("B");
    expect(
      pickAvailableTeam(makeRoom({ team_b_player_id: "p-b" })),
    ).toBeNull();
    expect(pickAvailableTeam(makeRoom({ team_a_player_id: null }))).toBe("A");
  });

  it("formats the countdown as mm:ss", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(9)).toBe("00:09");
    expect(formatCountdown(75)).toBe("01:15");
    expect(formatCountdown(-4)).toBe("00:00");
  });
});
