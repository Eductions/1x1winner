"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { UserRole } from "@/lib/types";

interface RoleSwitcherProps {
  role: UserRole;
}

/**
 * Prototype role switch (see migration 0003 — production deployments should
 * gate teacher status behind an admin approval flow instead).
 */
export function RoleSwitcher({ role }: RoleSwitcherProps) {
  const router = useRouter();
  const [current, setCurrent] = useState<UserRole>(role);
  const [busy, setBusy] = useState(false);

  async function switchRole(next: UserRole) {
    if (next === current || busy) return;
    setBusy(true);
    const { error } = await getSupabaseClient().rpc("update_my_role", {
      p_role: next,
    });
    setBusy(false);
    if (error) return;
    setCurrent(next);
    router.refresh();
  }

  return (
    <div
      className="inline-flex rounded-xl bg-slate-800 p-1"
      role="group"
      aria-label="Switch role"
    >
      <button
        type="button"
        onClick={() => void switchRole("student")}
        aria-pressed={current === "student"}
        className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition ${
          current === "student" ? "bg-amber-400 text-slate-950" : "text-slate-300 hover:text-white"
        }`}
      >
        <GraduationCap className="h-4 w-4" /> Student
      </button>
      <button
        type="button"
        onClick={() => void switchRole("teacher")}
        aria-pressed={current === "teacher"}
        className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition ${
          current === "teacher" ? "bg-amber-400 text-slate-950" : "text-slate-300 hover:text-white"
        }`}
      >
        <ShieldCheck className="h-4 w-4" /> Teacher
      </button>
    </div>
  );
}
