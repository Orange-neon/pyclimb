export const ACTIVE_RACE_HISTORY_KEY = "col.active-race-history.v1";
export const COMPLETED_RACE_HISTORY_KEY = "col.completed-race-history.v1";

const MAX_COMPLETED_RACES = 50;

export type RaceHistoryMode = "solo" | "multiplayer";
export type RaceProblemStatus = "solved" | "not-solved";

export interface RaceProblemOutcome {
  problemId: string;
  status: RaceProblemStatus;
  firstOpenedAt: number;
  lastUpdatedAt: number;
}

export interface CompletedRaceHistory {
  id: string;
  mode: RaceHistoryMode;
  label: string;
  bankVersion: string;
  finishedAt: number;
  score: number;
  rank: number;
  playerCount: number;
  problems: RaceProblemOutcome[];
}

interface ActiveRaceHistory {
  problems: Record<string, RaceProblemOutcome>;
}

type ActiveRaceHistoryMap = Record<string, ActiveRaceHistory>;

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    return JSON.parse(storage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Race history should never interrupt a race when browser storage is unavailable.
  }
}

export function recordRaceProblem(
  raceId: string,
  problemId: string,
  solved = false,
  updatedAt = Date.now(),
  storage: Storage = localStorage,
): void {
  const active = readJson<ActiveRaceHistoryMap>(storage, ACTIVE_RACE_HISTORY_KEY, {});
  const race = active[raceId] ?? { problems: {} };
  const current = race.problems[problemId];
  race.problems[problemId] = {
    problemId,
    status: solved || current?.status === "solved" ? "solved" : "not-solved",
    firstOpenedAt: current?.firstOpenedAt ?? updatedAt,
    lastUpdatedAt: updatedAt,
  };
  active[raceId] = race;
  writeJson(storage, ACTIVE_RACE_HISTORY_KEY, active);
}

export function readCompletedRaceHistory(
  storage: Storage = localStorage,
): CompletedRaceHistory[] {
  const parsed = readJson<unknown>(storage, COMPLETED_RACE_HISTORY_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((race): race is CompletedRaceHistory =>
    Boolean(
      race &&
      typeof race === "object" &&
      typeof (race as CompletedRaceHistory).id === "string" &&
      Array.isArray((race as CompletedRaceHistory).problems),
    ),
  );
}

interface FinishRaceHistoryInput {
  id: string;
  mode: RaceHistoryMode;
  label: string;
  bankVersion: string;
  finishedAt?: number;
  score: number;
  rank: number;
  playerCount: number;
  solvedIds?: Iterable<string>;
}

export function finishRaceHistory(
  input: FinishRaceHistoryInput,
  storage: Storage = localStorage,
): CompletedRaceHistory | null {
  const active = readJson<ActiveRaceHistoryMap>(storage, ACTIVE_RACE_HISTORY_KEY, {});
  const race = active[input.id];
  if (!race || !Object.keys(race.problems).length) return null;

  const solved = new Set(input.solvedIds ?? []);
  const problems = Object.values(race.problems)
    .map((problem) => ({
      ...problem,
      status: solved.has(problem.problemId) ? "solved" as const : problem.status,
    }))
    .sort((left, right) => right.lastUpdatedAt - left.lastUpdatedAt);
  const completed: CompletedRaceHistory = {
    id: input.id,
    mode: input.mode,
    label: input.label,
    bankVersion: input.bankVersion,
    finishedAt: input.finishedAt ?? Date.now(),
    score: input.score,
    rank: Math.max(1, input.rank),
    playerCount: Math.max(1, input.playerCount),
    problems,
  };
  const previous = readCompletedRaceHistory(storage).filter((item) => item.id !== input.id);
  writeJson(
    storage,
    COMPLETED_RACE_HISTORY_KEY,
    [completed, ...previous].slice(0, MAX_COMPLETED_RACES),
  );
  delete active[input.id];
  writeJson(storage, ACTIVE_RACE_HISTORY_KEY, active);
  return completed;
}

