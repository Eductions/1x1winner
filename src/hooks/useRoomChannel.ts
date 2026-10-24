"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
} from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { mergeRoomState } from "@/lib/gameLogic";
import type {
  AnswerKey,
  AnswerResult,
  RoomMatch,
  TeamSide,
} from "@/lib/types";

export type ConnectionStatus =
  | "IDLE"
  | "CONNECTING"
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "CLOSED";

export interface SubmitAnswerVars {
  team: TeamSide;
  questionId: string;
  selectedKey: AnswerKey;
}

export interface UseRoomChannelResult {
  room: RoomMatch | null;
  status: ConnectionStatus;
  isConnected: boolean;
  error: string | null;
  /** Call the atomic submit_answer RPC; the RPC result updates local state. */
  submitAnswer: (vars: SubmitAnswerVars) => Promise<RoomMatch>;
  /** Step 2: secure answering RPC that also returns correctness feedback. */
  answerQuestion: (vars: SubmitAnswerVars) => Promise<AnswerResult>;
  /** Timer expiry: rotate the turn without moving a team. */
  expireTurn: (team: TeamSide) => Promise<RoomMatch>;
  /** Manually reconnect (e.g. after a CHANNEL_ERROR). */
  reconnect: () => void;
}

/**
 * Subscribes to the room_matches row for `roomId` and keeps both teams'
 * tower positions in sync instantly across every connected browser.
 *
 * Race-safety design:
 *  - Clients never UPDATE room_matches directly (RLS blocks it).
 *  - Answers go through Postgres RPCs, which take a SELECT ... FOR UPDATE
 *    row lock, so simultaneous answers are serialised.
 *  - The single committed row change fans out through this channel.
 *  - mergeRoomState() ignores any event whose `version` is older than the
 *    state already rendered, so out-of-order Realtime delivery cannot move a
 *    team backwards.
 */
export function useRoomChannel(roomId: string | null): UseRoomChannelResult {
  const [room, setRoom] = useState<RoomMatch | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [reconnectToken, setReconnectToken] = useState(0);

  // Latest room ref lets RPC calls merge against fresh state without
  // re-creating the channel on every position change.
  const roomRef = useRef<RoomMatch | null>(null);
  roomRef.current = room;

  useEffect(() => {
    if (!roomId) {
      setStatus("IDLE");
      return;
    }

    const supabase = getSupabaseClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    setStatus("CONNECTING");
    setError(null);

    // 1. Hydrate current state once (covers changes made before subscribe).
    supabase
      .from("room_matches")
      .select("*")
      .eq("id", roomId)
      .single()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError(fetchError.message);
          return;
        }
        if (data) {
          setRoom((prev) => mergeRoomState(prev, data as RoomMatch));
        }
      });

    // 2. Live subscription scoped to this one room row.
    channel = supabase
      .channel(`room:${roomId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: "" },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_matches",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            // Room removed — reset the board.
            setRoom(null);
            return;
          }
          const incoming = payload.new as RoomMatch;
          // Version guard: stale/out-of-order events are discarded.
          setRoom((prev) => mergeRoomState(prev, incoming));
        },
      )
      .subscribe((subscribeStatus, err) => {
        if (cancelled) return;
        if (err) setError(err.message);
        switch (subscribeStatus) {
          case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
            setStatus("SUBSCRIBED");
            break;
          case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
            setStatus("CHANNEL_ERROR");
            break;
          case REALTIME_SUBSCRIBE_STATES.CLOSED:
            setStatus("CLOSED");
            break;
          default:
            setStatus("CONNECTING");
        }
      });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomId, reconnectToken]);

  const submitAnswer = useCallback(
    async ({ team, questionId, selectedKey }: SubmitAnswerVars) => {
      const supabase = getSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("submit_answer", {
        p_room_id: roomId,
        p_team: team,
        p_question_id: questionId,
        p_selected_key: selectedKey,
      });
      if (rpcError) {
        setError(rpcError.message);
        throw new Error(rpcError.message);
      }
      const next = data as RoomMatch;
      // Optimistic confirmation; a Realtime echo with the same version is
      // ignored by mergeRoomState so there is no double update.
      setRoom((prev) => mergeRoomState(prev, next));
      return next;
    },
    [roomId],
  );

  const answerQuestion = useCallback(
    async ({
      team,
      questionId,
      selectedKey,
    }: SubmitAnswerVars): Promise<AnswerResult> => {
      const supabase = getSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("answer_question", {
        p_room_id: roomId,
        p_team: team,
        p_question_id: questionId,
        p_selected_key: selectedKey,
      });
      if (rpcError) {
        setError(rpcError.message);
        throw new Error(rpcError.message);
      }
      const result = data as AnswerResult;
      setRoom((prev) => mergeRoomState(prev, result.room));
      return result;
    },
    [roomId],
  );

  const expireTurn = useCallback(
    async (team: TeamSide) => {
      const supabase = getSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("expire_turn", {
        p_room_id: roomId,
        p_team: team,
      });
      if (rpcError) {
        setError(rpcError.message);
        throw new Error(rpcError.message);
      }
      const next = data as RoomMatch;
      setRoom((prev) => mergeRoomState(prev, next));
      return next;
    },
    [roomId],
  );

  const reconnect = useCallback(() => {
    setReconnectToken((token) => token + 1);
  }, []);

  return {
    room,
    status,
    isConnected: status === "SUBSCRIBED",
    error,
    submitAnswer,
    answerQuestion,
    expireTurn,
    reconnect,
  };
}
