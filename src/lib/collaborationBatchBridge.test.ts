import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createBatchedDocumentBridge } from "./collaborationBatchBridge";

afterEach(() => vi.useRealTimers());

describe("batched collaboration document bridge", () => {
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
});
