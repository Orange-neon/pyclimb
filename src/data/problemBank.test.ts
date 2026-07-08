import { describe, expect, it } from "vitest";
import {
  getAvailableBankVersions,
  LATEST_BANK_VERSION,
  loadProblemBank,
  validateProblemBank,
} from "./problemBank";

describe("versioned problem banks", () => {
  it("loads and validates the 90-problem v1 bank", async () => {
    const bank = await loadProblemBank("v1");
    expect(() => validateProblemBank(bank)).not.toThrow();
    expect(bank.problems).toHaveLength(90);
    expect(
      bank.problems.reduce<Record<string, number>>((counts, problem) => {
        counts[problem.difficulty] = (counts[problem.difficulty] ?? 0) + 1;
        return counts;
      }, {}),
    ).toEqual({ easy: 30, medium: 30, hard: 30 });
  });

  it("uses v1 as the sole release bank", async () => {
    expect(LATEST_BANK_VERSION).toBe("v1");
    expect(getAvailableBankVersions()).toEqual(["v1"]);
    expect((await loadProblemBank()).version).toBe("v1");
  });

  it("has unique IDs and at least three tests in the latest bank", async () => {
    const bank = await loadProblemBank();
    const ids = bank.problems.map((problem) => problem.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(bank.problems.every((problem) => problem.testCases.length >= 3)).toBe(true);
  });
});
