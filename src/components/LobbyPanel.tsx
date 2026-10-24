"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  DoorOpen,
  Loader2,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  friendlyErrorMessage,
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from "@/lib/forms";
import type { RoomMatch, WaitingRoomRow } from "@/lib/types";

export function LobbyPanel({ username }: { username: string }) {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [openRooms, setOpenRooms] = useState<WaitingRoomRow[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const loadOpenRooms = useCallback(async () => {
    setLoadingRooms(true);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("list_waiting_rooms");
    if (!error) setOpenRooms((data as WaitingRoomRow[]) ?? []);
    setLoadingRooms(false);
  }, []);

  useEffect(() => {
    loadOpenRooms().catch(() => undefined);
  }, [loadOpenRooms]);

  async function createRoom() {
    setBusy("create");
    setFormError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc("create_room");
      if (error) throw new Error(error.message);
      const room = data as RoomMatch;
      router.push(`/room/${room.room_code}`);
    } catch (err) {
      setFormError(friendlyErrorMessage((err as Error).message));
      setBusy(null);
    }
  }

  async function joinRoom(rawCode: string) {
    const code = normalizeRoomCode(rawCode);
    if (!isValidRoomCode(code)) {
      setCodeError(`Room code must be ${ROOM_CODE_LENGTH} letters/numbers.`);
      return;
    }
    setBusy("join");
    setFormError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc("join_room", {
        p_code: code,
      });
      if (error) throw new Error(error.message);
      const room = data as RoomMatch;
      router.push(`/room/${room.room_code}`);
    } catch (err) {
      setFormError(friendlyErrorMessage((err as Error).message));
      setBusy(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void joinRoom(codeInput);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Create / join card */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-7">
        <p className="text-sm font-semibold text-slate-400">
          Welcome back, <span className="text-amber-300">{username}</span>
        </p>
        <h2 className="mt-1 text-2xl font-black text-white">Game lobby</h2>

        <button
          type="button"
          onClick={() => void createRoom()}
          disabled={busy !== null}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3.5 font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "create" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
          Create a new room
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-600">
          <span className="h-px flex-1 bg-slate-800" />
          or join
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="room-code"
              className="mb-1.5 block text-sm font-semibold text-slate-300"
            >
              Room code
            </label>
            <input
              id="room-code"
              value={codeInput}
              onChange={(e) => {
                setCodeInput(normalizeRoomCode(e.target.value));
                setCodeError(null);
              }}
              placeholder="ABC123"
              maxLength={ROOM_CODE_LENGTH}
              aria-invalid={Boolean(codeError)}
              aria-describedby={codeError ? "room-code-error" : undefined}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.4em] text-white placeholder:tracking-normal placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none focus:ring-4 focus:ring-amber-400/20"
            />
            {codeError && (
              <p id="room-code-error" role="alert" className="mt-1 text-xs font-semibold text-rose-400">
                {codeError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 font-bold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "join" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <DoorOpen className="h-5 w-5" />
            )}
            Join room
          </button>
        </form>

        {formError && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300"
          >
            {formError}
          </p>
        )}
      </section>

      {/* Open rooms list */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-7">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-black text-white">
            <Users className="h-5 w-5 text-sky-400" />
            Open rooms
          </h2>
          <button
            type="button"
            onClick={() => void loadOpenRooms()}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Refresh open rooms"
          >
            <RefreshCw className={`h-4 w-4 ${loadingRooms ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loadingRooms && openRooms.length === 0 ? (
          <p className="mt-6 text-center text-sm text-slate-500">Loading rooms…</p>
        ) : openRooms.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-8 text-center">
            <p className="text-sm text-slate-400">
              No open rooms yet — create one and invite a teammate with the
              six-character code.
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-3" data-testid="open-rooms-list">
            {openRooms.map((room) => (
              <li key={room.room_code}>
                <button
                  type="button"
                  onClick={() => void joinRoom(room.room_code)}
                  disabled={busy !== null}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/70 px-4 py-3.5 text-left transition hover:border-sky-500/60 hover:bg-slate-800 disabled:opacity-60"
                >
                  <span>
                    <span className="block font-mono text-lg font-black tracking-widest text-amber-300">
                      {room.room_code}
                    </span>
                    <span className="text-xs text-slate-400">
                      Host: {room.team_a_username ?? "—"} · free slot: Team{" "}
                      {room.free_slot}
                    </span>
                  </span>
                  <DoorOpen className="h-5 w-5 text-sky-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
