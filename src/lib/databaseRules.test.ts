import { describe, expect, it } from "vitest";
import databaseRules from "../../database.rules.json";

interface RuleNode {
  [key: string]: RuleNode | string | boolean;
}
const rules = databaseRules.rules as RuleNode;

describe("Realtime Database rule shape", () => {
  it("denies global reads and writes", () => {
    expect(rules[".read"]).toBe(false);
    expect(rules[".write"]).toBe(false);
  });

  it("requires authentication to read a room and gates unlimited rooms behind Google", () => {
    const room = ((rules.rooms as RuleNode).$code ?? {}) as RuleNode;
    const readRule = String(room[".read"]);
    expect(readRule).toContain("auth != null");
    expect(readRule).toContain("meta/unlimited");
    expect(readRule).toContain("!== true");
    expect(readRule).toContain("google.com");
  });

  it("limits leaderboard and progress writes to their owner or host", () => {
    const room = ((rules.rooms as RuleNode).$code ?? {}) as RuleNode;
    const leaderboardUser = (((room.leaderboard as RuleNode).$uid ?? {}) as RuleNode)[
      ".write"
    ];
    const progressUser = (((room.progress as RuleNode).$uid ?? {}) as RuleNode)[".write"];
    expect(String(leaderboardUser)).toContain("$uid === auth.uid");
    expect(String(progressUser)).toContain("$uid === auth.uid");
    expect(String(leaderboardUser)).toContain("hostUid");
    expect(String(progressUser)).toContain("hostUid");
  });

  it("bounds optional curriculum topic metadata", () => {
    const room = ((rules.rooms as RuleNode).$code ?? {}) as RuleNode;
    const metaValidation = String((room.meta as RuleNode)[".validate"]);
    expect(metaValidation).toContain("topicIds");
    expect(metaValidation).toContain("length <= 160");
    expect(metaValidation).toContain("unlimited");
    expect(metaValidation).toContain("isBoolean");
    expect(metaValidation).toContain("problemCount').val() <= 600");
  });

  it("allows timed room writes with auth and keeps unlimited writes Google-gated", () => {
    const room = ((rules.rooms as RuleNode).$code ?? {}) as RuleNode;
    const roomWrite = String(room[".write"]);
    const progressWrite = String(((room.progress as RuleNode).$uid as RuleNode)[".write"]);
    expect(roomWrite).toContain("auth != null");
    expect(roomWrite).toContain("newData.child('meta/unlimited').val() !== true");
    expect(roomWrite).toContain("google.com");
    expect(progressWrite).toContain("auth != null");
    expect(progressWrite).toContain("meta/unlimited");
    expect(progressWrite).toContain("google.com");
  });

  it("validates the free adaptive learning profile", () => {
    const room = ((rules.rooms as RuleNode).$code ?? {}) as RuleNode;
    const progress = ((room.progress as RuleNode).$uid ?? {}) as RuleNode;
    const adaptive = ((progress.adaptive as RuleNode).$difficulty ?? {}) as RuleNode;
    const validation = String(adaptive[".validate"]);
    expect(validation).toContain("$difficulty === 'easy'");
    expect(validation).toContain("rating");
    expect(validation).toContain("outcomes");
    expect(validation).toContain("forfeited");
    expect(validation).toContain("streak");
  });

  it("protects streak-gated leader challenges and challenge awards", () => {
    const room = ((rules.rooms as RuleNode).$code ?? {}) as RuleNode;
    const challenge = room.challenge as RuleNode;
    const challengeWrite = String(challenge[".write"]);
    expect(challengeWrite).toContain("meta/unlimited");
    expect(challengeWrite).toContain("val() !== true");
    expect(challengeWrite).toContain("child($code).child('meta/status').val() === 'active'");
    expect(challengeWrite).toContain("child('leaderboard').child(auth.uid)");
    expect(challengeWrite).toContain("child('progress').child(auth.uid).child('currentStreak')");
    expect(challengeWrite).toContain("championUid");
    expect(challengeWrite).toContain("winnerUid");
    expect(String(challenge[".validate"])).toContain("problemReward");
    const progress = ((room.progress as RuleNode).$uid ?? {}) as RuleNode;
    const awards = ((progress.challengeAwards as RuleNode).$challengeId ?? {}) as RuleNode;
    expect(String(awards[".validate"])).toContain("-2000");
  });

  it("requires Google authentication and a creator membership to create collaboration rooms", () => {
    const room = ((rules.collaborationRooms as RuleNode).$code ?? {}) as RuleNode;
    const roomWrite = String(room[".write"]);
    expect(roomWrite).toContain("google.com");
    expect(roomWrite).toContain("meta/creatorUid");
    expect(roomWrite).toContain("newData.child('members').child(auth.uid)");
    expect(roomWrite).toContain("newData.child('memberSlots').child('0')");
    expect(roomWrite).toContain("meta/leaseExpiresAt");
    expect(roomWrite).toContain("<= now");
  });

  it("keeps collaboration metadata identity immutable while members renew a bounded lease", () => {
    const room = ((rules.collaborationRooms as RuleNode).$code ?? {}) as RuleNode;
    const meta = room.meta as RuleNode;
    const validation = String(meta[".validate"]);
    expect(String(meta[".write"])).toContain("child('members').child(auth.uid)");
    expect(String(meta[".write"])).toContain("data.child('leaseExpiresAt').val() > now");
    expect(validation).toContain("roomInstanceId");
    expect(validation).toContain("schemaVersion').val() === 1");
    expect(validation).toContain("status').val() === 'open'");
    expect(validation).toContain("leaseExpiresAt");
    expect(validation).toContain("now + 120000");
    expect(validation).toContain("newData.child('creatorUid').val() === data.child('creatorUid').val()");
    expect(validation).not.toContain("source");
    expect(validation).not.toContain("output");
    expect(((meta.$other as RuleNode)[".validate"])).toBe(false);
    expect((((room.$other as RuleNode)[".validate"]))).toBe(false);
  });

  it("limits collaboration members to self-owned immutable records in live rooms", () => {
    const room = ((rules.collaborationRooms as RuleNode).$code ?? {}) as RuleNode;
    const member = (((room.members as RuleNode).$uid ?? {}) as RuleNode);
    const memberWrite = String(member[".write"]);
    const memberValidation = String(member[".validate"]);
    expect(memberWrite).toContain("$uid === auth.uid");
    expect(memberWrite).toContain("meta/status");
    expect(memberWrite).toContain("meta/leaseExpiresAt");
    expect(memberWrite).toContain("!newData.exists()");
    expect(memberWrite).toContain("newData.parent().parent().child('memberSlots')");
    expect(memberValidation).toContain("$uid === auth.uid");
    expect(memberValidation).toContain("nickname");
    expect(memberValidation).toContain("joinedAt");
    expect(memberValidation).toContain("meta/leaseExpiresAt");
    expect(memberValidation).toContain("google.com");
    expect(memberValidation).toContain("meta/creatorUid");
    expect(((member.$other as RuleNode)[".validate"])).toBe(false);
  });

  it("does not grant Google users a cascading room read", () => {
    const room = ((rules.collaborationRooms as RuleNode).$code ?? {}) as RuleNode;
    expect(room[".read"]).toBeUndefined();
    expect(String((room.meta as RuleNode)[".read"])).toContain("auth != null");
    expect(String((room.members as RuleNode)[".read"])).toContain("data.child(auth.uid)");
  });

  it("avoids unsupported child-count APIs", () => {
    expect(JSON.stringify(rules.collaborationRooms)).not.toContain("numChildren");
  });

  it("caps Firebase authorization records with thirty self-owned slots", () => {
    const room = ((rules.collaborationRooms as RuleNode).$code ?? {}) as RuleNode;
    const slots = room.memberSlots as RuleNode;
    const slot = slots.$slot as RuleNode;
    const writeRule = String(slot[".write"]);
    const validation = String(slot[".validate"]);
    expect(writeRule).toContain("$slot === '0'");
    expect(writeRule).toContain("$slot === '29'");
    expect(writeRule).not.toContain("$slot === '30'");
    expect(writeRule).toContain("newData.val() === auth.uid");
    expect(writeRule).toContain("!newData.exists()");
    expect(writeRule).toContain("child('members').child(auth.uid)");
    expect(writeRule).toContain("child('slot').val() === $slot");
    expect(validation).toContain("newData.isString()");
    expect(validation).toContain("child('members').child(auth.uid)");
  });

  it("requires existing members and slots to be removed atomically", () => {
    const room = ((rules.collaborationRooms as RuleNode).$code ?? {}) as RuleNode;
    const memberWrite = String((((room.members as RuleNode).$uid as RuleNode)[".write"]));
    const slotWrite = String((((room.memberSlots as RuleNode).$slot as RuleNode)[".write"]));

    // Explicit Leave is idempotent when a member or slot was already cleaned
    // up by another same-user browser context.
    expect(memberWrite).toContain("!newData.exists() && (!data.exists() ||");
    expect(slotWrite).toContain("!newData.exists() && (!data.exists() ||");

    // Once either half exists, both halves must disappear in the same write.
    expect(memberWrite).toContain(
      "data.parent().parent().child('memberSlots').child(data.child('slot').val()).val() === auth.uid",
    );
    expect(memberWrite).toContain(
      "!newData.parent().parent().child('memberSlots').child(data.child('slot').val()).exists()",
    );
    expect(slotWrite).toContain(
      "data.parent().parent().child('members').child(auth.uid).child('slot').val() === $slot",
    );
    expect(slotWrite).toContain(
      "!newData.parent().parent().child('members').child(auth.uid).exists()",
    );
  });

  it("allows root deletion only when all occupied slots belong to the caller", () => {
    const room = ((rules.collaborationRooms as RuleNode).$code ?? {}) as RuleNode;
    const writeRule = String(room[".write"]);
    expect(writeRule).toContain("data.exists() && !newData.exists()");
    expect(writeRule).toContain("data.child('members').child(auth.uid)");
    expect(writeRule).toContain("memberSlots').child('0').exists()");
    expect(writeRule).toContain("memberSlots').child('29').exists()");
    expect(writeRule).not.toContain("memberSlots').child('30')");
  });
});
