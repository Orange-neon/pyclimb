export type RelayRateKind = "sync" | "awareness" | "control";

export interface RelayRateState {
  startedAt: number;
  syncFrames: number;
  awarenessFrames: number;
  controlFrames: number;
  bytes: number;
}

interface RelayRateLimits {
  windowMs: number;
  maxSyncFrames: number;
  maxAwarenessFrames: number;
  maxControlFrames: number;
  maxBytes: number;
}

export function consumeUidRate(
  otherSocketStates: Iterable<RelayRateState | undefined>,
  currentSocketState: RelayRateState | undefined,
  kind: RelayRateKind,
  bytes: number,
  now: number,
  limits: RelayRateLimits,
): { state: RelayRateState; allowed: boolean } {
  const currentIsActive =
    currentSocketState &&
    now - currentSocketState.startedAt < limits.windowMs &&
    currentSocketState.startedAt <= now;
  const state: RelayRateState = currentIsActive
    ? { ...currentSocketState }
    : { startedAt: now, syncFrames: 0, awarenessFrames: 0, controlFrames: 0, bytes: 0 };

  if (kind === "sync") state.syncFrames += 1;
  else if (kind === "awareness") state.awarenessFrames += 1;
  else state.controlFrames += 1;
  state.bytes += Math.max(0, bytes);

  const total = { ...state };
  for (const candidate of otherSocketStates) {
    if (!candidate || now - candidate.startedAt >= limits.windowMs || candidate.startedAt > now) continue;
    total.syncFrames += candidate.syncFrames ?? 0;
    total.awarenessFrames += candidate.awarenessFrames ?? 0;
    total.controlFrames += candidate.controlFrames ?? 0;
    total.bytes += candidate.bytes ?? 0;
  }

  return {
    state,
    allowed:
      total.syncFrames <= limits.maxSyncFrames &&
      total.awarenessFrames <= limits.maxAwarenessFrames &&
      total.controlFrames <= limits.maxControlFrames &&
      total.bytes <= limits.maxBytes,
  };
}
