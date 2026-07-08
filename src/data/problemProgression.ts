import { CURRICULUM_TOPICS, getProblemTopic } from "./curriculum";
import { DIFFICULTIES, DIFFICULTY_CONFIG } from "./difficulty";
import type { Difficulty, Problem, ProblemBank } from "./problemTypes";
import { timedModeForPosition } from "./timedProblems";

export const BONUS_RANGES: Record<Difficulty, { minimum: number; maximum: number }> = {
  easy: { minimum: 20, maximum: 30 },
  medium: { minimum: 50, maximum: 100 },
  hard: { minimum: 100, maximum: 200 },
};

const ADVANCED_TAG_WEIGHTS: Record<string, number> = {
  recursion: 180,
  "dynamic-programming": 180,
  graphs: 160,
  algorithms: 140,
  "nested-loops": 110,
  grids: 90,
  sorting: 80,
  searching: 70,
  stacks: 60,
  sequences: 40,
};

export function scoreProblemComplexity(problem: Problem): number {
  const topicIndex = CURRICULUM_TOPICS.findIndex((topic) => topic.id === getProblemTopic(problem));
  const structuralScore = problem.tags.reduce(
    (total, tag) => total + (ADVANCED_TAG_WEIGHTS[tag] ?? 0),
    0,
  );
  const lines = problem.solutionCode.split("\n").filter((line) => line.trim()).length;
  const branchCount = (problem.solutionCode.match(/\b(?:if|elif|for|while|def|class)\b/g) ?? []).length;
  const maximumIndent = problem.solutionCode.split("\n").reduce((maximum, line) => {
    const spaces = line.match(/^ */)?.[0].length ?? 0;
    return Math.max(maximum, spaces);
  }, 0);
  return topicIndex * 1_000 + structuralScore + lines * 3 + branchCount * 8 + maximumIndent;
}

function bonusForPosition(difficulty: Difficulty, index: number, count: number): number {
  const { minimum, maximum } = BONUS_RANGES[difficulty];
  if (count <= 1) return minimum;
  return minimum + Math.round(((maximum - minimum) * index) / (count - 1));
}

export function applyProblemProgression(bank: ProblemBank): ProblemBank {
  const ranked = DIFFICULTIES.flatMap((difficulty) => {
    const problems = bank.problems
      .filter((problem) => problem.difficulty === difficulty)
      .map((problem) => ({ problem, complexityScore: scoreProblemComplexity(problem) }))
      .sort(
        (left, right) =>
          left.complexityScore - right.complexityScore ||
          left.problem.title.localeCompare(right.problem.title),
      );
    return problems.map(({ problem, complexityScore }, index) => ({
      ...problem,
      complexityScore,
      progressionOrder: index + 1,
      bonusPoints: bonusForPosition(difficulty, index, problems.length),
      timedMode: timedModeForPosition(bank.version, index, problems.length),
    }));
  });
  return { ...bank, problems: ranked };
}

export function getProblemBonus(problem: Problem): number {
  return problem.bonusPoints ?? BONUS_RANGES[problem.difficulty].minimum;
}

export function getProblemReward(problem: Problem): number {
  return DIFFICULTY_CONFIG[problem.difficulty].points + getProblemBonus(problem);
}
