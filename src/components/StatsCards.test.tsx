import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatsCards } from "./StatsCards";
import type { PlayerStats } from "@/lib/types";

const stats: PlayerStats = {
  matches_played: 8,
  matches_won: 5,
  answers_total: 20,
  answers_correct: 15,
};

describe("<StatsCards />", () => {
  it("renders the four headline statistics", () => {
    render(<StatsCards stats={stats} />);

    expect(screen.getByTestId("stat-matches-played")).toHaveTextContent("8");
    expect(screen.getByTestId("stat-matches-won")).toHaveTextContent("5");
    expect(screen.getByTestId("stat-correct-answers")).toHaveTextContent("15/20");
    expect(screen.getByTestId("stat-accuracy")).toHaveTextContent("75.0%");
  });

  it("renders zeroes safely for a brand-new player", () => {
    render(
      <StatsCards
        stats={{
          matches_played: 0,
          matches_won: 0,
          answers_total: 0,
          answers_correct: 0,
        }}
      />,
    );
    expect(screen.getByTestId("stat-accuracy")).toHaveTextContent("0.0%");
    expect(screen.getByTestId("win-rate")).toHaveTextContent("Win rate 0.0%");
  });
});
