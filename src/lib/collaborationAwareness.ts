export const COLLABORATION_SELECTION_BROADCAST_MS = 200;

interface AwarenessChange {
  added: number[];
  updated: number[];
  removed: number[];
}

type AwarenessChangeHandler = (change: AwarenessChange, origin: unknown) => void;

interface CollaborationAwarenessLike {
  setLocalStateField(field: string, value: unknown): void;
  on(event: "change", handler: AwarenessChangeHandler): void;
  off(event: "change", handler: AwarenessChangeHandler): void;
}

interface CollaborationAwarenessProviderLike {
  awareness: CollaborationAwarenessLike;
  _awarenessUpdateHandler: AwarenessChangeHandler;
}

/**
 * Keeps remote awareness frames from being echoed back to the relay and limits
 * local cursor traffic. Presence/focus fields still cross immediately.
 */
export function optimizeCollaborationAwareness(
  provider: CollaborationAwarenessProviderLike,
  selectionBroadcastMs = COLLABORATION_SELECTION_BROADCAST_MS,
): () => void {
  const awareness = provider.awareness;
  const providerHandler = provider._awarenessUpdateHandler;
  const originalSetLocalStateField = awareness.setLocalStateField;
  let lastSelectionSentAt = Number.NEGATIVE_INFINITY;
  let pendingSelection: unknown;
  let hasPendingSelection = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let restored = false;

  const sendPendingSelection = () => {
    timeoutId = null;
    if (!hasPendingSelection || restored) return;
    const selection = pendingSelection;
    pendingSelection = undefined;
    hasPendingSelection = false;
    lastSelectionSentAt = Date.now();
    originalSetLocalStateField.call(awareness, "selection", selection);
  };

  awareness.setLocalStateField = (field: string, value: unknown) => {
    if (field !== "selection" || selectionBroadcastMs <= 0) {
      originalSetLocalStateField.call(awareness, field, value);
      return;
    }

    const elapsed = Date.now() - lastSelectionSentAt;
    if (timeoutId === null && elapsed >= selectionBroadcastMs) {
      lastSelectionSentAt = Date.now();
      originalSetLocalStateField.call(awareness, field, value);
      return;
    }

    pendingSelection = value;
    hasPendingSelection = true;
    if (timeoutId === null) {
      timeoutId = setTimeout(
        sendPendingSelection,
        Math.max(0, selectionBroadcastMs - Math.max(0, elapsed)),
      );
    }
  };

  const forwardLocalChange: AwarenessChangeHandler = (change, origin) => {
    // y-partyserver already broadcasts remote awareness to every peer. Its
    // stock provider forwards those remote changes back once per recipient;
    // only local state changes need to enter this room's relay connection.
    if (origin === "local") providerHandler(change, origin);
  };
  awareness.off("change", providerHandler);
  awareness.on("change", forwardLocalChange);

  return () => {
    if (restored) return;
    restored = true;
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = null;
    pendingSelection = undefined;
    hasPendingSelection = false;
    awareness.setLocalStateField = originalSetLocalStateField;
    awareness.off("change", forwardLocalChange);
    awareness.on("change", providerHandler);
  };
}
