import { describe, expect, it } from "vitest";

import { DocumentSizeBudget } from "./document-size-budget";

describe("document size budget", () => {
  it("uses cached estimates for small updates and requests periodic exact measurements", () => {
    const budget = new DocumentSizeBudget(1_000_000, 4, 10_000);
    budget.reset(100);

    for (let index = 0; index < 3; index += 1) {
      expect(budget.needsExactMeasurement(20)).toBe(false);
      budget.recordEstimatedUpdate(20);
    }
    expect(budget.estimate).toBe(160);
    expect(budget.needsExactMeasurement(20)).toBe(true);

    budget.recordExactMeasurement(130);
    expect(budget.pendingUpdates).toBe(0);
    expect(budget.estimate).toBe(130);
  });

  it("forces an exact merge check inside the cap guard band", () => {
    const budget = new DocumentSizeBudget(1_000, 32, 100);
    budget.reset(850);
    expect(budget.needsExactMeasurement(50)).toBe(false);
    expect(budget.needsExactMeasurement(51)).toBe(true);
  });
});
