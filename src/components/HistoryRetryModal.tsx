import Editor from "@monaco-editor/react";
import {
  CheckCircle2,
  CircleStop,
  LoaderCircle,
  Play,
  RotateCcw,
  Send,
  Terminal,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DIFFICULTY_CONFIG } from "../data/difficulty";
import { getProblemReward } from "../data/problemProgression";
import type { Problem } from "../data/problemTypes";
import { usePyodide } from "../hooks/usePyodide";
import { compareOutput } from "../lib/judge";
import { ProblemDescription } from "./ProblemDescription";

interface HistoryRetryModalProps {
  problem: Problem;
  solved: boolean;
  onSolved: () => void;
  onClose: () => void;
}

const difficultyStyles: Record<Problem["difficulty"], string> = {
  easy: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  hard: "border-rose-400/30 bg-rose-400/10 text-rose-100",
};

export function HistoryRetryModal({
  problem,
  solved,
  onSolved,
  onClose,
}: HistoryRetryModalProps) {
  const python = usePyodide();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [code, setCode] = useState(problem.starterCode);
  const [stdin, setStdin] = useState(problem.testCases[0]?.input ?? "");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(solved);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  const runCode = async () => {
    if (busy || python.status !== "ready") return;
    setBusy(true);
    setOutput("$ Running solution.py…");
    try {
      const result = await python.execute(code, stdin);
      setOutput(
        result.timedOut
          ? result.stderr
          : [result.stdout, result.stderr]
              .filter(Boolean)
              .join(result.stdout && result.stderr ? "\n" : "") ||
              `$ Finished in ${Math.round(result.durationMs)}ms with no output.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const submitSolution = async () => {
    if (busy || python.status !== "ready") return;
    setBusy(true);
    try {
      for (let index = 0; index < problem.testCases.length; index += 1) {
        const testCase = problem.testCases[index];
        setOutput(`$ Checking test ${index + 1} of ${problem.testCases.length}…`);
        const result = await python.execute(code, testCase.input);
        const comparison = compareOutput(result.stdout, testCase.expectedOutput);

        if (result.error || !comparison.passed) {
          setOutput(
            [
              `✗ Test ${index + 1} failed`,
              "",
              "Input:",
              testCase.input || "(empty)",
              "",
              "Expected:",
              comparison.expected || "(empty)",
              "",
              "Your output:",
              comparison.actual || "(empty)",
              result.stderr ? `\nYour code raised an error:\n${result.stderr}` : "",
            ].join("\n"),
          );
          return;
        }
      }

      setAccepted(true);
      setOutput(
        `✓ All ${problem.testCases.length} tests passed!\nThis problem is now marked solved in your history.`,
      );
      onSolved();
    } finally {
      setBusy(false);
    }
  };

  const resetCode = () => {
    setCode(problem.starterCode);
    setStdin(problem.testCases[0]?.input ?? "");
    setOutput("");
  };

  const stopExecution = () => {
    python.cancel();
    setBusy(false);
    setOutput("$ Run stopped. Python is warming back up…");
  };

  const canExecute = python.status === "ready" && !busy;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-retry-title"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-5"
    >
      <section className="panel flex max-h-[92vh] min-h-0 w-full max-w-6xl flex-col overflow-hidden shadow-2xl shadow-black/50">
        <header className="flex items-start justify-between gap-4 border-b border-slate-700/70 px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">
                History retry
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${difficultyStyles[problem.difficulty]}`}>
                {DIFFICULTY_CONFIG[problem.difficulty].label}
              </span>
              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                {getProblemReward(problem)} pts
              </span>
            </div>
            <h2 id="history-retry-title" className="mt-1 truncate text-xl font-black text-white sm:text-2xl">
              {problem.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {accepted && (
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200 sm:inline-flex">
                <CheckCircle2 size={14} /> Solved
              </span>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close retry workspace"
              className="grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {accepted && !solved && (
          <div className="flex items-center gap-2 border-b border-emerald-400/20 bg-emerald-400/10 px-5 py-2.5 text-xs font-bold text-emerald-100">
            <CheckCircle2 size={15} /> Solved — it has been removed from Not solved and kept in your full history.
          </div>
        )}

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)] lg:overflow-hidden">
          <div className="min-h-0 overflow-y-auto border-b border-slate-700/70 p-5 lg:border-b-0 lg:border-r">
            <ProblemDescription markdown={problem.description} />
          </div>

          <div className="grid min-h-[620px] grid-rows-[minmax(300px,1fr)_auto] bg-[#0b1020] lg:min-h-0">
            <div className="min-h-0">
              <div className="flex h-10 items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <span className="size-2 rounded-full bg-sky-400" /> solution.py
                </div>
                <button
                  type="button"
                  onClick={resetCode}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-white disabled:opacity-40"
                >
                  <RotateCcw size={12} /> Reset code
                </button>
              </div>
              <div className="h-[calc(100%-2.5rem)]">
                <Editor
                  height="100%"
                  language="python"
                  theme="vs-dark"
                  value={code}
                  onChange={(value) => setCode(value ?? "")}
                  loading={<div className="p-5 text-sm text-slate-500">Loading editor…</div>}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineHeight: 22,
                    tabSize: 4,
                    insertSpaces: true,
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 12, bottom: 12 },
                    renderLineHighlight: "gutter",
                    smoothScrolling: true,
                    fontLigatures: true,
                  }}
                />
              </div>
            </div>

            <div className="border-t border-slate-800">
              <div className="grid sm:grid-cols-[minmax(180px,0.7fr)_minmax(240px,1.3fr)]">
                <div className="border-b border-slate-800 p-3 sm:border-b-0 sm:border-r">
                  <label htmlFor="history-retry-stdin" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    Standard input
                  </label>
                  <textarea
                    id="history-retry-stdin"
                    rows={4}
                    value={stdin}
                    onChange={(event) => setStdin(event.target.value)}
                    className="mt-2 w-full resize-none rounded-lg border border-slate-700 bg-slate-950/80 p-2.5 font-mono text-xs text-slate-200"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex h-9 items-center justify-between border-b border-slate-800 bg-slate-950/50 px-3">
                    <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <Terminal size={12} /> Output
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] uppercase text-slate-500">
                      <span className={`size-2 rounded-full ${
                        python.status === "ready"
                          ? "bg-emerald-400"
                          : python.status === "error"
                            ? "bg-rose-400"
                            : "animate-pulse bg-amber-300"
                      }`} />
                      {python.status === "ready" ? "Python ready" : python.status}
                    </span>
                  </div>
                  <pre aria-live="polite" className="h-28 overflow-auto whitespace-pre-wrap bg-[#050812] p-3 font-mono text-xs leading-5 text-slate-300">
                    {output || "$ Output will appear here."}
                  </pre>
                </div>
              </div>
              {python.status === "error" && (
                <div className="border-t border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
                  Python failed to load. <button type="button" onClick={python.retry} className="font-black text-white hover:underline">Retry engine</button>
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t border-slate-800 p-3">
                {busy ? (
                  <button
                    type="button"
                    onClick={stopExecution}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3.5 py-2 text-sm font-bold text-rose-200"
                  >
                    <CircleStop size={16} /> Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canExecute}
                    onClick={() => void runCode()}
                    className="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3.5 py-2 text-sm font-bold text-sky-200 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {python.status === "loading" ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={16} />}
                    Run code
                  </button>
                )}
                <button
                  type="button"
                  disabled={!canExecute}
                  onClick={() => void submitSolution()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-3.5 py-2 text-sm font-black text-emerald-950 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Send size={16} /> {accepted ? "Submit again" : "Submit solution"}
                </button>
                <span className="ml-auto self-center text-[10px] text-slate-600">
                  Retries do not change original race points.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
