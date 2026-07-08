import { Code2, RotateCcw, Trophy } from "lucide-react";
import { DIFFICULTIES, DIFFICULTY_CONFIG } from "../data/difficulty";
import type { Difficulty } from "../data/problemTypes";
import { BrandLogo } from "./BrandLogo";

interface NavbarProps {
  score: number;
  rank: number;
  remaining: Record<Difficulty, number>;
  activeDifficulty?: Difficulty;
  roomCode?: string;
  timeRemaining?: string;
  onSelectDifficulty: (difficulty: Difficulty) => void;
  onReset?: () => void;
}

const difficultyStyles: Record<Difficulty, string> = {
  easy: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20",
  hard: "border-rose-400/30 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20",
};

export function Navbar({
  score,
  rank,
  remaining,
  activeDifficulty,
  roomCode,
  timeRemaining,
  onSelectDifficulty,
  onReset,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#070b16]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <div className="mr-auto flex items-center gap-3">
          <BrandLogo className="size-10 rounded-xl object-contain shadow-lg shadow-sky-500/20" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white">Col</span>
              <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200">
                Sprint
              </span>
            </div>
            <p className="text-xs text-slate-500">Beginner Python race</p>
          </div>
        </div>

        <div className="order-3 flex w-full gap-2 overflow-x-auto py-1 md:order-none md:w-auto">
          {DIFFICULTIES.map((difficulty) => {
            const config = DIFFICULTY_CONFIG[difficulty];
            const exhausted = remaining[difficulty] === 0;
            return (
              <button
                key={difficulty}
                type="button"
                disabled={exhausted}
                onClick={() => onSelectDifficulty(difficulty)}
                className={`min-w-fit rounded-xl border px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${difficultyStyles[difficulty]} ${
                  activeDifficulty === difficulty ? "ring-2 ring-white/60" : ""
                }`}
              >
                {config.label} (+{config.points})
                <span className="ml-2 text-[11px] opacity-60">{remaining[difficulty]} left</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {roomCode && (
            <div className="hidden rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-center sm:block">
              <span className="block text-[9px] uppercase tracking-wider text-violet-300/60">Room</span>
              <strong className="font-mono text-sm tracking-widest text-violet-100">{roomCode}</strong>
            </div>
          )}
          {timeRemaining && (
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-center">
              <span className="block text-[9px] uppercase tracking-wider text-slate-500">Time</span>
              <strong className="font-mono text-sm text-white">{timeRemaining}</strong>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/80 px-3 py-2">
            <Trophy size={16} className="text-amber-300" />
            <div className="leading-none">
              <span className="block text-[10px] uppercase tracking-wider text-slate-500">Rank</span>
              <strong className="text-sm text-white">#{rank}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/80 px-3 py-2">
            <Code2 size={16} className="text-sky-300" />
            <div className="leading-none">
              <span className="block text-[10px] uppercase tracking-wider text-slate-500">Score</span>
              <strong className="text-sm text-white">{score.toLocaleString()}</strong>
            </div>
          </div>
          {onReset && (
            <button
              type="button"
              title="Reset sprint"
              aria-label="Reset sprint"
              onClick={onReset}
              className="grid size-10 place-items-center rounded-xl border border-slate-700/70 bg-slate-900/80 text-slate-400 transition hover:border-slate-600 hover:text-white"
            >
              <RotateCcw size={17} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
