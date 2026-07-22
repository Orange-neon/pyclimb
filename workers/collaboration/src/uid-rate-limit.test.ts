import { describe, expect, it } from "vitest";

import { consumeUidRate, type RelayRateState } from "./uid-rate-limit";

const limits = {
  windowMs: 1_000,
  maxSyncFrames: 2,
  maxAwarenessFrames: 2,
  maxControlFrames: 2,
  maxBytes: 100,
};

describe("per-UID relay rate limiting", () => {
  it("aggregates counters from multiple sockets for the same UID", () => {
    const first: RelayRateState = {
      startedAt: 100,
      syncFrames: 1,
      awarenessFrames: 0,
      controlFrames: 0,
      bytes: 10,
    };
    const second: RelayRateState = {
      startedAt: 120,
      syncFrames: 1,
      awarenessFrames: 0,
      controlFrames: 0,
      bytes: 10,
    };
    const result = consumeUidRate([second], first, "sync", 10, 200, limits);
    expect(result.allowed).toBe(false);
    expect(result.state).toMatchObject({ startedAt: 100, syncFrames: 2, bytes: 20 });
  });

  it("does not double-count an aggregate when traffic alternates between sockets", () => {
    const a1 = consumeUidRate([], undefined, "sync", 10, 100, limits).state;
    const b1 = consumeUidRate([a1], undefined, "sync", 10, 200, limits);
    expect(b1.allowed).toBe(true);
    const a2 = consumeUidRate([b1.state], a1, "sync", 10, 300, limits);
    expect(a2.allowed).toBe(false);
    expect(a2.state.syncFrames).toBe(2);
    expect(b1.state.syncFrames).toBe(1);
  });

  it("drops counters from expired windows", () => {
    const expired: RelayRateState = {
      startedAt: 100,
      syncFrames: 99,
      awarenessFrames: 0,
      controlFrames: 0,
      bytes: 99,
    };
    expect(consumeUidRate([], expired, "sync", 5, 1_100, limits)).toEqual({
      allowed: true,
      state: {
        startedAt: 1_100,
        syncFrames: 1,
        awarenessFrames: 0,
        controlFrames: 0,
        bytes: 5,
      },
    });
  });
});
