import { createRequire } from "node:module";
import path from "node:path";
import { loadPyodide } from "pyodide";
import { getAvailableBankVersions, loadProblemBank } from "../src/data/problemBank";
import { compareOutput } from "../src/lib/judge";

function createInputReader(input: string): () => string | undefined {
  const normalized = input.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) lines.pop();
  let index = 0;
  return () => (index < lines.length ? lines[index++] : undefined);
}

const require = createRequire(import.meta.url);
const pyodideDirectory = path.dirname(require.resolve("pyodide/package.json"));
const pyodide = await loadPyodide({ indexURL: pyodideDirectory });
const failures: string[] = [];
let testCount = 0;
let problemCount = 0;

for (const version of getAvailableBankVersions()) {
  const bank = await loadProblemBank(version);
  problemCount += bank.problems.length;
  for (const problem of bank.problems) {
    for (const [index, testCase] of problem.testCases.entries()) {
    let stdout = "";
    let stderr = "";
    pyodide.setStdin({ stdin: createInputReader(testCase.input), isatty: false });
    pyodide.setStdout({ raw: (value) => (stdout += String.fromCharCode(value)) });
    pyodide.setStderr({ raw: (value) => (stderr += String.fromCharCode(value)) });

    const globals = pyodide.toPy({ __name__: "__main__" });
    try {
      await pyodide.runPythonAsync(problem.solutionCode, { globals });
      const comparison = compareOutput(stdout, testCase.expectedOutput);
      if (!comparison.passed) {
        failures.push(
          `${version}/${problem.id} test ${index + 1}: expected ${JSON.stringify(comparison.expected)}, ` +
            `received ${JSON.stringify(comparison.actual)}`,
        );
      }
    } catch (error) {
      failures.push(
        `${version}/${problem.id} test ${index + 1}: ${error instanceof Error ? error.message : String(error)}` +
          (stderr ? `\n${stderr}` : ""),
      );
    } finally {
      globals.destroy();
    }
    testCount += 1;
    }
  }
}

if (failures.length) {
  console.error(`Reference solution verification failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${problemCount} versioned reference solutions across ${testCount} Pyodide test cases.`,
  );
}
