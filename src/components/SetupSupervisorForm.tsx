"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  canonicalPlayerName,
  validateAccessCode,
  validatePlayerName,
} from "@/lib/accessCredentials";
import { friendlyErrorMessage } from "@/lib/forms";

export function SetupSupervisorForm() {
  const router = useRouter();
  const [setupSecret, setSetupSecret] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!setupSecret.trim()) next.setupSecret = "Setup key is required.";

    const nameError = validatePlayerName(name);
    if (nameError) next.name = nameError;

    const codeError = validateAccessCode(code, { supervisor: true });
    if (codeError) next.code = codeError;

    if (confirmCode !== code) next.confirmCode = "The two codes do not match.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/setup/supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupSecret: setupSecret.trim(),
          name: canonicalPlayerName(name),
          code,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        throw new Error(payload.code ?? payload.error ?? "Supervisor setup failed.");
      }

      setSetupSecret("");
      setCode("");
      setConfirmCode("");
      router.replace("/login?setup=complete");
      router.refresh();
    } catch (error) {
      setFormError(friendlyErrorMessage((error as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl"
    >
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-black text-white">Create the supervisor</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          This one-time setup creates the supervisor account. After that, the
          supervisor adds every student from the control panel.
        </p>
      </div>

      <div className="space-y-4">
        <Field
          id="setup-secret"
          label="Owner setup key"
          type="password"
          value={setupSecret}
          onChange={setSetupSecret}
          placeholder="The secret set in Vercel"
          error={errors.setupSecret}
          autoComplete="off"
        />
        <Field
          id="supervisor-name"
          label="Supervisor name"
          value={name}
          onChange={setName}
          placeholder="Exact name for sign-in"
          error={errors.name}
          autoComplete="username"
        />
        <Field
          id="supervisor-code"
          label="Supervisor access code"
          type="password"
          value={code}
          onChange={setCode}
          placeholder="At least 8 characters"
          error={errors.code}
          autoComplete="new-password"
        />
        <Field
          id="confirm-supervisor-code"
          label="Repeat access code"
          type="password"
          value={confirmCode}
          onChange={setConfirmCode}
          placeholder="Repeat the same code"
          error={errors.confirmCode}
          autoComplete="new-password"
        />
      </div>

      {formError && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300"
        >
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ShieldCheck className="h-5 w-5" />
        )}
        Create supervisor
      </button>

      <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
        Keep both the owner setup key and the supervisor access code private.
        This page locks automatically after the first supervisor is created.
      </p>
    </form>
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
        onChange={(event) => onChange(event.target.value)}
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
