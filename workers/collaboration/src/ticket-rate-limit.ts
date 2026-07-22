interface RateEntry {
  startedAt: number;
  count: number;
  lastSeenAt: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs: number;
}

/** A bounded, best-effort fixed-window limiter for a single Worker isolate. */
export class InMemoryRateLimiter {
  private entries = new Map<string, RateEntry>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys: number,
  ) {}

  consume(key: string, now = Date.now()): RateLimitDecision {
    let entry = this.entries.get(key);
    if (!entry || now - entry.startedAt >= this.windowMs) {
      entry = { startedAt: now, count: 0, lastSeenAt: now };
    }
    entry.count += 1;
    entry.lastSeenAt = now;
    this.entries.set(key, entry);
    this.prune(now);

    const retryAfterMs = Math.max(0, entry.startedAt + this.windowMs - now);
    return { allowed: entry.count <= this.limit, retryAfterMs };
  }

  private prune(now: number): void {
    if (this.entries.size <= this.maxKeys) return;
    for (const [key, entry] of this.entries) {
      if (now - entry.startedAt >= this.windowMs) this.entries.delete(key);
    }
    while (this.entries.size > this.maxKeys) {
      let oldestKey: string | undefined;
      let oldestSeen = Number.POSITIVE_INFINITY;
      for (const [key, entry] of this.entries) {
        if (entry.lastSeenAt < oldestSeen) {
          oldestSeen = entry.lastSeenAt;
          oldestKey = key;
        }
      }
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }
}
