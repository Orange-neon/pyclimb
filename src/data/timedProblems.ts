import type { Difficulty, TimedProblemMode } from "./problemTypes";

export const TIMED_PROBLEM_SECONDS: Record<Difficulty, number> = {
  easy: 60,
  medium: 90,
  hard: 120,
};

export const BOMB_PENALTY = 50;
export const DOUBLE_MULTIPLIER = 2;

export function getTimedProblemReward(
  normalReward: number,
  mode: TimedProblemMode | undefined,
  deadline: number | null,
  now: number,
): number {
  return mode === "double" && deadline !== null && now <= deadline
    ? normalReward * DOUBLE_MULTIPLIER
    : normalReward;
}

export function timedModeForPosition(
  bankVersion: string,
  index: number,
  count: number,
): TimedProblemMode | undefined {
  if (Number(bankVersion.slice(1)) < 4 || count < 12) return undefined;
  const percentile = index / Math.max(1, count - 1);
  if (percentile <= 0.35 && index % 7 === 3) return "bomb";
  if (percentile >= 0.65 && index % 7 === 5) return "double";
  return undefined;
}
