import { CURRICULUM_TOPICS, getProblemTopic } from "./curriculum";
import { DIFFICULTIES, DIFFICULTY_CONFIG } from "./difficulty";
import type { Difficulty, Problem, ProblemBank } from "./problemTypes";
import { timedModeForPosition } from "./timedProblems";

function exampleValue(value: string): string {
  return value.replace(/\n/g, " ↵ ") || "(empty input)";
}

function sectionText(description: string, heading: string): string | null {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = description.match(
    new RegExp(`^## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n#{1,3} |$)`, "m"),
  );
  return match?.[1].trim().replace(/\s+/g, " ") ?? null;
}

/**
 * Older banks intentionally keep their original authored copy. This adds the
 * same explicit task and sample walkthrough to every generation without
 * rewriting (and potentially changing) the rules of an archived problem.
 */
export function addProblemGuidance(problem: Problem): Problem {
  if (problem.description.includes("## What your program needs to do")) return problem;

  const overview = problem.description
    .replace(/^# .*\n+/, "")
    .split(/\n#{2,3} /, 1)[0]
    .trim()
    .replace(/\s+/g, " ");
  const inputRule = sectionText(problem.description, "Input") ?? "Use the supplied input values.";
  const outputRule = sectionText(problem.description, "Output") ?? "Print the requested result.";
  const example = problem.testCases[0];
  const exampleLineNote = example.input.includes("\n")
    ? "The ↵ symbol marks where the next input line begins."
    : "This example uses one input line.";

  const taskGuidance = `## What your program needs to do
Read the input exactly as described: ${inputRule}

Use those values to complete the task: ${overview}

Print only the requested result, with the exact spacing and capitalization described here: ${outputRule}`;

  const exampleGuidance = `### Example explained
The example gives \`${exampleValue(example.input)}\` as input. ${exampleLineNote} Your program uses those values to complete the task described above. The result is \`${exampleValue(example.expectedOutput)}\`, so that exact value is printed.`;

  const exampleHeading = problem.description.indexOf("\n### Example");
  const description = exampleHeading === -1
    ? `${problem.description.trim()}\n\n${taskGuidance}\n\n${exampleGuidance}`
    : `${problem.description.slice(0, exampleHeading).trim()}\n\n${taskGuidance}\n\n${problem.description.slice(exampleHeading + 1).trim()}\n\n${exampleGuidance}`;

  return { ...problem, description };
}

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
      ...addProblemGuidance(problem),
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
