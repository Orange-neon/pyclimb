import { describe, expect, it } from "vitest";
import { getTimedProblemReward, TIMED_PROBLEM_SECONDS, timedModeForPosition } from "./timedProblems";

describe("timed problem types", () => {
  it("uses the requested time limits", () => {
    expect(TIMED_PROBLEM_SECONDS).toEqual({ easy: 60, medium: 90, hard: 120 });
  });

  it("keeps bombs in the easier band and doubles in the harder band", () => {
    const modes = Array.from({ length: 100 }, (_, index) => ({
      index,
      mode: timedModeForPosition("v4", index, 100),
    })).filter(({ mode }) => mode);
    expect(modes.some(({ mode }) => mode === "bomb")).toBe(true);
    expect(modes.some(({ mode }) => mode === "double")).toBe(true);
    expect(modes.filter(({ mode }) => mode === "bomb").every(({ index }) => index <= 35)).toBe(true);
    expect(modes.filter(({ mode }) => mode === "double").every(({ index }) => index >= 65)).toBe(true);
  });

  it("does not change timed behavior in immutable older banks", () => {
    expect(timedModeForPosition("v3", 3, 100)).toBeUndefined();
  });

  it("doubles only before or exactly at the deadline", () => {
    expect(getTimedProblemReward(550, "double", 10_000, 9_999)).toBe(1_100);
    expect(getTimedProblemReward(550, "double", 10_000, 10_000)).toBe(1_100);
    expect(getTimedProblemReward(550, "double", 10_000, 10_001)).toBe(550);
    expect(getTimedProblemReward(550, "bomb", 10_000, 9_000)).toBe(550);
  });
});
