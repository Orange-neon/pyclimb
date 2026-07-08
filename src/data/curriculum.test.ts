import { describe, expect, it } from "vitest";
import { loadProblemBank } from "./problemBank";
import {
  CURRICULUM_TOPICS,
  expandTopicSelection,
  filterProblemBankByTopics,
  getDefaultTopicSelection,
  getProblemTopic,
  getTopicCounts,
  parseTopicSelection,
  serializeTopicSelection,
} from "./curriculum";

describe("curriculum topic selection", () => {
  it("includes every earlier prerequisite through the hardest selected topic", () => {
    expect(expandTopicSelection(["functions"])).toEqual([
      "hello-world",
      "fundamentals",
      "control-flow",
      "loops",
      "strings",
      "lists",
      "dictionaries",
      "functions",
    ]);
    expect(expandTopicSelection(["control-flow", "lists"])).toEqual(
      CURRICULUM_TOPICS.slice(0, 6).map((topic) => topic.id),
    );
  });

  it("classifies and filters the existing bank without losing problems", async () => {
    const bank = await loadProblemBank();
    const counts = getTopicCounts(bank);
    expect(Object.values(counts).reduce((total, count) => total + count, 0)).toBe(90);
    expect(counts["dictionaries"]).toBeGreaterThan(0);
    expect(counts.functions).toBe(0);
    expect(filterProblemBankByTopics(bank, getDefaultTopicSelection(bank)).problems).toHaveLength(90);
  });

  it("places representative problems in their teaching topics", async () => {
    const bank = await loadProblemBank();
    const byId = (id: string) => bank.problems.find((problem) => problem.id === id)!;
    expect(getProblemTopic(byId("friendly-greeting"))).toBe("hello-world");
    expect(getProblemTopic(byId("inventory-ledger"))).toBe("dictionaries");
    expect(getProblemTopic(byId("list-sum"))).toBe("lists");
  });

  it("round-trips valid room metadata and ignores unknown topics", () => {
    expect(parseTopicSelection(serializeTopicSelection(["loops", "lists"]))).toEqual([
      "loops",
      "lists",
    ]);
    expect(parseTopicSelection("unknown,strings")).toEqual(["strings"]);
    expect(parseTopicSelection(undefined)).toBeNull();
  });
});
