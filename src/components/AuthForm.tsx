"use client";

import { useState, type FormEvent } from "react";
import { LogIn, UserPlus, Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  friendlyErrorMessage,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/forms";

type Mode = "signin" | "signup";

interface AuthFormProps {
  initialMode?: Mode;
  onSuccess?: () => void;
}

export function AuthForm({ initialMode = "signin", onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError) next.email = emailError;
    if (passwordError) next.password = passwordError;
    if (mode === "signup") {
      const usernameError = validateUsername(username);
      if (usernameError) next.username = usernameError;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    const supabase = getSupabaseClient();

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: username.trim() } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      onSuccess?.();
    } catch (err) {
      setFormError(friendlyErrorMessage((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-800 p-1">
        {(["signin", "signup"] as Mode[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setMode(tab);
              setErrors({});
              setFormError(null);
            }}
            className={`rounded-lg py-2 text-sm font-bold transition ${
              mode === tab
                ? "bg-amber-400 text-slate-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            {tab === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {mode === "signup" && (
          <Field
            id="username"
            label="Username"
            value={username}
            onChange={setUsername}
            placeholder="english.champ"
            error={errors.username}
            autoComplete="username"
          />
        )}
        <Field
          id="email"
          label="University email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@university.edu"
          error={errors.email}
          autoComplete="email"
        />
        <Field
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          error={errors.password}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
          ) : mode === "signin" ? (
            <LogIn className="h-5 w-5" />
          ) : (
            <UserPlus className="h-5 w-5" />
          )}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      {mode === "signup" && (
        <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
          If email confirmation is enabled in your Supabase project, confirm
          your inbox before the first sign-in.
        </p>
      )}
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
