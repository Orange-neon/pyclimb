import type { ExecutionStatus } from "./protocol";

export function executionStatusForResult(
  timedOut: boolean | undefined,
  submittedError: string | undefined,
): Extract<ExecutionStatus, "finished" | "error" | "timed_out"> {
  if (timedOut) return "timed_out";
  return submittedError ? "error" : "finished";
}
