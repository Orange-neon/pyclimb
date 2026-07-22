import { describe, expect, it } from "vitest";

import { compactConnectionTicket } from "./connection-auth";
import type { RelayTicketPayload } from "./protocol";
import { MAX_RECENT_REQUEST_IDS } from "./request-dedupe";

describe("hibernating connection state budget", () => {
  it("keeps a worst-case PartyServer attachment below its documented 2 KiB state cap", () => {
    const now = 1_000_000;
    const fullTicket: RelayTicketPayload = {
      version: 1,
      roomInstanceId: "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
      code: "ABC234",
      uid: "u".repeat(128),
      nickname: "n".repeat(40),
      role: "creator",
      channel: "sync",
      issuedAt: now,
      expiresAt: now + 60_000,
      nonce: "x".repeat(64),
    };
    const connectionId = "i".repeat(64);
    const attachment = {
      __pk: {
        id: connectionId,
        tags: [connectionId],
        // The signed ticket query is stripped before PartyServer accepts it.
        uri: `https://relay.example/parties/collaboration-room/${fullTicket.roomInstanceId}`,
      },
      __user: {
        __ypsAwarenessIds: [4_294_967_295],
        relay: {
          ticket: compactConnectionTicket(fullTicket),
          lastRunAt: now,
          activeRun: {
            runId: "r".repeat(128),
            sequence: Number.MAX_SAFE_INTEGER,
            cellId: "c".repeat(128),
            uid: fullTicket.uid,
            nickname: fullTicket.nickname,
            sourceHash: "f".repeat(64),
            acceptedAt: now,
            deadline: now + 5_000,
          },
          rate: {
            startedAt: now,
            syncFrames: 300,
            awarenessFrames: 900,
            controlFrames: 40,
            bytes: 10 * 1024 * 1024,
          },
          recentRequestIds: Array.from({ length: MAX_RECENT_REQUEST_IDS }, (_, index) => ({
            id: "a".repeat(32),
            seenAt: now - index,
          })),
        },
      },
    };

    const serializedBytes = new TextEncoder().encode(JSON.stringify(attachment)).byteLength;
    expect(serializedBytes).toBeLessThanOrEqual(2_048);
  });
});
