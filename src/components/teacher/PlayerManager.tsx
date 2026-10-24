"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Ban,
  CheckCircle2,
  Dices,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  UserPlus,
  Users,
} from "lucide-react";
import {
  canonicalPlayerName,
  generateAccessCode,
  MIN_PLAYER_ACCESS_CODE_LENGTH,
  validateAccessCode,
  validatePlayerName,
} from "@/lib/accessCredentials";
import { friendlyErrorMessage } from "@/lib/forms";
import type { ManagedPlayer } from "@/lib/types";

interface CredentialNotice {
  name: string;
  code: string;
  action: "created" | "reset";
}

async function playerApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  } & T;

  if (!response.ok) {
    throw new Error(payload.code ?? payload.error ?? "Player account request failed.");
  }
  return payload;
}

export function PlayerManager() {
  const [players, setPlayers] = useState<ManagedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<CredentialNotice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetCodes, setResetCodes] = useState<Record<string, string>>({});
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await playerApi<{ players: ManagedPlayer[] }>("/api/admin/players");
      setPlayers(data.players ?? []);
      setFormError(null);
    } catch (error) {
      setFormError(friendlyErrorMessage((error as Error).message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPlayer(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const nextNameError = validatePlayerName(name);
    const nextCodeError = validateAccessCode(code);
    setNameError(nextNameError);
    setCodeError(nextCodeError);
    if (nextNameError || nextCodeError) return;

    const submittedName = canonicalPlayerName(name);
    const submittedCode = code;
    setSubmitting(true);
    try {
      const data = await playerApi<{ player: ManagedPlayer }>("/api/admin/players", {
        method: "POST",
        body: JSON.stringify({ name: submittedName, code: submittedCode }),
      });
      setNotice({
        name: data.player?.name ?? submittedName,
        code: submittedCode,
        action: "created",
      });
      setName("");
      setCode("");
      await load();
    } catch (error) {
      setFormError(friendlyErrorMessage((error as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  async function resetCode(player: ManagedPlayer) {
    const nextCode = resetCodes[player.id] ?? "";
    const error = validateAccessCode(nextCode);
    if (error) {
      setFormError(error);
      return;
    }

    setBusyPlayerId(player.id);
    setFormError(null);
    setNotice(null);
    try {
      await playerApi(`/api/admin/players/${player.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reset_code", code: nextCode }),
      });
      setNotice({ name: player.name, code: nextCode, action: "reset" });
      setResetCodes((previous) => ({ ...previous, [player.id]: "" }));
    } catch (requestError) {
      setFormError(friendlyErrorMessage((requestError as Error).message));
    } finally {
      setBusyPlayerId(null);
    }
  }

  async function setDisabled(player: ManagedPlayer, disabled: boolean) {
    setBusyPlayerId(player.id);
    setFormError(null);
    setNotice(null);
    try {
      await playerApi(`/api/admin/players/${player.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "set_disabled", disabled }),
      });
      setPlayers((previous) =>
        previous.map((entry) =>
          entry.id === player.id ? { ...entry, disabled } : entry,
        ),
      );
    } catch (error) {
      setFormError(friendlyErrorMessage((error as Error).message));
    } finally {
      setBusyPlayerId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-7">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-white">
              <Users className="h-5 w-5 text-amber-300" /> Player accounts
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
              Add each student with a unique name and a private access code.
              Students sign in with those two values only — they cannot create
              their own accounts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Refresh player accounts"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <form onSubmit={addPlayer} noValidate className="rounded-2xl bg-slate-950/40 p-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Player name" error={nameError ?? undefined}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Exact name for sign-in"
                className="input"
                aria-label="Player name"
                dir="auto"
                autoComplete="off"
              />
            </Field>

            <Field label="Access code" error={codeError ?? undefined}>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder={`At least ${MIN_PLAYER_ACCESS_CODE_LENGTH} characters`}
                  className="input"
                  aria-label="Access code"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setCode(generateAccessCode(8))}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
                >
                  <Dices className="h-4 w-4" /> Generate
                </button>
              </div>
            </Field>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <UserPlus className="h-5 w-5" />
              )}
              Add player
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            If two students share the same name, make each sign-in name unique
            by adding a middle or family name. Names can be Arabic or English.
          </p>
        </form>

        {notice && (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            <p className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="h-5 w-5" />
              {notice.action === "created" ? "Player added." : "Access code reset."}
            </p>
            <p className="mt-1">
              Give <strong dir="auto">{notice.name}</strong> this code now:{" "}
              <code className="rounded-md bg-slate-950/60 px-2 py-1 font-black tracking-wider text-amber-300">
                {notice.code}
              </code>
            </p>
            <p className="mt-1 text-xs text-emerald-300/80">
              Codes cannot be viewed later; reset the code if it is lost.
            </p>
          </div>
        )}

        {formError && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300"
          >
            {formError}
          </p>
        )}

        <div className="mt-6">
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading players…
            </p>
          ) : players.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
              No players yet — add the first student above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" data-testid="player-table">
                <thead className="text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Reset code</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.id} className="border-t border-slate-800 align-middle">
                      <td className="py-3 pr-4 font-bold text-slate-100" dir="auto">
                        {player.name}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            player.disabled
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {player.disabled ? "Disabled" : "Active"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex min-w-56 gap-2">
                          <input
                            value={resetCodes[player.id] ?? ""}
                            onChange={(event) =>
                              setResetCodes((previous) => ({
                                ...previous,
                                [player.id]: event.target.value,
                              }))
                            }
                            placeholder="New code"
                            className="input"
                            aria-label={`New code for ${player.name}`}
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            onClick={() => void resetCode(player)}
                            disabled={busyPlayerId === player.id}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                            aria-label={`Reset code for ${player.name}`}
                          >
                            {busyPlayerId === player.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <KeyRound className="h-4 w-4" />
                            )}
                            Reset
                          </button>
                        </div>
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => void setDisabled(player, !player.disabled)}
                          disabled={busyPlayerId === player.id}
                          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                          aria-label={`${player.disabled ? "Enable" : "Disable"} ${player.name}`}
                        >
                          {player.disabled ? (
                            <RotateCcw className="h-4 w-4" />
                          ) : (
                            <Ban className="h-4 w-4" />
                          )}
                          {player.disabled ? "Enable" : "Disable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-slate-300">{label}</p>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-xs font-semibold text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
