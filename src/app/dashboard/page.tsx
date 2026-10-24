import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { DashboardView } from "@/components/DashboardView";
import type { UserRole } from "@/lib/types";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=not_configured&redirect=/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role")
    .eq("id", user.id)
    .single();

  const username =
    profile?.username ?? user.user_metadata?.username ?? "Player";
  const role: UserRole = profile?.role === "teacher" ? "teacher" : "student";

  return <DashboardView username={username} role={role} />;
}
