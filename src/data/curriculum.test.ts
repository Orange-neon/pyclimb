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
    expect(counts).toEqual({
      "hello-world": 12,
      fundamentals: 50,
      "control-flow": 20,
      loops: 28,
      strings: 108,
      lists: 148,
      dictionaries: 34,
      functions: 66,
      modules: 66,
      classes: 68,
    });
    expect(Object.values(counts).reduce((total, count) => total + count, 0)).toBe(600);
    expect(filterProblemBankByTopics(bank, getDefaultTopicSelection(bank)).problems).toHaveLength(600);
  });

  it("doubles every topic within every difficulty tier", async () => {
    const bank = await loadProblemBank("v5");
    const expected = {
      easy: [12, 42, 16, 10, 68, 20, 8, 24, 22, 22],
      medium: [0, 0, 4, 10, 16, 64, 16, 22, 22, 24],
      hard: [0, 8, 0, 8, 24, 64, 10, 20, 22, 22],
    } as const;

    for (const [difficulty, topicCounts] of Object.entries(expected)) {
      const tier = bank.problems.filter((problem) => problem.difficulty === difficulty);
      expect(
        CURRICULUM_TOPICS.map(
          (topic) => tier.filter((problem) => getProblemTopic(problem) === topic.id).length,
        ),
      ).toEqual(topicCounts);
    }
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
