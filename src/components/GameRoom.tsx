"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Check,
  LogOut,
  Play,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { useRoomPresence } from "@/hooks/useRoomPresence";
import { useCountdown } from "@/hooks/useCountdown";
import { useSoundFx } from "@/hooks/useSoundFx";
import { Tower } from "@/components/Tower";
import { QuestionCard } from "@/components/QuestionCard";
import { CelebrationModal, type EarnedBadge } from "@/components/CelebrationModal";
import { PresenceAvatars } from "@/components/PresenceAvatars";
import { SoundToggle } from "@/components/SoundToggle";
import { earnBadges } from "@/lib/gameLogic";
import { friendlyErrorMessage } from "@/lib/forms";
import { initialQuizState, quizReducer, teamOfUser } from "@/lib/quiz";
import {
  QUESTION_TIME_SECONDS,
  type AnswerKey,
  type PresenceUser,
  type RoomAnswer,
  type RoomMatch,
  type SafeQuestion,
} from "@/lib/types";

interface GameRoomProps {
  roomCode: string;
  user: { id: string; username: string };
}

export function GameRoom({ roomCode, user }: GameRoomProps) {
  const router = useRouter();
  const [roomId, setRoomId] = useState<string | null | undefined>(undefined);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [quiz, dispatch] = useReducer(quizReducer, initialQuizState);
  const [actionError, setActionError] = useState<string | null>(null);
  const [answerHistory, setAnswerHistory] = useState<RoomAnswer[]>([]);
  const [copied, setCopied] = useState(false);

  const presenceUser: PresenceUser = useMemo(
    () => ({ user_id: user.id, username: user.username, online_at: "" }),
    [user.id, user.username],
  );

  // 1. Resolve the room id from the human-friendly code.
  useEffect(() => {
    let cancelled = false;
    getSupabaseClient()
      .from("room_matches")
      .select("*")
      .eq("room_code", roomCode)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLookupError("This room does not exist or was closed.");
          setRoomId(null);
          return;
        }
        setRoomId((data as RoomMatch).id);
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  const { room, isConnected, status, answerQuestion, expireTurn, reconnect } =
    useRoomChannel(roomId ?? null);
  const onlineUsers = useRoomPresence({ roomId: roomId ?? null, user: presenceUser });
  const { play, muted, toggleMute } = useSoundFx();

  // Sound feedback: result tones, a five-second warning tick and the win fanfare.
  useEffect(() => {
    if (quiz.phase !== "submitted") return;
    play(quiz.isCorrect ? "correct" : "wrong");
  }, [quiz.phase, quiz.isCorrect, play]);

  useEffect(() => {
    if (room?.status === "finished") play("win");
  }, [room?.status, play]);

  const myTeam = room ? teamOfUser(room, user.id) : null;
  const isHost = room?.created_by === user.id;

  // 2. Load the safe question whenever the room points at a new one.
  useEffect(() => {
    if (!room || room.status !== "playing" || !room.current_question_id) return;
    if (quiz.questionId === room.current_question_id && quiz.phase !== "idle") return;

    const questionId = room.current_question_id;
    dispatch({ type: "LOAD_QUESTION", questionId });

    getSupabaseClient()
      .rpc("get_question", { p_question_id: questionId })
      .then(({ data, error }) => {
        if (error) {
          dispatch({ type: "ANSWER_FAILED", message: friendlyErrorMessage(error.message) });
          return;
        }
        dispatch({ type: "QUESTION_READY", question: data as SafeQuestion });
      });
    // quiz.questionId intentionally excluded: the room row drives rounds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.current_question_id, room?.status, room?.version]);

  // 3. Fetch the audit trail once the match ends, for badge calculation.
  useEffect(() => {
    if (room?.status !== "finished" || !roomId) return;
    getSupabaseClient()
      .from("room_answers")
      .select("*")
      .eq("room_id", roomId)
      .then(({ data }) => {
        if (data) setAnswerHistory(data as RoomAnswer[]);
      });
  }, [room?.status, roomId]);

  const handleExpire = useCallback(async () => {
    if (!room || room.status !== "playing") return;
    const timedOutTeam = room.current_turn;
    dispatch({ type: "EXPIRE" });
    try {
      await expireTurn(timedOutTeam);
    } catch {
      // The turn may already have rotated via another client — safe to ignore.
    }
  }, [room, expireTurn]);

  const { remaining } = useCountdown(
    QUESTION_TIME_SECONDS,
    quiz.phase === "active",
    () => void handleExpire(),
    room?.current_question_id,
  );

  // Warning tick during the last five seconds of the round.
  useEffect(() => {
    if (quiz.phase === "active" && remaining === 5) play("tick");
  }, [remaining, quiz.phase, play]);

  async function handleSelect(key: AnswerKey) {
    if (!room || !myTeam || quiz.phase !== "active") return;
    if (room.current_turn !== myTeam) return;
    const questionId = room.current_question_id;
    if (!questionId) return;

    dispatch({ type: "SELECT_ANSWER", key });
    setActionError(null);
    try {
      const result = await answerQuestion({
        team: myTeam,
        questionId,
        selectedKey: key,
      });
      dispatch({ type: "ANSWER_CONFIRMED", result });
    } catch (err) {
      dispatch({
        type: "ANSWER_FAILED",
        message: friendlyErrorMessage((err as Error).message),
      });
    }
  }

  async function handleStart() {
    if (!room) return;
    setActionError(null);
    const { error } = await getSupabaseClient().rpc("start_match", {
      p_room_id: room.id,
    });
    if (error) setActionError(friendlyErrorMessage(error.message));
  }

  async function handleLeave() {
    if (!room) {
      router.push("/lobby");
      return;
    }
    try {
      await getSupabaseClient().rpc("leave_room", { p_room_id: room.id });
    } catch {
      // Room may already be closed — navigation still proceeds.
    }
    router.push("/lobby");
  }

  function copyCode() {
    void navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (roomId === undefined) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20 text-center text-slate-400">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin" />
        <p className="mt-3 font-semibold">Opening room…</p>
      </main>
    );
  }

  if (lookupError || !room) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-lg font-bold text-rose-300">{lookupError ?? "Room unavailable."}</p>
        <button
          type="button"
          onClick={() => router.push("/lobby")}
          className="mt-5 rounded-xl bg-amber-400 px-6 py-3 font-bold text-slate-950 hover:bg-amber-300"
        >
          Back to lobby
        </button>
      </main>
    );
  }

  const badges: EarnedBadge[] = earnBadges(
    room,
    answerHistory.map((a) => ({ team: a.team, is_correct: a.is_correct })),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleLeave()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" /> Leave
          </button>
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm font-black tracking-widest text-amber-300 transition hover:bg-slate-800"
            aria-label="Copy room code"
          >
            {roomCode}
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <SoundToggle muted={muted} onToggle={toggleMute} />
          {status === "CHANNEL_ERROR" && (
            <button
              type="button"
              onClick={reconnect}
              className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-bold text-rose-300 hover:bg-rose-500/25"
            >
              Reconnect
            </button>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${
              isConnected ? "bg-emerald-400/15 text-emerald-300" : "bg-slate-800 text-slate-400"
            }`}
          >
            {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {isConnected ? "Live" : "Connecting…"}
          </span>
        </div>
      </header>

      <div className="mb-6">
        <PresenceAvatars
          onlineUsers={onlineUsers}
          teamAssignments={{
            A: room.team_a_player_id,
            B: room.team_b_player_id,
          }}
        />
      </div>

      {room.status === "waiting" ? (
        <WaitingRoom
          room={room}
          isHost={isHost}
          onStart={() => void handleStart()}
          actionError={actionError}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
          <QuestionCard
            state={quiz}
            remaining={remaining}
            activeTeam={room.current_turn}
            canAnswer={myTeam === room.current_turn && room.status === "playing"}
            onSelect={(key) => void handleSelect(key)}
          />
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
            <Tower
              teamAPosition={room.team_a_position}
              teamBPosition={room.team_b_position}
              winner={room.winner}
              status={room.status}
            />
          </div>
        </div>
      )}

      {actionError && room.status === "waiting" && (
        <p role="alert" className="mt-4 text-sm font-semibold text-rose-400">
          {actionError}
        </p>
      )}

      <CelebrationModal
        open={room.status === "finished"}
        winner={room.winner}
        badges={badges}
        onPlayAgain={() => router.push("/lobby")}
      />
    </main>
  );
}

function WaitingRoom({
  room,
  isHost,
  onStart,
  actionError,
}: {
  room: RoomMatch;
  isHost: boolean;
  onStart: () => void;
  actionError: string | null;
}) {
  const bothTeamsReady =
    Boolean(room.team_a_player_id) && Boolean(room.team_b_player_id);

  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-slate-800 bg-slate-900/70 p-10 text-center">
      <h2 className="text-2xl font-black text-white">Waiting room</h2>
      <p className="mt-2 text-slate-400">
        Share the room code above with your opponent. The race starts once both
        teams are in.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-sky-900/70 bg-sky-950/30 p-5">
          <p className="text-sm font-black text-sky-300">Team A</p>
          <p className="mt-1 text-xs text-slate-400">
            {room.team_a_player_id ? "Joined" : "Open slot"}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-900/70 bg-rose-950/30 p-5">
          <p className="text-sm font-black text-rose-300">Team B</p>
          <p className="mt-1 text-xs text-slate-400">
            {room.team_b_player_id ? "Joined" : "Open slot"}
          </p>
        </div>
      </div>

      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={!bothTeamsReady}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-8 py-3.5 font-black text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="h-5 w-5" />
          {bothTeamsReady ? "Start the race" : "Waiting for Team B…"}
        </button>
      ) : (
        <p className="mt-8 font-semibold text-slate-400">
          The host will start the match shortly…
        </p>
      )}
      {actionError && (
        <p role="alert" className="mt-4 text-sm font-semibold text-rose-400">
          {actionError}
        </p>
      )}
    </section>
  );
}
