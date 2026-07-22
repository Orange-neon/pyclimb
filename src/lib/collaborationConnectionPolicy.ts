export type RelayCloseDisposition = "refresh-ticket" | "fatal" | "reconnect";
export type DisconnectedRelayStatus = "connecting" | "unsynced" | "offline" | "error";

export function classifyRelayClose(code: number, reason: string): RelayCloseDisposition {
  if (code === 1008 && /ticket|expired/i.test(reason)) return "refresh-ticket";
  if (code === 1008 || code === 1009) return "fatal";
  return "reconnect";
}

export function isRetryableRelayTicketStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function disconnectedRelayStatus(
  online: boolean,
  fatal: boolean,
  wasSynchronized: boolean,
): DisconnectedRelayStatus {
  if (fatal) return "error";
  if (!online) return "offline";
  return wasSynchronized ? "unsynced" : "connecting";
}
