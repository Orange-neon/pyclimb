import { describe, expect, it } from "vitest";
import type { RaceActivity } from "../types/multiplayer";
import {
  createRaceActivityWriteQueue,
  promoteRaceSpectatorAfterActivityCleanup,
  updateRaceActivityRecord,
} from "./raceActivity";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("race activity write queue", () => {
  it("serializes writes and skips a stale cleanup when an effect republishes", async () => {
    const firstWrite = deferred();
    const calls: string[] = [];
    const queue = createRaceActivityWriteQueue();

    const first = queue.enqueue("room/player", async () => {
      calls.push("first publish started");
      await firstWrite.promise;
      calls.push("first publish finished");
    }, "publish");
    const staleCleanup = queue.enqueue("room/player", async () => {
      calls.push("stale clear");
    }, "clear");
    const replacement = queue.enqueue("room/player", async () => {
      calls.push("replacement publish");
    }, "publish");

    expect(calls).toEqual([]);
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual(["first publish started"]);

    firstWrite.resolve();
    await Promise.all([first, staleCleanup, replacement]);

    expect(calls).toEqual([
      "first publish started",
      "first publish finished",
      "replacement publish",
    ]);
  });

  it("runs the final cleanup after an in-flight publish", async () => {
    const firstWrite = deferred();
    const calls: string[] = [];
    const queue = createRaceActivityWriteQueue();

    const publish = queue.enqueue("room/player", async () => {
      calls.push("publish started");
      await firstWrite.promise;
      calls.push("publish finished");
    }, "publish");
    const cleanup = queue.enqueue("room/player", async () => {
      calls.push("clear");
    }, "clear");

    await Promise.resolve();
    firstWrite.resolve();
    await Promise.all([publish, cleanup]);

    expect(calls).toEqual(["publish started", "publish finished", "clear"]);
  });

  it("continues with the newest write after an earlier write fails", async () => {
    const calls: string[] = [];
    const queue = createRaceActivityWriteQueue();

    const failed = queue.enqueue("room/player", async () => {
      calls.push("failed publish");
      throw new Error("offline");
    }, "publish");
    const replacement = queue.enqueue("room/player", async () => {
      calls.push("replacement publish");
    }, "publish");

    await expect(failed).rejects.toThrow("offline");
    await expect(replacement).resolves.toBeUndefined();
    expect(calls).toEqual(["failed publish", "replacement publish"]);
  });

  it("does not skip cleanup for a previous room when a new room publishes", async () => {
    const calls: string[] = [];
    const queue = createRaceActivityWriteQueue();

    const cleanup = queue.enqueue("old-room/player", async () => {
      calls.push("old room clear");
    }, "clear");
    const publish = queue.enqueue("new-room/player", async () => {
      calls.push("new room publish");
    }, "publish");

    await Promise.all([cleanup, publish]);
    expect(calls).toEqual(["old room clear", "new room publish"]);
  });

  it("does not let a stalled write in an old room delay a new room", async () => {
    const oldRoomWrite = deferred();
    const calls: string[] = [];
    const queue = createRaceActivityWriteQueue();

    const oldPublish = queue.enqueue("old-room/player", async () => {
      calls.push("old publish started");
      await oldRoomWrite.promise;
      calls.push("old publish finished");
    }, "publish");
    const newPublish = queue.enqueue("new-room/player", async () => {
      calls.push("new publish");
    }, "publish");

    await newPublish;
    expect(calls).toEqual(["old publish started", "new publish"]);

    oldRoomWrite.resolve();
    await oldPublish;
    expect(calls).toEqual([
      "old publish started",
      "new publish",
      "old publish finished",
    ]);
  });
});

describe("spectator promotion activity ordering", () => {
  it("waits for stale activity cleanup before membership promotion", async () => {
    const cleanup = deferred();
    const calls: string[] = [];

    const promotion = promoteRaceSpectatorAfterActivityCleanup(
      async () => {
        calls.push("cleanup started");
        await cleanup.promise;
        calls.push("cleanup finished");
      },
      async () => {
        calls.push("promotion committed");
        calls.push("fresh activity published");
      },
    );

    await Promise.resolve();
    expect(calls).toEqual(["cleanup started"]);

    cleanup.resolve();
    await promotion;
    expect(calls).toEqual([
      "cleanup started",
      "cleanup finished",
      "promotion committed",
      "fresh activity published",
    ]);
  });

  it("does not promote when stale activity cannot be cleared", async () => {
    let promoted = false;

    await expect(
      promoteRaceSpectatorAfterActivityCleanup(
        async () => {
          throw new Error("cleanup denied");
        },
        async () => {
          promoted = true;
        },
      ),
    ).rejects.toThrow("cleanup denied");
    expect(promoted).toBe(false);
  });
});

describe("race activity child updates", () => {
  const activity = (problemId: string): RaceActivity => ({
    problemId,
    phase: "active",
    source: `print(${JSON.stringify(problemId)})`,
    updatedAt: 100,
  });

  it("merges independent contestant updates without losing siblings", () => {
    const first = updateRaceActivityRecord({}, "ada", activity("easy-1"));
    const second = updateRaceActivityRecord(first, "grace", activity("medium-2"));
    const changed = updateRaceActivityRecord(second, "ada", activity("hard-3"));

    expect(changed).toEqual({
      ada: activity("hard-3"),
      grace: activity("medium-2"),
    });
  });

  it("removes only the departed contestant and reuses state for redundant removals", () => {
    const current = {
      ada: activity("easy-1"),
      grace: activity("medium-2"),
    };
    const removed = updateRaceActivityRecord(current, "ada", null);

    expect(removed).toEqual({ grace: activity("medium-2") });
    expect(updateRaceActivityRecord(removed, "ada", null)).toBe(removed);
  });
});
