import { routePartykitRequest, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

import { compactConnectionTicket, type RelayConnectionTicket } from "./connection-auth";
import { DocumentSizeBudget } from "./document-size-budget";
import { MembershipError, verifyFirebaseRoomMembership } from "./firebase";
import { executionStatusForResult } from "./execution-policy";
import { getExecutableCellSource, removeExecutionForMissingCell } from "./execution-cell";
import { readBoundedUtf8Body } from "./http-body";
import { corsHeaders, isAllowedOrigin } from "./origins";
import {
  RELAY_LIMITS,
  ROOM_INSTANCE_PATTERN,
  parseControlMessage,
  parseTicketRequest,
  serializeControlMessage,
  truncateExecutionOutput,
  utf8ByteLength,
  type RelayTicketPayload,
  type RelayTicketResponse,
  type RunRejectedMessage,
  type RunRequestMessage,
  type RunResultMessage,
  type SharedExecution,
} from "./protocol";
import { evaluateRunRequest, type ActiveRunView } from "./run-policy";
import {
  activeRunFromSharedExecution,
  recoveredRunDecision,
  type ActiveRunState,
} from "./run-recovery";
import {
  fingerprintRequestId,
  registerRequestId,
  type RecentRequestId,
} from "./request-dedupe";
import { shouldResetEphemeralDocument } from "./room-lifecycle";
import { VERIFIED_TICKET_HEADER, forwardVerifiedSocketRequest } from "./socket-forwarding";
import { DocumentSyncGate } from "./sync-gate";
import { InMemoryRateLimiter } from "./ticket-rate-limit";
import {
  createNonce,
  isPlausibleFirebaseIdToken,
  signRelayTicket,
  verifyRelayTicket,
} from "./tickets";
import { consumeUidRate, type RelayRateKind, type RelayRateState } from "./uid-rate-limit";
import {
  classifyYjsFrame,
  extractSyncUpdate,
  getSyncMessageSubtype,
  isValidYjsUpdate,
  measureMergedDocumentBytes,
  type YjsFrameKind,
} from "./yjs-frame";

export interface Env extends Cloudflare.Env {
  CollaborationRoom: DurableObjectNamespace<CollaborationRoom>;
  FIREBASE_DATABASE_URL: string;
  ALLOWED_ORIGINS: string;
  RELAY_TICKET_SECRET: string;
}

interface RelayConnectionState extends Record<string, unknown> {
  relay?: {
    ticket: RelayConnectionTicket;
    lastRunAt?: number;
    activeRun?: ActiveRunState;
    rate?: RelayRateState;
    recentRequestIds?: RecentRequestId[];
  };
}

const ticketRequestLimiter = new InMemoryRateLimiter(120, 60_000, 2_048);
const EXECUTION_RESERVE_BYTES = RELAY_LIMITS.maxOutputBytes + 4 * 1024;

function jsonResponse(
  body: unknown,
  status: number,
  origin?: string,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  if (origin) {
    corsHeaders(origin).forEach((value, name) => headers.set(name, value));
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(status: number, code: string, message: string, origin?: string): Response {
  return jsonResponse({ error: { code, message } }, status, origin);
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  return match?.[1] ?? null;
}

function socketUrl(request: Request, roomInstanceId: string): string {
  const url = new URL(request.url);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  url.pathname = `/parties/collaboration-room/${encodeURIComponent(roomInstanceId)}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function handleRelayTicket(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
    return errorResponse(403, "origin-denied", "This site is not allowed to use the collaboration relay.");
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return errorResponse(405, "method-not-allowed", "Use POST to request relay tickets.", origin);
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 4_096) {
    return errorResponse(413, "request-too-large", "The ticket request is too large.", origin);
  }

  const idToken = bearerToken(request);
  if (!idToken) return errorResponse(401, "missing-auth", "Sign in before connecting to a room.", origin);
  if (!isPlausibleFirebaseIdToken(idToken)) {
    return errorResponse(401, "invalid-auth", "A valid Firebase ID token is required.", origin);
  }

  let rawBody: unknown;
  try {
    const body = await readBoundedUtf8Body(request.body, 4_096);
    if (!body.ok) {
      return body.reason === "too-large"
        ? errorResponse(413, "request-too-large", "The ticket request is too large.", origin)
        : errorResponse(400, "bad-request", "The ticket request must be valid UTF-8 JSON.", origin);
    }
    rawBody = JSON.parse(body.text);
  } catch {
    return errorResponse(400, "bad-request", "The ticket request must be valid JSON.", origin);
  }
  const ticketRequest = parseTicketRequest(rawBody);
  if (!ticketRequest) {
    return errorResponse(400, "bad-request", "The room code or room instance is invalid.", origin);
  }

  // Best-effort and per Worker isolate: useful abuse resistance without paid
  // or persistent storage, but not a globally strict distributed quota.
  const clientKey = (request.headers.get("CF-Connecting-IP") ?? "unknown").slice(0, 128);
  const rateDecision = ticketRequestLimiter.consume(clientKey);
  if (!rateDecision.allowed) {
    return jsonResponse(
      { error: { code: "rate-limited", message: "Too many relay ticket requests. Try again shortly." } },
      429,
      origin,
      { "Retry-After": String(Math.max(1, Math.ceil(rateDecision.retryAfterMs / 1_000))) },
    );
  }

  try {
    const membership = await verifyFirebaseRoomMembership(
      env.FIREBASE_DATABASE_URL,
      ticketRequest.code,
      ticketRequest.roomInstanceId,
      idToken,
    );
    const issuedAt = Date.now();
    const expiresAt = issuedAt + RELAY_LIMITS.ticketLifetimeMs;
    const basePayload = {
      version: 1 as const,
      roomInstanceId: ticketRequest.roomInstanceId,
      code: ticketRequest.code,
      uid: membership.uid,
      nickname: membership.nickname,
      role: membership.role,
      issuedAt,
      expiresAt,
    };
    const [syncTicket, controlTicket] = await Promise.all([
      signRelayTicket({ ...basePayload, channel: "sync", nonce: createNonce() }, env.RELAY_TICKET_SECRET),
      signRelayTicket({ ...basePayload, channel: "control", nonce: createNonce() }, env.RELAY_TICKET_SECRET),
    ]);
    const response: RelayTicketResponse = {
      syncTicket,
      controlTicket,
      expiresAt,
      websocketUrl: socketUrl(request, ticketRequest.roomInstanceId),
    };
    return jsonResponse(response, 200, origin);
  } catch (error) {
    if (error instanceof MembershipError) {
      return errorResponse(error.status, error.code, error.message, origin);
    }
    return errorResponse(503, "relay-unavailable", "The collaboration relay is temporarily unavailable.", origin);
  }
}

async function authenticateSocketRequest(
  request: Request,
  env: Env,
  expectedRoomInstanceId: string,
): Promise<Response | null> {
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
    return errorResponse(403, "origin-denied", "This site is not allowed to use the collaboration relay.");
  }
  if (!ROOM_INSTANCE_PATTERN.test(expectedRoomInstanceId)) {
    return errorResponse(404, "not-found", "Collaboration room not found.");
  }

  const ticket = new URL(request.url).searchParams.get("ticket");
  if (!ticket) return errorResponse(401, "missing-ticket", "A relay ticket is required.");
  try {
    const verified = await verifyRelayTicket(ticket, env.RELAY_TICKET_SECRET, {
      expectedRoomInstanceId,
    });
    return verified ? null : errorResponse(401, "invalid-ticket", "The relay ticket is invalid or expired.");
  } catch {
    return errorResponse(503, "relay-unavailable", "The collaboration relay is not configured.");
  }
}

function getState(connection: Connection): RelayConnectionState["relay"] | undefined {
  return (connection.state as RelayConnectionState | null)?.relay;
}

function byteLength(message: WSMessage): number {
  if (typeof message === "string") return utf8ByteLength(message);
  if (message instanceof ArrayBuffer) return message.byteLength;
  return message.byteLength;
}

function binaryMessageBytes(message: WSMessage): Uint8Array | null {
  if (typeof message === "string") return null;
  return message instanceof ArrayBuffer
    ? new Uint8Array(message)
    : new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class CollaborationRoom extends YServer<Env> {
  static options = { hibernate: true };

  private controlQueue: Promise<void> = Promise.resolve();
  private runTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private documentSync = new DocumentSyncGate();
  private documentSize = new DocumentSizeBudget(RELAY_LIMITS.maxDocumentBytes);

  override async onStart(): Promise<void> {
    const expectedResponders: string[] = [];
    for (const connection of this.getConnections()) {
      if (getState(connection)?.ticket.channel === "sync") expectedResponders.push(connection.id);
    }
    this.documentSync.resetForStart(expectedResponders);
    await super.onStart();
    this.documentSize.reset(Y.encodeStateAsUpdate(this.document).byteLength);
    for (const connection of this.getConnections()) {
      const relay = getState(connection);
      if (relay?.ticket.channel === "sync") {
        try {
          // y-partyserver provider message type 3 asks an idle client to
          // reannounce its complete awareness state after a hibernation wake.
          connection.send(Uint8Array.of(3));
        } catch {
          // A concurrently closed socket will be cleaned up by PartyServer.
        }
      }
    }
  }

  override async onConnect(connection: Connection, context: ConnectionContext): Promise<void> {
    const origin = context.request.headers.get("Origin");
    const ticketValue = context.request.headers.get(VERIFIED_TICKET_HEADER) ?? "";
    let ticket: RelayTicketPayload | null = null;
    try {
      if (isAllowedOrigin(origin, this.env.ALLOWED_ORIGINS)) {
        ticket = await verifyRelayTicket(ticketValue, this.env.RELAY_TICKET_SECRET, {
          expectedRoomInstanceId: this.name,
        });
      }
    } catch {
      ticket = null;
    }
    if (!ticket) {
      connection.close(1008, "Invalid or expired relay ticket");
      return;
    }

    const connectedUids = new Set<string>();
    let connectionCount = 0;
    let uidConnectionCount = 0;
    for (const peer of this.getConnections()) {
      if (peer.id === connection.id) continue;
      const peerTicket = getState(peer)?.ticket;
      if (!peerTicket) continue;
      connectionCount += 1;
      connectedUids.add(peerTicket.uid);
      if (peerTicket.uid === ticket.uid) uidConnectionCount += 1;
    }
    if (
      connectionCount >= RELAY_LIMITS.maxConnections ||
      uidConnectionCount >= RELAY_LIMITS.maxConnectionsPerUid ||
      (!connectedUids.has(ticket.uid) && connectedUids.size >= RELAY_LIMITS.maxParticipants)
    ) {
      connection.close(1008, "Room is full");
      return;
    }

    connection.setState((previous: unknown) => ({
      ...((previous as RelayConnectionState | null) ?? {}),
      relay: { ticket: compactConnectionTicket(ticket) },
    }));

    if (ticket.channel === "sync") {
      this.documentSync.expectResponder(connection.id);
      await super.onConnect(connection, context);
    }
    if (this.documentSync.ready) this.sendControlReady(connection);
  }

  override isReadOnly(connection: Connection): boolean {
    return getState(connection)?.ticket.channel !== "sync";
  }

  override onMessage(connection: Connection, message: WSMessage): void {
    const relay = getState(connection);
    if (!relay) {
      connection.close(1008, "Unauthenticated connection");
      return;
    }

    const binary = binaryMessageBytes(message);
    const binaryKind: YjsFrameKind | null = binary ? classifyYjsFrame(binary) : null;
    const kind: "control" | YjsFrameKind = binaryKind ?? "control";
    if (relay.ticket.channel === "control" && kind !== "control") {
      connection.close(1003, "Control connections do not accept binary sync frames");
      return;
    }
    if (typeof message === "string" && !message.startsWith("__YPS:")) {
      connection.close(1003, "Control messages must use the Y-PartyServer envelope");
      return;
    }

    const size = byteLength(message);
    if (kind === "other") {
      connection.close(1003, "Unsupported relay protocol frame");
      return;
    }
    const frameLimit = kind === "control"
      ? RELAY_LIMITS.maxControlFrameBytes
      : kind === "awareness"
        ? RELAY_LIMITS.maxAwarenessFrameBytes
        : RELAY_LIMITS.maxSyncFrameBytes;
    if (size > frameLimit) {
      connection.close(1009, "Relay frame is too large");
      return;
    }
    if (!this.consumeRateLimit(connection, kind, size)) {
      connection.close(1013, "Relay rate limit exceeded; reconnect shortly");
      return;
    }

    const syncSubtype = kind === "sync" && binary ? getSyncMessageSubtype(binary) : null;
    const mutatesDocument = syncSubtype === 1 || syncSubtype === 2;
    let exactMergedSize: number | undefined;
    let incomingUpdateBytes = 0;
    if (mutatesDocument && binary) {
      const incomingUpdate = extractSyncUpdate(binary);
      if (!incomingUpdate || !isValidYjsUpdate(incomingUpdate)) {
        connection.close(1003, "Malformed Yjs sync frame");
        return;
      }
      incomingUpdateBytes = incomingUpdate.byteLength;
      const executionReserve = this.activeExecutionReserveBytes();
      const needsReservedCapacityCheck =
        this.documentSize.estimate + incomingUpdateBytes + executionReserve >
        RELAY_LIMITS.maxDocumentBytes - 64 * 1024;
      if (this.documentSize.needsExactMeasurement(incomingUpdateBytes) || needsReservedCapacityCheck) {
        const mergedSize = measureMergedDocumentBytes(this.document, binary);
        if (mergedSize === null) {
          connection.close(1003, "Malformed Yjs sync frame");
          return;
        }
        if (mergedSize + executionReserve > RELAY_LIMITS.maxDocumentBytes) {
          connection.close(1009, "Shared document limit exceeded");
          return;
        }
        exactMergedSize = mergedSize;
      }
    }

    super.onMessage(connection, message);

    if (mutatesDocument) {
      if (exactMergedSize === undefined) this.documentSize.recordEstimatedUpdate(incomingUpdateBytes);
      else this.documentSize.recordExactMeasurement(exactMergedSize);
    }
    if (this.documentSync.observeSyncSubtype(connection.id, syncSubtype)) this.queueDocumentReady();
  }

  override onCustomMessage(connection: Connection, message: string): void {
    this.controlQueue = this.controlQueue
      .then(() => this.handleControlMessage(connection, message))
      .catch(() => {
        this.sendRejected(connection, {
          type: "run-rejected",
          code: "bad-message",
          message: "The relay could not process that run request.",
        });
      });
  }

  override async onClose(
    connection: Connection,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    const isSyncConnection = getState(connection)?.ticket.channel === "sync";
    try {
      this.controlQueue = this.controlQueue
        .then(() => this.documentSync.ready ? this.interruptConnectionRun(connection) : undefined)
        .catch(() => undefined);
      await this.controlQueue;
    } finally {
      if (isSyncConnection) {
        try {
          await super.onClose(connection, code, reason, wasClean);
        } catch {
          // Final-disconnect disposal below must still run if awareness cleanup
          // encounters a concurrently closed transport.
        }
      }
    }

    if (isSyncConnection && this.documentSync.removeResponder(connection.id)) {
      this.queueDocumentReady();
    }

    const remainingChannels: Array<"sync" | "control"> = [];
    for (const peer of this.getConnections()) {
      if (peer.id === connection.id) continue;
      const channel = getState(peer)?.ticket.channel;
      if (channel) remainingChannels.push(channel);
    }
    if (shouldResetEphemeralDocument(isSyncConnection ? "sync" : undefined, remainingChannels)) {
      // A fresh isolate creates a fresh Y.Doc. Unlike applying an empty Yjs
      // snapshot, this emits no deletion tombstones that could erase a
      // disconnected browser's local edits when it reconnects and seeds the
      // room again. Notebook data is never written to Durable Object storage.
      this.ctx.abort("Final collaboration sync connection closed; discarding ephemeral document");
    }
  }

  private consumeRateLimit(
    connection: Connection,
    kind: RelayRateKind,
    bytes: number,
  ): boolean {
    const relay = getState(connection);
    if (!relay) return false;
    const now = Date.now();
    const otherStates: Array<RelayRateState | undefined> = [];
    for (const peer of this.getConnections()) {
      const peerRelay = getState(peer);
      if (peer.id !== connection.id && peerRelay?.ticket.uid === relay.ticket.uid) {
        otherStates.push(peerRelay.rate);
      }
    }

    const decision = consumeUidRate(otherStates, relay.rate, kind, bytes, now, {
      windowMs: RELAY_LIMITS.rateWindowMs,
      maxSyncFrames: RELAY_LIMITS.maxSyncFramesPerWindow,
      maxAwarenessFrames: RELAY_LIMITS.maxAwarenessFramesPerWindow,
      maxControlFrames: RELAY_LIMITS.maxControlFramesPerWindow,
      maxBytes: RELAY_LIMITS.maxBytesPerWindow,
    });
    connection.setState((previous: unknown) => {
      const state = (previous as RelayConnectionState | null) ?? {};
      return { ...state, relay: { ...state.relay!, rate: decision.state } };
    });
    return decision.allowed;
  }

  private async handleControlMessage(connection: Connection, rawMessage: string): Promise<void> {
    const message = parseControlMessage(rawMessage);
    if (!message) {
      this.sendRejected(connection, {
        type: "run-rejected",
        code: "bad-message",
        message: "The run message is invalid.",
      });
      return;
    }
    if (!this.documentSync.ready) {
      this.sendRejected(connection, {
        type: "run-rejected",
        code: "document-syncing",
        message: "The notebook is resynchronizing after an idle period. Try again shortly.",
        requestId: message.type === "run-request" ? message.requestId : undefined,
        cellId: message.cellId,
        retryAfterMs: 250,
      });
      return;
    }
    await this.cleanupExpiredRuns(Date.now());
    if (message.type === "run-request") await this.handleRunRequest(connection, message);
    else await this.handleRunResult(connection, message);
  }

  private async handleRunRequest(connection: Connection, message: RunRequestMessage): Promise<void> {
    const relay = getState(connection);
    if (!relay) return;
    if (!this.documentSync.ready) {
      this.sendRejected(connection, {
        type: "run-rejected",
        code: "document-syncing",
        message: "The notebook is resynchronizing after an idle period. Try the run again shortly.",
        requestId: message.requestId,
        cellId: message.cellId,
        retryAfterMs: 250,
      });
      return;
    }
    const source = getExecutableCellSource(this.document, message.cellId);
    if (source === null) {
      this.sendRejected(connection, {
        type: "run-rejected",
        code: "cell-not-found",
        message: "That cell no longer exists.",
        requestId: message.requestId,
        cellId: message.cellId,
      });
      return;
    }

    const now = Date.now();
    const [currentHash, requestIdFingerprint] = await Promise.all([
      sha256(source),
      fingerprintRequestId(message.requestId),
    ]);
    if (getExecutableCellSource(this.document, message.cellId) !== source) {
      this.sendRejected(connection, {
        type: "run-rejected",
        code: "hash-mismatch",
        message: "The cell changed while the run was being prepared. Try again.",
        requestId: message.requestId,
        cellId: message.cellId,
      });
      return;
    }
    const activeRuns: ActiveRunView[] = [];
    let lastRunAt: number | undefined;
    for (const peer of this.getConnections()) {
      const peerRelay = getState(peer);
      if (!peerRelay) continue;
      if (peerRelay.ticket.uid === relay.ticket.uid && peerRelay.lastRunAt !== undefined) {
        lastRunAt = Math.max(lastRunAt ?? 0, peerRelay.lastRunAt);
      }
      if (peerRelay.activeRun) activeRuns.push(peerRelay.activeRun);
    }

    const rejection = evaluateRunRequest({
      now,
      uid: relay.ticket.uid,
      cellId: message.cellId,
      source,
      sourceHash: message.sourceHash,
      currentHash,
      lastRunAt,
      activeRuns,
    });
    if (rejection) {
      this.sendRejected(connection, {
        type: "run-rejected",
        ...rejection,
        requestId: message.requestId,
        cellId: message.cellId,
      });
      return;
    }

    if (!this.claimRunRequestId(connection, relay.ticket.uid, requestIdFingerprint, now)) {
      this.sendRejected(connection, {
        type: "run-rejected",
        code: "duplicate-request",
        message: "This run request was already processed.",
        requestId: message.requestId,
        cellId: message.cellId,
      });
      return;
    }

    const sequence = await this.nextRunSequence();
    if (getExecutableCellSource(this.document, message.cellId) !== source) {
      this.sendRejected(connection, {
        type: "run-rejected",
        code: "hash-mismatch",
        message: "The cell changed while the run was being prepared. Try again.",
        requestId: message.requestId,
        cellId: message.cellId,
      });
      return;
    }
    const run: ActiveRunState = {
      runId: crypto.randomUUID(),
      sequence,
      cellId: message.cellId,
      uid: relay.ticket.uid,
      nickname: relay.ticket.nickname,
      sourceHash: currentHash,
      acceptedAt: now,
      deadline: now + RELAY_LIMITS.runTimeoutMs,
    };
    const runningExecution: SharedExecution = {
      runId: run.runId,
      sequence,
      cellId: run.cellId,
      status: "running",
      ranBy: { uid: run.uid, nickname: run.nickname },
      acceptedAt: run.acceptedAt,
      sourceHash: run.sourceHash,
    };
    if (!this.writeExecution(runningExecution, (activeRuns.length + 1) * EXECUTION_RESERVE_BYTES)) {
      const cellStillExists = getExecutableCellSource(this.document, message.cellId) !== null;
      this.sendRejected(connection, {
        type: "run-rejected",
        code: cellStillExists ? "document-full" : "cell-not-found",
        message: cellStillExists
          ? "The shared notebook is too close to its size limit to record another run."
          : "That cell no longer exists.",
        requestId: message.requestId,
        cellId: message.cellId,
      });
      return;
    }
    connection.setState((previous: unknown) => {
      const state = (previous as RelayConnectionState | null) ?? {};
      return { ...state, relay: { ...state.relay!, lastRunAt: now, activeRun: run } };
    });
    this.scheduleRunTimeout(run, RELAY_LIMITS.runTimeoutMs);
    this.sendCustomMessage(
      connection,
      serializeControlMessage({
        type: "run-accepted",
        requestId: message.requestId,
        runId: run.runId,
        cellId: run.cellId,
        source,
        sourceHash: run.sourceHash,
        acceptedAt: run.acceptedAt,
        timeoutMs: RELAY_LIMITS.runTimeoutMs,
      }),
    );
  }

  private async handleRunResult(connection: Connection, message: RunResultMessage): Promise<void> {
    const relay = getState(connection);
    const run = relay?.activeRun;
    if (
      !relay ||
      !run ||
      run.runId !== message.runId ||
      run.cellId !== message.cellId ||
      run.sourceHash !== message.sourceHash
    ) {
      this.sendRejected(connection, {
        type: "run-rejected",
        code: "run-mismatch",
        message: "This result does not match the active run.",
        cellId: message.cellId,
      });
      return;
    }

    const now = Date.now();
    if (now > run.deadline) {
      const stale = await this.isRunStale(run);
      this.finishRun(connection, run, "timed_out", now, { error: "Execution exceeded the five-second limit." }, stale);
      this.sendRejected(connection, {
        type: "run-rejected",
        code: "run-expired",
        message: "The result arrived after the execution deadline.",
        cellId: message.cellId,
      });
      return;
    }

    const status = executionStatusForResult(message.timedOut, message.error);
    const output = truncateExecutionOutput(message.stdout, message.stderr, message.error);
    const stale = await this.isRunStale(run);
    this.finishRun(connection, run, status, now, output, stale);
    this.sendCustomMessage(
      connection,
      serializeControlMessage({ type: "run-recorded", runId: run.runId, cellId: run.cellId, stale }),
    );
  }

  private finishRun(
    connection: Connection,
    run: ActiveRunState,
    status: SharedExecution["status"],
    completedAt: number,
    output: { stdout?: string; stderr?: string; error?: string },
    stale: boolean,
  ): void {
    const timer = this.runTimers.get(run.runId);
    if (timer) clearTimeout(timer);
    this.runTimers.delete(run.runId);
    this.publishRunCompletion(run, status, completedAt, output, stale);
    try {
      connection.setState((previous: unknown) => {
        const state = (previous as RelayConnectionState | null) ?? {};
        if (state.relay?.activeRun?.runId !== run.runId) return state;
        return { ...state, relay: { ...state.relay, activeRun: undefined } };
      });
    } catch {
      // A close hook can receive an already-closed transport. Publication is
      // complete, and the attachment disappears with the socket.
    }
  }

  private publishRunCompletion(
    run: ActiveRunState,
    status: SharedExecution["status"],
    completedAt: number,
    output: { stdout?: string; stderr?: string; error?: string },
    stale: boolean,
  ): void {
    const completedExecution: SharedExecution = {
      runId: run.runId,
      sequence: run.sequence,
      cellId: run.cellId,
      status,
      ranBy: { uid: run.uid, nickname: run.nickname },
      acceptedAt: run.acceptedAt,
      completedAt,
      sourceHash: run.sourceHash,
      stdout: output.stdout ?? "",
      stderr: output.stderr ?? "",
      error: output.error,
      stale,
    };
    if (removeExecutionForMissingCell(this.document, run.cellId, run.runId)) {
      this.documentSize.recordExactMeasurement(Y.encodeStateAsUpdate(this.document).byteLength);
    } else {
      const remainingExecutionReserve = this.activeExecutionReserveBytes(run.runId);
      if (!this.writeExecution(completedExecution, remainingExecutionReserve)) {
        this.writeExecution(
          {
            ...completedExecution,
            stdout: "",
            stderr: "",
            error: "Execution output was omitted because the shared notebook reached its size limit.",
          },
          remainingExecutionReserve,
        );
      }
    }
  }

  private async cleanupExpiredRuns(now: number): Promise<void> {
    if (!this.documentSync.ready) return;
    for (const connection of this.getConnections()) {
      const run = getState(connection)?.activeRun;
      if (run && run.deadline <= now) {
        const stale = await this.isRunStale(run);
        this.finishRun(
          connection,
          run,
          "timed_out",
          now,
          { error: "Execution exceeded the five-second limit." },
          stale,
        );
      }
    }
  }

  private async interruptConnectionRun(connection: Connection): Promise<void> {
    const run = getState(connection)?.activeRun;
    if (!run) return;
    const stale = await this.isRunStale(run);
    this.finishRun(
      connection,
      run,
      "interrupted",
      Date.now(),
      { error: "The participant running this cell disconnected." },
      stale,
    );
  }

  private writeExecution(execution: SharedExecution, reservedBytes = 0): boolean {
    if (getExecutableCellSource(this.document, execution.cellId) === null) return false;
    const executions = this.document.getMap<SharedExecution>("executions");
    const existing = executions.get(execution.cellId);
    if (existing && existing.runId !== execution.runId && existing.sequence > execution.sequence) return true;

    const temporary = new Y.Doc();
    let predictedSize: number;
    try {
      Y.applyUpdate(temporary, Y.encodeStateAsUpdate(this.document));
      temporary.getMap<SharedExecution>("executions").set(execution.cellId, execution);
      predictedSize = Y.encodeStateAsUpdate(temporary).byteLength;
    } catch {
      return false;
    } finally {
      temporary.destroy();
    }
    // Leave a small margin because the temporary and live documents use
    // different Yjs client ids when encoding the replacement item.
    if (predictedSize + Math.max(0, reservedBytes) + 1_024 > RELAY_LIMITS.maxDocumentBytes) {
      return false;
    }

    this.document.transact(() => executions.set(execution.cellId, execution), "relay-execution");
    const exactSize = Y.encodeStateAsUpdate(this.document).byteLength;
    this.documentSize.recordExactMeasurement(exactSize);
    // Admission happened against the predicted state with a 1 KiB encoding
    // margin. Once broadcast, report success so callers never mistake an
    // already-published running record for a rejected write.
    return true;
  }

  private activeExecutionReserveBytes(excludedRunId?: string): number {
    const runIds = new Set<string>();
    for (const peer of this.getConnections()) {
      const run = getState(peer)?.activeRun;
      if (run && run.runId !== excludedRunId) runIds.add(run.runId);
    }
    return runIds.size * EXECUTION_RESERVE_BYTES;
  }

  private async nextRunSequence(): Promise<number> {
    return this.ctx.storage.transaction(async (transaction) => {
      const current = (await transaction.get<number>("runSequence")) ?? 0;
      const next = current + 1;
      await transaction.put("runSequence", next);
      return next;
    });
  }

  private claimRunRequestId(
    connection: Connection,
    uid: string,
    requestId: string,
    now: number,
  ): boolean {
    const peers: Connection[] = [];
    const existing: RecentRequestId[] = [];
    for (const peer of this.getConnections()) {
      const peerRelay = getState(peer);
      if (peerRelay?.ticket.uid !== uid) continue;
      peers.push(peer);
      if (peerRelay.recentRequestIds) existing.push(...peerRelay.recentRequestIds);
    }
    if (!peers.some((peer) => peer.id === connection.id)) peers.push(connection);

    const registration = registerRequestId(existing, requestId, now);
    for (const peer of peers) {
      peer.setState((previous: unknown) => {
        const state = (previous as RelayConnectionState | null) ?? {};
        return {
          ...state,
          relay: {
            ...state.relay!,
            // Replicate the bounded normalized ledger to every socket for the
            // UID so a requester disconnect cannot erase replay protection.
            recentRequestIds: registration.entries,
          },
        };
      });
    }
    return !registration.duplicate;
  }

  private queueDocumentReady(): void {
    this.controlQueue = this.controlQueue
      .then(() => this.reconcileRunsAfterSync())
      .then(() => this.announceControlReady())
      .catch(() => undefined);
  }

  private async reconcileRunsAfterSync(): Promise<void> {
    const now = Date.now();
    const activeByRunId = new Map<string, { connection: Connection; run: ActiveRunState }>();
    for (const connection of this.getConnections()) {
      const run = getState(connection)?.activeRun;
      if (run) activeByRunId.set(run.runId, { connection, run });
    }

    const sharedByRunId = new Map<string, ActiveRunState>();
    for (const [cellId, execution] of this.document.getMap<unknown>("executions")) {
      const run = activeRunFromSharedExecution(cellId, execution);
      if (run) sharedByRunId.set(run.runId, run);
    }

    for (const [runId, active] of activeByRunId) {
      const shared = sharedByRunId.get(runId);
      if (!shared || shared.cellId !== active.run.cellId) {
        this.clearConnectionRun(active.connection, runId);
        continue;
      }
      sharedByRunId.delete(runId);
      const decision = recoveredRunDecision(active.run, true, now);
      if (decision === "timed_out") {
        const stale = await this.isRunStale(active.run);
        this.finishRun(
          active.connection,
          active.run,
          "timed_out",
          now,
          { error: "Execution exceeded the five-second limit." },
          stale,
        );
      } else {
        this.scheduleRunTimeout(active.run, active.run.deadline - now);
      }
    }

    // A shared `running` value with no surviving attachment means the runner
    // disconnected while this isolate was asleep. Resolve it only after all
    // surviving sync sockets have restored the document.
    for (const run of sharedByRunId.values()) {
      const decision = recoveredRunDecision(run, false, now);
      const timedOut = decision === "timed_out";
      const stale = await this.isRunStale(run);
      this.publishRunCompletion(
        run,
        timedOut ? "timed_out" : "interrupted",
        now,
        {
          error: timedOut
            ? "Execution exceeded the five-second limit."
            : "The participant running this cell disconnected.",
        },
        stale,
      );
    }
  }

  private clearConnectionRun(connection: Connection, runId: string): void {
    const timer = this.runTimers.get(runId);
    if (timer) clearTimeout(timer);
    this.runTimers.delete(runId);
    try {
      connection.setState((previous: unknown) => {
        const state = (previous as RelayConnectionState | null) ?? {};
        if (state.relay?.activeRun?.runId !== runId) return state;
        return { ...state, relay: { ...state.relay, activeRun: undefined } };
      });
    } catch {
      // The socket may have closed during reconciliation.
    }
  }

  private sendRejected(connection: Connection, message: RunRejectedMessage): void {
    this.sendCustomMessage(connection, serializeControlMessage(message));
  }

  private sendControlReady(connection: Connection): void {
    const ticket = getState(connection)?.ticket;
    if (!ticket) return;
    this.sendCustomMessage(
      connection,
      serializeControlMessage({ type: "control-ready", expiresAt: ticket.expiresAt }),
    );
  }

  private announceControlReady(): void {
    for (const connection of this.getConnections()) this.sendControlReady(connection);
  }

  private async isRunStale(run: ActiveRunState): Promise<boolean> {
    const currentSource = getExecutableCellSource(this.document, run.cellId);
    if (currentSource === null) return true;
    const currentHash = await sha256(currentSource);
    return (
      getExecutableCellSource(this.document, run.cellId) !== currentSource ||
      currentHash !== run.sourceHash
    );
  }

  private scheduleRunTimeout(run: ActiveRunState, delayMs: number): void {
    const existing = this.runTimers.get(run.runId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.runTimers.delete(run.runId);
      this.controlQueue = this.controlQueue
        .then(() => this.cleanupExpiredRuns(Date.now()))
        .catch(() => undefined);
    }, delayMs + 1);
    this.runTimers.set(run.runId, timer);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/relay-ticket") return handleRelayTicket(request, env);

    const routed = await routePartykitRequest(request, env, {
      onBeforeConnect: async (candidate, lobby) => {
        if (lobby.className !== "CollaborationRoom") {
          return errorResponse(404, "not-found", "Relay route not found.");
        }
        const rejection = await authenticateSocketRequest(candidate, env, lobby.name);
        if (rejection) return rejection;
        const ticket = new URL(candidate.url).searchParams.get("ticket");
        if (!ticket) return errorResponse(401, "missing-ticket", "A relay ticket is required.");
        return forwardVerifiedSocketRequest(candidate, ticket);
      },
      onBeforeRequest: () => errorResponse(404, "not-found", "Relay route not found."),
    });
    return routed ?? errorResponse(404, "not-found", "Relay route not found.");
  },
} satisfies ExportedHandler<Env>;
