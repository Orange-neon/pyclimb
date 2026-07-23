import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YProvider from "y-partyserver/provider";
import * as Y from "yjs";
import type { CollaborationRoomSession } from "../types/collaboration";
import { createBatchedDocumentBridge } from "../lib/collaborationBatchBridge";
import {
  classifyRelayClose,
  disconnectedRelayStatus,
  isRetryableRelayTicketStatus,
} from "../lib/collaborationConnectionPolicy";
import { optimizeCollaborationAwareness } from "../lib/collaborationAwareness";
import {
  applyInitialNotebookUpdate,
  normalizeNotebookStructure,
  participantColor,
} from "../lib/collaborationNotebook";

export type CollaborationAwareness = YProvider["awareness"];
export type CollaborationRelayStatus =
  | "connecting"
  | "syncing"
  | "connected"
  | "unsynced"
  | "offline"
  | "error";

export interface CollaborationParticipant {
  clientId: number;
  uid: string;
  nickname: string;
  color: string;
  activeCellId: string | null;
  local: boolean;
}

export interface RunAcceptedMessage {
  type: "run-accepted";
  requestId: string;
  runId: string;
  cellId: string;
  source: string;
  sourceHash: string;
  acceptedAt: number;
  timeoutMs: number;
}

export interface RunResultMessage {
  type: "run-result";
  runId: string;
  cellId: string;
  sourceHash: string;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut?: boolean;
}

interface RelayTicketResponse {
  syncTicket: string;
  controlTicket: string;
  expiresAt: number;
  websocketUrl: string;
}

interface PendingRunRequest {
  resolve: (message: RunAcceptedMessage) => void;
  reject: (reason: Error) => void;
  timeoutId: number;
}

class RelayTicketError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "RelayTicketError";
  }
}

export class RelayRunRejectedError extends Error {
  constructor(
    message: string,
    readonly code = "run-rejected",
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "RelayRunRejectedError";
  }
}

interface UseCollaborationRelayOptions {
  session: CollaborationRoomSession;
  relayHost: string;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

function httpBase(relayHost: string): URL {
  const trimmed = relayHost.trim().replace(/\/+$/, "");
  if (/^wss?:\/\//i.test(trimmed)) {
    return new URL(trimmed.replace(/^ws/i, "http"));
  }
  if (/^https?:\/\//i.test(trimmed)) return new URL(trimmed);
  const local = /^(?:localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(trimmed);
  return new URL(`${local ? "http" : "https"}://${trimmed}`);
}

function relayErrorMessage(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : fallback;
}

function parseParticipant(
  clientId: number,
  value: unknown,
  localClientId: number,
): CollaborationParticipant | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Record<string, unknown>;
  if (typeof state.uid !== "string" || typeof state.nickname !== "string") return null;
  const color = typeof state.color === "string" && /^#[0-9a-f]{6}$/i.test(state.color)
    ? state.color
    : participantColor(state.uid);
  return {
    clientId,
    uid: state.uid,
    nickname: state.nickname.trim().slice(0, 40) || "Collaborator",
    color,
    activeCellId: typeof state.activeCellId === "string" ? state.activeCellId : null,
    local: clientId === localClientId,
  };
}

function sameParticipants(
  current: readonly CollaborationParticipant[],
  next: readonly CollaborationParticipant[],
): boolean {
  return (
    current.length === next.length &&
    current.every((participant, index) => {
      const candidate = next[index];
      return (
        participant.clientId === candidate.clientId &&
        participant.uid === candidate.uid &&
        participant.nickname === candidate.nickname &&
        participant.color === candidate.color &&
        participant.activeCellId === candidate.activeCellId &&
        participant.local === candidate.local
      );
    })
  );
}

function createDocumentBundle() {
  const editorDocument = new Y.Doc();
  const transportDocument = new Y.Doc();
  applyInitialNotebookUpdate(editorDocument);
  applyInitialNotebookUpdate(transportDocument);
  const bridge = createBatchedDocumentBridge(editorDocument, transportDocument);
  return { editorDocument, transportDocument, bridge };
}

export function useCollaborationRelay({
  session,
  relayHost,
  getIdToken,
}: UseCollaborationRelayOptions) {
  const [documents] = useState(createDocumentBundle);
  const [provider, setProvider] = useState<YProvider | null>(null);
  const [status, setStatus] = useState<CollaborationRelayStatus>("connecting");
  const [hasSynchronized, setHasSynchronized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<CollaborationParticipant[]>([]);
  const pendingRuns = useRef(new Map<string, PendingRunRequest>());
  const providerRef = useRef<YProvider | null>(null);
  const retryConnectionRef = useRef<(() => void) | null>(null);

  const ticketUrl = useMemo(() => {
    const url = httpBase(relayHost);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/relay-ticket`;
    url.search = "";
    url.hash = "";
    return url.toString();
  }, [relayHost]);

  const fetchTicket = useCallback(
    async (forceRefresh = false): Promise<RelayTicketResponse> => {
      const idToken = await getIdToken(forceRefresh);
      const response = await fetch(ticketUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: session.code, roomInstanceId: session.roomInstanceId }),
        cache: "no-store",
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // The status-specific fallback below is more useful than a JSON parse error.
      }
      if (!response.ok) {
        if (response.status === 401 && !forceRefresh) return fetchTicket(true);
        throw new RelayTicketError(
          relayErrorMessage(body, `The collaboration relay returned ${response.status}.`),
          isRetryableRelayTicketStatus(response.status),
        );
      }
      const value = body as Partial<RelayTicketResponse> | null;
      if (!value || typeof value.syncTicket !== "string" || typeof value.expiresAt !== "number") {
        throw new RelayTicketError("The collaboration relay returned an invalid ticket.", false);
      }
      return value as RelayTicketResponse;
    },
    [getIdToken, session.code, session.roomInstanceId, ticketUrl],
  );

  useEffect(() => {
    let active = true;
    let readyForControl = false;
    let wasSynchronized = false;
    let fatalClose = false;
    let connectInFlight = false;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;
    setStatus(navigator.onLine ? "connecting" : "offline");
    setError(null);

    const base = httpBase(relayHost);
    const nextProvider = new YProvider(base.host, session.roomInstanceId, documents.transportDocument, {
      party: "collaboration-room",
      connect: false,
      disableBc: true,
      params: async () => {
        try {
          const ticket = await fetchTicket();
          return { ticket: ticket.syncTicket };
        } catch (reason) {
          if (active) {
            const fatal = reason instanceof RelayTicketError && !reason.retryable;
            if (fatal) {
              // YProvider's internal reconnect path deliberately falls back to
              // stale params when refreshing throws. Stop it here before that
              // fallback can reopen a revoked or expired room ticket.
              fatalClose = true;
              nextProvider.disconnect();
              if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
              reconnectTimer = null;
            }
            setStatus(disconnectedRelayStatus(navigator.onLine, fatal, wasSynchronized));
            setError(reason instanceof Error ? reason.message : String(reason));
          }
          throw reason;
        }
      },
    });
    const restoreAwareness = optimizeCollaborationAwareness(nextProvider);
    providerRef.current = nextProvider;
    setProvider(nextProvider);

    const scheduleConnect = (delayMs?: number) => {
      if (!active || fatalClose || !navigator.onLine || reconnectTimer !== null) return;
      const delay = delayMs ?? Math.min(10_000, 500 * 2 ** reconnectAttempt);
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connectProvider();
      }, delay);
    };

    const connectProvider = async () => {
      if (
        !active ||
        fatalClose ||
        !navigator.onLine ||
        connectInFlight ||
        nextProvider.wsconnected ||
        nextProvider.wsconnecting
      ) {
        return;
      }
      connectInFlight = true;
      try {
        await nextProvider.connect();
        reconnectAttempt = 0;
      } catch (reason) {
        if (active && !fatalClose) {
          if (reason instanceof RelayTicketError && !reason.retryable) {
            fatalClose = true;
            setStatus("error");
          } else {
            reconnectAttempt += 1;
            scheduleConnect();
          }
        }
      } finally {
        connectInFlight = false;
      }
    };

    const color = participantColor(session.uid);
    nextProvider.awareness.setLocalState({
      uid: session.uid,
      nickname: session.nickname,
      color,
      activeCellId: null,
      user: { name: session.nickname, color, colorLight: `${color}33` },
    });

    const updateParticipants = () => {
      const byUid = new Map<string, CollaborationParticipant>();
      for (const [clientId, state] of nextProvider.awareness.getStates()) {
        const participant = parseParticipant(clientId, state, nextProvider.awareness.clientID);
        if (!participant) continue;
        const current = byUid.get(participant.uid);
        if (!current || participant.local) byUid.set(participant.uid, participant);
      }
      const nextParticipants = Array.from(byUid.values()).sort(
        (left, right) =>
          left.local === right.local
            ? left.nickname.localeCompare(right.nickname)
            : left.local
              ? -1
              : 1,
      );
      // Cursor selection is also carried through awareness and changes on
      // nearly every keystroke. Monaco consumes it directly; avoid rebuilding
      // the full notebook when the participant fields rendered here did not
      // actually change.
      setParticipants((current) =>
        sameParticipants(current, nextParticipants) ? current : nextParticipants,
      );
    };

    const handleStatus = ({ status: next }: { status: string }) => {
      if (!active) return;
      if (next === "connected") {
        if (fatalClose) {
          nextProvider.disconnect();
          setStatus("error");
          return;
        }
        reconnectAttempt = 0;
        if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
        setStatus("syncing");
        setError(null);
      } else if (next === "disconnected") {
        readyForControl = false;
        setStatus(disconnectedRelayStatus(navigator.onLine, fatalClose, wasSynchronized));
      }
    };
    const handleSync = (synced: boolean) => {
      if (!active) return;
      if (fatalClose) setStatus("error");
      else if (!navigator.onLine) setStatus("offline");
      else if (synced && readyForControl) {
        wasSynchronized = true;
        setHasSynchronized(true);
        setStatus("connected");
      } else if (nextProvider.wsconnected) setStatus("syncing");
      else setStatus(disconnectedRelayStatus(true, false, wasSynchronized));
    };
    const handleCustomMessage = (raw: string) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }
      if (message.type === "control-ready") {
        if (fatalClose) return;
        readyForControl = true;
        if (nextProvider.synced && navigator.onLine) {
          wasSynchronized = true;
          setHasSynchronized(true);
          setStatus("connected");
        }
        return;
      }
      if (message.type === "run-accepted" && typeof message.requestId === "string") {
        const pending = pendingRuns.current.get(message.requestId);
        if (!pending) return;
        pendingRuns.current.delete(message.requestId);
        window.clearTimeout(pending.timeoutId);
        pending.resolve(message as unknown as RunAcceptedMessage);
        return;
      }
      if (message.type === "run-rejected") {
        const reason = new RelayRunRejectedError(
          typeof message.message === "string" ? message.message : "The relay rejected this run.",
          typeof message.code === "string" ? message.code : undefined,
          typeof message.retryAfterMs === "number" ? message.retryAfterMs : undefined,
        );
        if (typeof message.requestId === "string") {
          const pending = pendingRuns.current.get(message.requestId);
          if (pending) {
            pendingRuns.current.delete(message.requestId);
            window.clearTimeout(pending.timeoutId);
            pending.reject(reason);
            return;
          }
        }
        setError(reason.message);
      }
    };
    const handleClose = (event: CloseEvent) => {
      if (!active) return;
      readyForControl = false;
      const disposition = classifyRelayClose(event.code, event.reason);
      if (disposition === "refresh-ticket") {
        // Stop y-partyserver's stale-parameter reconnect loop; the scheduled
        // connect below must obtain a fresh ticket before opening a socket.
        nextProvider.disconnect();
        setStatus(disconnectedRelayStatus(navigator.onLine, false, wasSynchronized));
        setError("Refreshing the collaboration connection…");
        reconnectAttempt += 1;
        scheduleConnect();
      } else if (disposition === "fatal") {
        fatalClose = true;
        setStatus("error");
        setError(event.reason || "The collaboration relay rejected this connection.");
        // Policy, capacity, and document-size failures need user action.
        // Stop YProvider's automatic reconnect loop to avoid quota churn.
        nextProvider.disconnect();
        if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      } else {
        setStatus(disconnectedRelayStatus(navigator.onLine, false, wasSynchronized));
        if (event.reason) setError(event.reason);
      }
    };
    const handleOffline = () => setStatus(fatalClose ? "error" : "offline");
    const handleOnline = () => {
      if (fatalClose) {
        setStatus("error");
        return;
      }
      setStatus(
        nextProvider.wsconnected && nextProvider.synced && readyForControl
          ? "connected"
          : nextProvider.wsconnected
            ? "syncing"
            : disconnectedRelayStatus(true, false, wasSynchronized),
      );
      reconnectAttempt = 0;
      scheduleConnect(0);
    };
    const flush = () => documents.bridge.flush();

    retryConnectionRef.current = () => {
      if (!active) return;
      fatalClose = false;
      reconnectAttempt = 0;
      setError(null);
      setStatus(disconnectedRelayStatus(navigator.onLine, false, wasSynchronized));
      scheduleConnect(0);
    };

    nextProvider.on("status", handleStatus);
    nextProvider.on("sync", handleSync);
    nextProvider.on("custom-message", handleCustomMessage);
    nextProvider.on("connection-close", handleClose);
    nextProvider.awareness.on("change", updateParticipants);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pagehide", flush);
    updateParticipants();
    scheduleConnect(0);

    return () => {
      active = false;
      if (retryConnectionRef.current) retryConnectionRef.current = null;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      documents.bridge.flush();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pagehide", flush);
      nextProvider.awareness.off("change", updateParticipants);
      restoreAwareness();
      nextProvider.destroy();
      if (providerRef.current === nextProvider) providerRef.current = null;
      for (const pending of pendingRuns.current.values()) {
        window.clearTimeout(pending.timeoutId);
        pending.reject(new Error("The collaboration connection closed before the run started."));
      }
      pendingRuns.current.clear();
    };
  }, [documents, fetchTicket, relayHost, session.nickname, session.roomInstanceId, session.uid]);

  useEffect(() => {
    let repairing = false;
    const repair = () => {
      if (repairing) return;
      repairing = true;
      try {
        normalizeNotebookStructure(documents.editorDocument);
      } finally {
        repairing = false;
      }
    };
    const repairAfterStructuralChange = (transaction: Y.Transaction) => {
      // MonacoBinding owns Y.Text synchronization. Text-only transactions
      // cannot add, remove, or reorder cells, so rescanning the full notebook
      // for every keystroke only adds work on all participating browsers.
      for (const changedType of transaction.changed.keys()) {
        if (!(changedType instanceof Y.Text)) {
          repair();
          break;
        }
      }
    };
    documents.editorDocument.on("afterTransaction", repairAfterStructuralChange);
    repair();
    return () => documents.editorDocument.off("afterTransaction", repairAfterStructuralChange);
  }, [documents.editorDocument]);

  const requestRun = useCallback(
    (cellId: string, sourceHash: string): Promise<RunAcceptedMessage> => {
      const current = providerRef.current;
      if (status !== "connected" || !current?.wsconnected) {
        return Promise.reject(new Error("Reconnect to the room before running shared code."));
      }
      const requestId = `request_${Date.now()}_${crypto.randomUUID().replaceAll("-", "")}`;
      return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          pendingRuns.current.delete(requestId);
          reject(new Error("The collaboration relay did not answer the run request."));
        }, 8_000);
        pendingRuns.current.set(requestId, { resolve, reject, timeoutId });
        current.sendMessage(JSON.stringify({ type: "run-request", requestId, cellId, sourceHash }));
      });
    },
    [status],
  );

  const sendRunResult = useCallback((message: RunResultMessage) => {
    const current = providerRef.current;
    if (!current?.wsconnected) throw new Error("The collaboration connection was lost during execution.");
    current.sendMessage(JSON.stringify(message));
  }, []);

  const setActiveCell = useCallback((cellId: string | null) => {
    providerRef.current?.awareness.setLocalStateField("activeCellId", cellId);
  }, []);

  const retryConnection = useCallback(() => retryConnectionRef.current?.(), []);

  return {
    document: documents.editorDocument,
    awareness: provider?.awareness ?? null,
    providerKey: provider?.id ?? "opening",
    participants,
    status,
    hasSynchronized,
    error,
    requestRun,
    sendRunResult,
    setActiveCell,
    retryConnection,
    flush: documents.bridge.flush,
  };
}
