import { describe, expect, it } from "vitest";
import { foundationEasyProblems } from "./foundationEasy";

describe("v3 beginner foundations", () => {
  it("provides useful starter code for every new problem", () => {
    for (const problem of foundationEasyProblems) {
      expect(problem.starterCode).not.toBe("# Write your solution here\n");
      expect(problem.starterCode).toContain("input()")
    }
  });

  it("keeps shortcuts out of introductory reference solutions", () => {
    const shortcutPatterns = [
      /\bmap\s*\(/,
      /\blambda\b/,
      /\bprint\([^\n]*\bif\b[^\n]*\belse\b/,
      /\bf["']/,
      /\[[^\]]+\bfor\b[^\]]+\]/,
      /\([^)]*\bfor\b[^)]*\)/,
    ];
    for (const problem of foundationEasyProblems) {
      for (const pattern of shortcutPatterns) {
        expect(problem.solutionCode, `${problem.id} uses ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("teaches the requested one-line string pattern with one print", () => {
    const problem = foundationEasyProblems.find(({ id }) => id === "string-one-line-pair");
    expect(problem).toBeDefined();
    expect(problem?.solutionCode.match(/\bprint\s*\(/g)).toHaveLength(1);
    expect(problem?.solutionCode).toContain('line = first + " " + second');
    expect(problem?.testCases[0].expectedOutput).toBe("hello world");
  });
});
