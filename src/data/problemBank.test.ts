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

  it("loads the 210-problem v2 bank with balanced difficulty tiers", async () => {
    const bank = await loadProblemBank("v2");
    expect(bank.problems).toHaveLength(210);
    expect(
      bank.problems.reduce<Record<string, number>>((counts, problem) => {
        counts[problem.difficulty] = (counts[problem.difficulty] ?? 0) + 1;
        return counts;
      }, {}),
    ).toEqual({ easy: 70, medium: 70, hard: 70 });
  });

  it("loads the beginner-expanded 242-problem v3 bank", async () => {
    const bank = await loadProblemBank("v3");
    expect(bank.problems).toHaveLength(242);
    expect(
      bank.problems.reduce<Record<string, number>>((counts, problem) => {
        counts[problem.difficulty] = (counts[problem.difficulty] ?? 0) + 1;
        return counts;
      }, {}),
    ).toEqual({ easy: 102, medium: 70, hard: 70 });
  });

  it("loads the 300-problem v4 event bank", async () => {
    const bank = await loadProblemBank("v4");
    expect(bank.problems).toHaveLength(300);
    expect(
      bank.problems.reduce<Record<string, number>>((counts, problem) => {
        counts[problem.difficulty] = (counts[problem.difficulty] ?? 0) + 1;
        return counts;
      }, {}),
    ).toEqual({ easy: 122, medium: 89, hard: 89 });
    expect(bank.problems.some((problem) => problem.timedMode === "bomb")).toBe(true);
    expect(bank.problems.some((problem) => problem.timedMode === "double")).toBe(true);
  });

  it("keeps older banks available while using v4 as the latest release", async () => {
    expect(LATEST_BANK_VERSION).toBe("v4");
    expect(getAvailableBankVersions()).toEqual(["v1", "v2", "v3", "v4"]);
    expect((await loadProblemBank()).version).toBe("v4");
  });

  it("has distinct IDs and titles, examples, and at least three tests", async () => {
    const bank = await loadProblemBank();
    const ids = bank.problems.map((problem) => problem.id);
    const titles = bank.problems.map((problem) => problem.title.toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(titles).size).toBe(titles.length);
    expect(bank.problems.every((problem) => problem.description.includes("### Example"))).toBe(true);
    expect(bank.problems.every((problem) => problem.testCases.length >= 3)).toBe(true);
  });
});
