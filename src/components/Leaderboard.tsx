import { Medal } from "lucide-react";
import { formatPercent, medalFor, rankLeaderboard } from "@/lib/stats";
import type { LeaderboardEntry } from "@/lib/types";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUsername?: string;
}

const MEDAL_STYLES: Record<string, string> = {
  gold: "bg-amber-400/20 text-amber-300 border-amber-400/40",
  silver: "bg-slate-300/20 text-slate-200 border-slate-300/40",
  bronze: "bg-orange-700/25 text-orange-300 border-orange-700/50",
};

export function Leaderboard({ entries, currentUsername }: LeaderboardProps) {
  const ranked = rankLeaderboard(entries);

  if (ranked.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-400">
        No ranked players yet — finish a match to appear here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-800/70 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-5 py-3">#</th>
            <th className="px-5 py-3">Player</th>
            <th className="px-5 py-3 text-center">Wins</th>
            <th className="px-5 py-3 text-center">Correct</th>
            <th className="px-5 py-3 text-right">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((entry, index) => {
            const medal = medalFor(index);
            const isCurrent = entry.username === currentUsername;
            return (
              <tr
                key={entry.username}
                data-testid={`leaderboard-row-${index + 1}`}
                className={`border-t border-slate-800 ${
                  isCurrent ? "bg-amber-400/10" : ""
                }`}
              >
                <td className="px-5 py-3.5">
                  {medal ? (
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-black ${MEDAL_STYLES[medal]}`}
                    >
                      <Medal className="h-4 w-4" />
                    </span>
                  ) : (
                    <span className="pl-2 font-bold text-slate-400">{index + 1}</span>
                  )}
                </td>
                <td className="px-5 py-3.5 font-bold text-white">
                  {entry.username}
                  {isCurrent && (
                    <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black uppercase text-amber-300">
                      You
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-center font-semibold text-slate-200">
                  {entry.matches_won}
                </td>
                <td className="px-5 py-3.5 text-center font-semibold text-slate-200">
                  {entry.answers_correct}
                </td>
                <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-200">
                  {formatPercent(entry.accuracy)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
