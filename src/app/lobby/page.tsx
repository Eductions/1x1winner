import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { LobbyPanel } from "@/components/LobbyPanel";
import { AppHeader } from "@/components/AppHeader";

export default async function LobbyPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=not_configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware normally redirects; this is the defence-in-depth check.
  if (!user) redirect("/login?redirect=/lobby");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const username =
    profile?.username ?? user.user_metadata?.username ?? user.email?.split("@")[0] ?? "Player";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AppHeader />

      <LobbyPanel username={username} />
    </main>
  );
}
