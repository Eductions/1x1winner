"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, LogIn } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  internalEmailForName,
  validateAccessCode,
  validatePlayerName,
} from "@/lib/accessCredentials";
import { friendlyErrorMessage } from "@/lib/forms";

interface AuthFormProps {
  onSuccess?: () => void;
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    const nameError = validatePlayerName(name);
    const codeError = validateAccessCode(code);
    if (nameError) next.name = nameError;
    if (codeError) next.code = codeError;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const email = await internalEmailForName(name);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: code,
      });
      if (error) throw error;
      onSuccess?.();
    } catch (err) {
      setFormError(friendlyErrorMessage((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-black text-white">Sign in with your code</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Use the exact name and personal access code given to you by your
          supervisor. No email address is needed.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          id="name"
          label="Your name"
          value={name}
          onChange={setName}
          placeholder="Write your name exactly"
          error={errors.name}
          autoComplete="username"
        />
        <Field
          id="code"
          label="Access code"
          type="password"
          value={code}
          onChange={setCode}
          placeholder="Your personal code"
          error={errors.code}
          autoComplete="current-password"
        />

        {formError && (
          <p
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300"
          >
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <LogIn className="h-5 w-5" />
          )}
          Sign in
        </button>
      </form>

      <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
        Accounts are created by the supervisor only. If your name is not in the
        system yet, ask your supervisor to add it from the control panel.
      </p>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  autoComplete?: string;
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  autoComplete,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-slate-300"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        dir="auto"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-xl border bg-slate-800 px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-4 ${
          error
            ? "border-rose-500/60 focus:ring-rose-500/20"
            : "border-slate-700 focus:border-amber-400/60 focus:ring-amber-400/20"
        }`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-semibold text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
