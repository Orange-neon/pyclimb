import { Check, Layers3 } from "lucide-react";
import {
  CURRICULUM_TOPICS,
  expandTopicSelection,
  getProblemTopic,
  getTopicCounts,
  type CurriculumTopicId,
} from "../data/curriculum";
import type { ProblemBank } from "../data/problemTypes";

interface TopicSelectorProps {
  bank: ProblemBank;
  selected: CurriculumTopicId[];
  onChange: (selected: CurriculumTopicId[]) => void;
}

export function TopicSelector({ bank, selected, onChange }: TopicSelectorProps) {
  const counts = getTopicCounts(bank);
  const included = new Set(expandTopicSelection(selected));
  const includedChallengeCount = bank.problems.filter((problem) =>
    included.has(getProblemTopic(problem)),
  ).length;

  const toggle = (topicId: CurriculumTopicId) => {
    if (selected.includes(topicId)) {
      if (selected.length > 1) onChange(selected.filter((id) => id !== topicId));
      return;
    }
    onChange([...selected, topicId]);
  };

  return (
    <section className="panel mb-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
            <Layers3 size={20} />
          </div>
          <div>
            <h2 className="font-black text-white">Choose your topics</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Pick one or more focus topics. Earlier foundations are included automatically.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 px-3 py-2 text-right">
          <strong className="block text-sm text-sky-200">{includedChallengeCount} challenges</strong>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">included</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {CURRICULUM_TOPICS.map((topic) => {
          const isSelected = selected.includes(topic.id);
          const isIncluded = included.has(topic.id);
          const unavailable = counts[topic.id] === 0;
          return (
            <button
              key={topic.id}
              type="button"
              disabled={unavailable}
              aria-pressed={isSelected}
              onClick={() => toggle(topic.id)}
              className={`relative min-h-20 rounded-xl border p-3 text-left transition ${
                isSelected
                  ? "border-sky-300/70 bg-sky-400/15 text-white ring-1 ring-sky-300/30"
                  : isIncluded
                    ? "border-violet-400/25 bg-violet-400/5 text-slate-300"
                    : "border-slate-800 bg-slate-950/35 text-slate-500 hover:border-slate-700"
              } disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950/20 disabled:opacity-45`}
            >
              <span className="flex items-center justify-between gap-2">
                <strong className="text-xs">{topic.label}</strong>
                {isSelected ? (
                  <span className="grid size-5 place-items-center rounded-full bg-sky-300 text-slate-950">
                    <Check size={12} strokeWidth={3} />
                  </span>
                ) : (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
                    {unavailable ? "Soon" : isIncluded ? "Included" : counts[topic.id]}
                  </span>
                )}
              </span>
              <span className="mt-2 block text-[10px] leading-4 text-slate-500">
                {unavailable ? "No dedicated challenges in v1 yet" : topic.description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
