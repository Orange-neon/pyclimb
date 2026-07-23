import * as Y from "yjs";

const REMOTE_BRIDGE_ORIGIN = Symbol("collaboration-remote-update");
const LOCAL_BRIDGE_ORIGIN = Symbol("collaboration-local-batch");

// Cloudflare recommends 50–100 ms WebSocket batching for high-frequency
// realtime data. The lower bound keeps shared typing responsive while still
// coalescing Monaco/Yjs bursts into at most 20 transport updates per second.
export const COLLABORATION_EDIT_BATCH_MS = 50;

export interface BatchedDocumentBridge {
  flush(): void;
  destroy(): void;
  readonly pendingUpdateCount: number;
}

/**
 * Keeps an editor-facing document separate from the provider document. Remote
 * updates cross immediately; local updates are merged into one update every
 * `delayMs` to reduce relay frames.
 */
export function createBatchedDocumentBridge(
  editorDocument: Y.Doc,
  transportDocument: Y.Doc,
  delayMs = COLLABORATION_EDIT_BATCH_MS,
): BatchedDocumentBridge {
  let pendingCount = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const flush = () => {
    if (destroyed || pendingCount === 0) return;
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = null;
    // Encode the current differential instead of retaining every incremental
    // update. Besides batching frames, this lets Yjs garbage-collect text that
    // was inserted and then removed (for example, an oversized paste).
    const update = Y.encodeStateAsUpdate(editorDocument, Y.encodeStateVector(transportDocument));
    pendingCount = 0;
    Y.applyUpdate(transportDocument, update, LOCAL_BRIDGE_ORIGIN);
  };

  const handleEditorUpdate = (update: Uint8Array, origin: unknown) => {
    if (destroyed || origin === REMOTE_BRIDGE_ORIGIN) return;
    void update;
    pendingCount += 1;
    if (timeoutId === null) timeoutId = setTimeout(flush, delayMs);
  };

  const handleTransportUpdate = (update: Uint8Array, origin: unknown) => {
    if (destroyed || origin === LOCAL_BRIDGE_ORIGIN) return;
    Y.applyUpdate(editorDocument, update, REMOTE_BRIDGE_ORIGIN);
  };

  editorDocument.on("update", handleEditorUpdate);
  transportDocument.on("update", handleTransportUpdate);

  return {
    flush,
    destroy() {
      if (destroyed) return;
      flush();
      destroyed = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      editorDocument.off("update", handleEditorUpdate);
      transportDocument.off("update", handleTransportUpdate);
    },
    get pendingUpdateCount() {
      return pendingCount;
    },
  };
}
