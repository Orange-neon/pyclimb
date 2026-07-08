import { Check, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Problem } from "../data/problemTypes";

interface SolutionModalProps {
  problem: Problem;
  onClose: () => void;
}

export function SolutionModal({ problem, onClose }: SolutionModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="solution-title"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="panel w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Learn from the trail</p>
            <h2 id="solution-title" className="mt-1 text-lg font-black text-white">
              {problem.title} solution
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close solution"
            className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <pre className="max-h-[60vh] overflow-auto bg-[#050812] p-5 font-mono text-sm leading-6 text-sky-100">
          {problem.solutionCode}
        </pre>
        <div className="flex justify-end border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-sky-300"
          >
            <Check size={16} /> Got it
          </button>
        </div>
      </div>
    </div>
  );
}
