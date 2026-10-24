"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Award, Medal, Sparkles, Trophy } from "lucide-react";
import { TEAM_META, type TeamSide } from "@/lib/types";

export interface EarnedBadge {
  id: string;
  label: string;
  description: string;
}

interface CelebrationModalProps {
  open: boolean;
  winner: TeamSide | null;
  badges: EarnedBadge[];
  onPlayAgain: () => void;
}

const BADGE_ICONS = [Trophy, Medal, Award];

/** Full-screen celebration shown when a team reaches Floor 10. */
export function CelebrationModal({
  open,
  winner,
  badges,
  onPlayAgain,
}: CelebrationModalProps) {
  return (
    <AnimatePresence>
      {open && winner && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={`${TEAM_META[winner].name} wins`}
        >
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />

          {/* Confetti particles */}
          {Array.from({ length: 18 }).map((_, i) => (
            <motion.span
              key={i}
              className={`absolute top-0 h-2.5 w-2.5 rounded-sm ${
                i % 2 === 0 ? "bg-amber-300" : i % 3 === 0 ? "bg-sky-400" : "bg-rose-400"
              }`}
              initial={{ x: `${(i * 53) % 100}vw`, y: -20, opacity: 1, rotate: 0 }}
              animate={{ y: "110vh", rotate: 360 }}
              transition={{
                duration: 2.6 + (i % 5) * 0.4,
                repeat: Infinity,
                delay: (i % 7) * 0.25,
                ease: "easeIn",
              }}
            />
          ))}

          <motion.div
            initial={{ scale: 0.7, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 p-8 text-center shadow-2xl"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 12 }}
              className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${TEAM_META[winner].color}`}
            >
              <Trophy className="h-10 w-10 text-white" />
            </motion.div>

            <h2 className="text-3xl font-black text-white">
              {TEAM_META[winner].name} Wins!
            </h2>
            <p className="mt-2 flex items-center justify-center gap-2 text-slate-300">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Reached Floor 10 and conquered the Tower of English
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {badges.map((badge, index) => {
                const BadgeIcon = BADGE_ICONS[index % BADGE_ICONS.length];
                return (
                  <motion.div
                    key={badge.id}
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 + index * 0.15 }}
                    className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4"
                  >
                    <BadgeIcon className="mx-auto h-7 w-7 text-amber-300" />
                    <p className="mt-2 text-sm font-bold text-white">{badge.label}</p>
                    <p className="mt-1 text-xs leading-snug text-slate-400">
                      {badge.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onPlayAgain}
              className="mt-7 w-full rounded-xl bg-amber-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-amber-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50"
            >
              Play Again
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
