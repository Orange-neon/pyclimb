import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createBatchedDocumentBridge, type BatchedDocumentBridge } from "./collaborationBatchBridge";
import {
  INITIAL_CELL_ID,
  addNotebookCell,
  applyInitialNotebookUpdate,
  getNotebookCellInput,
  getNotebookCellSource,
  readNotebookSnapshot,
  replaceNotebookCellInput,
} from "./collaborationNotebook";

interface SimulatedClient {
  editor: Y.Doc;
  transport: Y.Doc;
  bridge: BatchedDocumentBridge;
}

function createClient(): SimulatedClient {
  const editor = new Y.Doc();
  const transport = new Y.Doc();
  applyInitialNotebookUpdate(editor);
  applyInitialNotebookUpdate(transport);
  return {
    editor,
    transport,
    bridge: createBatchedDocumentBridge(editor, transport),
  };
}

function exchange(left: Y.Doc, right: Y.Doc): void {
  const leftUpdate = Y.encodeStateAsUpdate(left, Y.encodeStateVector(right));
  const rightUpdate = Y.encodeStateAsUpdate(right, Y.encodeStateVector(left));
  Y.applyUpdate(left, rightUpdate, "provider");
  Y.applyUpdate(right, leftUpdate, "provider");
}

function notebookState(document: Y.Doc) {
  return readNotebookSnapshot(document).cells.map((cell) => ({
    id: cell.id,
    source: cell.source.toString(),
    stdin: cell.stdin?.toString() ?? null,
    execution: cell.execution,
  }));
}

describe("simulated collaborative notebook session", () => {
  it("converges seven concurrent editors after a partition without losing cells, code, or input", () => {
    const relay = new Y.Doc();
    const clients = Array.from({ length: 7 }, createClient);

    // Every client completes the initial room sync before edits are enabled.
    for (const client of clients) exchange(client.transport, relay);
    for (const client of clients) exchange(client.transport, relay);

    const addedCellIds: string[] = [];
    clients.forEach((client, index) => {
      const source = getNotebookCellSource(client.editor, INITIAL_CELL_ID)!;
      source.insert(source.length, `# participant-${index}\n`);
      replaceNotebookCellInput(
        getNotebookCellInput(client.editor, INITIAL_CELL_ID)!,
        `input-${index}`,
      );

      const addedCellId = addNotebookCell(client.editor, INITIAL_CELL_ID)!;
      addedCellIds.push(addedCellId);
      getNotebookCellSource(client.editor, addedCellId)!.insert(
        0,
        `print("cell from participant ${index}")`,
      );
      replaceNotebookCellInput(
        getNotebookCellInput(client.editor, addedCellId)!,
        `private-${index}`,
      );
      client.bridge.flush();
    });

    // The clients were partitioned while editing. Merge each retained provider
    // document into the relay, then broadcast the converged state back.
    for (const client of clients) exchange(client.transport, relay);
    for (const client of clients) exchange(client.transport, relay);

    const expected = notebookState(relay);
    expect(expected).toHaveLength(8);
    expect(new Set(expected.map((cell) => cell.id)).size).toBe(8);
    for (const addedCellId of addedCellIds) {
      expect(expected.some((cell) => cell.id === addedCellId)).toBe(true);
    }
    const sharedSource = getNotebookCellSource(relay, INITIAL_CELL_ID)!.toString();
    const sharedInput = getNotebookCellInput(relay, INITIAL_CELL_ID)!.toString();
    for (let index = 0; index < clients.length; index += 1) {
      expect(sharedSource).toContain(`# participant-${index}`);
      expect(sharedInput).toContain(`input-${index}`);
      const addedCell = expected.find((cell) => cell.id === addedCellIds[index]);
      expect(addedCell).toMatchObject({
        source: `print("cell from participant ${index}")`,
        stdin: `private-${index}`,
      });
    }

    for (const client of clients) {
      expect(notebookState(client.editor)).toEqual(expected);
      expect(notebookState(client.transport)).toEqual(expected);
    }

    for (const client of clients) client.bridge.destroy();
  });

  it("keeps editing responsive while remote updates cross an outstanding local batch", () => {
    const left = createClient();
    const right = createClient();
    const relay = new Y.Doc();
    exchange(left.transport, relay);
    exchange(right.transport, relay);
    exchange(left.transport, relay);

    const leftSource = getNotebookCellSource(left.editor, INITIAL_CELL_ID)!;
    const rightSource = getNotebookCellSource(right.editor, INITIAL_CELL_ID)!;
    leftSource.insert(0, "local pending\n");
    expect(left.bridge.pendingUpdateCount).toBe(1);

    rightSource.insert(0, "remote immediate\n");
    right.bridge.flush();
    exchange(right.transport, relay);
    Y.applyUpdate(
      left.transport,
      Y.encodeStateAsUpdate(relay, Y.encodeStateVector(left.transport)),
      "provider",
    );

    // Remote transport updates are mirrored synchronously even though the
    // client's own edit is still waiting for its 50 ms transport batch.
    expect(leftSource.toString()).toContain("remote immediate");
    expect(leftSource.toString()).toContain("local pending");
    expect(left.bridge.pendingUpdateCount).toBe(1);

    left.bridge.flush();
    exchange(left.transport, relay);
    exchange(right.transport, relay);
    exchange(left.transport, relay);

    expect(getNotebookCellSource(relay, INITIAL_CELL_ID)!.toString()).toBe(
      getNotebookCellSource(left.editor, INITIAL_CELL_ID)!.toString(),
    );
    expect(getNotebookCellSource(right.editor, INITIAL_CELL_ID)!.toString()).toBe(
      getNotebookCellSource(left.editor, INITIAL_CELL_ID)!.toString(),
    );

    left.bridge.destroy();
    right.bridge.destroy();
  });
});
