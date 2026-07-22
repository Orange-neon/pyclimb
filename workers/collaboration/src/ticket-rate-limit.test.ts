import { describe, expect, it } from "vitest";

import { InMemoryRateLimiter } from "./ticket-rate-limit";

describe("ticket request limiter", () => {
  it("limits each key and resets after the fixed window", () => {
    const limiter = new InMemoryRateLimiter(2, 1_000, 10);
    expect(limiter.consume("ip-a", 100).allowed).toBe(true);
    expect(limiter.consume("ip-a", 200).allowed).toBe(true);
    expect(limiter.consume("ip-a", 300)).toEqual({ allowed: false, retryAfterMs: 800 });
    expect(limiter.consume("ip-b", 300).allowed).toBe(true);
    expect(limiter.consume("ip-a", 1_100).allowed).toBe(true);
  });
});
