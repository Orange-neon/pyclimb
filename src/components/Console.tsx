import { CircleStop, Flag, LoaderCircle, Play, Send, Terminal } from "lucide-react";
import type { PyodideStatus } from "../hooks/usePyodide";

interface ConsoleProps {
  stdin: string;
  output: string;
  pyodideStatus: PyodideStatus;
  busy: boolean;
  hasProblem: boolean;
  onStdinChange: (value: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  onGiveUp: () => void;
  onCancel: () => void;
}

export function Console({
  stdin,
  output,
  pyodideStatus,
  busy,
  hasProblem,
  onStdinChange,
  onRun,
  onSubmit,
  onGiveUp,
  onCancel,
}: ConsoleProps) {
  const canExecute = hasProblem && pyodideStatus === "ready" && !busy;

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-slate-700/70 p-4">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="stdin" className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Standard input
          </label>
          <span className="text-[10px] text-slate-600">one value or line per input()</span>
        </div>
        <textarea
          id="stdin"
          rows={4}
          value={stdin}
          disabled={!hasProblem}
          onChange={(event) => onStdinChange(event.target.value)}
          placeholder="Your program input appears here…"
          className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950/80 p-3 font-mono text-sm text-slate-200 placeholder:text-slate-700 disabled:opacity-50"
        />
      </div>

      <div>
        <div className="flex h-10 items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Terminal size={14} /> Terminal output
          </div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
            <span
              className={`size-2 rounded-full ${
                pyodideStatus === "ready"
                  ? "bg-emerald-400"
                  : pyodideStatus === "error"
                    ? "bg-rose-400"
                    : "animate-pulse bg-amber-300"
              }`}
            />
            {pyodideStatus === "ready" ? "Python ready" : pyodideStatus}
          </div>
        </div>
        <pre
          aria-live="polite"
          className="h-44 overflow-auto whitespace-pre-wrap bg-[#050812] p-4 font-mono text-[13px] leading-5 text-slate-300"
        >
          {output || <span className="text-slate-700">$ Output will appear here.</span>}
        </pre>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-800 p-3">
        {busy ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3.5 py-2 text-sm font-bold text-rose-200 transition hover:bg-rose-400/20"
          >
            <CircleStop size={16} /> Stop
          </button>
        ) : (
          <button
            type="button"
            disabled={!canExecute}
            onClick={onRun}
            className="flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3.5 py-2 text-sm font-bold text-sky-200 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {pyodideStatus === "loading" ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={16} />}
            Run code
          </button>
        )}
        <button
          type="button"
          disabled={!canExecute}
          onClick={onSubmit}
          className="flex items-center gap-2 rounded-xl bg-emerald-400 px-3.5 py-2 text-sm font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Send size={16} /> Submit solution
        </button>
        <button
          type="button"
          disabled={!hasProblem || busy}
          onClick={onGiveUp}
          className="ml-auto flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-800 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Flag size={15} /> Give up
        </button>
      </div>
    </section>
  );
}
