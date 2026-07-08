import { describe, expect, it } from "vitest";
import type { Problem } from "../data/problemTypes";
import type { RoomPlayer } from "../types/multiplayer";
import {
  formatCountdown,
  getRemainingCounts,
  pickUnsolvedProblem,
  sortRoomPlayers,
} from "./raceLogic";

const problem = (id: string, difficulty: Problem["difficulty"]): Problem => ({
  id,
  difficulty,
  title: id,
  tags: ["test"],
  description: "# Test\n\n## Input\nNone\n\n## Output\nNone",
  starterCode: "print()",
  solutionCode: "print()",
  testCases: [{ input: "", expectedOutput: "" }],
});

const player = (overrides: Partial<RoomPlayer>): RoomPlayer => ({
  uid: crypto.randomUUID(),
  nickname: "Climber",
  normalizedNickname: "climber",
  score: 0,
  correctCount: 0,
  joinedAt: 1,
  lastAcceptedAt: null,
  online: true,
  ready: true,
  ...overrides,
});

describe("problem selection", () => {
  const problems = [problem("e1", "easy"), problem("e2", "easy"), problem("m1", "medium")];

  it("never selects a solved problem", () => {
    expect(pickUnsolvedProblem(problems, "easy", ["e1"], () => 0)?.id).toBe("e2");
  });

  it("returns null after a tier is exhausted", () => {
    expect(pickUnsolvedProblem(problems, "easy", ["e1", "e2"])).toBeNull();
  });

  it("counts remaining problems by tier", () => {
    expect(getRemainingCounts(problems, ["e1"])).toEqual({ easy: 1, medium: 1, hard: 0 });
  });
});

describe("leaderboard ordering", () => {
  it("uses score, solves, acceptance time, then nickname", () => {
    const players = [
      player({ uid: "b", nickname: "Beta", score: 300, correctCount: 1, lastAcceptedAt: 20 }),
      player({ uid: "a", nickname: "Alpha", score: 300, correctCount: 2, lastAcceptedAt: 30 }),
      player({ uid: "c", nickname: "Clara", score: 300, correctCount: 2, lastAcceptedAt: 10 }),
      player({ uid: "d", nickname: "Delta", score: 100, correctCount: 5 }),
    ];
    expect(sortRoomPlayers(players).map((item) => item.uid)).toEqual(["c", "a", "b", "d"]);
  });
});

describe("countdown formatting", () => {
  it.each([
    [0, "0:00"],
    [9, "0:09"],
    [60, "1:00"],
    [185, "3:05"],
    [-10, "0:00"],
  ])("formats %i seconds", (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });
});
