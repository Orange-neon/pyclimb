import { CheckCircle2, Clock3, Copy, LoaderCircle, LogOut, Play, Radio, Users } from "lucide-react";
import type { PyodideStatus } from "../hooks/usePyodide";
import type { RoomPlayer } from "../types/multiplayer";

interface RoomLobbyProps {
  role: "host" | "player";
  code: string;
  players: RoomPlayer[];
  durationSeconds: number;
  pythonStatus?: PyodideStatus;
  onDurationChange?: (minutes: number) => void;
  onStart?: () => void;
  onRetryPython?: () => void;
  onLeave: () => void;
}

export function RoomLobby({
  role,
  code,
  players,
  durationSeconds,
  pythonStatus,
  onDurationChange,
  onStart,
  onRetryPython,
  onLeave,
}: RoomLobbyProps) {
  const readyPlayers = players.filter((player) => player.ready).length;
  const allReady = players.length > 0 && readyPlayers === players.length;

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
          <button type="button" onClick={onLeave} className="flex items-center gap-2 text-sm text-slate-500 hover:text-rose-300">
            <LogOut size={16} /> {role === "host" ? "Close room" : "Leave room"}
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-4">
              <div className="flex items-center gap-2 font-black text-white"><Users size={18} /> Climbers</div>
              <span className="text-xs text-slate-500">{players.length}/30</span>
            </div>
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {players.map((player) => (
                <div key={player.uid} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-3">
                  <span className={`size-2.5 rounded-full ${player.online ? "bg-emerald-400" : "bg-slate-700"}`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-200">{player.nickname}</span>
                  {player.ready ? <CheckCircle2 size={16} className="text-emerald-300" /> : <LoaderCircle size={16} className="animate-spin text-slate-600" />}
                </div>
              ))}
              {!players.length && <p className="col-span-full py-12 text-center text-sm text-slate-600">Waiting for the first climber…</p>}
            </div>
          </section>

          <aside className="panel p-5">
            {role === "host" ? (
              <>
                <div className="mb-5 flex items-center gap-2 text-sm font-black text-white"><Clock3 size={17} /> Race length</div>
                <label className="text-xs text-slate-500" htmlFor="duration">Minutes</label>
                <input
                  id="duration"
                  type="number"
                  min={1}
                  max={120}
                  value={Math.round(durationSeconds / 60)}
                  onChange={(event) => onDurationChange?.(Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-white"
                />
                <p className="mt-3 text-xs leading-5 text-slate-600">Start unlocks when every connected student has loaded Python.</p>
                <button
                  type="button"
                  disabled={!allReady}
                  onClick={onStart}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-emerald-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Play size={17} /> Start race
                </button>
              </>
            ) : (
              <div className="text-center">
                <div className={`mx-auto grid size-14 place-items-center rounded-2xl ${pythonStatus === "ready" ? "bg-emerald-400/10 text-emerald-300" : "bg-sky-400/10 text-sky-300"}`}>
                  {pythonStatus === "ready" ? <CheckCircle2 size={27} /> : <Radio size={27} className="animate-pulse" />}
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
