export interface RecentRequestId {
  id: string;
  seenAt: number;
}

export interface RequestIdRegistration {
  duplicate: boolean;
  entries: RecentRequestId[];
}

export const MAX_RECENT_REQUEST_IDS = 8;

/** A fixed-size 128-bit fingerprint keeps hibernating attachments bounded. */
export async function fingerprintRequestId(requestId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(requestId));
  return Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function registerRequestId(
  existing: Iterable<RecentRequestId>,
  requestId: string,
  now: number,
  maxEntries = MAX_RECENT_REQUEST_IDS,
  ttlMs = 60_000,
): RequestIdRegistration {
  const byId = new Map<string, RecentRequestId>();
  for (const entry of existing) {
    if (
      typeof entry.id === "string" &&
      Number.isFinite(entry.seenAt) &&
      now - entry.seenAt < ttlMs &&
      entry.seenAt <= now + 5_000
    ) {
      const prior = byId.get(entry.id);
      if (!prior || prior.seenAt < entry.seenAt) byId.set(entry.id, entry);
    }
  }

  const duplicate = byId.has(requestId);
  if (!duplicate) byId.set(requestId, { id: requestId, seenAt: now });
  const entries = Array.from(byId.values())
    .sort((left, right) => left.seenAt - right.seenAt)
    .slice(-maxEntries);
  return { duplicate, entries };
}
