import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  INITIAL_CELL_ID,
  MAX_CELL_SOURCE_BYTES,
  MAX_EXECUTION_OUTPUT_BYTES,
  addNotebookCell,
  applyInitialNotebookUpdate,
  deleteNotebookCell,
  getNotebookCellOrder,
  getNotebookCellSource,
  getNotebookCells,
  getNotebookExecutions,
  hashNotebookSource,
  ensureNotebookHasCell,
  moveNotebookCell,
  normalizeNotebookStructure,
  readNotebookSnapshot,
  truncateExecutionOutput,
  trimNotebookCellSource,
} from "./collaborationNotebook";

function synchronize(left: Y.Doc, right: Y.Doc): void {
  const leftUpdate = Y.encodeStateAsUpdate(left, Y.encodeStateVector(right));
  const rightUpdate = Y.encodeStateAsUpdate(right, Y.encodeStateVector(left));
  Y.applyUpdate(left, rightUpdate);
  Y.applyUpdate(right, leftUpdate);
}

describe("collaboration notebook document", () => {
  it("applies the checked-in initial cell update idempotently", () => {
    const document = new Y.Doc();
    applyInitialNotebookUpdate(document);
    applyInitialNotebookUpdate(document);

    const snapshot = readNotebookSnapshot(document);
    expect(snapshot.cells).toHaveLength(1);
    expect(snapshot.cells[0].id).toBe(INITIAL_CELL_ID);
    expect(snapshot.cells[0].source.toString()).toBe("");
  });

  it("converges concurrent edits to the same cell", () => {
    const left = new Y.Doc();
    const right = new Y.Doc();
    applyInitialNotebookUpdate(left);
    applyInitialNotebookUpdate(right);

    getNotebookCellSource(left, INITIAL_CELL_ID)!.insert(0, "left");
    getNotebookCellSource(right, INITIAL_CELL_ID)!.insert(0, "right");
    synchronize(left, right);

    expect(getNotebookCellSource(left, INITIAL_CELL_ID)!.toString()).toBe(
      getNotebookCellSource(right, INITIAL_CELL_ID)!.toString(),
    );
    expect(getNotebookCellSource(left, INITIAL_CELL_ID)!.toString()).toContain("left");
    expect(getNotebookCellSource(left, INITIAL_CELL_ID)!.toString()).toContain("right");
  });

  it("deduplicates the rendered structure after concurrent inserts and moves", () => {
    const left = new Y.Doc();
    const right = new Y.Doc();
    applyInitialNotebookUpdate(left);
    applyInitialNotebookUpdate(right);
    const leftId = addNotebookCell(left, INITIAL_CELL_ID)!;
    const rightId = addNotebookCell(right, INITIAL_CELL_ID)!;
    synchronize(left, right);

    moveNotebookCell(left, leftId, -1);
    moveNotebookCell(right, rightId, 1);
    synchronize(left, right);

    const leftIds = readNotebookSnapshot(left).cells.map((cell) => cell.id);
    const rightIds = readNotebookSnapshot(right).cells.map((cell) => cell.id);
    expect(leftIds).toEqual(rightIds);
    expect(new Set(leftIds).size).toBe(3);
  });

  it("deterministically removes concurrent overflow beyond fifty cells", () => {
    const left = new Y.Doc();
    const right = new Y.Doc();
    applyInitialNotebookUpdate(left);
    for (let index = 1; index < 49; index += 1) addNotebookCell(left);
    synchronize(left, right);

    addNotebookCell(left);
    addNotebookCell(right);
    synchronize(left, right);
    normalizeNotebookStructure(left);
    normalizeNotebookStructure(right);
    synchronize(left, right);
    expect(normalizeNotebookStructure(left)).toBe(false);
    expect(normalizeNotebookStructure(right)).toBe(false);

    expect(readNotebookSnapshot(left).cells).toHaveLength(50);
    expect(readNotebookSnapshot(right).cells.map((cell) => cell.id)).toEqual(
      readNotebookSnapshot(left).cells.map((cell) => cell.id),
    );
    deleteNotebookCell(left, readNotebookSnapshot(left).cells[0].id);
    synchronize(left, right);
    expect(readNotebookSnapshot(left).cells).toHaveLength(49);
    expect(readNotebookSnapshot(right).cells).toHaveLength(49);
  });

  it("clears rather than removes the final cell", () => {
    const document = new Y.Doc();
    applyInitialNotebookUpdate(document);
    getNotebookCellSource(document, INITIAL_CELL_ID)!.insert(0, "print('keep a cell')");

    expect(deleteNotebookCell(document, INITIAL_CELL_ID)).toBe(true);
    expect(readNotebookSnapshot(document).cells).toHaveLength(1);
    expect(getNotebookCellSource(document, INITIAL_CELL_ID)!.toString()).toBe("");
  });

  it("does not retain live cell maps or order entries after repeated deletion", () => {
    const document = new Y.Doc();
    applyInitialNotebookUpdate(document);

    for (let index = 0; index < 200; index += 1) {
      const id = addNotebookCell(document, INITIAL_CELL_ID)!;
      getNotebookCellSource(document, id)!.insert(0, "temporary source");
      expect(deleteNotebookCell(document, id)).toBe(true);
    }

    expect(getNotebookCells(document).size).toBe(1);
    expect(getNotebookCellOrder(document).toArray()).toEqual([INITIAL_CELL_ID]);
    expect(readNotebookSnapshot(document).cells).toHaveLength(1);
  });

  it("cleans legacy deleted maps during structure normalization", () => {
    const document = new Y.Doc();
    applyInitialNotebookUpdate(document);
    const id = addNotebookCell(document, INITIAL_CELL_ID)!;
    getNotebookCells(document).get(id)!.set("deleted", true);

    expect(normalizeNotebookStructure(document)).toBe(true);
    expect(getNotebookCells(document).has(id)).toBe(false);
    expect(getNotebookCellOrder(document).toArray()).not.toContain(id);
  });

  it("sweeps executions whose cells are no longer in the visible notebook", () => {
    const document = new Y.Doc();
    applyInitialNotebookUpdate(document);
    const execution = {
      runId: "run-orphan",
      status: "running" as const,
      ranBy: { uid: "user-1", nickname: "Ada" },
      acceptedAt: 100,
      sourceHash: "a".repeat(64),
    };
    getNotebookExecutions(document).set(INITIAL_CELL_ID, execution);
    getNotebookExecutions(document).set("cell-deleted-during-run", execution);

    expect(normalizeNotebookStructure(document)).toBe(true);
    expect(getNotebookExecutions(document).has(INITIAL_CELL_ID)).toBe(true);
    expect(getNotebookExecutions(document).has("cell-deleted-during-run")).toBe(false);
    expect(normalizeNotebookStructure(document)).toBe(false);
  });

  it("repairs concurrent deletion of every cell with one blank cell", () => {
    const left = new Y.Doc();
    const right = new Y.Doc();
    applyInitialNotebookUpdate(left);
    const secondId = addNotebookCell(left, INITIAL_CELL_ID)!;
    getNotebookCellSource(left, INITIAL_CELL_ID)!.insert(0, "first secret");
    getNotebookCellSource(left, secondId)!.insert(0, "second secret");
    synchronize(left, right);

    deleteNotebookCell(left, INITIAL_CELL_ID);
    deleteNotebookCell(right, secondId);
    synchronize(left, right);
    ensureNotebookHasCell(left);
    ensureNotebookHasCell(right);
    synchronize(left, right);

    const leftCells = readNotebookSnapshot(left).cells;
    const rightCells = readNotebookSnapshot(right).cells;
    expect(leftCells).toHaveLength(1);
    expect(rightCells).toHaveLength(1);
    expect(leftCells[0].id).toBe(rightCells[0].id);
    expect(leftCells[0].source.toString()).toBe("");
    expect(rightCells[0].source.toString()).toBe("");
  });

  it("trims oversized cell sources to the collaboration limit", () => {
    const document = new Y.Doc();
    const source = document.getText("oversized-source");
    source.insert(0, "x".repeat(60 * 1024));
    expect(trimNotebookCellSource(source)).toBe(true);
    expect(source.length).toBe(50 * 1024);
    expect(trimNotebookCellSource(source)).toBe(false);

    const unicode = document.getText("oversized-unicode-source");
    unicode.insert(0, "🙂".repeat(20 * 1024));
    expect(trimNotebookCellSource(unicode)).toBe(true);
    expect(new TextEncoder().encode(unicode.toString()).byteLength).toBeLessThanOrEqual(
      MAX_CELL_SOURCE_BYTES,
    );
    expect(unicode.toString()).not.toContain("�");
  });

  it("reads plain shared execution records", () => {
    const document = new Y.Doc();
    applyInitialNotebookUpdate(document);
    getNotebookExecutions(document).set(INITIAL_CELL_ID, {
      runId: "run-1",
      sequence: 1,
      status: "finished",
      ranBy: { uid: "user-1", nickname: "Ada" },
      acceptedAt: 100,
      completedAt: 120,
      sourceHash: "a".repeat(64),
      stdout: "hello\n",
    });

    expect(readNotebookSnapshot(document).cells[0].execution).toMatchObject({
      status: "finished",
      ranBy: { nickname: "Ada" },
      stdout: "hello\n",
    });
  });

  it("hashes source and bounds combined execution output", async () => {
    expect(await hashNotebookSource("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    const bounded = truncateExecutionOutput({ stdout: "x".repeat(MAX_EXECUTION_OUTPUT_BYTES + 100) });
    const encodedLength = new TextEncoder().encode(
      bounded.stdout + bounded.stderr + (bounded.error ?? ""),
    ).byteLength;
    expect(encodedLength).toBeLessThanOrEqual(MAX_EXECUTION_OUTPUT_BYTES);
    expect(bounded.stderr).toContain("output truncated");

    const noisyError = truncateExecutionOutput({
      stdout: "noise".repeat(MAX_EXECUTION_OUTPUT_BYTES),
      error: "ValueError: important failure",
    });
    expect(noisyError.error).toBe("ValueError: important failure");

    const unicode = truncateExecutionOutput({ stdout: "🙂".repeat(MAX_EXECUTION_OUTPUT_BYTES) });
    expect(
      new TextEncoder().encode(unicode.stdout + unicode.stderr + (unicode.error ?? "")).byteLength,
    ).toBeLessThanOrEqual(MAX_EXECUTION_OUTPUT_BYTES);
  });
});
