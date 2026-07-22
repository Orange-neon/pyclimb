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
import type { CollaborationRoomSession } from "../types/collaboration";
import { useCollaborationPython } from "../hooks/useCollaborationPython";
import { useCollaborationRelay } from "../hooks/useCollaborationRelay";
import {
  MAX_CELL_SOURCE_BYTES,
  MAX_NOTEBOOK_CELLS,
  addNotebookCell,
  deleteNotebookCell,
  hashNotebookSource,
  moveNotebookCell,
  notebookSourceByteLength,
  readNotebookSnapshot,
  truncateExecutionOutput,
} from "../lib/collaborationNotebook";
import { CollaborativeCodeCell } from "./CollaborativeCodeCell";
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
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    const update = () => setDocumentRevision((current) => current + 1);
    relay.document.on("update", update);
    return () => relay.document.off("update", update);
  }, [relay.document]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) {
      setCooldownRemaining(0);
      return;
    }
    let intervalId = 0;
    const update = () => {
      const remaining = Math.max(0, cooldownUntil - Date.now());
      setCooldownRemaining(remaining);
      if (remaining === 0 && intervalId) window.clearInterval(intervalId);
    };
    update();
    intervalId = window.setInterval(update, 50);
    return () => window.clearInterval(intervalId);
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
        setCooldownUntil(Date.now() + 500);
        // Use a local duration rather than comparing client and relay clocks.
        // The small margin leaves time for the result frame to reach the relay.
        const remaining = Math.max(100, Math.min(4_850, accepted.timeoutMs - 150));
        const result = await python.execute(accepted.source, remaining);
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
  const canRun = connected && python.status === "ready" && !busyCellId && cooldownRemaining === 0;
  const statusLabel =
    relay.status === "connected"
      ? "Synced"
      : relay.status === "offline"
        ? "Offline — edits stay on this screen"
        : relay.status === "unsynced"
          ? "Offline/unsynced — reconnecting"
        : relay.status === "error"
          ? "Relay unavailable"
          : relay.status === "syncing"
            ? "Syncing notebook…"
            : "Connecting…";

  const localCursorStyle = relay.awareness
    ? `.yRemoteSelection-${relay.awareness.clientID}{background:transparent!important}` +
      `.yRemoteSelectionHead-${relay.awareness.clientID}{border-left-color:transparent!important}`
    : "";
  const cursorStyles = [
    localCursorStyle,
    ...relay.participants
      .filter((participant) => !participant.local)
      .map(
        (participant) =>
          `.yRemoteSelection-${participant.clientId}{background:${participant.color}55}` +
          `.yRemoteSelectionHead-${participant.clientId}{border-left-color:${participant.color}}`,
      ),
  ].join("");

  return (
    <main className="grid-glow min-h-screen bg-[#070b16] px-3 py-4 text-slate-100 sm:px-5">
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
                runDisabled={
                  !canRun ||
                  cell.execution?.status === "running" ||
                  notebookSourceByteLength(cell.source) > MAX_CELL_SOURCE_BYTES
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
              disabled={snapshot.cells.length >= MAX_NOTEBOOK_CELLS}
              onClick={() => addNotebookCell(relay.document, snapshot.cells.at(-1)?.id)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 px-4 py-4 text-sm font-bold text-slate-400 hover:border-sky-400/40 hover:bg-sky-400/5 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Plus size={17} />
              {snapshot.cells.length >= MAX_NOTEBOOK_CELLS ? "50-cell room limit reached" : "Add Python cell"}
            </button>
          </section>
        )}

        <footer className="mx-auto mt-4 max-w-3xl text-center text-xs leading-5 text-slate-600">
          Each run uses a fresh, isolated Python namespace on the runner’s browser. Shared output is collaborator-provided and is not trusted server computation.
          {cooldownRemaining > 0 ? ` Run available in ${Math.ceil(cooldownRemaining)} ms.` : ""}
        </footer>
      </div>
    </main>
  );
}
