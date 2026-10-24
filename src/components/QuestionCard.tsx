"use client";

import { motion } from "framer-motion";
import { Check, Clock, Loader2, X } from "lucide-react";
import { formatCountdown, type QuizState } from "@/lib/quiz";
import { QUESTION_TIME_SECONDS, TEAM_META, type AnswerKey, type TeamSide } from "@/lib/types";

interface QuestionCardProps {
  state: QuizState;
  remaining: number;
  activeTeam: TeamSide;
  canAnswer: boolean;
  onSelect: (key: AnswerKey) => void;
}

/**
 * Question panel with a per-question countdown, four options and a
 * post-answer feedback state. The correct key never reaches this component
 * until the answer_question RPC returns it.
 */
export function QuestionCard({
  state,
  remaining,
  activeTeam,
  canAnswer,
  onSelect,
}: QuestionCardProps) {
  const meta = TEAM_META[activeTeam];
  const timeRatio = Math.max(0, remaining / QUESTION_TIME_SECONDS);
  const lowTime = remaining <= 5 && state.phase === "active";

  return (
    <section
      aria-live="polite"
      className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-7"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider text-white ${meta.color}`}
        >
          {meta.name} turn
        </span>
        <TimerBadge remaining={remaining} lowTime={lowTime} visible={state.phase === "active"} />
      </div>

      {state.phase === "loading" || state.phase === "idle" ? (
        <div className="flex flex-col items-center gap-3 py-14 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" data-testid="question-loading" />
          <p className="text-sm font-semibold">Drawing the next question…</p>
        </div>
      ) : state.phase === "timeout" ? (
        <div className="py-10 text-center">
          <Clock className="mx-auto h-10 w-10 text-amber-300" />
          <p className="mt-3 text-lg font-black text-amber-300">Time&apos;s up!</p>
          <p className="mt-1 text-sm text-slate-400">
            The turn passes to {TEAM_META[activeTeam === "A" ? "B" : "A"].name}.
          </p>
        </div>
      ) : (
        state.question && (
          <motion.div
            key={state.question.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">
              {state.question.category} · Floor {state.question.floor_level}
            </p>
            <h3 className="text-xl font-bold leading-snug text-white">
              {state.question.prompt}
            </h3>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {state.question.options.map((option) => {
                const isSelected = state.selectedKey === option.key;
                const isRevealedCorrect =
                  state.phase === "submitted" && option.key === state.correctKey;
                const isRevealedWrong =
                  state.phase === "submitted" &&
                  isSelected &&
                  option.key !== state.correctKey;

                return (
                  <OptionButton
                    key={option.key}
                    optionKey={option.key}
                    text={option.text}
                    selected={isSelected}
                    revealedCorrect={isRevealedCorrect}
                    revealedWrong={isRevealedWrong}
                    disabled={!canAnswer || state.phase !== "active"}
                    onSelect={onSelect}
                  />
                );
              })}
            </div>

            {state.phase === "submitted" && (
              <FeedbackBanner
                isCorrect={state.isCorrect === true}
                explanation={state.explanation}
              />
            )}
            {state.error && (
              <p role="alert" className="mt-4 text-sm font-semibold text-rose-400">
                {state.error}
              </p>
            )}
          </motion.div>
        )
      )}

      {state.phase === "active" && (
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            className={`h-full rounded-full ${lowTime ? "bg-rose-500" : "bg-emerald-400"}`}
            initial={false}
            animate={{ width: `${timeRatio * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      )}
    </section>
  );
}

function TimerBadge({
  remaining,
  lowTime,
  visible,
}: {
  remaining: number;
  lowTime: boolean;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <span
      data-testid="countdown"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm font-black tabular-nums ${
        lowTime ? "animate-pulse bg-rose-500/15 text-rose-300" : "bg-slate-800 text-slate-200"
      }`}
    >
      <Clock className="h-4 w-4" />
      {formatCountdown(remaining)}
    </span>
  );
}

interface OptionButtonProps {
  optionKey: AnswerKey;
  text: string;
  selected: boolean;
  revealedCorrect: boolean;
  revealedWrong: boolean;
  disabled: boolean;
  onSelect: (key: AnswerKey) => void;
}

function OptionButton({
  optionKey,
  text,
  selected,
  revealedCorrect,
  revealedWrong,
  disabled,
  onSelect,
}: OptionButtonProps) {
  const tone = revealedCorrect
    ? "border-emerald-500 bg-emerald-500/15 text-white"
    : revealedWrong
      ? "border-rose-500 bg-rose-500/15 text-white"
      : selected
        ? "border-amber-400 bg-amber-400/15 text-white"
        : "border-slate-700 bg-slate-800/70 text-slate-200 hover:border-slate-500 hover:bg-slate-800";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(optionKey)}
      aria-pressed={selected}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/30 disabled:cursor-not-allowed ${tone} ${
        disabled && !selected && !revealedCorrect && !revealedWrong ? "opacity-70" : ""
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-black ${
          revealedCorrect
            ? "bg-emerald-500 text-white"
            : revealedWrong
              ? "bg-rose-500 text-white"
              : selected
                ? "bg-amber-400 text-slate-950"
                : "bg-slate-700 text-slate-200"
        }`}
      >
        {optionKey}
      </span>
      <span className="text-sm font-semibold leading-snug">{text}</span>
    </button>
  );
}

function FeedbackBanner({
  isCorrect,
  explanation,
}: {
  isCorrect: boolean;
  explanation: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-5 rounded-2xl border p-4 ${
        isCorrect
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-rose-500/40 bg-rose-500/10"
      }`}
    >
      <p
        className={`flex items-center gap-2 font-black ${
          isCorrect ? "text-emerald-300" : "text-rose-300"
        }`}
      >
        {isCorrect ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
        {isCorrect ? "Correct — climb one floor!" : "Not quite — the turn passes on."}
      </p>
      {explanation && (
        <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{explanation}</p>
      )}
    </motion.div>
  );
}
