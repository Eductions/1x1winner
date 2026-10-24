"use client";

import { useMemo, useState } from "react";
import { Wifi, RotateCcw, Check, X, Building2 } from "lucide-react";
import { Tower } from "@/components/Tower";
import { CelebrationModal, type EarnedBadge } from "@/components/CelebrationModal";
import { applyAnswerToRoom, earnBadges } from "@/lib/gameLogic";
import {
  FLOOR_COUNT,
  TEAM_META,
  type AnswerKey,
  type Question,
  type RoomAnswer,
  type RoomMatch,
  type TeamSide,
} from "@/lib/types";

const PLAYER_A = "11111111-1111-1111-1111-111111111111";
const PLAYER_B = "22222222-2222-2222-2222-222222222222";

function makeMockRoom(): RoomMatch {
  return {
    id: "demo-room-id",
    room_code: "ENGL10",
    status: "playing",
    created_by: PLAYER_A,
    team_a_player_id: PLAYER_A,
    team_b_player_id: PLAYER_B,
    team_a_position: 0,
    team_b_position: 0,
    current_turn: "A",
    current_question_id: "q-1",
    winner: null,
    version: 0,
    started_at: new Date().toISOString(),
    finished_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

const MOCK_QUESTION: Pick<Question, "correct_key"> = { correct_key: "A" };

export default function DemoPage() {
  const [room, setRoom] = useState<RoomMatch>(makeMockRoom);
  const [history, setHistory] = useState<RoomAnswer[]>([]);
  const [connected] = useState(true);

  const badges: EarnedBadge[] = useMemo(
    () =>
      earnBadges(room, history.map((h) => ({ team: h.team, is_correct: h.is_correct }))),
    [room, history],
  );

  function simulateAnswer(team: TeamSide, correct: boolean) {
    if (room.status !== "playing" || room.current_turn !== team) return;

    const questionId = room.current_question_id ?? "q-1";
    const selectedKey: AnswerKey = correct ? "A" : "B";

    // Same pure function the Realtime flow relies on; the Postgres RPC
    // answer_question enforces identical rules server-side.
    const next = applyAnswerToRoom(room, {
      team,
      playerId: team === "A" ? PLAYER_A : PLAYER_B,
      questionId,
      selectedKey,
      question: MOCK_QUESTION,
      alreadyAnswered: false,
    });

    setHistory((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        room_id: room.id,
        question_id: questionId,
        team,
        player_id: team === "A" ? PLAYER_A : PLAYER_B,
        selected_key: selectedKey,
        is_correct: correct,
        created_at: new Date().toISOString(),
      },
    ]);
    // Each turn gets a fresh question id, mirroring draw-next-question in RPC.
    next.current_question_id = `q-${next.version + 1}`;
    setRoom(next);
  }

  function reset() {
    setRoom(makeMockRoom());
    setHistory([]);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <header className="mb-10 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-sm text-slate-300">
          <Building2 className="h-4 w-4 text-amber-300" />
          Offline demo · no account needed
        </div>
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
          Tower of <span className="text-amber-300">English</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Two teams race up {FLOOR_COUNT} floors. Every correct English answer
          climbs one floor — first team to the top wins.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Tower board */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300">
                Room · {room.room_code}
              </span>
              <span
                className={`rounded-lg px-3 py-1.5 ${
                  room.status === "finished"
                    ? "bg-amber-400/15 text-amber-300"
                    : "bg-emerald-400/15 text-emerald-300"
                }`}
              >
                {room.status === "finished" ? "Finished" : "Live match"}
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                connected ? "bg-sky-400/15 text-sky-300" : "bg-rose-400/15 text-rose-300"
              }`}
            >
              <Wifi className="h-4 w-4" />
              Simulated connection
            </span>
          </div>

          <Tower
            teamAPosition={room.team_a_position}
            teamBPosition={room.team_b_position}
            winner={room.winner}
            status={room.status}
          />

          <p className="mt-6 text-center text-sm text-slate-400">
            {room.status === "finished" ? (
              <span className="font-bold text-amber-300">
                {room.winner ? TEAM_META[room.winner].name : ""} reached the top — game over.
              </span>
            ) : (
              <>
                Current turn:{" "}
                <span className="font-bold text-white">
                  {TEAM_META[room.current_turn].name}
                </span>
              </>
            )}
          </p>
        </section>

        {/* Control panel */}
        <aside className="space-y-5">
          {(["A", "B"] as TeamSide[]).map((team) => {
            const meta = TEAM_META[team];
            const isTurn = room.current_turn === team && room.status === "playing";
            return (
              <div
                key={team}
                className={`rounded-2xl border p-5 transition ${
                  isTurn ? "border-slate-500 bg-slate-800/80" : "border-slate-800 bg-slate-900/60"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-lg font-black text-white">{meta.name}</span>
                  <span className="text-sm font-semibold text-slate-400">
                    Floor {team === "A" ? room.team_a_position : room.team_b_position}/
                    {FLOOR_COUNT}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!isTurn}
                    onClick={() => simulateAnswer(team, true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Check className="h-4 w-4" /> Correct
                  </button>
                  <button
                    type="button"
                    disabled={!isTurn}
                    onClick={() => simulateAnswer(team, false)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-500 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <X className="h-4 w-4" /> Wrong
                  </button>
                </div>
                {isTurn && (
                  <p className="mt-2 text-xs font-semibold text-amber-300">
                    Waiting for an answer…
                  </p>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={reset}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
          >
            <RotateCcw className="h-4 w-4" /> Reset match
          </button>
        </aside>
      </div>

      <CelebrationModal
        open={room.status === "finished"}
        winner={room.winner}
        badges={badges}
        onPlayAgain={reset}
      />
    </main>
  );
}
