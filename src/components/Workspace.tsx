import Editor from "@monaco-editor/react";
import { BookOpen, Braces } from "lucide-react";
import type { Problem } from "../data/problemTypes";
import { ProblemDescription } from "./ProblemDescription";

interface WorkspaceProps {
  problem: Problem | null;
  code: string;
  onCodeChange: (code: string) => void;
}

export function Workspace({ problem, code, onCodeChange }: WorkspaceProps) {
  if (!problem) {
    return (
      <section className="panel grid min-h-[620px] place-items-center overflow-hidden p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
            <Braces size={32} />
          </div>
          <h1 className="text-2xl font-black text-white">Choose your next climb</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Pick Easy, Medium, or Hard above. Your Python engine is warming up while you choose.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel grid min-h-[620px] grid-rows-[minmax(220px,0.75fr)_minmax(360px,1.25fr)] overflow-hidden">
      <div className="min-h-0 overflow-y-auto border-b border-slate-700/70 p-5">
        <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          <BookOpen size={15} /> Problem
        </div>
        <ProblemDescription markdown={problem.description} />
      </div>

      <div className="min-h-0 bg-[#0b1020]">
        <div className="flex h-10 items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span className="size-2 rounded-full bg-sky-400" /> solution.py
          </div>
          <span className="text-[10px] uppercase tracking-widest text-slate-600">Python 3</span>
        </div>
        <div className="h-[calc(100%-2.5rem)]">
          <Editor
            height="100%"
            language="python"
            theme="vs-dark"
            value={code}
            onChange={(value) => onCodeChange(value ?? "")}
            loading={<div className="p-5 text-sm text-slate-500">Loading editor…</div>}
            options={{
              minimap: { enabled: false },
              fontSize: 15,
              lineHeight: 23,
              tabSize: 4,
              insertSpaces: true,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 14, bottom: 14 },
              renderLineHighlight: "gutter",
              smoothScrolling: true,
              fontLigatures: true,
            }}
          />
        </div>
      </div>
    </section>
  );
}
