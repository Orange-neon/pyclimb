import type { RelayChannel } from "./protocol";

/**
 * The ephemeral document generation ends only when a sync participant leaves
 * and no other authenticated sync transport remains. Control-only transports
 * neither retain nor prevent disposal of notebook state.
 */
export function shouldResetEphemeralDocument(
  disconnectedChannel: RelayChannel | undefined,
  remainingChannels: Iterable<RelayChannel>,
): boolean {
  if (disconnectedChannel !== "sync") return false;
  for (const channel of remainingChannels) {
    if (channel === "sync") return false;
  }
  return true;
}
