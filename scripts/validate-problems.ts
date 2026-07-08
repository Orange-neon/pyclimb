import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DIFFICULTIES } from "../src/data/difficulty";
import type { Difficulty, Problem, ProblemBank } from "../src/data/problemTypes";
import { validateProblemBank } from "../src/data/problemBank";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const banksDirectory = path.join(root, "src", "data", "banks");
const entries = await readdir(banksDirectory, { withFileTypes: true });
const versions = entries
  .filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name))
  .map((entry) => entry.name)
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

const allErrors: string[] = [];

for (const version of versions) {
  const versionDirectory = path.join(banksDirectory, version);
  const indexModule = (await import(pathToFileURL(path.join(versionDirectory, "index.ts")).href)) as {
    problemBank: ProblemBank;
  };
  const problemBank = indexModule.problemBank;
  validateProblemBank(problemBank);

  const tierProblems = new Map<Difficulty, Problem[]>();
  for (const difficulty of DIFFICULTIES) {
    const module = (await import(
      pathToFileURL(path.join(versionDirectory, `${difficulty}.ts`)).href
    )) as Record<string, Problem[]>;
    const problems = Object.values(module).find(Array.isArray) ?? [];
    tierProblems.set(difficulty, problems);
  }

  const errors: string[] = [];
  const counts = { easy: 0, medium: 0, hard: 0 };

  for (const [expectedDifficulty, problems] of tierProblems) {
    for (const problem of problems) {
      if (problem.difficulty !== expectedDifficulty) {
        errors.push(`${problem.id}: move it to ${problem.difficulty}.ts or correct its difficulty.`);
      }
    }
  }

  for (const problem of problemBank.problems) {
    counts[problem.difficulty] += 1;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(problem.id)) {
      errors.push(`${problem.id}: ID must use lowercase kebab-case.`);
    }
    if (problem.tags.length === 0) errors.push(`${problem.id}: add at least one topic tag.`);
    if (!problem.description.startsWith("# ")) {
      errors.push(`${problem.id}: description must begin with a level-one heading.`);
    }
    if (!problem.description.includes("## Input") || !problem.description.includes("## Output")) {
      errors.push(`${problem.id}: description must document Input and Output.`);
    }
    if (problem.testCases.length < 3) {
      errors.push(`${problem.id}: add at least three test cases.`);
    }
    if (/(^|\n)\s*(?:from\s+\S+\s+import|import\s+\S+)/.test(problem.solutionCode)) {
      errors.push(`${problem.id}: reference solutions must not use imports.`);
    }
    const inputs = new Set<string>();
    for (const [index, testCase] of problem.testCases.entries()) {
      if (inputs.has(testCase.input)) errors.push(`${problem.id}: test ${index + 1} repeats an input.`);
      inputs.add(testCase.input);
    }
  }

  for (const difficulty of DIFFICULTIES) {
    if (counts[difficulty] === 0) errors.push(`Bank has no ${difficulty} problems.`);
  }

  if (errors.length) {
    allErrors.push(...errors.map((error) => `${version}/${error}`));
  } else {
    console.log(
      `Problem bank ${problemBank.version}: ${problemBank.problems.length} valid problems ` +
        `(${counts.easy} easy, ${counts.medium} medium, ${counts.hard} hard).`,
    );
  }
}

if (allErrors.length) {
  console.error(`Problem bank validation failed:\n- ${allErrors.join("\n- ")}`);
  process.exitCode = 1;
}
