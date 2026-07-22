import { describe, expect, it } from "vitest";
import {
  classifyRelayClose,
  disconnectedRelayStatus,
  isRetryableRelayTicketStatus,
} from "./collaborationConnectionPolicy";

describe("collaboration connection policy", () => {
  it("refreshes expired tickets but stops automatic policy and size retries", () => {
    expect(classifyRelayClose(1008, "Invalid or expired relay ticket")).toBe("refresh-ticket");
    expect(classifyRelayClose(1008, "Room is full")).toBe("fatal");
    expect(classifyRelayClose(1009, "Shared document limit exceeded")).toBe("fatal");
    expect(classifyRelayClose(1006, "")).toBe("reconnect");
  });

  it("retries only transient ticket endpoint statuses automatically", () => {
    expect(isRetryableRelayTicketStatus(408)).toBe(true);
    expect(isRetryableRelayTicketStatus(429)).toBe(true);
    expect(isRetryableRelayTicketStatus(503)).toBe(true);
    expect(isRetryableRelayTicketStatus(401)).toBe(false);
    expect(isRetryableRelayTicketStatus(403)).toBe(false);
    expect(isRetryableRelayTicketStatus(404)).toBe(false);
    // Revoked membership and expired-room responses must stop the provider;
    // retrying them with y-partyserver's stale dynamic params is unsafe.
    expect(isRetryableRelayTicketStatus(410)).toBe(false);
  });

  it("distinguishes first connection from an interrupted synchronized room", () => {
    expect(disconnectedRelayStatus(true, false, false)).toBe("connecting");
    expect(disconnectedRelayStatus(true, false, true)).toBe("unsynced");
    expect(disconnectedRelayStatus(false, false, true)).toBe("offline");
    expect(disconnectedRelayStatus(true, true, true)).toBe("error");
  });
});
