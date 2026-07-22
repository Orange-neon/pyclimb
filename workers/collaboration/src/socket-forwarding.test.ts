import { describe, expect, it } from "vitest";

import { VERIFIED_TICKET_HEADER, forwardVerifiedSocketRequest } from "./socket-forwarding";

describe("verified WebSocket request forwarding", () => {
  it("removes the ticket-bearing URL before PartyServer persists it", () => {
    const request = new Request(
      "https://relay.example/parties/collaboration-room/room-id?ticket=signed-secret&other=kept",
      { headers: { Origin: "https://frontend.example" } },
    );
    const forwarded = forwardVerifiedSocketRequest(request, "signed-secret");
    const url = new URL(forwarded.url);

    expect(url.searchParams.has("ticket")).toBe(false);
    expect(url.searchParams.get("other")).toBe("kept");
    expect(forwarded.headers.get(VERIFIED_TICKET_HEADER)).toBe("signed-secret");
    expect(forwarded.headers.get("Origin")).toBe("https://frontend.example");
  });
});
