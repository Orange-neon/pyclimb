import { RELAY_LIMITS, utf8ByteLength, type RunRejectionCode } from "./protocol";

export interface ActiveRunView {
  uid: string;
  cellId: string;
  deadline: number;
}

export interface RunPolicyInput {
  now: number;
  uid: string;
  cellId: string;
  source: string;
  sourceHash: string;
  currentHash: string;
  lastRunAt?: number;
  activeRuns: readonly ActiveRunView[];
}

export interface RunPolicyRejection {
  code: RunRejectionCode;
  message: string;
  retryAfterMs?: number;
}

export function evaluateRunRequest(input: RunPolicyInput): RunPolicyRejection | null {
  if (utf8ByteLength(input.source) > RELAY_LIMITS.maxSourceBytes) {
    return { code: "source-too-large", message: "This cell exceeds the 50 KiB execution limit." };
  }
  if (input.sourceHash !== input.currentHash) {
    return { code: "hash-mismatch", message: "The cell changed before the run reached the relay. Try again." };
  }

  if (input.lastRunAt !== undefined) {
    const elapsed = input.now - input.lastRunAt;
    if (elapsed < RELAY_LIMITS.runCooldownMs) {
      return {
        code: "cooldown",
        message: "Please wait briefly before running another cell.",
        retryAfterMs: RELAY_LIMITS.runCooldownMs - Math.max(0, elapsed),
      };
    }
  }

  const liveRuns = input.activeRuns.filter((run) => run.deadline > input.now);
  if (liveRuns.some((run) => run.uid === input.uid)) {
    return { code: "uid-busy", message: "Wait for your current cell run to finish." };
  }
  if (liveRuns.some((run) => run.cellId === input.cellId)) {
    return { code: "cell-busy", message: "Another participant is already running this cell." };
  }
  return null;
}
