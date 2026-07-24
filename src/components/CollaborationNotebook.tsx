import {
  AlertTriangle,
  Check,
  Clipboard,
  CloudOff,
  Code2,
  LoaderCircle,
  LogOut,
  Plus,
  RotateCw,
  Users,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import type { CollaborationRoomSession } from "../types/collaboration";
import { useCollaborationPython } from "../hooks/useCollaborationPython";
import { useCollaborationRelay } from "../hooks/useCollaborationRelay";
import {
  COLLABORATION_RUN_COOLDOWN_MS,
  MAX_CELL_SOURCE_BYTES,
  MAX_NOTEBOOK_CELLS,
  addNotebookCell,
  deleteNotebookCell,
  getNotebookCellOrder,
  getNotebookCells,
  getNotebookExecutions,
  hashNotebookSource,
  moveNotebookCell,
  notebookSourceByteLength,
  readNotebookSnapshot,
  truncateExecutionOutput,
} from "../lib/collaborationNotebook";
import { CollaborativeCodeCell } from "./CollaborativeCodeCell";
import { collaborationCursorStyles } from "./collaborationCursorStyles";
import "./collaboration.css";

export interface CollaborationNotebookProps {
  session: CollaborationRoomSession;
  relayHost: string;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  onLeave: () => Promise<void>;
}

export function CollaborationNotebook(props: CollaborationNotebookProps) {
  return <CollaborationNotebookRoom key={props.session.roomInstanceId} {...props} />;
}

function CollaborationNotebookRoom({
  session,
  relayHost,
  getIdToken,
  onLeave,
}: CollaborationNotebookProps) {
  const relay = useCollaborationRelay({ session, relayHost, getIdToken });
  const python = useCollaborationPython();
  const [documentRevision, setDocumentRevision] = useState(0);
  const [busyCellId, setBusyCellId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  useEffect(() => {
    const update = () => setDocumentRevision((current) => current + 1);
    const cells = getNotebookCells(relay.document);
    const cellOrder = getNotebookCellOrder(relay.document);
    const executions = getNotebookExecutions(relay.document);
    const updateForCellMetadata = (events: Array<{ target: unknown }>) => {
      // Monaco and the stdin field subscribe to their own Y.Text instances.
      // Text edits therefore do not need to rebuild every cell in the room.
      if (events.some((event) => !(event.target instanceof Y.Text))) update();
    };
    cells.observeDeep(updateForCellMetadata);
    cellOrder.observe(update);
    executions.observe(update);
    return () => {
      cells.unobserveDeep(updateForCellMetadata);
      cellOrder.unobserve(update);
      executions.unobserve(update);
    };
  }, [relay.document]);

  useEffect(() => {
    if (cooldownUntil === 0) return;
    const remaining = cooldownUntil - Date.now();
    if (remaining <= 0) {
      setCooldownUntil(0);
      return;
    }
    const timeoutId = window.setTimeout(() => setCooldownUntil(0), remaining);
    return () => window.clearTimeout(timeoutId);
  }, [cooldownUntil]);

  const snapshot = useMemo(
    () => readNotebookSnapshot(relay.document),
    [documentRevision, relay.document],
  );

  const runCell = useCallback(
    async (cellId: string) => {
      const cell = readNotebookSnapshot(relay.document).cells.find((item) => item.id === cellId);
      if (!cell || busyCellId) return;
      const source = cell.source.toString();
      if (!cell.stdin) {
        setError("Shared input for this cell is still syncing. Try again shortly.");
        return;
      }
      const stdin = cell.stdin.toString();
      if (notebookSourceByteLength(source) > MAX_CELL_SOURCE_BYTES) {
        setError("This cell is over the 50 KiB source limit.");
        return;
      }
      setBusyCellId(cellId);
      setError(null);
      try {
        relay.flush();
        const sourceHash = await hashNotebookSource(source);
        const accepted = await relay.requestRun(cellId, sourceHash);
        setCooldownUntil(Date.now() + COLLABORATION_RUN_COOLDOWN_MS);
        // Use a local duration rather than comparing client and relay clocks.
        // The small margin leaves time for the result frame to reach the relay.
        const remaining = Math.max(100, Math.min(4_850, accepted.timeoutMs - 150));
        const result = await python.execute(accepted.source, stdin, remaining);
        const bounded = truncateExecutionOutput(result);
        relay.sendRunResult({
          type: "run-result",
          runId: accepted.runId,
          cellId: accepted.cellId,
          sourceHash: accepted.sourceHash,
          stdout: bounded.stdout,
          stderr: bounded.stderr,
          error: bounded.error,
          timedOut: result.timedOut,
        });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setBusyCellId(null);
      }
    },
    [busyCellId, python, relay],
  );

  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    setError(null);
    relay.flush();
    try {
      await onLeave();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setLeaving(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(session.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setError("Copy failed. Select the room code and copy it manually.");
    }
  };

  const connected = relay.status === "connected";
  const canRun = connected && python.status === "ready" && !busyCellId && cooldownUntil === 0;
  const repairingEmptyNotebook =
    snapshot.cells.length === 0 &&
    (relay.status === "connecting" ||
      relay.status === "syncing" ||
      relay.status === "connected");
  const statusLabel =
    relay.status === "connected"
      ? "Synced"
      : relay.status === "offline"
        ? relay.hasSynchronized
          ? "Offline — edits stay on this screen"
          : "Offline — first room sync required"
        : relay.status === "unsynced"
          ? "Offline/unsynced — reconnecting"
        : relay.status === "error"
          ? "Relay unavailable"
          : relay.status === "syncing"
            ? "Syncing notebook…"
            : "Connecting…";

  const cursorStyles = collaborationCursorStyles(
    relay.awareness?.clientID ?? null,
    relay.cursorParticipants,
  );

  return (
    <main className="collaboration-notebook grid-glow min-h-screen bg-[#070b16] px-3 py-4 text-slate-100 sm:px-5">
      <style>{cursorStyles}</style>
      <div className="mx-auto w-full max-w-6xl">
        <header className="panel mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
              <Code2 size={21} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-black text-white">Collaborative notebook</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={copyCode}
                  className="inline-flex items-center gap-1 font-mono font-black tracking-[0.18em] text-sky-300 hover:text-sky-200"
                  aria-label={`Copy room code ${session.code}`}
                >
                  {session.code} {copied ? <Check size={12} /> : <Clipboard size={12} />}
                </button>
                <span>·</span>
                <span
                  role="status"
                  aria-live="polite"
                  className={`inline-flex items-center gap-1 ${connected ? "text-emerald-300" : relay.status === "error" ? "text-rose-300" : "text-amber-200"}`}
                >
                  {connected ? <Wifi size={12} /> : <CloudOff size={12} />}
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <Users size={14} /> {relay.participants.length}
            </span>
            <button
              type="button"
              disabled={leaving}
              onClick={() => void leave()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-40"
            >
              {leaving ? <LoaderCircle size={15} className="animate-spin" /> : <LogOut size={15} />}
              Leave
            </button>
          </div>
          <div
            className="flex basis-full gap-2 overflow-x-auto border-t border-slate-800 pt-3"
            aria-label={`${relay.participants.length} collaborators online`}
            role="list"
          >
            {relay.participants.map((participant) => (
              <span
                key={`${participant.uid}-${participant.clientId}`}
                role="listitem"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/50 px-2.5 py-1 text-[11px] font-bold text-slate-300"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: participant.color }}
                  aria-hidden="true"
                />
                {participant.nickname}{participant.local ? " (you)" : ""}
              </span>
            ))}
          </div>
        </header>

        {(relay.error || error) && (
          <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">{error ?? relay.error}</span>
            {relay.status === "error" && (
              <button
                type="button"
                onClick={relay.retryConnection}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/30 px-2.5 py-1.5 text-xs font-bold hover:bg-rose-300/10"
              >
                <RotateCw size={13} /> Retry connection
              </button>
            )}
          </div>
        )}

        {python.status === "error" && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">
            <span>Python could not load: {python.error}</span>
            <button type="button" onClick={python.retry} className="inline-flex items-center gap-1.5 font-bold hover:text-white">
              <RotateCw size={14} /> Retry
            </button>
          </div>
        )}

        {!relay.awareness ? (
          <section className="panel grid min-h-72 place-items-center p-8 text-center">
            <div>
              <LoaderCircle className="mx-auto animate-spin text-sky-300" />
              <p className="mt-3 text-sm text-slate-400">Opening the shared notebook…</p>
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            {snapshot.cells.map((cell, index) => (
              <CollaborativeCodeCell
                // Remount Monaco when a same-room provider replacement creates
                // a new Awareness instance, preventing stale cursor listeners.
                key={`${cell.id}-${relay.providerKey}`}
                cell={cell}
                index={index}
                roomInstanceId={session.roomInstanceId}
                awareness={relay.awareness!}
                running={busyCellId === cell.id || cell.execution?.status === "running"}
                editingDisabled={!relay.hasSynchronized}
                runDisabled={
                  !canRun ||
                  !cell.stdin ||
                  cell.execution?.status === "running"
                }
                moveUpDisabled={index === 0}
                moveDownDisabled={index === snapshot.cells.length - 1}
                addBelowDisabled={snapshot.cells.length >= MAX_NOTEBOOK_CELLS}
                onlyCell={snapshot.cells.length === 1}
                onFocus={() => relay.setActiveCell(cell.id)}
                onRun={() => void runCell(cell.id)}
                onMove={(direction) => moveNotebookCell(relay.document, cell.id, direction)}
                onAddBelow={() => addNotebookCell(relay.document, cell.id)}
                onDelete={() => deleteNotebookCell(relay.document, cell.id)}
              />
            ))}

            <button
              type="button"
              disabled={
                !relay.hasSynchronized ||
                snapshot.cells.length >= MAX_NOTEBOOK_CELLS ||
                repairingEmptyNotebook
              }
              onClick={() => addNotebookCell(relay.document, snapshot.cells.at(-1)?.id)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 px-4 py-4 text-sm font-bold text-slate-400 hover:border-sky-400/40 hover:bg-sky-400/5 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Plus size={17} />
              {!relay.hasSynchronized
                ? "Waiting for the first room sync…"
                : snapshot.cells.length >= MAX_NOTEBOOK_CELLS
                  ? "50-cell room limit reached"
                  : repairingEmptyNotebook
                    ? "Repairing shared notebook…"
                    : "Add Python cell"}
            </button>
          </section>
        )}

        <footer className="mx-auto mt-4 max-w-3xl text-center text-xs leading-5 text-slate-600">
          Each run captures the shared input when Run is clicked and uses a fresh, isolated Python namespace on the runner’s browser. Shared output is collaborator-provided and is not trusted server computation.
          {cooldownUntil > 0 ? " One-second run cooldown active." : ""}
        </footer>
      </div>
    </main>
  );
}
