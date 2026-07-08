import { Crown, Swords } from "lucide-react";
import { DIFFICULTIES, DIFFICULTY_CONFIG } from "../data/difficulty";
import type { Difficulty } from "../data/problemTypes";
import type { RoomChallenge } from "../types/multiplayer";

interface ChallengePanelProps {
  challenge: RoomChallenge | null;
  streak: number;
  canChallenge: boolean;
  onChallenge: (difficulty: Difficulty) => void;
}

export function ChallengePanel({
  challenge,
  streak,
  canChallenge,
  onChallenge,
}: ChallengePanelProps) {
  return (
    <section className="panel overflow-hidden border-amber-400/20">
      <div className="flex items-center gap-2 border-b border-slate-700/70 px-4 py-3 text-sm font-black text-white">
        <Swords size={17} className="text-amber-300" /> Challenge the leader
      </div>
      <div className="p-4">
        {challenge && challenge.status !== "finished" ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100">
            <p className="flex items-center gap-2 font-black">
              <Crown size={14} /> {challenge.challengerName} vs. {challenge.championName}
            </p>
            <p className="mt-1 text-amber-100/65">
              {challenge.status === "waiting"
                ? `Waiting for ${challenge.championName} to finish their current problem.`
                : `${DIFFICULTY_CONFIG[challenge.difficulty].label} head-to-head is live—the first accepted solution wins.`}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs leading-5 text-slate-500">
              Build a five-problem streak, then choose the category and race first place.
              Your current streak is <strong className="text-sky-200">{streak}/5</strong>.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  disabled={!canChallenge}
                  onClick={() => onChallenge(difficulty)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-[11px] font-black text-slate-300 transition hover:border-amber-400/40 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {DIFFICULTY_CONFIG[difficulty].label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
