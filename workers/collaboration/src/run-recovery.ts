import { RELAY_LIMITS, type SharedExecution } from "./protocol";

export interface ActiveRunState {
  runId: string;
  sequence: number;
  cellId: string;
  uid: string;
  nickname: string;
  sourceHash: string;
  acceptedAt: number;
  deadline: number;
}

export function activeRunFromSharedExecution(cellId: string, value: unknown): ActiveRunState | null {
  if (!value || typeof value !== "object") return null;
  const execution = value as Partial<SharedExecution>;
  const ranBy = execution.ranBy;
  if (
    execution.status !== "running" ||
    typeof execution.runId !== "string" ||
    execution.runId.length === 0 ||
    execution.runId.length > 128 ||
    typeof execution.sequence !== "number" ||
    !Number.isSafeInteger(execution.sequence) ||
    typeof execution.acceptedAt !== "number" ||
    !Number.isFinite(execution.acceptedAt) ||
    typeof execution.sourceHash !== "string" ||
    !/^[0-9a-f]{64}$/.test(execution.sourceHash) ||
    !ranBy ||
    typeof ranBy.uid !== "string" ||
    typeof ranBy.nickname !== "string"
  ) {
    return null;
  }
  return {
    runId: execution.runId,
    sequence: execution.sequence,
    cellId,
    uid: ranBy.uid.slice(0, 128),
    nickname: ranBy.nickname.slice(0, 40),
    sourceHash: execution.sourceHash,
    acceptedAt: execution.acceptedAt,
    deadline: execution.acceptedAt + RELAY_LIMITS.runTimeoutMs,
  };
}

export function recoveredRunDecision(
  run: ActiveRunState,
  hasSurvivingAttachment: boolean,
  now: number,
): "resume" | "timed_out" | "interrupted" {
  if (run.deadline <= now) return "timed_out";
  return hasSurvivingAttachment ? "resume" : "interrupted";
}
