import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const PROJECT_ID = "demo-col-collaboration";
const ROOM_CODE = "ABC234";
const ROOM_PATH = `collaborationRooms/${ROOM_CODE}`;
const INSTANCE_ID = "0123456789abcdef0123456789abcdef";

let testEnvironment: RulesTestEnvironment;

function googleDatabase(uid: string) {
  return testEnvironment.authenticatedContext(uid, {
    firebase: { sign_in_provider: "google.com" },
  }).database();
}

function anonymousDatabase(uid: string) {
  return testEnvironment.authenticatedContext(uid, {
    firebase: { sign_in_provider: "anonymous" },
    provider_id: "anonymous",
  }).database();
}

function member(uid: string, slot: number, nickname = `User ${slot}`) {
  return {
    uid,
    nickname,
    joinedAt: Date.now(),
    slot: String(slot),
  };
}

function room(
  creatorUid = "creator",
  additionalMembers: Array<{ uid: string; slot: number; nickname?: string }> = [],
) {
  const members: Record<string, ReturnType<typeof member>> = {
    [creatorUid]: member(creatorUid, 0, "Creator"),
  };
  const memberSlots: Record<string, string> = { "0": creatorUid };

  for (const entry of additionalMembers) {
    members[entry.uid] = member(entry.uid, entry.slot, entry.nickname);
    memberSlots[String(entry.slot)] = entry.uid;
  }

  const now = Date.now();
  return {
    meta: {
      creatorUid,
      roomInstanceId: INSTANCE_ID,
      schemaVersion: 1,
      status: "open",
      createdAt: now,
      leaseExpiresAt: now + 90_000,
    },
    members,
    memberSlots,
  };
}

async function seedRoom(value = room()) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await context.database().ref(ROOM_PATH).set(value);
  });
}

beforeAll(async () => {
  const rules = await readFile(new URL("../../database.rules.json", import.meta.url), "utf8");
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { rules },
  });
});

beforeEach(async () => {
  await testEnvironment.clearDatabase();
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("collaboration Realtime Database rules", () => {
  it("allows Google users to create rooms and rejects anonymous creators", async () => {
    await assertFails(anonymousDatabase("anonymous-user").ref(ROOM_PATH).set(room("anonymous-user")));
    await assertSucceeds(googleDatabase("creator").ref(ROOM_PATH).set(room()));
  });

  it("lets a Google creator replace an expired room even when their UID was already recorded", async () => {
    const expired = room("creator");
    expired.meta.leaseExpiresAt = Date.now() - 1_000;
    expired.members.creator = member("creator", 7, "Old name");
    expired.memberSlots = { "7": "creator" };
    await seedRoom(expired);

    const replacement = room("creator");
    replacement.members.creator.nickname = "New name";
    await assertSucceeds(googleDatabase("creator").ref(ROOM_PATH).set(replacement));
  });

  it("requires membership and slot claims to be created atomically", async () => {
    await seedRoom();
    const guest = anonymousDatabase("guest");
    const guestRecord = member("guest", 1, "Guest");

    await assertFails(guest.ref(`${ROOM_PATH}/members/guest`).set(guestRecord));
    await assertFails(guest.ref(`${ROOM_PATH}/memberSlots/1`).set("guest"));
    await assertSucceeds(guest.ref(ROOM_PATH).update({
      "members/guest": guestRecord,
      "memberSlots/1": "guest",
    }));
  });

  it("allows users to write only their own authorization record", async () => {
    await seedRoom(room("creator", [{ uid: "guest", slot: 1, nickname: "Guest" }]));
    const creator = googleDatabase("creator");

    await assertFails(creator.ref(`${ROOM_PATH}/members/guest/nickname`).set("Changed"));
    await assertFails(creator.ref(`${ROOM_PATH}/memberSlots/1`).set("creator"));
  });

  it("requires existing member and slot records to be removed together", async () => {
    await seedRoom(room("creator", [{ uid: "guest", slot: 1, nickname: "Guest" }]));
    const guest = anonymousDatabase("guest");

    await assertFails(guest.ref(`${ROOM_PATH}/members/guest`).remove());
    await assertFails(guest.ref(`${ROOM_PATH}/memberSlots/1`).remove());
    await assertSucceeds(guest.ref(ROOM_PATH).update({
      "members/guest": null,
      "memberSlots/1": null,
    }));
  });

  it("keeps room identity immutable while allowing a live member to renew its lease", async () => {
    await seedRoom(room("creator", [{ uid: "guest", slot: 1, nickname: "Guest" }]));
    const guest = anonymousDatabase("guest");

    await assertFails(guest.ref(`${ROOM_PATH}/meta/roomInstanceId`).set("fedcba9876543210fedcba9876543210"));
    await assertFails(guest.ref(`${ROOM_PATH}/meta/creatorUid`).set("guest"));
    await assertSucceeds(guest.ref(`${ROOM_PATH}/meta/leaseExpiresAt`).set(Date.now() + 90_000));
  });

  it("lets the creator leave without closing the room and only the final member delete it", async () => {
    await seedRoom(room("creator", [{ uid: "guest", slot: 1, nickname: "Guest" }]));
    const creator = googleDatabase("creator");
    const guest = anonymousDatabase("guest");

    await assertFails(creator.ref(ROOM_PATH).remove());
    await assertSucceeds(creator.ref(ROOM_PATH).update({
      "members/creator": null,
      "memberSlots/0": null,
    }));

    const meta = await assertSucceeds(guest.ref(`${ROOM_PATH}/meta`).once("value"));
    expect(meta.child("roomInstanceId").val()).toBe(INSTANCE_ID);
    await assertSucceeds(guest.ref(ROOM_PATH).remove());
  });

  it("rejects a thirty-first membership slot", async () => {
    const occupants = Array.from({ length: 29 }, (_, index) => ({
      uid: `member-${index + 1}`,
      slot: index + 1,
    }));
    await seedRoom(room("creator", occupants));

    const overflow = anonymousDatabase("overflow");
    await assertFails(overflow.ref(ROOM_PATH).update({
      "members/overflow": member("overflow", 30, "Overflow"),
      "memberSlots/30": "overflow",
    }));
  });
});
