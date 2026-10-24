import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { GameRoom } from "@/components/GameRoom";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  if (!isSupabaseConfigured()) {
    redirect(`/login?error=not_configured&redirect=/room/${code}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?redirect=/room/${code}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const username =
    profile?.username ?? user.user_metadata?.username ?? "Player";

  return <GameRoom roomCode={code.toUpperCase()} user={{ id: user.id, username }} />;
}
