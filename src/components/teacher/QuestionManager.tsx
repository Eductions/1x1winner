"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Archive, Loader2, Plus, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { friendlyErrorMessage } from "@/lib/forms";
import {
  formToQuestionInput,
  hasErrors,
  initialQuestionForm,
  validateQuestionForm,
  type QuestionFormErrors,
  type QuestionFormState,
} from "@/lib/questionForm";
import { QUESTION_CATEGORIES, type TeacherQuestion } from "@/lib/types";

export function QuestionManager() {
  const [questions, setQuestions] = useState<TeacherQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<QuestionFormState>(initialQuestionForm);
  const [errors, setErrors] = useState<QuestionFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("teacher_list_questions", {
      p_include_inactive: false,
    });
    if (!error) setQuestions((data as TeacherQuestion[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof QuestionFormState>(key: K, value: QuestionFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    const validation = validateQuestionForm(form);
    setErrors(validation);
    if (hasErrors(validation)) return;

    setSubmitting(true);
    const input = formToQuestionInput(form);
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("create_question", {
      p_floor_level: input.floor_level,
      p_category: input.category,
      p_prompt: input.prompt,
      p_options: input.options,
      p_correct_key: input.correct_key,
      p_explanation: input.explanation,
    });

    setSubmitting(false);
    if (error) {
      setFormError(friendlyTeacherError(error.message));
      return;
    }

    setSuccess("Question added to the bank.");
    setForm(initialQuestionForm);
    await load();
  }

  async function archive(id: string) {
    setArchivingId(id);
    setFormError(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("archive_question", { p_id: id });
    if (error) setFormError(friendlyTeacherError(error.message));
    setArchivingId(null);
    await load();
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black text-white">Question bank</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Refresh question bank"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 py-8 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading questions…
          </p>
        ) : questions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
            No active questions yet — create the first one below.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="question-table">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Floor</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Prompt</th>
                  <th className="py-2 pr-4 text-center">Key</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id} className="border-t border-slate-800 align-top">
                    <td className="py-3 pr-4 font-black text-amber-300">{q.floor_level}</td>
                    <td className="py-3 pr-4 capitalize text-slate-300">{q.category}</td>
                    <td className="max-w-sm py-3 pr-4 text-slate-200">{q.prompt}</td>
                    <td className="py-3 pr-4 text-center">
                      <span className="rounded-md bg-emerald-500/15 px-2 py-1 font-black text-emerald-300">
                        {q.correct_key}
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => void archive(q.id)}
                        disabled={archivingId === q.id}
                        aria-label={`Archive question ${q.floor_level}`}
                        className="rounded-lg p-2 text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-50"
                      >
                        {archivingId === q.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-7"
        data-testid="question-form"
      >
        <h2 className="mb-5 flex items-center gap-2 text-xl font-black text-white">
          <Plus className="h-5 w-5 text-amber-300" /> Add a question
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Floor (1–10)" error={errors.floor_level}>
            <input
              type="number"
              min={1}
              max={10}
              value={form.floor_level}
              onChange={(e) => update("floor_level", e.target.value)}
              className="input"
              aria-label="Floor level"
            />
          </FormField>

          <FormField label="Category" error={undefined}>
            <select
              value={form.category}
              onChange={(e) =>
                update("category", e.target.value as QuestionFormState["category"])
              }
              className="input"
              aria-label="Question category"
            >
              {QUESTION_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Prompt" error={errors.prompt}>
          <textarea
            value={form.prompt}
            onChange={(e) => update("prompt", e.target.value)}
            rows={2}
            placeholder="Write the English question here…"
            className="input"
            aria-label="Question prompt"
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          {(["A", "B", "C", "D"] as const).map((key) => {
            const field = `option${key}` as const;
            const optionError = errors.options;
            return (
              <FormField key={key} label={`Option ${key}`} error={key === "A" ? optionError : undefined}>
                <div className="flex items-center gap-2">
                  <input
                    value={form[field]}
                    onChange={(e) => update(field, e.target.value)}
                    placeholder={`Option ${key} text`}
                    className="input"
                    aria-label={`Option ${key}`}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-300">
                    <input
                      type="radio"
                      name="correct_key"
                      checked={form.correct_key === key}
                      onChange={() => update("correct_key", key)}
                      aria-label={`Mark option ${key} correct`}
                    />
                    Correct
                  </label>
                </div>
              </FormField>
            );
          })}
        </div>

        <FormField label="Explanation (optional)" error={undefined}>
          <textarea
            value={form.explanation}
            onChange={(e) => update("explanation", e.target.value)}
            rows={2}
            placeholder="Why is this the correct answer?"
            className="input"
            aria-label="Explanation"
          />
        </FormField>

        {formError && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300">
            {formError}
          </p>
        )}
        {success && (
          <p role="status" className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          Add question
        </button>
      </form>
    </section>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="mb-1.5 text-sm font-semibold text-slate-300">{label}</p>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-xs font-semibold text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

function friendlyTeacherError(message: string): string {
  if (message.includes("TEACHER_ONLY")) return "Only the supervisor can manage questions.";
  if (message.includes("OPTIONS_MUST_BE_FOUR")) return "A question needs exactly four options.";
  if (message.includes("PROMPT_TOO_SHORT")) return "The prompt is too short.";
  return friendlyErrorMessage(message);
}
