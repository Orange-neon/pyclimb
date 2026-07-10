import { ArrowLeft, CheckCircle2, CircleX, History, Trophy, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { DIFFICULTY_CONFIG } from "../data/difficulty";
import type { ProblemBank } from "../data/problemTypes";
import type { GoogleUserProfile } from "../lib/firebase";
import {
  readCompletedRaceHistory,
  type RaceProblemStatus,
} from "../lib/raceHistory";
import { BrandLogo } from "./BrandLogo";

interface ProfilePageProps {
  bank: ProblemBank;
  authUser: GoogleUserProfile | null;
  onBack: () => void;
}

type StatusFilter = "all" | RaceProblemStatus;

export function ProfilePage({ bank, authUser, onBack }: ProfilePageProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const races = useMemo(() => readCompletedRaceHistory(), []);
  const byId = useMemo(() => new Map(bank.problems.map((problem) => [problem.id, problem])), [bank]);
  const totals = useMemo(() => {
    const problems = races.flatMap((race) => race.problems);
    return {
      races: races.length,
      solved: problems.filter((problem) => problem.status === "solved").length,
      notSolved: problems.filter((problem) => problem.status === "not-solved").length,
    };
  }, [races]);

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

          <div className="grid gap-3 p-5 sm:grid-cols-3">
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
          </div>
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
                          {new Date(race.finishedAt).toLocaleString()} · {race.mode === "solo" ? "Solo" : "Multiplayer"} · Bank {race.bankVersion}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <strong className="block text-base text-sky-200">{race.score} pts</strong>
                        Rank {race.rank}/{race.playerCount}
                      </div>
                    </div>
                    <div className="grid gap-2 p-3 sm:grid-cols-2">
                      {visible.map((outcome) => {
                        const problem = byId.get(outcome.problemId);
                        const solved = outcome.status === "solved";
                        return (
                          <article key={outcome.problemId} className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
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
                          </article>
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
    </main>
  );
}

