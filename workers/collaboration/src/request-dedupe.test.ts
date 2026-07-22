import { describe, expect, it } from "vitest";

import {
  MAX_RECENT_REQUEST_IDS,
  fingerprintRequestId,
  registerRequestId,
} from "./request-dedupe";

describe("run request id deduplication", () => {
  it("rejects replay after the run cooldown while the entry is live", () => {
    const first = registerRequestId([], "request-a", 1_000);
    expect(first.duplicate).toBe(false);
    expect(registerRequestId(first.entries, "request-a", 2_000).duplicate).toBe(true);
  });

  it("deduplicates replicated ledgers from multiple sockets", () => {
    const first = registerRequestId([], "fingerprint-a", 1_000);
    const replay = registerRequestId(
      [...first.entries, ...first.entries],
      "fingerprint-a",
      2_000,
    );
    expect(replay.duplicate).toBe(true);
    expect(replay.entries).toEqual(first.entries);
  });

  it("uses stable, fixed-size request fingerprints", async () => {
    const first = await fingerprintRequestId("request-a");
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(await fingerprintRequestId("request-a")).toBe(first);
    expect(await fingerprintRequestId("request-b")).not.toBe(first);
  });

  it("expires old entries and keeps storage bounded", () => {
    const entries = Array.from({ length: 20 }, (_, index) => ({
      id: `request-${index}`,
      seenAt: 10_000 + index,
    }));
    const bounded = registerRequestId(entries, "request-new", 20_000, 8, 60_000);
    expect(bounded.duplicate).toBe(false);
    expect(bounded.entries).toHaveLength(8);
    expect(registerRequestId([{ id: "old", seenAt: 1_000 }], "old", 70_000).duplicate).toBe(false);
  });

  it("uses the attachment-safe default bound", () => {
    const entries = Array.from({ length: 20 }, (_, index) => ({ id: `id-${index}`, seenAt: index }));
    expect(registerRequestId(entries, "new", 100).entries).toHaveLength(MAX_RECENT_REQUEST_IDS);
  });
});
