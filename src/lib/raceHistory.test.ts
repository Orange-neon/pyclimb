import { describe, expect, it } from "vitest";
import {
  ACTIVE_RACE_HISTORY_KEY,
  COMPLETED_RACE_HISTORY_KEY,
  finishRaceHistory,
  markRaceProblemSolved,
  readCompletedRaceHistory,
  recordRaceProblem,
} from "./raceHistory";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("completed race history", () => {
  it("archives opened problems and upgrades accepted problems to solved", () => {
    const storage = memoryStorage();
    recordRaceProblem("race-1", "opened", false, 10, storage);
    recordRaceProblem("race-1", "solved", false, 20, storage);
    recordRaceProblem("race-1", "solved", true, 30, storage);

    finishRaceHistory({
      id: "race-1",
      mode: "multiplayer",
      label: "Room ABC123",
      bankVersion: "v4",
      startedAt: 5,
      finishedAt: 40,
      score: 500,
      rank: 2,
      playerCount: 3,
    }, storage);

    expect(readCompletedRaceHistory(storage)[0]).toMatchObject({
      id: "race-1",
      score: 500,
      durationMs: 35,
      problems: [
        { problemId: "solved", status: "solved" },
        { problemId: "opened", status: "not-solved" },
      ],
    });
    expect(JSON.parse(storage.getItem(ACTIVE_RACE_HISTORY_KEY) ?? "null")).toEqual({});
  });

  it("marks a retried problem solved without removing it from history", () => {
    const storage = memoryStorage();
    recordRaceProblem("retry-race", "try-again", false, 10, storage);
    finishRaceHistory({
      id: "retry-race",
      mode: "solo",
      label: "Solo practice",
      bankVersion: "v4",
      finishedAt: 20,
      score: 0,
      rank: 1,
      playerCount: 1,
    }, storage);

    const races = markRaceProblemSolved("retry-race", "try-again", 30, storage);

    expect(races[0].problems).toEqual([
      expect.objectContaining({
        problemId: "try-again",
        status: "solved",
        lastUpdatedAt: 30,
      }),
    ]);
    expect(readCompletedRaceHistory(storage)[0].problems).toHaveLength(1);
  });

  it("uses authoritative solved ids when a completed room is archived", () => {
    const storage = memoryStorage();
    recordRaceProblem("race-2", "accepted-before-reload", false, 10, storage);
    const result = finishRaceHistory({
      id: "race-2",
      mode: "multiplayer",
      label: "Room XYZ789",
      bankVersion: "v4",
      score: 100,
      rank: 1,
      playerCount: 2,
      solvedIds: ["accepted-before-reload"],
    }, storage);

    expect(result?.problems[0].status).toBe("solved");
    expect(storage.getItem(COMPLETED_RACE_HISTORY_KEY)).toContain("accepted-before-reload");
  });

  it("does not create an empty race entry", () => {
    const storage = memoryStorage();
    expect(finishRaceHistory({
      id: "empty",
      mode: "solo",
      label: "Solo practice",
      bankVersion: "v4",
      score: 0,
      rank: 1,
      playerCount: 5,
    }, storage)).toBeNull();
    expect(readCompletedRaceHistory(storage)).toEqual([]);
  });
});
