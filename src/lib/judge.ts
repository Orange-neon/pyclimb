export function normalizeOutput(value: string): string {
  return value.replace(/\r\n?/g, "\n").trimEnd();
}

export interface OutputComparison {
  passed: boolean;
  actual: string;
  expected: string;
}

export function compareOutput(actualOutput: string, expectedOutput: string): OutputComparison {
  const actual = normalizeOutput(actualOutput);
  const expected = normalizeOutput(expectedOutput);
  return { passed: actual === expected, actual, expected };
}
