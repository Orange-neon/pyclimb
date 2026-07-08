import type { ProblemBank } from "./problemTypes";

export const LATEST_BANK_VERSION = "v1";

const bankLoaders: Record<string, () => Promise<ProblemBank>> = {
  v1: async () => (await import("./banks/v1")).problemBank,
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
  return bank;
}

export function validateProblemBank(bank: ProblemBank): void {
  const ids = new Set<string>();

  if (!bank.version || bank.problems.length === 0) {
    throw new Error("The problem bank must have a version and at least one problem.");
  }

  for (const problem of bank.problems) {
    if (ids.has(problem.id)) {
      throw new Error(`Duplicate problem ID: ${problem.id}`);
    }
    ids.add(problem.id);

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
