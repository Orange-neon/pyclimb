import type { ReactNode } from "react";

function inlineCode(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, index) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code
        key={`${part}-${index}`}
        className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[0.9em] text-sky-200"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

export function ProblemDescription({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-3 text-sm leading-6 text-slate-300">
      {markdown.split("\n").map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <div key={index} className="h-1" />;
        if (line.startsWith("### ")) {
          return (
            <h4 key={index} className="pt-1 text-xs font-black uppercase tracking-[0.18em] text-violet-300">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h3 key={index} className="pt-2 text-sm font-bold text-sky-200">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h2 key={index} className="text-xl font-black tracking-tight text-white">
              {line.slice(2)}
            </h2>
          );
        }
        return <p key={index}>{inlineCode(line)}</p>;
      })}
    </div>
  );
}
