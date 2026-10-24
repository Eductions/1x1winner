"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await getSupabaseClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
    >
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  );
}
