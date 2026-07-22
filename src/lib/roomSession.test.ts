import { describe, expect, it } from "vitest";
import {
  ACTIVE_ROOM_SESSION_KEY,
  LEGACY_PYCLIMB_SESSION_KEY,
  LEGACY_RACE_SESSION_KEY,
  clearActiveRoomSession,
  getCollaborationRoomSession,
  getRaceRoomSession,
  readActiveRoomSession,
  writeActiveRoomSession,
  writeRaceRoomSession,
} from "./roomSession";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("active room sessions", () => {
  it("migrates a race v0 session without changing its consumer shape", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEGACY_RACE_SESSION_KEY,
      JSON.stringify({ code: "ABC234", uid: "host-1", role: "host" }),
    );

    const active = readActiveRoomSession(storage);

    expect(active).toEqual({ kind: "race", code: "ABC234", uid: "host-1", role: "host" });
    expect(getRaceRoomSession(active)).toEqual({ code: "ABC234", uid: "host-1", role: "host" });
    expect(storage.getItem(LEGACY_RACE_SESSION_KEY)).toBeNull();
    expect(JSON.parse(storage.getItem(ACTIVE_ROOM_SESSION_KEY)!)).toEqual(active);
  });

  it("also migrates the original PyClimb session key", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEGACY_PYCLIMB_SESSION_KEY,
      JSON.stringify({ code: "XYZ234", uid: "player-1", role: "player", nickname: "Ada" }),
    );

    expect(getRaceRoomSession(readActiveRoomSession(storage))).toEqual({
      code: "XYZ234",
      uid: "player-1",
      role: "player",
      nickname: "Ada",
    });
    expect(storage.getItem(LEGACY_PYCLIMB_SESSION_KEY)).toBeNull();
  });

  it("round-trips collaboration sessions and excludes them from race consumers", () => {
    const storage = new MemoryStorage();
    const session = {
      kind: "collaboration" as const,
      code: "RMM234",
      uid: "member-1",
      nickname: "Grace",
      roomInstanceId: "2fdab893-9d68-4d0f-8f93-d3c5c39b1284",
      memberSlot: "7",
    };

    writeActiveRoomSession(session, storage);
    const active = readActiveRoomSession(storage);

    expect(getCollaborationRoomSession(active)).toEqual(session);
    expect(getRaceRoomSession(active)).toBeNull();
  });

  it("only clears a session when its kind matches", () => {
    const storage = new MemoryStorage();
    writeRaceRoomSession({ code: "ABC234", uid: "host-1", role: "host" }, storage);

    clearActiveRoomSession("collaboration", storage);
    expect(readActiveRoomSession(storage)?.kind).toBe("race");

    clearActiveRoomSession("race", storage);
    expect(readActiveRoomSession(storage)).toBeNull();
  });

  it("ignores malformed stored sessions", () => {
    const storage = new MemoryStorage();
    storage.setItem(ACTIVE_ROOM_SESSION_KEY, JSON.stringify({ kind: "collaboration", code: 42 }));
    expect(readActiveRoomSession(storage)).toBeNull();
  });

  it("clears collaboration sessions from the pre-slot format", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      ACTIVE_ROOM_SESSION_KEY,
      JSON.stringify({
        kind: "collaboration",
        code: "RMM234",
        uid: "member-1",
        nickname: "Grace",
        roomInstanceId: "2fdab893-9d68-4d0f-8f93-d3c5c39b1284",
      }),
    );
    expect(readActiveRoomSession(storage)).toBeNull();
  });
});
