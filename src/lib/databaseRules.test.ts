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

  it("requires authentication to read a room", () => {
    const room = ((rules.rooms as RuleNode).$code ?? {}) as RuleNode;
    expect(String(room[".read"])).toContain("google.com");
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

  it("requires Google sign-in for room writes", () => {
    const room = ((rules.rooms as RuleNode).$code ?? {}) as RuleNode;
    expect(String(room[".write"])).toContain("sign_in_provider");
    expect(String(((room.progress as RuleNode).$uid as RuleNode)[".write"])).toContain("google.com");
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
    expect(String(challenge[".write"])).toContain("currentStreak");
    expect(String(challenge[".write"])).toContain("championUid");
    expect(String(challenge[".write"])).toContain("winnerUid");
    expect(String(challenge[".validate"])).toContain("problemReward");
    const progress = ((room.progress as RuleNode).$uid ?? {}) as RuleNode;
    const awards = ((progress.challengeAwards as RuleNode).$challengeId ?? {}) as RuleNode;
    expect(String(awards[".validate"])).toContain("-2000");
  });
});
