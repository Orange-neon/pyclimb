import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COLLABORATION_SELECTION_BROADCAST_MS,
  optimizeCollaborationAwareness,
} from "./collaborationAwareness";

interface Change {
  added: number[];
  updated: number[];
  removed: number[];
}

type Handler = (change: Change, origin: unknown) => void;

class FakeAwareness {
  readonly handlers = new Set<Handler>();
  readonly fields = new Map<string, unknown>();

  setLocalStateField(field: string, value: unknown): void {
    this.fields.set(field, value);
    for (const handler of this.handlers) {
      handler({ added: [], updated: [1], removed: [] }, "local");
    }
  }

  on(_event: "change", handler: Handler): void {
    this.handlers.add(handler);
  }

  off(_event: "change", handler: Handler): void {
    this.handlers.delete(handler);
  }

  emitRemote(): void {
    for (const handler of this.handlers) {
      handler({ added: [], updated: [2], removed: [] }, "provider");
    }
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("collaboration awareness optimization", () => {
  it("sends the latest cursor at most once per 200 ms while forwarding other local fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const awareness = new FakeAwareness();
    const forwarded: Array<{ change: Change; origin: unknown }> = [];
    const providerHandler: Handler = (change, origin) => forwarded.push({ change, origin });
    awareness.on("change", providerHandler);
    const restore = optimizeCollaborationAwareness({
      awareness,
      _awarenessUpdateHandler: providerHandler,
    });

    awareness.setLocalStateField("selection", { head: 1 });
    awareness.setLocalStateField("selection", { head: 2 });
    awareness.setLocalStateField("selection", { head: 3 });
    expect(forwarded).toHaveLength(1);
    expect(awareness.fields.get("selection")).toEqual({ head: 1 });

    vi.advanceTimersByTime(COLLABORATION_SELECTION_BROADCAST_MS - 1);
    expect(forwarded).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(forwarded).toHaveLength(2);
    expect(awareness.fields.get("selection")).toEqual({ head: 3 });

    awareness.setLocalStateField("activeCellId", "cell-a");
    expect(forwarded).toHaveLength(3);
    restore();
  });

  it("does not echo remote awareness and restores the provider handler on cleanup", () => {
    vi.useFakeTimers();
    const awareness = new FakeAwareness();
    const providerHandler = vi.fn<Handler>();
    awareness.on("change", providerHandler);
    const restore = optimizeCollaborationAwareness({
      awareness,
      _awarenessUpdateHandler: providerHandler,
    });

    awareness.emitRemote();
    expect(providerHandler).not.toHaveBeenCalled();

    awareness.setLocalStateField("selection", { head: 1 });
    awareness.setLocalStateField("selection", { head: 2 });
    restore();
    vi.runAllTimers();
    expect(providerHandler).toHaveBeenCalledTimes(1);

    awareness.emitRemote();
    expect(providerHandler).toHaveBeenCalledTimes(2);
  });
});
