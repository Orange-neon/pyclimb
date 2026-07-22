import { describe, expect, it } from "vitest";

import { RELAY_LIMITS } from "./protocol";
import { evaluateRunRequest, type RunPolicyInput } from "./run-policy";

const hash = "b".repeat(64);

function input(overrides: Partial<RunPolicyInput> = {}): RunPolicyInput {
  return {
    now: 10_000,
    uid: "user-a",
    cellId: "cell-a",
    source: "print('hello')",
    sourceHash: hash,
    currentHash: hash,
    activeRuns: [],
    ...overrides,
  };
}

describe("run admission policy", () => {
  it("enforces the cooldown through 499 ms and accepts at 500 ms", () => {
    expect(evaluateRunRequest(input({ lastRunAt: 9_501 }))).toMatchObject({
      code: "cooldown",
      retryAfterMs: 1,
    });
    expect(evaluateRunRequest(input({ lastRunAt: 9_500 }))).toBeNull();
  });

  it("rejects concurrent runs by the same UID or on the same cell", () => {
    expect(
      evaluateRunRequest(input({ activeRuns: [{ uid: "user-a", cellId: "other", deadline: 15_000 }] })),
    ).toMatchObject({ code: "uid-busy" });
    expect(
      evaluateRunRequest(input({ activeRuns: [{ uid: "user-b", cellId: "cell-a", deadline: 15_000 }] })),
    ).toMatchObject({ code: "cell-busy" });
    expect(
      evaluateRunRequest(input({ activeRuns: [{ uid: "user-a", cellId: "cell-a", deadline: 9_999 }] })),
    ).toBeNull();
  });

  it("rejects stale hashes and oversized source", () => {
    expect(evaluateRunRequest(input({ sourceHash: "c".repeat(64) }))).toMatchObject({ code: "hash-mismatch" });
    expect(evaluateRunRequest(input({ source: "x".repeat(RELAY_LIMITS.maxSourceBytes + 1) }))).toMatchObject({
      code: "source-too-large",
    });
  });

  it("measures the source limit in UTF-8 bytes", () => {
    expect(
      evaluateRunRequest(input({ source: "é".repeat(RELAY_LIMITS.maxSourceBytes / 2) })),
    ).toBeNull();
    expect(
      evaluateRunRequest(input({ source: "é".repeat(RELAY_LIMITS.maxSourceBytes / 2 + 1) })),
    ).toMatchObject({ code: "source-too-large" });
  });
});
