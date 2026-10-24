import { describe, expect, it } from "vitest";
import {
  accuracy,
  emptyStats,
  formatPercent,
  medalFor,
  rankLeaderboard,
  winRate,
} from "./stats";
import type { LeaderboardEntry } from "./types";

function entry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    username: "player",
    matches_played: 0,
    matches_won: 0,
    answers_total: 0,
    answers_correct: 0,
    accuracy: 0,
    ...overrides,
  };
}

describe("accuracy and win rate", () => {
  it("returns zero when there is no data", () => {
    expect(accuracy(0, 0)).toBe(0);
    expect(winRate(0, 0)).toBe(0);
  });

  it("computes percentages rounded to one decimal", () => {
    expect(accuracy(7, 10)).toBe(70);
    expect(accuracy(1, 3)).toBe(33.3);
    expect(winRate(3, 4)).toBe(75);
  });

  it("formats values with a percent sign", () => {
    expect(formatPercent(33.3)).toBe("33.3%");
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("exposes a zeroed stats object", () => {
    expect(emptyStats()).toEqual({
      matches_played: 0,
      matches_won: 0,
      answers_total: 0,
      answers_correct: 0,
    });
  });
});

describe("rankLeaderboard", () => {
  it("orders by wins, then correct answers, then accuracy, then name", () => {
    const rows = [
      entry({ username: "Omar", matches_won: 1, answers_correct: 4 }),
      entry({ username: "Aisha", matches_won: 3, answers_correct: 9 }),
      entry({ username: "Sara", matches_won: 3, answers_correct: 12 }),
      entry({ username: "Hadi", matches_won: 0, answers_correct: 20, accuracy: 90 }),
    ];

    const ranked = rankLeaderboard(rows).map((r) => r.username);
    expect(ranked).toEqual(["Sara", "Aisha", "Omar", "Hadi"]);
  });

  it("breaks exact ties alphabetically", () => {
    const rows = [
      entry({ username: "Zed", matches_won: 2 }),
      entry({ username: "Ami", matches_won: 2 }),
    ];
    expect(rankLeaderboard(rows).map((r) => r.username)).toEqual(["Ami", "Zed"]);
  });

  it("does not mutate the input array", () => {
    const rows = [
      entry({ username: "B", matches_won: 1 }),
      entry({ username: "A", matches_won: 2 }),
    ];
    const snapshot = [...rows];
    rankLeaderboard(rows);
    expect(rows).toEqual(snapshot);
  });
});

describe("medalFor", () => {
  it("returns the podium medals for the first three ranks", () => {
    expect(medalFor(0)).toBe("gold");
    expect(medalFor(1)).toBe("silver");
    expect(medalFor(2)).toBe("bronze");
    expect(medalFor(3)).toBeNull();
  });
});
