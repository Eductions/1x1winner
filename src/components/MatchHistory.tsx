import { Crown } from "lucide-react";
import { TEAM_META } from "@/lib/types";
import type { MatchHistoryRow } from "@/lib/types";

interface MatchHistoryProps {
  matches: MatchHistoryRow[];
}

export function MatchHistory({ matches }: MatchHistoryProps) {
  if (matches.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
        You have not joined any matches yet.
      </div>
    );
  }

  return (
    <ul className="space-y-2.5" data-testid="match-history-list">
      {matches.map((match) => {
        const won = match.winner === match.my_team;
        return (
          <li
            key={match.room_code}
            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-black text-white ${TEAM_META[match.my_team].color}`}
              >
                {match.my_team}
              </span>
              <div>
                <p className="font-mono text-sm font-black tracking-widest text-amber-300">
                  {match.room_code}
                </p>
                <p className="text-xs text-slate-400">
                  Reached floor {match.my_position}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
                won
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {won && <Crown className="h-3.5 w-3.5" />}
              {won ? "Won" : match.status === "finished" ? "Lost" : "Open"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
