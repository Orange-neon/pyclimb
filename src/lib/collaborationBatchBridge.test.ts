import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  COLLABORATION_EDIT_BATCH_MS,
  createBatchedDocumentBridge,
} from "./collaborationBatchBridge";
import {
  INITIAL_CELL_ID,
  applyInitialNotebookUpdate,
  getNotebookCellInput,
  getNotebookCellSource,
} from "./collaborationNotebook";

afterEach(() => vi.useRealTimers());

describe("batched collaboration document bridge", () => {
  it("uses a 50 ms default latency while batching rapid local edits", () => {
    expect(COLLABORATION_EDIT_BATCH_MS).toBe(50);
    vi.useFakeTimers();
    const editor = new Y.Doc();
    const transport = new Y.Doc();
    const bridge = createBatchedDocumentBridge(editor, transport);
    const transportUpdates: Uint8Array[] = [];
    transport.on("update", (update) => transportUpdates.push(update));

    editor.getText("source").insert(0, "a");
    editor.getText("source").insert(1, "b");

    vi.advanceTimersByTime(COLLABORATION_EDIT_BATCH_MS - 1);
    expect(transportUpdates).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(transport.getText("source").toString()).toBe("ab");
    expect(transportUpdates).toHaveLength(1);
    expect(bridge.pendingUpdateCount).toBe(0);
  });

  it("merges local edits into one delayed transport update", () => {
    vi.useFakeTimers();
    const editor = new Y.Doc();
    const transport = new Y.Doc();
    const bridge = createBatchedDocumentBridge(editor, transport, 100);
    const transportUpdates: Uint8Array[] = [];
    transport.on("update", (update) => transportUpdates.push(update));

    editor.getText("source").insert(0, "a");
    editor.getText("source").insert(1, "b");
    editor.getText("source").insert(2, "c");
    expect(transport.getText("source").toString()).toBe("");
    expect(bridge.pendingUpdateCount).toBe(3);

    vi.advanceTimersByTime(99);
    expect(transportUpdates).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(transport.getText("source").toString()).toBe("abc");
    expect(transportUpdates).toHaveLength(1);
    expect(bridge.pendingUpdateCount).toBe(0);
  });

  it("applies remote transport updates to the editor immediately", () => {
    vi.useFakeTimers();
    const editor = new Y.Doc();
    const transport = new Y.Doc();
    createBatchedDocumentBridge(editor, transport, 100);
    const remote = new Y.Doc();
    remote.getText("source").insert(0, "remote");

    Y.applyUpdate(transport, Y.encodeStateAsUpdate(remote), "provider");

    expect(editor.getText("source").toString()).toBe("remote");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("flushes pending edits synchronously before leave", () => {
    vi.useFakeTimers();
    const editor = new Y.Doc();
    const transport = new Y.Doc();
    const bridge = createBatchedDocumentBridge(editor, transport, 100);
    editor.getText("source").insert(0, "saved on remaining screens");

    bridge.flush();

    expect(transport.getText("source").toString()).toBe("saved on remaining screens");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the provider document client id stable after mirrored local edits", () => {
    vi.useFakeTimers();
    const editor = new Y.Doc();
    const transport = new Y.Doc();
    const transportClientId = transport.clientID;
    const bridge = createBatchedDocumentBridge(editor, transport, 100);

    editor.getText("source").insert(0, "presence survives reconnect");
    bridge.flush();

    expect(editor.clientID).not.toBe(transport.clientID);
    expect(transport.clientID).toBe(transportClientId);
  });

  it("holds sustained typing to one transport update per 50 ms window", () => {
    vi.useFakeTimers();
    const editor = new Y.Doc();
    const transport = new Y.Doc();
    createBatchedDocumentBridge(editor, transport);
    const transportUpdates: Uint8Array[] = [];
    transport.on("update", (update) => transportUpdates.push(update));
    const source = editor.getText("source");

    for (let window = 0; window < 20; window += 1) {
      for (let edit = 0; edit < 25; edit += 1) {
        source.insert(source.length, String.fromCharCode(97 + ((window + edit) % 26)));
      }
      vi.advanceTimersByTime(COLLABORATION_EDIT_BATCH_MS - 1);
      expect(transportUpdates).toHaveLength(window);
      vi.advanceTimersByTime(1);
      expect(transportUpdates).toHaveLength(window + 1);
    }

    expect(source.length).toBe(500);
    expect(transport.getText("source").toString()).toBe(source.toString());
    expect(transportUpdates).toHaveLength(20);
  });

  it("reseeds a fresh relay generation with edits retained by a reconnecting browser", () => {
    vi.useFakeTimers();
    const editor = new Y.Doc();
    const transport = new Y.Doc();
    applyInitialNotebookUpdate(editor);
    applyInitialNotebookUpdate(transport);
    const bridge = createBatchedDocumentBridge(editor, transport);

    getNotebookCellSource(editor, INITIAL_CELL_ID)!.insert(0, "print('before disconnect')\n");
    bridge.flush();

    const firstRelayGeneration = new Y.Doc();
    Y.applyUpdate(firstRelayGeneration, Y.encodeStateAsUpdate(transport), "provider");
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(firstRelayGeneration), "provider");
    getNotebookCellSource(peer, INITIAL_CELL_ID)!.insert(
      getNotebookCellSource(peer, INITIAL_CELL_ID)!.length,
      "print('from peer')\n",
    );
    getNotebookCellInput(peer, INITIAL_CELL_ID)!.insert(0, "shared input");

    Y.applyUpdate(firstRelayGeneration, Y.encodeStateAsUpdate(peer), "provider");
    Y.applyUpdate(
      transport,
      Y.encodeStateAsUpdate(firstRelayGeneration, Y.encodeStateVector(transport)),
      "provider",
    );
    expect(getNotebookCellSource(editor, INITIAL_CELL_ID)!.toString()).toContain("from peer");
    expect(getNotebookCellInput(editor, INITIAL_CELL_ID)!.toString()).toBe("shared input");

    getNotebookCellSource(editor, INITIAL_CELL_ID)!.insert(
      getNotebookCellSource(editor, INITIAL_CELL_ID)!.length,
      "print('offline edit')\n",
    );
    bridge.flush();

    // Production discards the Durable Object's in-memory Y.Doc after the final
    // sync socket leaves. A reconnecting browser must be able to seed that
    // brand-new generation from its retained provider document.
    const freshRelayGeneration = new Y.Doc();
    Y.applyUpdate(freshRelayGeneration, Y.encodeStateAsUpdate(transport), "provider");
    const lateJoiner = new Y.Doc();
    Y.applyUpdate(lateJoiner, Y.encodeStateAsUpdate(freshRelayGeneration), "provider");

    const recoveredSource = getNotebookCellSource(lateJoiner, INITIAL_CELL_ID)!.toString();
    expect(recoveredSource).toContain("before disconnect");
    expect(recoveredSource).toContain("from peer");
    expect(recoveredSource).toContain("offline edit");
    expect(getNotebookCellInput(lateJoiner, INITIAL_CELL_ID)!.toString()).toBe("shared input");
  });
});
