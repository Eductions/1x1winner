"use client";

import { useEffect, useState } from "react";
import { Loader2, Trophy, History, BarChart3 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { AppHeader } from "@/components/AppHeader";
import { StatsCards } from "@/components/StatsCards";
import { Leaderboard } from "@/components/Leaderboard";
import { MatchHistory } from "@/components/MatchHistory";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { QuestionManager } from "@/components/teacher/QuestionManager";
import { emptyStats } from "@/lib/stats";
import type {
  LeaderboardEntry,
  MatchHistoryRow,
  PlayerStats,
  UserRole,
} from "@/lib/types";

interface DashboardViewProps {
  username: string;
  role: UserRole;
}

export function DashboardView({ username, role }: DashboardViewProps) {
  const [stats, setStats] = useState<PlayerStats>(emptyStats());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<MatchHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();

    Promise.all([
      supabase.rpc("get_my_stats"),
      supabase.rpc("get_leaderboard", { p_limit: 10 }),
      supabase.rpc("get_my_matches"),
    ]).then(([statsRes, boardRes, historyRes]) => {
      if (cancelled) return;
      if (!statsRes.error && statsRes.data) setStats(statsRes.data as PlayerStats);
      if (!boardRes.error && boardRes.data)
        setLeaderboard(boardRes.data as LeaderboardEntry[]);
      if (!historyRes.error && historyRes.data)
        setHistory(historyRes.data as MatchHistoryRow[]);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AppHeader />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white">
            {role === "teacher" ? "Teacher dashboard" : "Student dashboard"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Signed in as <span className="font-bold text-amber-300">{username}</span>
          </p>
        </div>
        <RoleSwitcher role={role} />
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-16 justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" /> Loading your dashboard…
        </p>
      ) : (
        <div className="space-y-10">
          {role === "teacher" && <QuestionManager />}

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white">
              <BarChart3 className="h-5 w-5 text-sky-400" /> Your performance
            </h2>
            <StatsCards stats={stats} />
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white">
              <Trophy className="h-5 w-5 text-amber-300" /> Leaderboard
            </h2>
            <Leaderboard entries={leaderboard} currentUsername={username} />
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white">
              <History className="h-5 w-5 text-rose-300" /> Recent matches
            </h2>
            <MatchHistory matches={history} />
          </section>
        </div>
      )}
    </main>
  );
}
