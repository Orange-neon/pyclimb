import { describe, expect, it } from "vitest";
import { BOT_MIN_DELAY_MS, createBotAction } from "./botSimulation";

function sequence(...values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe("solo bot simulation", () => {
  it.each([
    [0.1, "easy", 100],
    [0.6, "medium", 300],
    [0.9, "hard", 500],
  ] as const)("awards only the configured tier points", (roll, difficulty, points) => {
    const action = createBotAction(sequence(roll, 0.9, 0));
    expect(action).toMatchObject({ difficulty, delta: points, forfeited: false });
  });

  it.each([
    [0.1, "easy", -50],
    [0.6, "medium", -150],
    [0.9, "hard", -250],
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
});
