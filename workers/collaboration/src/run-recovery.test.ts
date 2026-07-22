import { describe, expect, it } from "vitest";

import { activeRunFromSharedExecution, recoveredRunDecision } from "./run-recovery";

const running = {
  runId: "run-a",
  sequence: 1,
  cellId: "cell-a",
  status: "running" as const,
  ranBy: { uid: "user-a", nickname: "Ada" },
  acceptedAt: 1_000,
  sourceHash: "a".repeat(64),
};

describe("run reconciliation after hibernation", () => {
  it("times out an overdue attachment only after the shared running record is restored", () => {
    const recovered = activeRunFromSharedExecution("cell-a", running);
    expect(recovered).not.toBeNull();
    expect(recoveredRunDecision(recovered!, true, 6_000)).toBe("timed_out");
  });

  it("interrupts a restored running record whose runner socket disappeared", () => {
    const recovered = activeRunFromSharedExecution("cell-a", running)!;
    expect(recoveredRunDecision(recovered, false, 2_000)).toBe("interrupted");
    expect(recoveredRunDecision(recovered, true, 2_000)).toBe("resume");
  });
});
