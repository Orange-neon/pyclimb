import { describe, expect, it } from "vitest";
import { BOT_MIN_DELAY_MS, createBotAction, createBotSolveDelay } from "./botSimulation";

function sequence(...values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe("solo bot simulation", () => {
  it.each([
    [0.1, "easy", 100],
    [0.6, "medium", 450],
    [0.9, "hard", 900],
  ] as const)("awards only the configured tier points", (roll, difficulty, points) => {
    const action = createBotAction(sequence(roll, 0.9, 0));
    expect(action).toMatchObject({ difficulty, delta: points, forfeited: false });
  });

  it.each([
    [0.1, "easy", -50],
    [0.6, "medium", -50],
    [0.9, "hard", -50],
  ] as const)("occasionally subtracts the tier penalty", (roll, difficulty, penalty) => {
    const action = createBotAction(sequence(roll, 0.1, 0));
    expect(action).toMatchObject({ difficulty, delta: penalty, forfeited: true });
  });

  it.each([
    [0.1, "easy"],
    [0.6, "medium"],
    [0.9, "hard"],
  ] as const)("never schedules a %s action before its minimum time", (roll, difficulty) => {
    const minimum = BOT_MIN_DELAY_MS[difficulty];
    const earliest = createBotAction(sequence(roll, 0.9, 0));
    const latest = createBotAction(sequence(roll, 0.9, 0.999999));

    expect(earliest.delayMs).toBe(minimum);
    expect(latest.delayMs).toBeGreaterThanOrEqual(minimum);
    expect(latest.delayMs).toBeLessThan(minimum * 1.5);
  });

  it("skews champion solve times toward the quicker end of the bot window", () => {
    const minimum = BOT_MIN_DELAY_MS.medium;
    const midpointRoll = createBotSolveDelay("medium", () => 0.5);

    expect(midpointRoll).toBeGreaterThanOrEqual(minimum);
    expect(midpointRoll).toBeLessThan(minimum * 1.25);
    expect(createBotSolveDelay("medium", () => 0.999999)).toBeLessThan(minimum * 1.5);
  });
});
