import { DIFFICULTY_CONFIG } from "../data/difficulty";
import type { Difficulty } from "../data/problemTypes";

export const BOT_MIN_DELAY_MS: Record<Difficulty, number> = {
  easy: 60_000,
  medium: 90_000,
  hard: 120_000,
};

export interface BotAction {
  difficulty: Difficulty;
  delta: number;
  delayMs: number;
  forfeited: boolean;
}

export function createBotSolveDelay(
  difficulty: Difficulty,
  random: () => number = Math.random,
): number {
  const minimumDelay = BOT_MIN_DELAY_MS[difficulty];
  const skewedRoll = Math.pow(random(), 1.75);
  return minimumDelay + Math.floor(skewedRoll * (minimumDelay / 2));
}

export function createBotAction(random: () => number = Math.random): BotAction {
  const difficultyRoll = random();
  const difficulty: Difficulty =
    difficultyRoll < 0.45 ? "easy" : difficultyRoll < 0.8 ? "medium" : "hard";
  const forfeited = random() < 0.2;
  const config = DIFFICULTY_CONFIG[difficulty];
  const delayMs = createBotSolveDelay(difficulty, random);

  return {
    difficulty,
    delta: forfeited ? -config.penalty : config.points,
    delayMs,
    forfeited,
  };
}
