import type { Problem } from "../data/problemTypes";
import { getProblemReward } from "../data/problemProgression";
import type { CompletedRaceHistory, RaceProblemOutcome } from "./raceHistory";

const TARGET_MINUTES_BY_DIFFICULTY: Record<Problem["difficulty"], number> = {
  easy: 5,
  medium: 8,
  hard: 12,
};

const DEFAULT_TARGET_MINUTES = 8;

export interface ProfileRating {
  overall: number;
  points: number;
  accuracy: number;
  pace: number;
  earnedPoints: number;
  possiblePoints: number;
  solved: number;
  attempted: number;
  durationMs: number;
}

type ProblemLookup = (
  race: CompletedRaceHistory,
  outcome: RaceProblemOutcome,
) => Problem | undefined;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function getRaceDuration(race: CompletedRaceHistory): number {
  if (typeof race.durationMs === "number" && Number.isFinite(race.durationMs)) {
    return Math.max(0, race.durationMs);
  }
  const firstOpenedAt = race.problems.reduce(
    (earliest, problem) => Math.min(earliest, problem.firstOpenedAt),
    race.finishedAt,
  );
  return Math.max(0, race.finishedAt - firstOpenedAt);
}

export function calculateProfileRating(
  races: CompletedRaceHistory[],
  findProblem: ProblemLookup,
): ProfileRating {
  const outcomes = races.flatMap((race) =>
    race.problems.map((outcome) => ({ race, outcome, problem: findProblem(race, outcome) })),
  );
  const attempted = outcomes.length;
  const solved = outcomes.filter(({ outcome }) => outcome.status === "solved").length;
  const earnedPoints = races.reduce((total, race) => total + race.score, 0);
  const possiblePoints = outcomes.reduce(
    (total, { problem }) => total + (problem ? getProblemReward(problem) : 0),
    0,
  );
  const durationMs = races.reduce((total, race) => total + getRaceDuration(race), 0);

  if (!attempted) {
    return {
      overall: 0,
      points: 0,
      accuracy: 0,
      pace: 0,
      earnedPoints,
      possiblePoints,
      solved,
      attempted,
      durationMs,
    };
  }

  const pointRatio = possiblePoints > 0 ? clampUnit(earnedPoints / possiblePoints) : 0;
  const accuracyRatio = solved / attempted;
  const targetMs = outcomes.reduce(
    (total, { problem }) =>
      total +
      (problem
        ? TARGET_MINUTES_BY_DIFFICULTY[problem.difficulty]
        : DEFAULT_TARGET_MINUTES) *
        60_000,
    0,
  );
  const rawPaceRatio = durationMs > 0 ? clampUnit(targetMs / durationMs) : 1;
  const paceRatio = rawPaceRatio * accuracyRatio;
  const points = Math.round(pointRatio * 100);
  const accuracy = Math.round(accuracyRatio * 100);
  const pace = Math.round(paceRatio * 100);

  return {
    overall: Math.round(points * 0.45 + accuracy * 0.35 + pace * 0.2),
    points,
    accuracy,
    pace,
    earnedPoints,
    possiblePoints,
    solved,
    attempted,
    durationMs,
  };
}
