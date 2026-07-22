import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { getExecutableCellSource, removeExecutionForMissingCell } from "./execution-cell";

describe("execution records for deleted cells", () => {
  it("removes the matching running record and blocks late publication", () => {
    const document = new Y.Doc();
    const cell = new Y.Map<unknown>();
    cell.set("source", new Y.Text("print('hello')"));
    document.getMap<unknown>("cells").set("cell-a", cell);
    document.getMap<{ runId: string }>("executions").set("cell-a", { runId: "run-a" });

    cell.set("deleted", true);
    expect(getExecutableCellSource(document, "cell-a")).toBeNull();
    expect(removeExecutionForMissingCell(document, "cell-a", "run-a")).toBe(true);
    expect(document.getMap("executions").has("cell-a")).toBe(false);
  });

  it("does not remove a newer run's record", () => {
    const document = new Y.Doc();
    document.getMap<{ runId: string }>("executions").set("cell-a", { runId: "run-new" });
    expect(removeExecutionForMissingCell(document, "cell-a", "run-old")).toBe(true);
    expect(document.getMap("executions").get("cell-a")).toEqual({ runId: "run-new" });
  });
});
