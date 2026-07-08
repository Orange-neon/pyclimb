import type { Problem, ProblemBank } from "./problemTypes";

export const CURRICULUM_TOPICS = [
  { id: "hello-world", label: "Hello World", description: "Printing and first programs" },
  { id: "fundamentals", label: "Variables & Input", description: "Values, input, and arithmetic" },
  { id: "control-flow", label: "Control Flow", description: "Conditions and comparisons" },
  { id: "loops", label: "Loops", description: "For, while, and repetition" },
  { id: "strings", label: "Strings", description: "Text, indexing, and formatting" },
  { id: "lists", label: "Lists", description: "Collections, grids, and sorting" },
  { id: "dictionaries", label: "Dictionaries", description: "Keys, values, and aggregation" },
  { id: "functions", label: "Functions", description: "Reusable blocks of code" },
  { id: "modules", label: "Modules", description: "Imports and Python libraries" },
  { id: "classes", label: "Classes", description: "Objects, state, and methods" },
] as const;

export type CurriculumTopicId = (typeof CURRICULUM_TOPICS)[number]["id"];

const TOPIC_IDS = new Set<CurriculumTopicId>(CURRICULUM_TOPICS.map((topic) => topic.id));

function hasAnyTag(problem: Problem, tags: string[]): boolean {
  return tags.some((tag) => problem.tags.includes(tag));
}

export function getProblemTopic(problem: Problem): CurriculumTopicId {
  if (problem.id === "friendly-greeting") return "hello-world";
  if (hasAnyTag(problem, ["classes", "objects", "oop"])) return "classes";
  if (hasAnyTag(problem, ["modules", "imports"])) return "modules";
  if (hasAnyTag(problem, ["functions", "recursion"])) return "functions";
  if (problem.tags.includes("dictionaries")) return "dictionaries";
  if (
    hasAnyTag(problem, [
      "lists",
      "nested-lists",
      "grids",
      "sorting",
      "stacks",
    ])
  ) {
    return "lists";
  }
  if (problem.tags.includes("strings")) return "strings";
  if (hasAnyTag(problem, ["loops", "while-loops", "nested-loops", "range"])) return "loops";
  if (hasAnyTag(problem, ["conditionals", "comparisons"])) return "control-flow";
  if (problem.tags.includes("print")) return "hello-world";
  return "fundamentals";
}

export function getTopicCounts(bank: ProblemBank): Record<CurriculumTopicId, number> {
  const counts = Object.fromEntries(
    CURRICULUM_TOPICS.map((topic) => [topic.id, 0]),
  ) as Record<CurriculumTopicId, number>;
  for (const problem of bank.problems) counts[getProblemTopic(problem)] += 1;
  return counts;
}

export function getDefaultTopicSelection(bank: ProblemBank): CurriculumTopicId[] {
  const counts = getTopicCounts(bank);
  for (let index = CURRICULUM_TOPICS.length - 1; index >= 0; index -= 1) {
    const topic = CURRICULUM_TOPICS[index];
    if (counts[topic.id] > 0) return [topic.id];
  }
  return [];
}

export function expandTopicSelection(selected: CurriculumTopicId[]): CurriculumTopicId[] {
  const selectedIndexes = selected
    .map((id) => CURRICULUM_TOPICS.findIndex((topic) => topic.id === id))
    .filter((index) => index >= 0);
  if (!selectedIndexes.length) return [];
  const highestIndex = Math.max(...selectedIndexes);
  return CURRICULUM_TOPICS.slice(0, highestIndex + 1).map((topic) => topic.id);
}

export function filterProblemBankByTopics(
  bank: ProblemBank,
  selected: CurriculumTopicId[],
): ProblemBank {
  const included = new Set(expandTopicSelection(selected));
  return {
    ...bank,
    problems: bank.problems.filter((problem) => included.has(getProblemTopic(problem))),
  };
}

export function serializeTopicSelection(selected: CurriculumTopicId[]): string {
  return selected.filter((id) => TOPIC_IDS.has(id)).join(",");
}

export function parseTopicSelection(value?: string | null): CurriculumTopicId[] | null {
  if (value === undefined || value === null) return null;
  const selected = value
    .split(",")
    .filter((id): id is CurriculumTopicId => TOPIC_IDS.has(id as CurriculumTopicId));
  return selected.length ? [...new Set(selected)] : null;
}
