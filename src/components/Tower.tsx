"use client";

import { motion } from "framer-motion";
import { Crown, Flag, Shield, Swords } from "lucide-react";
import {
  FLOOR_COUNT,
  TEAM_META,
  type MatchStatus,
  type TeamSide,
} from "@/lib/types";

interface TowerProps {
  teamAPosition: number;
  teamBPosition: number;
  winner?: TeamSide | null;
  status?: MatchStatus;
}

/**
 * The vertical 10-floor tower with two animated team tokens.
 *
 * Layout: [Team A lane] [Tower floors] [Team B lane], all sharing an 11-slot
 * vertical grid (ground + floors 1–10). Tokens carry a stable `layoutId`, so
 * Framer Motion springs them smoothly between slots whenever the Realtime
 * channel delivers a new floor position — even across reparented slots.
 */
export function Tower({
  teamAPosition,
  teamBPosition,
  winner = null,
  status = "playing",
}: TowerProps) {
  // Floor 10 at the top, floor 1 at the bottom; slot 0 is the ground.
  const floors = Array.from({ length: FLOOR_COUNT }, (_, i) => FLOOR_COUNT - i);

  return (
    <div
      className="flex w-full max-w-md items-stretch justify-center gap-3 sm:gap-5"
      role="img"
      aria-label={`Tower race. Team A on floor ${teamAPosition}, Team B on floor ${teamBPosition}.`}
    >
      <TeamLane
        team="A"
        position={teamAPosition}
        isWinner={winner === "A"}
        disabled={status === "finished" && winner !== "A"}
      />

      <div className="flex flex-1 flex-col">
        {floors.map((floor) => {
          const occupiedBy: TeamSide[] = [];
          if (teamAPosition === floor) occupiedBy.push("A");
          if (teamBPosition === floor) occupiedBy.push("B");
          const isTop = floor === FLOOR_COUNT;

          return (
            <div
              key={floor}
              data-testid={`floor-${floor}`}
              className={[
                "relative flex h-16 items-center justify-between rounded-xl border px-4 transition-colors duration-300",
                isTop
                  ? "border-amber-400/60 bg-gradient-to-r from-amber-500/25 via-yellow-400/15 to-amber-500/25"
                  : "border-slate-700/80 bg-slate-800/80",
                occupiedBy.length > 0 ? "ring-2 ring-offset-2 ring-offset-slate-950" : "",
                occupiedBy.includes("A") ? "ring-sky-400/80" : "",
                occupiedBy.includes("B") ? "ring-rose-400/80" : "",
                occupiedBy.length === 2 ? "ring-amber-300/90" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "text-sm font-bold tracking-wider",
                  isTop ? "text-amber-300" : "text-slate-300",
                ].join(" ")}
              >
                Floor {floor}
              </span>

              {/* Difficulty dots: higher floors = harder */}
              <span className="flex items-center gap-1" aria-hidden>
                {Array.from({ length: FLOOR_COUNT }, (_, i) => (
                  <span
                    key={i}
                    className={[
                      "h-1.5 w-1.5 rounded-full",
                      i < floor ? (isTop ? "bg-amber-300" : "bg-slate-400") : "bg-slate-700",
                    ].join(" ")}
                  />
                ))}
              </span>

              {isTop && (
                <Flag className="absolute -top-3 left-1/2 h-5 w-5 -translate-x-1/2 text-amber-300" />
              )}
            </div>
          );
        })}

        {/* Ground strip */}
        <div
          data-testid="ground"
          className="mt-1 flex h-14 items-center justify-center rounded-xl border border-emerald-800/60 bg-emerald-950/60"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400/90">
            Ground
          </span>
        </div>
      </div>

      <TeamLane
        team="B"
        position={teamBPosition}
        isWinner={winner === "B"}
        disabled={status === "finished" && winner !== "B"}
      />
    </div>
  );
}

interface TeamLaneProps {
  team: TeamSide;
  position: number;
  isWinner: boolean;
  disabled: boolean;
}

function TeamLane({ team, position, isWinner, disabled }: TeamLaneProps) {
  const meta = TEAM_META[team];
  // Slots 0 (ground) … 10 (top), rendered top-to-bottom.
  const slots = Array.from({ length: FLOOR_COUNT + 1 }, (_, i) => FLOOR_COUNT - i);

  return (
    <div
      className={[
        "flex w-14 flex-col rounded-2xl border py-1 transition-opacity duration-500 sm:w-16",
        team === "A" ? "border-sky-900/70 bg-sky-950/30" : "border-rose-900/70 bg-rose-950/30",
        disabled ? "opacity-40" : "opacity-100",
      ].join(" ")}
      aria-label={`${meta.name} lane, currently at floor ${position}`}
    >
      {slots.map((slot) => (
        <div key={slot} className="relative flex h-16 items-center justify-center">
          {slot === position && (
            <TeamToken key={`token-${team}`} team={team} isWinner={isWinner} />
          )}
        </div>
      ))}
      {/* Ground slot aligned with the tower's ground strip */}
      <div className="flex h-14 items-center justify-center">
        {position === 0 && <TeamToken key={`token-${team}`} team={team} isWinner={isWinner} />}
      </div>
    </div>
  );
}

interface TeamTokenProps {
  team: TeamSide;
  isWinner: boolean;
}

function TeamToken({ team, isWinner }: TeamTokenProps) {
  const meta = TEAM_META[team];
  const Icon = team === "A" ? Shield : Swords;

  return (
    <motion.div
      layoutId={`team-${team}-token`}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative"
    >
      <motion.div
        animate={isWinner ? { y: [0, -6, 0] } : { y: 0 }}
        transition={
          isWinner
            ? { repeat: Infinity, duration: 1.1, ease: "easeInOut" }
            : { duration: 0.2 }
        }
        className={[
          "flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/70 shadow-lg sm:h-14 sm:w-14",
          meta.color,
          isWinner ? "ring-4 ring-amber-300/80" : "",
        ].join(" ")}
        aria-label={`${meta.name} token${isWinner ? ", winner" : ""}`}
      >
        <Icon className="h-6 w-6 text-white" strokeWidth={2.4} />
      </motion.div>

      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-slate-950 px-1.5 text-[10px] font-black text-white">
        {team}
      </span>

      {isWinner && (
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.15 }}
          className="absolute -top-3 left-1/2 -translate-x-1/2"
        >
          <Crown className="h-5 w-5 fill-amber-300 text-amber-400" />
        </motion.div>
      )}
    </motion.div>
  );
}
