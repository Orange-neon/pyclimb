import {
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  Infinity as InfinityIcon,
  LoaderCircle,
  LogOut,
  Play,
  Radio,
  UserRoundMinus,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { PyodideStatus } from "../hooks/usePyodide";
import type { RoomPlayer, RoomSpectator } from "../types/multiplayer";

interface RoomLobbyProps {
  role: "host" | "player" | "spectator";
  code: string;
  players: RoomPlayer[];
  spectators?: RoomSpectator[];
  durationSeconds: number;
  unlimited: boolean;
  pythonStatus?: PyodideStatus;
  onDurationChange?: (minutes: number) => void;
  onUnlimitedChange?: (unlimited: boolean) => void;
  onStart?: () => void;
  onRetryPython?: () => void;
  onMakeSpectator?: (uid: string) => void | Promise<void>;
  onMakePlayer?: (uid: string) => void | Promise<void>;
  onLeave: () => void;
}

export function RoomLobby({
  role,
  code,
  players,
  spectators = [],
  durationSeconds,
  unlimited,
  pythonStatus,
  onDurationChange,
  onUnlimitedChange,
  onStart,
  onRetryPython,
  onMakeSpectator,
  onMakePlayer,
  onLeave,
}: RoomLobbyProps) {
  const [assigningUid, setAssigningUid] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const readyPlayers = players.filter((player) => player.ready).length;
  const allReady = players.length > 0 && players.every((player) => player.ready);
  const participantCount = players.length + spectators.length;

  const makeSpectator = async (player: RoomPlayer) => {
    if (!onMakeSpectator || assigningUid) return;
    setAssigningUid(player.uid);
    setAssignmentError(null);
    try {
      await onMakeSpectator(player.uid);
    } catch (reason) {
      setAssignmentError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setAssigningUid(null);
    }
  };

  const makePlayer = async (spectator: RoomSpectator) => {
    if (!onMakePlayer || assigningUid) return;
    setAssigningUid(spectator.uid);
    setAssignmentError(null);
    try {
      await onMakePlayer(spectator.uid);
    } catch (reason) {
      setAssignmentError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setAssigningUid(null);
    }
  };

  return (
    <main className="grid-glow min-h-screen bg-[#070b16] px-4 py-8 text-slate-100">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Col room</p>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="font-mono text-3xl font-black tracking-[0.24em] text-white">{code}</h1>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(code)}
                className="grid size-9 place-items-center rounded-lg border border-slate-700 text-slate-500 hover:text-white"
                aria-label="Copy room code"
              >
                <Copy size={15} />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onLeave}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-rose-300"
          >
            <LogOut size={16} /> {role === "host" ? "Close room" : "Leave room"}
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-4">
              <div className="flex items-center gap-2 font-black text-white">
                <Users size={18} /> Participants
              </div>
              <span className="text-xs text-slate-500">{participantCount}/30</span>
            </div>

            <div className="flex items-center justify-between px-4 pb-1 pt-4">
              <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Contestants
              </h2>
              <span className="text-[10px] font-bold text-slate-600">
                {readyPlayers}/{players.length} ready
              </span>
            </div>
            <div className="grid gap-2 p-4 pt-2 sm:grid-cols-2">
              {players.map((player) => (
                <div
                  key={player.uid}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-3"
                >
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${
                      player.online ? "bg-emerald-400" : "bg-slate-700"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-200">
                    {player.nickname}
                  </span>
                  {player.ready ? (
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />
                  ) : (
                    <LoaderCircle size={16} className="shrink-0 animate-spin text-slate-600" />
                  )}
                  {role === "host" && onMakeSpectator && (
                    <button
                      type="button"
                      disabled={Boolean(assigningUid)}
                      onClick={() => void makeSpectator(player)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-400/25 bg-violet-400/10 px-2 py-1.5 text-[10px] font-black text-violet-200 transition hover:bg-violet-400/20 disabled:cursor-wait disabled:opacity-50"
                      aria-label={`Make ${player.nickname} a spectator`}
                    >
                      {assigningUid === player.uid ? (
                        <LoaderCircle size={12} className="animate-spin" />
                      ) : (
                        <UserRoundMinus size={12} />
                      )}
                      Spectate
                    </button>
                  )}
                </div>
              ))}
              {!players.length && (
                <p className="col-span-full py-8 text-center text-sm text-slate-600">
                  Waiting for the first contestant…
                </p>
              )}
            </div>

            {assignmentError && (
              <p
                className="border-t border-rose-400/20 bg-rose-400/10 px-4 py-2 text-xs text-rose-200"
                role="alert"
              >
                {assignmentError}
              </p>
            )}

            {spectators.length > 0 && (
              <div className="border-t border-slate-800">
                <div className="flex items-center justify-between px-4 pb-1 pt-4">
                  <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-violet-300">
                    <Eye size={14} /> Spectators
                  </h2>
                  <span className="text-[10px] text-slate-600">{spectators.length}</span>
                </div>
                <div className="grid gap-2 p-4 pt-2 sm:grid-cols-2">
                  {spectators.map((spectator) => (
                    <div
                      key={spectator.uid}
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-violet-400/15 bg-violet-400/5 px-3 py-3"
                    >
                      <span
                        className={`size-2.5 shrink-0 rounded-full ${
                          spectator.online ? "bg-emerald-400" : "bg-slate-700"
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-300">
                        {spectator.nickname}
                      </span>
                      {role === "host" && onMakePlayer ? (
                        <button
                          type="button"
                          disabled={Boolean(assigningUid)}
                          onClick={() => void makePlayer(spectator)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1.5 text-[10px] font-black text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-wait disabled:opacity-50"
                          aria-label={`Make ${spectator.nickname} a contestant`}
                        >
                          {assigningUid === spectator.uid ? (
                            <LoaderCircle size={12} className="animate-spin" />
                          ) : (
                            <UserRoundPlus size={12} />
                          )}
                          Compete
                        </button>
                      ) : (
                        <Eye size={15} className="shrink-0 text-violet-300/70" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="panel p-5">
            {role === "host" ? (
              <>
                <div className="mb-5 flex items-center gap-2 text-sm font-black text-white">
                  <Clock3 size={17} /> Race length
                </div>
                <button
                  type="button"
                  aria-pressed={unlimited}
                  onClick={() => onUnlimitedChange?.(!unlimited)}
                  className={`mb-4 flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                    unlimited
                      ? "border-violet-400/40 bg-violet-400/10 text-violet-200"
                      : "border-slate-700 bg-slate-950/50 text-slate-400"
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <InfinityIcon size={16} /> Unlimited
                  </span>
                  <span className={`h-5 w-9 rounded-full p-0.5 ${unlimited ? "bg-violet-400" : "bg-slate-700"}`}>
                    <span
                      className={`block size-4 rounded-full bg-white transition ${
                        unlimited ? "translate-x-4" : ""
                      }`}
                    />
                  </span>
                </button>
                <label className="text-xs text-slate-500" htmlFor="duration">
                  Minutes
                </label>
                <input
                  id="duration"
                  type="number"
                  min={1}
                  max={120}
                  disabled={unlimited}
                  value={Math.round(durationSeconds / 60)}
                  onChange={(event) => onDurationChange?.(Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-white disabled:cursor-not-allowed disabled:opacity-35"
                />
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  {unlimited
                    ? "The race continues until the host ends it."
                    : "Timed races can run for up to two hours."}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  Start unlocks when every contestant has loaded Python. Spectators do not need to
                  be ready.
                </p>
                <button
                  type="button"
                  disabled={!allReady}
                  onClick={onStart}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-emerald-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Play size={17} /> Start race
                </button>
              </>
            ) : role === "spectator" ? (
              <div className="text-center">
                {unlimited && (
                  <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-200">
                    <InfinityIcon size={12} /> Unlimited marathon
                  </p>
                )}
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-violet-400/10 text-violet-300">
                  <Eye size={27} />
                </div>
                <h2 className="mt-4 font-black text-white">Ready to spectate</h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  You will be able to view contestants&apos; problems and code after the race
                  begins. You will not appear in the standings.
                </p>
              </div>
            ) : (
              <div className="text-center">
                {unlimited && (
                  <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-200">
                    <InfinityIcon size={12} /> Unlimited marathon
                  </p>
                )}
                <div
                  className={`mx-auto grid size-14 place-items-center rounded-2xl ${
                    pythonStatus === "ready"
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-sky-400/10 text-sky-300"
                  }`}
                >
                  {pythonStatus === "ready" ? (
                    <CheckCircle2 size={27} />
                  ) : (
                    <Radio size={27} className="animate-pulse" />
                  )}
                </div>
                <h2 className="mt-4 font-black text-white">
                  {pythonStatus === "ready"
                    ? "Ready to climb"
                    : pythonStatus === "error"
                      ? "Python did not load"
                      : "Warming up Python"}
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {pythonStatus === "ready"
                    ? "Waiting for the host to begin."
                    : pythonStatus === "error"
                      ? "Check this browser's network connection and retry."
                      : "The editor and Python engine are loading before the clock starts."}
                </p>
                <p className="mt-3 text-[11px] leading-5 text-slate-600">
                  During the race, the host and spectators can view your current problem and code
                  live.
                </p>
                {pythonStatus === "error" && onRetryPython && (
                  <button
                    type="button"
                    onClick={onRetryPython}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-200"
                  >
                    Retry Python
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
