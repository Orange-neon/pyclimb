import { describe, expect, it } from "vitest";
import { DIFFICULTIES, DIFFICULTY_CONFIG } from "./difficulty";
import { loadProblemBank } from "./problemBank";
import {
  BONUS_RANGES,
  getProblemReward,
  scoreProblemComplexity,
} from "./problemProgression";

describe("problem progression and bonuses", () => {
  it("orders every tier from lower to higher estimated complexity", async () => {
    const bank = await loadProblemBank("v2");
    for (const difficulty of DIFFICULTIES) {
      const problems = bank.problems.filter((problem) => problem.difficulty === difficulty);
      expect(problems).toHaveLength(70);
      expect(problems.map((problem) => problem.progressionOrder)).toEqual(
        Array.from({ length: 70 }, (_, index) => index + 1),
      );
      for (let index = 1; index < problems.length; index += 1) {
        expect(scoreProblemComplexity(problems[index])).toBeGreaterThanOrEqual(
          scoreProblemComplexity(problems[index - 1]),
        );
      }
    }
  });

  it("assigns monotonic bonuses spanning each requested range", async () => {
    const bank = await loadProblemBank("v2");
    for (const difficulty of DIFFICULTIES) {
      const bonuses = bank.problems
        .filter((problem) => problem.difficulty === difficulty)
        .map((problem) => problem.bonusPoints!);
      expect(bonuses[0]).toBe(BONUS_RANGES[difficulty].minimum);
      expect(bonuses.at(-1)).toBe(BONUS_RANGES[difficulty].maximum);
      expect([...bonuses].sort((left, right) => left - right)).toEqual(bonuses);
    }
  });

  it("adds the problem bonus to its tier base score", async () => {
    const problem = (await loadProblemBank("v2")).problems.find(
      (item) => item.difficulty === "hard" && item.bonusPoints === 200,
    )!;
    expect(getProblemReward(problem)).toBe(DIFFICULTY_CONFIG.hard.points + 200);
  });

  it("adds explicit instructions and a walkthrough after every given example", async () => {
    for (const version of ["v1", "v4"]) {
      const bank = await loadProblemBank(version);
      for (const problem of bank.problems) {
        expect(problem.description).toContain("## What your program needs to do");
        expect(problem.description).toContain("### Example explained");
        expect(problem.description.indexOf("\n### Example\n")).toBeLessThan(
          problem.description.indexOf("\n### Example explained\n"),
        );
      }
    }
  });
});
