import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Leaderboard } from "./Leaderboard";
import type { LeaderboardEntry } from "@/lib/types";

function entry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    username: "player",
    matches_played: 1,
    matches_won: 0,
    answers_total: 0,
    answers_correct: 0,
    accuracy: 0,
    ...overrides,
  };
}

describe("<Leaderboard />", () => {
  it("renders an empty state when nobody has played", () => {
    render(<Leaderboard entries={[]} />);
    expect(screen.getByText(/no ranked players yet/i)).toBeInTheDocument();
  });

  it("ranks rows by wins and highlights the signed-in player", () => {
    render(
      <Leaderboard
        currentUsername="Aisha"
        entries={[
          entry({ username: "Omar", matches_won: 1 }),
          entry({ username: "Aisha", matches_won: 3, answers_correct: 9, accuracy: 90 }),
        ]}
      />,
    );

    const rows = screen.getAllByTestId(/leaderboard-row/);
    expect(within(rows[0]).getByText("Aisha")).toBeInTheDocument();
    expect(within(rows[0]).getByText("You")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Omar")).toBeInTheDocument();
  });

  it("formats the accuracy column", () => {
    render(
      <Leaderboard
        entries={[entry({ username: "Sara", accuracy: 83.3 })]}
      />,
    );
    expect(screen.getByText("83.3%")).toBeInTheDocument();
  });

  it("assigns podium medals to the first three rows", () => {
    render(
      <Leaderboard
        entries={[
          entry({ username: "P1", matches_won: 4 }),
          entry({ username: "P2", matches_won: 3 }),
          entry({ username: "P3", matches_won: 2 }),
          entry({ username: "P4", matches_won: 1 }),
        ]}
      />,
    );

    const firstRow = screen.getByTestId("leaderboard-row-1");
    expect(within(firstRow).getByText("P1")).toBeInTheDocument();
    // Fourth place shows the numeric rank instead of a medal.
    const fourthRow = screen.getByTestId("leaderboard-row-4");
    expect(within(fourthRow).getByText("4")).toBeInTheDocument();
  });
});
