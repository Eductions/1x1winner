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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-3xl font-black tracking-tight text-white">
        Tower of <span className="text-amber-300">English</span>
      </Link>
      {errorCode && (
        <p
          role="alert"
          className="mb-4 w-full max-w-md rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300"
        >
          {errorCode === "not_configured"
            ? "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, or explore the demo instead."
            : "Sign-in could not be completed. Please try again."}
        </p>
      )}
      <AuthForm onSuccess={() => router.replace(redirectTarget)} />
      <Link
        href="/demo"
        className="mt-6 text-sm font-semibold text-sky-400 hover:text-sky-300"
      >
        Or explore the demo without an account →
      </Link>
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
