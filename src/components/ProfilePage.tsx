import {
  ArrowLeft,
  CheckCircle2,
  CircleX,
  Gauge,
  History,
  RotateCcw,
  Trophy,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DIFFICULTY_CONFIG } from "../data/difficulty";
import { loadProblemBank } from "../data/problemBank";
import type { Problem, ProblemBank } from "../data/problemTypes";
import type { GoogleUserProfile } from "../lib/firebase";
import {
  markRaceProblemSolved,
  readCompletedRaceHistory,
  type RaceProblemStatus,
} from "../lib/raceHistory";
import { calculateProfileRating, getRaceDuration } from "../lib/profileRating";
import { BrandLogo } from "./BrandLogo";
import { HistoryRetryModal } from "./HistoryRetryModal";

interface ProfilePageProps {
  bank: ProblemBank;
  authUser: GoogleUserProfile | null;
  onBack: () => void;
}

type StatusFilter = "all" | RaceProblemStatus;

interface RetrySelection {
  raceId: string;
  problem: Problem;
  solved: boolean;
}

function problemKey(bankVersion: string, problemId: string): string {
  return `${bankVersion}:${problemId}`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 60_000) return "<1m";
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function ProfilePage({ bank, authUser, onBack }: ProfilePageProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [races, setRaces] = useState(readCompletedRaceHistory);
  const [banksByVersion, setBanksByVersion] = useState<Record<string, ProblemBank>>({
    [bank.version]: bank,
  });
  const unavailableBankVersions = useRef(new Set<string>());
  const [retrySelection, setRetrySelection] = useState<RetrySelection | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBanksByVersion((current) =>
      current[bank.version] === bank ? current : { ...current, [bank.version]: bank },
    );
    const missingVersions = [...new Set(races.map((race) => race.bankVersion))].filter(
      (version) =>
        version !== bank.version &&
        !banksByVersion[version] &&
        !unavailableBankVersions.current.has(version),
    );
    if (missingVersions.length) {
      void Promise.all(
        missingVersions.map((version) => loadProblemBank(version).catch(() => null)),
      ).then((loadedBanks) => {
        if (cancelled) return;
        loadedBanks.forEach((loaded, index) => {
          if (!loaded) unavailableBankVersions.current.add(missingVersions[index]);
        });
        if (!loadedBanks.some(Boolean)) return;
        setBanksByVersion((current) => {
          const next = { ...current };
          for (const loaded of loadedBanks) {
            if (loaded) next[loaded.version] = loaded;
          }
          return next;
        });
      });
    }
    return () => {
      cancelled = true;
    };
  }, [bank, banksByVersion, races]);

  const problemsByVersion = useMemo(() => {
    const index = new Map<string, Problem>();
    for (const loadedBank of Object.values(banksByVersion)) {
      for (const problem of loadedBank.problems) {
        index.set(problemKey(loadedBank.version, problem.id), problem);
      }
    }
    return index;
  }, [banksByVersion]);
  const totals = useMemo(() => {
    const problems = races.flatMap((race) => race.problems);
    return {
      races: races.length,
      solved: problems.filter((problem) => problem.status === "solved").length,
      notSolved: problems.filter((problem) => problem.status === "not-solved").length,
    };
  }, [races]);
  const rating = useMemo(
    () =>
      calculateProfileRating(races, (race, outcome) =>
        problemsByVersion.get(problemKey(race.bankVersion, outcome.problemId)),
      ),
    [problemsByVersion, races],
  );
  const hasVisibleProblems = useMemo(
    () =>
      races.some((race) =>
        race.problems.some((problem) => filter === "all" || problem.status === filter),
      ),
    [filter, races],
  );
  const closeRetry = useCallback(() => setRetrySelection(null), []);
  const solveRetry = useCallback(() => {
    if (!retrySelection) return;
    setRaces(markRaceProblemSolved(retrySelection.raceId, retrySelection.problem.id));
  }, [retrySelection]);

  return (
    <main className="grid-glow min-h-screen bg-[#070b16] px-4 py-8 text-slate-100">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft size={16} /> Home
          </button>
          <BrandLogo className="size-10 rounded-xl object-contain" />
        </div>

        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-700/70 p-6">
            {authUser?.photoURL ? (
              <img
                src={authUser.photoURL}
                alt=""
                referrerPolicy="no-referrer"
                className="size-16 rounded-2xl object-cover"
              />
            ) : (
              <div className="grid size-16 place-items-center rounded-2xl bg-sky-400/10 text-sky-300">
                <UserRound size={30} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">User profile</p>
              <h1 className="mt-1 truncate text-3xl font-black text-white">
                {authUser?.displayName ?? "Local racer"}
              </h1>
              <p className="mt-1 truncate text-sm text-slate-500">
                {authUser?.email ?? "Race history saved in this browser"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Finished races", value: totals.races, icon: Trophy, tone: "text-amber-300" },
              { label: "Solved", value: totals.solved, icon: CheckCircle2, tone: "text-emerald-300" },
              { label: "Not solved", value: totals.notSolved, icon: CircleX, tone: "text-rose-300" },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <Icon size={18} className={tone} />
                <strong className="mt-3 block text-2xl font-black text-white">{value}</strong>
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            ))}
            <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.07] p-4">
              <Gauge size={18} className="text-sky-300" />
              <strong className="mt-3 block text-2xl font-black text-white">
                {rating.overall}<span className="text-sm text-slate-500">/100</span>
              </strong>
              <span className="text-xs text-slate-500">Overall rating</span>
              <div className="mt-3 grid grid-cols-3 gap-1 border-t border-sky-400/10 pt-2 text-center text-[9px] uppercase tracking-wider text-slate-500">
                <span>Points <b className="block text-slate-300">{rating.points}</b></span>
                <span>Accuracy <b className="block text-slate-300">{rating.accuracy}</b></span>
                <span>Pace <b className="block text-slate-300">{rating.pace}</b></span>
              </div>
            </div>
          </div>
          <p className="border-t border-slate-800 px-5 py-3 text-[11px] leading-5 text-slate-600">
            Rating: 45% point efficiency, 35% solved accuracy, and 20% difficulty-adjusted pace. Retry solves improve accuracy without changing original race points.
          </p>
        </section>

        <section className="mt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <History size={19} className="text-sky-300" /> Previous race problems
              </h2>
              <p className="mt-1 text-xs text-slate-500">Only completed races and ended solo sessions appear here.</p>
            </div>
            <div className="flex rounded-xl border border-slate-800 bg-slate-950/60 p-1">
              {([
                ["all", "All"],
                ["solved", "Solved"],
                ["not-solved", "Not solved"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                    filter === value ? "bg-sky-400 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!races.length ? (
            <div className="panel py-16 text-center">
              <History className="mx-auto text-slate-700" size={34} />
              <h3 className="mt-4 font-black text-slate-300">No finished races yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                Finish a class race, or quit a solo practice after opening problems, to build your history.
              </p>
            </div>
          ) : !hasVisibleProblems ? (
            <div className="panel py-14 text-center">
              <CheckCircle2 className="mx-auto text-emerald-400/60" size={34} />
              <h3 className="mt-4 font-black text-slate-300">
                {filter === "not-solved" ? "No unsolved problems left" : "No problems in this category"}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {filter === "not-solved"
                  ? "Solved retries stay available under All and Solved."
                  : "Choose another history filter to see your problems."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {races.map((race) => {
                const visible = race.problems.filter((problem) => filter === "all" || problem.status === filter);
                if (!visible.length) return null;
                return (
                  <section key={race.id} className="panel overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
                      <div>
                        <h3 className="font-black text-white">{race.label}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(race.finishedAt).toLocaleString()} · {race.mode === "solo" ? "Solo" : "Multiplayer"} · Bank {race.bankVersion} · {formatDuration(getRaceDuration(race))}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <strong className="block text-base text-sky-200">{race.score} pts</strong>
                        Rank {race.rank}/{race.playerCount}
                      </div>
                    </div>
                    <div className="grid gap-2 p-3 sm:grid-cols-2">
                      {visible.map((outcome) => {
                        const problem = problemsByVersion.get(problemKey(race.bankVersion, outcome.problemId));
                        const solved = outcome.status === "solved";
                        return (
                          <button
                            key={outcome.problemId}
                            type="button"
                            disabled={!problem}
                            onClick={() => {
                              if (problem) {
                                setRetrySelection({ raceId: race.id, problem, solved });
                              }
                            }}
                            className="group rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-left transition hover:border-sky-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="truncate text-sm font-black text-white">
                                  {problem?.title ?? outcome.problemId}
                                </h4>
                                <p className="mt-1 text-xs text-slate-600">
                                  {problem ? DIFFICULTY_CONFIG[problem.difficulty].label : "Archived problem"}
                                </p>
                              </div>
                              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase ${
                                solved
                                  ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                                  : "border-rose-400/25 bg-rose-400/10 text-rose-200"
                              }`}>
                                {solved ? <CheckCircle2 size={12} /> : <CircleX size={12} />}
                                {solved ? "Solved" : "Not solved"}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800/80 pt-2 text-[11px] text-slate-600">
                              <span className="truncate">{problem?.tags.join(" · ") ?? "Problem details unavailable"}</span>
                              {problem && (
                                <span className="inline-flex shrink-0 items-center gap-1 font-bold text-sky-300 transition group-hover:text-sky-200">
                                  <RotateCcw size={12} /> {solved ? "Practice again" : "Try again"}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {retrySelection && (
        <HistoryRetryModal
          problem={retrySelection.problem}
          solved={retrySelection.solved}
          onSolved={solveRetry}
          onClose={closeRetry}
        />
      )}
    </main>
  );
}
