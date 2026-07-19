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

  it("loads the 600-problem v5 bank with every difficulty tier doubled", async () => {
    const bank = await loadProblemBank("v5");
    expect(bank.problems).toHaveLength(600);
    expect(
      bank.problems.reduce<Record<string, number>>((counts, problem) => {
        counts[problem.difficulty] = (counts[problem.difficulty] ?? 0) + 1;
        return counts;
      }, {}),
    ).toEqual({ easy: 244, medium: 178, hard: 178 });
    expect(bank.problems.some((problem) => problem.timedMode === "bomb")).toBe(true);
    expect(bank.problems.some((problem) => problem.timedMode === "double")).toBe(true);
  });

  it("adds 300 v5-only challenges without reusing an implementation or test suite", async () => {
    const previous = await loadProblemBank("v4");
    const current = await loadProblemBank("v5");
    const previousIds = new Set(previous.problems.map((problem) => problem.id));
    const additions = current.problems.filter((problem) => !previousIds.has(problem.id));
    expect(additions).toHaveLength(300);
    expect(additions.every((problem) => problem.id.startsWith("v5-"))).toBe(true);

    const normalizeCode = (code: string) => code.replace(/\s+/g, " ").trim();
    const testSignature = (problem: (typeof additions)[number]) =>
      JSON.stringify(problem.testCases.map(({ input, expectedOutput }) => [input, expectedOutput]));
    const usedSolutions = new Map(
      previous.problems.map((problem) => [normalizeCode(problem.solutionCode), problem.id]),
    );
    const usedTests = new Map(
      previous.problems.map((problem) => [testSignature(problem), problem.id]),
    );
    const repeatedSolutions: string[] = [];
    const repeatedTests: string[] = [];

    for (const problem of additions) {
      const solution = normalizeCode(problem.solutionCode);
      const tests = testSignature(problem);
      if (usedSolutions.has(solution)) {
        repeatedSolutions.push(`${problem.id} repeats ${usedSolutions.get(solution)}`);
      }
      if (usedTests.has(tests)) repeatedTests.push(`${problem.id} repeats ${usedTests.get(tests)}`);
      usedSolutions.set(solution, problem.id);
      usedTests.set(tests, problem.id);
    }

    expect(repeatedSolutions).toEqual([]);
    expect(repeatedTests).toEqual([]);
  });

  it("tags the top-level Python concepts that determine curriculum placement", async () => {
    const previousIds = new Set(
      (await loadProblemBank("v4")).problems.map((problem) => problem.id),
    );
    const additions = (await loadProblemBank("v5")).problems.filter(
      (problem) => !previousIds.has(problem.id),
    );
    const issues: string[] = [];

    for (const problem of additions) {
      if (
        /(?:^|\n)(?:from\s+\S+\s+import|import\s+\S+)/.test(problem.solutionCode) &&
        !problem.tags.includes("modules")
      ) {
        issues.push(`${problem.id} uses an import without the modules tag`);
      }
      if (/(?:^|\n)class\s+/.test(problem.solutionCode) && !problem.tags.includes("classes")) {
        issues.push(`${problem.id} defines a class without the classes tag`);
      }
      if (
        /(?:^|\n)def\s+/.test(problem.solutionCode) &&
        !problem.tags.includes("functions") &&
        !problem.tags.includes("classes")
      ) {
        issues.push(`${problem.id} defines a function without the functions tag`);
      }
    }

    expect(issues).toEqual([]);
  });

  it("keeps older banks available while using v5 as the latest release", async () => {
    expect(LATEST_BANK_VERSION).toBe("v5");
    expect(getAvailableBankVersions()).toEqual(["v1", "v2", "v3", "v4", "v5"]);
    expect((await loadProblemBank()).version).toBe("v5");
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
