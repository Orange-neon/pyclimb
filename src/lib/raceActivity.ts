import type { RaceActivity } from "../types/multiplayer";

export type RaceActivityWriteKind = "publish" | "clear";

export interface RaceActivityWriteQueue {
  enqueue(
    key: string,
    write: () => Promise<void>,
    kind: RaceActivityWriteKind,
  ): Promise<void>;
}

export async function promoteRaceSpectatorAfterActivityCleanup<T>(
  clearActivity: () => Promise<void>,
  promote: () => Promise<T>,
): Promise<T> {
  // A spectator cannot publish activity. Once promotion commits they can, so
  // the stale record must be gone before membership changes and no trailing
  // cleanup may remain that could erase their first fresh publish.
  await clearActivity();
  return promote();
}

export function createRaceActivityWriteQueue(): RaceActivityWriteQueue {
  let revision = 0;
  const tailsByKey = new Map<string, Promise<void>>();
  const latestRevisionByKey = new Map<string, number>();

  return {
    enqueue(key, write, kind) {
      const writeRevision = ++revision;
      latestRevisionByKey.set(key, writeRevision);
      const previous = tailsByKey.get(key) ?? Promise.resolve();
      const next = previous
        .catch(() => undefined)
        .then(async () => {
          if (kind === "clear" && latestRevisionByKey.get(key) !== writeRevision) return;
          try {
            await write();
          } finally {
            if (latestRevisionByKey.get(key) === writeRevision) {
              latestRevisionByKey.delete(key);
            }
          }
        });
      tailsByKey.set(key, next);
      const release = () => {
        if (tailsByKey.get(key) === next) tailsByKey.delete(key);
      };
      void next.then(release, release);
      return next;
    },
  };
}

export function updateRaceActivityRecord(
  current: Record<string, RaceActivity>,
  uid: string,
  activity: RaceActivity | null,
): Record<string, RaceActivity> {
  if (activity) {
    if (current[uid] === activity) return current;
    return { ...current, [uid]: activity };
  }
  if (!(uid in current)) return current;
  const next = { ...current };
  delete next[uid];
  return next;
}
