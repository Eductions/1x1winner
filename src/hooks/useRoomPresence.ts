"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { PresenceUser } from "@/lib/types";

interface UseRoomPresenceArgs {
  roomId: string | null;
  user: PresenceUser | null;
}

/**
 * Tracks which players are currently online in a room via Supabase Realtime
 * Presence. Each client tracks its own profile; the aggregated state is
 * de-duplicated by user id and re-rendered on join/leave/sync events.
 */
export function useRoomPresence({ roomId, user }: UseRoomPresenceArgs) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!roomId || !user) {
      setOnlineUsers([]);
      return;
    }

    const supabase = getSupabaseClient();
    let channel: RealtimeChannel | null = null;

    const collect = (): PresenceUser[] => {
      const state = channel?.presenceState() ?? {};
      const flat = Object.values(state).flat() as unknown as PresenceUser[];
      const byId = new Map<string, PresenceUser>();
      for (const entry of flat) {
        if (entry?.user_id) byId.set(entry.user_id, entry);
      }
      return Array.from(byId.values());
    };

    channel = supabase
      .channel(`presence:${roomId}`, {
        config: { presence: { key: user.user_id } },
      })
      .on("presence", { event: "sync" }, () => setOnlineUsers(collect()))
      .on("presence", { event: "join" }, () => setOnlineUsers(collect()))
      .on("presence", { event: "leave" }, () => setOnlineUsers(collect()));

    const currentChannel = channel;
    channel.subscribe(async (subscribeStatus) => {
      if (subscribeStatus === "SUBSCRIBED") {
        await currentChannel.track({
          user_id: user.user_id,
          username: user.username,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // Only re-subscribe when the room or the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.user_id]);

  return onlineUsers;
}
