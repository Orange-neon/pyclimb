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
});
