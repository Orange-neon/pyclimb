import { describe, expect, it } from "vitest";

import { executionStatusForResult } from "./execution-policy";
import { RELAY_LIMITS, truncateExecutionOutput } from "./protocol";

describe("execution result policy", () => {
  it("keeps error status when preceding output consumes the shared output cap", () => {
    const submittedError = "ValueError: boom";
    const bounded = truncateExecutionOutput(
      "x".repeat(RELAY_LIMITS.maxOutputBytes + 1),
      "",
      submittedError,
    );

    expect(bounded.error).toBe("");
    expect(executionStatusForResult(false, submittedError)).toBe("error");
  });

  it("gives timeout precedence and otherwise marks clean output finished", () => {
    expect(executionStatusForResult(true, "ValueError: late")).toBe("timed_out");
    expect(executionStatusForResult(false, undefined)).toBe("finished");
    expect(executionStatusForResult(false, "")).toBe("finished");
  });
});
