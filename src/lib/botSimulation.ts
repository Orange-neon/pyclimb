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

export function createBotAction(random: () => number = Math.random): BotAction {
  const difficultyRoll = random();
  const difficulty: Difficulty =
    difficultyRoll < 0.45 ? "easy" : difficultyRoll < 0.8 ? "medium" : "hard";
  const forfeited = random() < 0.2;
  const config = DIFFICULTY_CONFIG[difficulty];
  const minimumDelay = BOT_MIN_DELAY_MS[difficulty];
  const delayMs = minimumDelay + Math.floor(random() * (minimumDelay / 2));

  return {
    difficulty,
    delta: forfeited ? -config.penalty : config.points,
    delayMs,
    forfeited,
  };
}
