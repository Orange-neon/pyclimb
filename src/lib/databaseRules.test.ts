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
    expect(room[".read"]).toBe("auth != null");
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
  });
});
