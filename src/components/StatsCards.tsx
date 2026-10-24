import { Target, Trophy, CheckCircle2, Percent } from "lucide-react";
import { accuracy, formatPercent, winRate } from "@/lib/stats";
import type { PlayerStats } from "@/lib/types";

interface StatsCardsProps {
  stats: PlayerStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: "Matches played",
      value: String(stats.matches_played),
      icon: Target,
      tint: "text-sky-300 bg-sky-500/15",
    },
    {
      label: "Matches won",
      value: String(stats.matches_won),
      icon: Trophy,
      tint: "text-amber-300 bg-amber-500/15",
    },
    {
      label: "Correct answers",
      value: `${stats.answers_correct}/${stats.answers_total}`,
      icon: CheckCircle2,
      tint: "text-emerald-300 bg-emerald-500/15",
    },
    {
      label: "Accuracy",
      value: formatPercent(accuracy(stats.answers_correct, stats.answers_total)),
      icon: Percent,
      tint: "text-rose-300 bg-rose-500/15",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          data-testid={`stat-${card.label.toLowerCase().replace(/\s+/g, "-")}`}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
        >
          <span
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.tint}`}
          >
            <card.icon className="h-5 w-5" />
          </span>
          <p className="mt-3 text-2xl font-black text-white">{card.value}</p>
          <p className="text-sm font-semibold text-slate-400">{card.label}</p>
        </div>
      ))}
      <p className="sr-only" data-testid="win-rate">
        Win rate {formatPercent(winRate(stats.matches_won, stats.matches_played))}
      </p>
    </div>
  );
}
