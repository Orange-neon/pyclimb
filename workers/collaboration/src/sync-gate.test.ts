import { describe, expect, it } from "vitest";

import { DocumentSyncGate } from "./sync-gate";

describe("hibernation document sync gate", () => {
  it("blocks a cold room until a client sends sync-step-2", () => {
    const gate = new DocumentSyncGate();
    gate.resetForStart(["client-a"]);

    expect(gate.ready).toBe(false);
    expect(gate.observeSyncSubtype("client-a", 0)).toBe(false);
    expect(gate.observeSyncSubtype("client-a", 2)).toBe(false);
    expect(gate.ready).toBe(false);
    expect(gate.observeSyncSubtype("client-a", 1)).toBe(true);
    expect(gate.ready).toBe(true);
  });

  it("waits for every surviving socket after a hibernation wake", () => {
    const gate = new DocumentSyncGate();
    gate.resetForStart(["client-a", "client-b"]);

    expect(gate.ready).toBe(false);
    expect(gate.observeSyncSubtype("client-a", 1)).toBe(false);
    expect(gate.ready).toBe(false);
    expect(gate.observeSyncSubtype("client-b", 1)).toBe(true);
    expect(gate.observeSyncSubtype("client-b", 1)).toBe(false);
  });

  it("can finish when the only outstanding responder disconnects", () => {
    const gate = new DocumentSyncGate();
    gate.resetForStart(["client-a", "client-b"]);
    expect(gate.observeSyncSubtype("client-a", 1)).toBe(false);
    expect(gate.removeResponder("client-b")).toBe(true);
    expect(gate.ready).toBe(true);
  });

  it("does not declare an empty room synchronized", () => {
    const gate = new DocumentSyncGate();
    gate.resetForStart();
    expect(gate.removeResponder("unknown")).toBe(false);
    expect(gate.ready).toBe(false);
  });
});
