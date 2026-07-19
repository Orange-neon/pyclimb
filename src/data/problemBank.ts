import type { ProblemBank } from "./problemTypes";
import { applyProblemProgression } from "./problemProgression";

export const LATEST_BANK_VERSION = "v5";

const bankLoaders: Record<string, () => Promise<ProblemBank>> = {
  v1: async () => (await import("./banks/v1")).problemBank,
  v2: async () => (await import("./banks/v2")).problemBank,
  v3: async () => (await import("./banks/v3")).problemBank,
  v4: async () => (await import("./banks/v4")).problemBank,
  v5: async () => (await import("./banks/v5")).problemBank,
};

export function getAvailableBankVersions(): string[] {
  return Object.keys(bankLoaders);
}

export async function loadProblemBank(
  version = LATEST_BANK_VERSION,
): Promise<ProblemBank> {
  const loader = bankLoaders[version];
  if (!loader) {
    throw new Error(`Problem bank ${version} is not available in this build.`);
  }

  const bank = await loader();
  validateProblemBank(bank);
  return applyProblemProgression(bank);
}

export function validateProblemBank(bank: ProblemBank): void {
  const ids = new Set<string>();
  const titles = new Set<string>();

  if (!bank.version || bank.problems.length === 0) {
    throw new Error("The problem bank must have a version and at least one problem.");
  }

  for (const problem of bank.problems) {
    if (ids.has(problem.id)) {
      throw new Error(`Duplicate problem ID: ${problem.id}`);
    }
    ids.add(problem.id);
    const normalizedTitle = problem.title.trim().toLowerCase();
    if (titles.has(normalizedTitle)) {
      throw new Error(`Duplicate problem title: ${problem.title}`);
    }
    titles.add(normalizedTitle);

    if (
      !problem.title ||
      !problem.description ||
      !problem.starterCode ||
      !problem.solutionCode ||
      problem.testCases.length === 0
    ) {
      throw new Error(`Problem ${problem.id} is missing required content.`);
    }

    for (const testCase of problem.testCases) {
      if (typeof testCase.input !== "string" || typeof testCase.expectedOutput !== "string") {
        throw new Error(`Problem ${problem.id} has an invalid test case.`);
      }
    }
  }
}
