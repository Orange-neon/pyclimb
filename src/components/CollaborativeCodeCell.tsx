import Editor, { type OnMount } from "@monaco-editor/react";
import {
  ArrowDown,
  ArrowUp,
  LoaderCircle,
  Play,
  Plus,
  Terminal,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MonacoBinding } from "y-monaco";
import type { CollaborationAwareness } from "../hooks/useCollaborationRelay";
import {
  MAX_CELL_SOURCE_BYTES,
  notebookSourceByteLength,
  trimNotebookCellSource,
  type NotebookCell,
} from "../lib/collaborationNotebook";

interface CollaborativeCodeCellProps {
  cell: NotebookCell;
  index: number;
  roomInstanceId: string;
  awareness: CollaborationAwareness;
  running: boolean;
  runDisabled: boolean;
  moveUpDisabled: boolean;
  moveDownDisabled: boolean;
  addBelowDisabled: boolean;
  onlyCell: boolean;
  onFocus: () => void;
  onRun: () => void;
  onMove: (direction: -1 | 1) => void;
  onAddBelow: () => void;
  onDelete: () => void;
}

function executionTone(status: string): string {
  if (status === "finished") return "text-emerald-300";
  if (status === "running") return "text-sky-300";
  return "text-rose-300";
}

export function CollaborativeCodeCell({
  cell,
  index,
  roomInstanceId,
  awareness,
  running,
  runDisabled,
  moveUpDisabled,
  moveDownDisabled,
  addBelowDisabled,
  onlyCell,
  onFocus,
  onRun,
  onMove,
  onAddBelow,
  onDelete,
}: CollaborativeCodeCellProps) {
  const bindingRef = useRef<MonacoBinding | null>(null);
  const onFocusRef = useRef(onFocus);
  const [editor, setEditor] = useState<Parameters<OnMount>[0] | null>(null);
  const sourceBytes = notebookSourceByteLength(cell.source);
  onFocusRef.current = onFocus;

  const mountEditor = useCallback<OnMount>(
    (nextEditor) => setEditor(nextEditor),
    [],
  );

  useEffect(() => {
    if (!editor) return;
    const focusDisposable = editor.onDidFocusEditorText(() => onFocusRef.current());
    return () => focusDisposable.dispose();
  }, [editor]);

  useEffect(() => {
    const model = editor?.getModel();
    if (!editor || !model) return;
    const binding = new MonacoBinding(cell.source, model, new Set([editor]), awareness);
    bindingRef.current = binding;
    return () => {
      if (bindingRef.current === binding) bindingRef.current = null;
      // MonacoBinding also destroys itself from the model's onWillDispose
      // callback; its cleanup is not idempotent, so do not invoke it twice.
      if (!model.isDisposed()) binding.destroy();
    };
  }, [awareness, cell.source, editor]);

  useEffect(() => {
    let scheduled = false;
    const enforceSourceLimit = () => {
      if (notebookSourceByteLength(cell.source) <= MAX_CELL_SOURCE_BYTES || scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        trimNotebookCellSource(cell.source);
      });
    };
    cell.source.observe(enforceSourceLimit);
    enforceSourceLimit();
    return () => cell.source.unobserve(enforceSourceLimit);
  }, [cell.source]);

  const execution = cell.execution;
  const output = execution
    ? [
        execution.stdout,
        execution.stderr,
        execution.error && !execution.stderr?.includes(execution.error) ? execution.error : undefined,
      ].filter(Boolean).join("\n")
    : "";
  const completedAtLabel =
    typeof execution?.completedAt === "number" && Number.isFinite(execution.completedAt)
      ? new Date(execution.completedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : null;

  return (
    <article
      aria-label={`Python cell ${index + 1}`}
      className="collaboration-cell overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/75 shadow-xl shadow-black/10"
    >
      <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <span className="grid size-6 place-items-center rounded-md bg-sky-400/10 font-mono text-[10px] text-sky-300">
            {index + 1}
          </span>
          <span>Python</span>
          <span
            className={sourceBytes > MAX_CELL_SOURCE_BYTES ? "text-rose-300" : "text-slate-600"}
            title={`${sourceBytes.toLocaleString()} UTF-8 bytes`}
          >
            {Math.ceil(sourceBytes / 1024)} KiB / 50 KiB
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={moveUpDisabled}
            onClick={() => onMove(-1)}
            className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
            aria-label={`Move cell ${index + 1} up`}
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            disabled={moveDownDisabled}
            onClick={() => onMove(1)}
            className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
            aria-label={`Move cell ${index + 1} down`}
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-rose-400/10 hover:text-rose-300"
            aria-label={`${onlyCell ? "Clear" : "Delete"} cell ${index + 1}`}
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            disabled={addBelowDisabled}
            onClick={onAddBelow}
            className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-sky-400/10 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-25"
            aria-label={`Add a cell below cell ${index + 1}`}
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            disabled={runDisabled}
            onClick={onRun}
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-400 px-3 text-xs font-black text-emerald-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={`Run cell ${index + 1}`}
          >
            {running ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
            {running ? "Running" : "Run"}
          </button>
        </div>
      </header>

      <div className="h-56 bg-[#0b1020]">
        <Editor
          height="100%"
          path={`collaboration://${roomInstanceId}/${cell.id}.py`}
          defaultLanguage="python"
          defaultValue=""
          theme="vs-dark"
          onMount={mountEditor}
          keepCurrentModel={false}
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
            wordWrap: "on",
            ariaLabel: `Python cell ${index + 1} editor`,
          }}
        />
      </div>

      {execution && (
        <section
          className="border-t border-slate-800 bg-[#070b16] px-4 py-3"
          aria-live="polite"
          aria-atomic="false"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className={`inline-flex items-center gap-1.5 font-bold ${executionTone(execution.status)}`}>
              {execution.status === "running" ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <Terminal size={13} />
              )}
              {execution.status === "running"
                ? "Running locally"
                : execution.status === "timed_out"
                  ? "Timed out"
                  : execution.status === "interrupted"
                    ? "Interrupted"
                    : execution.status === "error"
                      ? "Finished with an error"
                      : "Finished"}
            </span>
            <span className="text-slate-500">
              ran locally by {execution.ranBy?.nickname ?? "a collaborator"}
              {completedAtLabel ? ` · ${completedAtLabel}` : ""}
              {execution.stale ? " · source changed since this run" : ""}
            </span>
          </div>
          {execution.status !== "running" && (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-300">
              {output || "$ Finished with no output."}
            </pre>
          )}
        </section>
      )}
    </article>
  );
}
