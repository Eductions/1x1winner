import type { LeaderboardEntry, PlayerStats } from "./types";

/**
 * Pure statistics helpers. The database aggregates the raw counts via RPC;
 * these functions turn those counts into display values and enforce a single
 * sorting rule for leaderboards.
 */

/** Correct-answer percentage rounded to one decimal; 0 when no answers exist. */
export function accuracy(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 1000) / 10;
}

/** Win percentage rounded to one decimal. */
export function winRate(wins: number, played: number): number {
  if (played <= 0) return 0;
  return Math.round((wins / played) * 1000) / 10;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Leaderboard ordering used identically by the UI and asserted in tests:
 * wins first, then correct answers, then accuracy, then username alphabetically.
 */
export function rankLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.matches_won !== a.matches_won) return b.matches_won - a.matches_won;
    if (b.answers_correct !== a.answers_correct)
      return b.answers_correct - a.answers_correct;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    return a.username.localeCompare(b.username);
  });
}

/** Medal badge for the top three ranks, otherwise null. */
export function medalFor(rankZeroBased: number): "gold" | "silver" | "bronze" | null {
  if (rankZeroBased === 0) return "gold";
  if (rankZeroBased === 1) return "silver";
  if (rankZeroBased === 2) return "bronze";
  return null;
}

export function emptyStats(): PlayerStats {
  return {
    matches_played: 0,
    matches_won: 0,
    answers_total: 0,
    answers_correct: 0,
  };
}
