"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") ?? "/lobby";
  const errorCode = searchParams.get("error");
  const setupComplete = searchParams.get("setup") === "complete";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-3xl font-black tracking-tight text-white">
        Tower of <span className="text-amber-300">English</span>
      </Link>

      {setupComplete && (
        <p
          role="status"
          className="mb-4 w-full max-w-md rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300"
        >
          Supervisor account created. Sign in with the supervisor name and
          access code, then add the students from the control panel.
        </p>
      )}

      {errorCode && (
        <p
          role="alert"
          className="mb-4 w-full max-w-md rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300"
        >
          {errorCode === "not_configured"
            ? "Supabase is not configured yet. Add the project settings from .env.local.example, or explore the demo instead."
            : "Sign-in could not be completed. Please try again."}
        </p>
      )}

      <AuthForm onSuccess={() => router.replace(redirectTarget)} />

      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <Link
          href="/demo"
          className="text-sm font-semibold text-sky-400 hover:text-sky-300"
        >
          Or explore the demo without an account →
        </Link>
        <Link
          href="/setup"
          className="text-xs font-semibold text-slate-500 hover:text-slate-300"
        >
          First-time owner setup: create the supervisor account
        </Link>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
