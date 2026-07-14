import { describe, expect, it } from "vitest";
import type { Problem } from "../data/problemTypes";
import type { CompletedRaceHistory } from "./raceHistory";
import { calculateProfileRating } from "./profileRating";

const easyProblem: Problem = {
  id: "easy-one",
  title: "Easy one",
  difficulty: "easy",
  tags: [],
  description: "Solve it",
  starterCode: "",
  solutionCode: "",
  testCases: [{ input: "", expectedOutput: "" }],
};

function race(overrides: Partial<CompletedRaceHistory> = {}): CompletedRaceHistory {
  return {
    id: "race-1",
    mode: "solo",
    label: "Solo practice",
    bankVersion: "v4",
    startedAt: 0,
    finishedAt: 5 * 60_000,
    durationMs: 5 * 60_000,
    score: 120,
    rank: 1,
    playerCount: 1,
    problems: [
      {
        problemId: easyProblem.id,
        status: "solved",
        firstOpenedAt: 0,
        lastUpdatedAt: 1,
      },
    ],
    ...overrides,
  };
}

describe("profile rating", () => {
  it("awards 100 for full points, perfect accuracy, and target pace", () => {
    expect(calculateProfileRating([race()], () => easyProblem)).toMatchObject({
      overall: 100,
      points: 100,
      accuracy: 100,
      pace: 100,
    });
  });

  it("weights points, accuracy, and pace into the overall score", () => {
    const twoAttempts = race({
      durationMs: 10 * 60_000,
      problems: [
        ...race().problems,
        {
          problemId: "easy-two",
          status: "not-solved",
          firstOpenedAt: 2,
          lastUpdatedAt: 3,
        },
      ],
    });

    expect(calculateProfileRating([twoAttempts], () => easyProblem)).toMatchObject({
      overall: 50,
      points: 50,
      accuracy: 50,
      pace: 50,
    });
  });

  it("reduces only the pace component for a slower perfect solve", () => {
    expect(
      calculateProfileRating([race({ durationMs: 10 * 60_000 })], () => easyProblem),
    ).toMatchObject({ overall: 90, points: 100, accuracy: 100, pace: 50 });
  });
});
