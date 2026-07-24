import {
  AlertTriangle,
  Clock3,
  Eye,
  LoaderCircle,
  LogOut,
  Radio,
  Square,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ProblemBank } from "../data/problemTypes";
import type {
  RaceActivity,
  RoomPlayer,
  RoomSpectator,
} from "../types/multiplayer";
import type { RaceEvent, Racer } from "../types/race";
import { LeaderboardTicker } from "./LeaderboardTicker";
import { ParticipantInspector } from "./ParticipantInspector";

interface HostDashboardProps {
  code: string;
  timeRemaining: string;
  players: RoomPlayer[];
  events: RaceEvent[];
  bank?: ProblemBank;
  activities?: Record<string, RaceActivity>;
  monitoringError?: string | null;
  spectators?: RoomSpectator[];
  canManage?: boolean;
  onMakeSpectator?: (uid: string) => void | Promise<void>;
  onMakePlayer?: (uid: string) => void | Promise<void>;
  onStop?: () => void;
  onLeave?: () => void;
}

export function HostDashboard({
  code,
  timeRemaining,
  players,
  events,
  bank,
  activities = {},
  monitoringError,
  spectators = [],
  canManage,
  onMakeSpectator,
  onMakePlayer,
  onStop,
  onLeave,
}: HostDashboardProps) {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [promotingUid, setPromotingUid] = useState<string | null>(null);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const managementEnabled = canManage ?? Boolean(onStop || onMakeSpectator || onMakePlayer);
  const racers: Racer[] = players.map((player) => ({
    id: player.uid,
    name: player.nickname,
    score: player.score,
    online: player.online,
  }));
  const selectedPlayer = players.find((player) => player.uid === selectedUid) ?? null;
  const selectedActivity = selectedUid ? activities[selectedUid] ?? null : null;
  const selectedProblem =
    selectedActivity && bank
      ? bank.problems.find((problem) => problem.id === selectedActivity.problemId) ?? null
      : null;

  useEffect(() => {
    if (selectedUid && !players.some((player) => player.uid === selectedUid)) {
      setSelectedUid(null);
    }
  }, [players, selectedUid]);

  const makePlayer = async (spectator: RoomSpectator) => {
    if (!onMakePlayer || promotingUid) return;
    setPromotingUid(spectator.uid);
    setPromotionError(null);
    try {
      await onMakePlayer(spectator.uid);
    } catch (reason) {
      setPromotionError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPromotingUid(null);
    }
  };

  return (
    <main className="grid-glow min-h-screen bg-[#070b16] px-4 py-8 text-slate-100">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] ${
                managementEnabled ? "text-emerald-300" : "text-violet-300"
              }`}
            >
              {managementEnabled ? (
                <Radio size={13} className="animate-pulse" />
              ) : (
                <Eye size={13} />
              )}
              {managementEnabled ? "Race live" : "Spectator view"}
            </p>
            <h1 className="mt-1 font-mono text-3xl font-black tracking-[0.22em] text-white">
              {code}
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
              <Clock3 size={18} className="text-sky-300" />
              <strong className="font-mono text-xl">{timeRemaining}</strong>
            </div>
            {managementEnabled && onStop && (
              <button
                type="button"
                onClick={onStop}
                className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-black text-rose-200 hover:bg-rose-400/20"
              >
                <Square size={15} /> Stop now
              </button>
            )}
            {onLeave && (
              <button
                type="button"
                onClick={onLeave}
                className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-400 hover:border-rose-400/30 hover:text-rose-200"
              >
                <LogOut size={15} /> Leave room
              </button>
            )}
          </div>
        </header>

        {monitoringError && (
          <div
            className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
            role="alert"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
            <span>{monitoringError}</span>
          </div>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(28rem,1.2fr)]">
          <div className="grid gap-4">
            <LeaderboardTicker
              racers={racers}
              events={events}
              selectedRacerId={selectedUid}
              onRacerSelect={setSelectedUid}
            />

            {spectators.length > 0 && (
              <section className="panel overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-700/70 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-black text-white">
                    <Eye size={16} className="text-violet-300" /> Spectators
                  </div>
                  <span className="text-xs text-slate-500">{spectators.length}</span>
                </div>
                <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {spectators.map((spectator) => (
                    <div
                      key={spectator.uid}
                      className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/45 px-3 py-2.5"
                    >
                      <span
                        className={`size-2.5 shrink-0 rounded-full ${
                          spectator.online ? "bg-emerald-400" : "bg-slate-700"
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-300">
                        {spectator.nickname}
                      </span>
                      {managementEnabled && onMakePlayer ? (
                        <button
                          type="button"
                          disabled={Boolean(promotingUid)}
                          onClick={() => void makePlayer(spectator)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-black text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-wait disabled:opacity-50"
                          aria-label={`Make ${spectator.nickname} a contestant`}
                        >
                          {promotingUid === spectator.uid ? (
                            <LoaderCircle size={11} className="animate-spin" />
                          ) : (
                            <UserRoundPlus size={11} />
                          )}
                          Compete
                        </button>
                      ) : (
                        <Eye size={13} className="shrink-0 text-violet-300/70" />
                      )}
                    </div>
                  ))}
                </div>
                {promotionError && (
                  <p
                    className="border-t border-rose-400/20 bg-rose-400/10 px-4 py-2 text-xs text-rose-200"
                    role="alert"
                  >
                    {promotionError}
                  </p>
                )}
              </section>
            )}

            {!players.length && (
              <section className="panel flex items-center gap-3 p-4 text-sm text-slate-500">
                <Users size={18} className="text-slate-600" />
                There are no contestants in the race.
              </section>
            )}
          </div>

          <ParticipantInspector
            player={selectedPlayer}
            problem={selectedProblem}
            activity={selectedActivity}
            canManage={managementEnabled}
            onMakeSpectator={managementEnabled ? onMakeSpectator : undefined}
          />
        </div>
      </div>
    </main>
  );
}
