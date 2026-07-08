export type Difficulty = "easy" | "medium" | "hard";

export interface TestCase {
  input: string;
  expectedOutput: string;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  description: string;
  starterCode: string;
  solutionCode: string;
  testCases: TestCase[];
}

export interface ProblemBank {
  version: string;
  problems: Problem[];
}
