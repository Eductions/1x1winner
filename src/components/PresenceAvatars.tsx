"use client";

import { Wifi } from "lucide-react";
import type { PresenceUser, TeamSide } from "@/lib/types";

interface PresenceAvatarsProps {
  onlineUsers: PresenceUser[];
  teamAssignments: Partial<Record<TeamSide, string | null>>;
}

/** Live roster showing which player is online, grouped by team. */
export function PresenceAvatars({ onlineUsers, teamAssignments }: PresenceAvatarsProps) {
  const isOnline = (userId?: string | null) =>
    Boolean(userId && onlineUsers.some((u) => u.user_id === userId));

  return (
    <div className="flex flex-wrap items-center gap-3">
      {(["A", "B"] as TeamSide[]).map((team) => {
        const userId = teamAssignments[team];
        const user = onlineUsers.find((u) => u.user_id === userId);
        const online = isOnline(userId);
        return (
          <div
            key={team}
            data-testid={`presence-team-${team}`}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              team === "A"
                ? "border-sky-900/70 bg-sky-950/40 text-sky-200"
                : "border-rose-900/70 bg-rose-950/40 text-rose-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                online ? "bg-emerald-400" : "bg-slate-600"
              }`}
              aria-hidden
            />
            Team {team}
            <span className="text-slate-400">
              {user ? user.username : userId ? "connecting…" : "open slot"}
            </span>
            {online && <Wifi className="h-3.5 w-3.5 text-emerald-400" />}
          </div>
        );
      })}
    </div>
  );
}
