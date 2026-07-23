import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  ensureNotebookHasCell,
  ensureRelayNotebookSchema,
  ensureSharedCellInputs,
  getExecutableCellSource,
  removeExecutionForMissingCell,
} from "./execution-cell";

const PRE_STDIN_NOTEBOOK_UPDATE_BASE64 =
  "AQbMmL2aBAAnAQVjZWxscwxjZWxsLWluaXRpYWwBKADMmL2aBAACaWQBdwxjZWxsLWluaXRpYWwoAMyYvZoEAAhsYW5ndWFnZQF3BnB5dGhvbigAzJi9mgQAB2RlbGV0ZWQBeScAzJi9mgQABnNvdXJjZQIIAQljZWxsT3JkZXIBdwxjZWxsLWluaXRpYWwA";
const INITIAL_STDIN_UPDATE_BASE64 = "AQGfxP+nCgAnAMyYvZoEAAVzdGRpbgIA";

function decodeBase64(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function synchronize(left: Y.Doc, right: Y.Doc): void {
  const leftUpdate = Y.encodeStateAsUpdate(left, Y.encodeStateVector(right));
  const rightUpdate = Y.encodeStateAsUpdate(right, Y.encodeStateVector(left));
  Y.applyUpdate(left, rightUpdate);
  Y.applyUpdate(right, leftUpdate);
}

describe("execution records for deleted cells", () => {
  it("uses the browser seed identity when the relay repairs the initial input first", () => {
    const relay = new Y.Doc();
    Y.applyUpdate(relay, decodeBase64(PRE_STDIN_NOTEBOOK_UPDATE_BASE64));

    const modernPeer = new Y.Doc();
    Y.applyUpdate(modernPeer, decodeBase64(PRE_STDIN_NOTEBOOK_UPDATE_BASE64));
    Y.applyUpdate(modernPeer, decodeBase64(INITIAL_STDIN_UPDATE_BASE64));
    const modernInput = modernPeer
      .getMap<Y.Map<unknown>>("cells")
      .get("cell-initial")
      ?.get("stdin");
    expect(modernInput).toBeInstanceOf(Y.Text);
    (modernInput as Y.Text).insert(0, "typed before initial sync");

    // Repairing before the modern peer's full state arrives must be safe. The
    // relay and browser attach content to the exact same nested Y.Text.
    expect(ensureSharedCellInputs(relay)).toBe(true);
    Y.applyUpdate(relay, Y.encodeStateAsUpdate(modernPeer));

    const relayInput = relay
      .getMap<Y.Map<unknown>>("cells")
      .get("cell-initial")
      ?.get("stdin");
    expect(relayInput).toBeInstanceOf(Y.Text);
    expect((relayInput as Y.Text).toString()).toBe("typed before initial sync");
  });

  it("authoritatively migrates legacy stdin before peers edit it concurrently", () => {
    const legacy = new Y.Doc();
    const cell = new Y.Map<unknown>();
    cell.set("source", new Y.Text("print(input())"));
    legacy.getMap<unknown>("cells").set("cell-a", cell);
    legacy.getArray<string>("cellOrder").push(["cell-a"]);

    const relay = new Y.Doc();
    Y.applyUpdate(relay, Y.encodeStateAsUpdate(legacy));
    expect(ensureSharedCellInputs(relay)).toBe(true);
    expect(ensureSharedCellInputs(relay)).toBe(false);

    const left = new Y.Doc();
    const right = new Y.Doc();
    const migratedState = Y.encodeStateAsUpdate(relay);
    Y.applyUpdate(left, migratedState);
    Y.applyUpdate(right, migratedState);
    const leftInput = (left.getMap<Y.Map<unknown>>("cells").get("cell-a")?.get("stdin"));
    const rightInput = (right.getMap<Y.Map<unknown>>("cells").get("cell-a")?.get("stdin"));
    expect(leftInput).toBeInstanceOf(Y.Text);
    expect(rightInput).toBeInstanceOf(Y.Text);

    (leftInput as Y.Text).insert(0, "LEFT");
    (rightInput as Y.Text).insert(0, "RIGHT");
    const leftUpdate = Y.encodeStateAsUpdate(left, Y.encodeStateVector(right));
    const rightUpdate = Y.encodeStateAsUpdate(right, Y.encodeStateVector(left));
    Y.applyUpdate(left, rightUpdate);
    Y.applyUpdate(right, leftUpdate);

    expect((leftInput as Y.Text).toString()).toBe((rightInput as Y.Text).toString());
    expect((leftInput as Y.Text).toString()).toContain("LEFT");
    expect((leftInput as Y.Text).toString()).toContain("RIGHT");
  });

  it("repairs a concurrently emptied notebook once before peers resume editing", () => {
    const original = new Y.Doc();
    Y.applyUpdate(original, decodeBase64(PRE_STDIN_NOTEBOOK_UPDATE_BASE64));
    Y.applyUpdate(original, decodeBase64(INITIAL_STDIN_UPDATE_BASE64));
    const second = new Y.Map<unknown>();
    second.set("source", new Y.Text("second"));
    second.set("stdin", new Y.Text("second-input"));
    original.getMap<unknown>("cells").set("cell-second", second);
    original.getArray<string>("cellOrder").push(["cell-second"]);
    original.getMap("executions").set("cell-initial", { runId: "old-initial" });
    original.getMap("executions").set("cell-second", { runId: "old-second" });

    const left = new Y.Doc();
    const right = new Y.Doc();
    Y.applyUpdate(left, Y.encodeStateAsUpdate(original));
    Y.applyUpdate(right, Y.encodeStateAsUpdate(original));

    const deleteCell = (document: Y.Doc, cellId: string) => {
      document.transact(() => {
        document.getMap("cells").delete(cellId);
        const order = document.getArray<string>("cellOrder");
        for (let index = order.length - 1; index >= 0; index -= 1) {
          if (order.get(index) === cellId) order.delete(index, 1);
        }
      });
    };
    deleteCell(left, "cell-initial");
    deleteCell(right, "cell-second");

    const relay = new Y.Doc();
    Y.applyUpdate(relay, Y.encodeStateAsUpdate(original));
    Y.applyUpdate(relay, Y.encodeStateAsUpdate(left));
    Y.applyUpdate(relay, Y.encodeStateAsUpdate(right));
    expect(Array.from(relay.getMap("cells").values()).some((cell) => (
      cell instanceof Y.Map &&
      cell.get("deleted") !== true &&
      cell.get("source") instanceof Y.Text
    ))).toBe(false);
    expect(ensureNotebookHasCell(relay)).toBe(true);
    expect(ensureRelayNotebookSchema(relay)).toBe(false);
    const repairedId = Array.from(relay.getMap("cells").keys())[0];
    expect(repairedId).not.toBe("cell-initial");
    expect(repairedId).not.toBe("cell-second");
    expect(relay.getArray<string>("cellOrder").toArray()).toEqual([repairedId]);
    expect(relay.getMap("executions").size).toBe(0);
    // A result already in flight for a deleted cell must still be recognized
    // as belonging to a missing cell, never to the blank replacement.
    expect(getExecutableCellSource(relay, "cell-initial")).toBeNull();
    expect(removeExecutionForMissingCell(relay, "cell-initial", "old-initial")).toBe(true);

    Y.applyUpdate(left, Y.encodeStateAsUpdate(relay));
    Y.applyUpdate(right, Y.encodeStateAsUpdate(relay));
    const leftCell = left.getMap<Y.Map<unknown>>("cells").get(repairedId);
    const rightCell = right.getMap<Y.Map<unknown>>("cells").get(repairedId);
    expect(leftCell?.get("source")).toBeInstanceOf(Y.Text);
    expect(leftCell?.get("stdin")).toBeInstanceOf(Y.Text);
    expect(rightCell?.get("source")).toBeInstanceOf(Y.Text);
    expect(rightCell?.get("stdin")).toBeInstanceOf(Y.Text);

    (leftCell?.get("source") as Y.Text).insert(0, "LEFT");
    (rightCell?.get("source") as Y.Text).insert(0, "RIGHT");
    (leftCell?.get("stdin") as Y.Text).insert(0, "left-input");
    (rightCell?.get("stdin") as Y.Text).insert(0, "right-input");
    synchronize(left, right);

    const mergedSource = (leftCell?.get("source") as Y.Text).toString();
    const mergedInput = (leftCell?.get("stdin") as Y.Text).toString();
    expect(mergedSource).toContain("LEFT");
    expect(mergedSource).toContain("RIGHT");
    expect(mergedInput).toContain("left-input");
    expect(mergedInput).toContain("right-input");
    expect((rightCell?.get("source") as Y.Text).toString()).toBe(mergedSource);
    expect((rightCell?.get("stdin") as Y.Text).toString()).toBe(mergedInput);
  });

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
