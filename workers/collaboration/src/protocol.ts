export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
export const ROOM_INSTANCE_PATTERN = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export const RELAY_LIMITS = {
  ticketLifetimeMs: 60_000,
  runCooldownMs: 500,
  runTimeoutMs: 5_000,
  maxParticipants: 30,
  maxConnections: 60,
  maxConnectionsPerUid: 4,
  maxSourceBytes: 50 * 1024,
  maxOutputBytes: 20 * 1024,
  maxControlFrameBytes: 256 * 1024,
  maxAwarenessFrameBytes: 64 * 1024,
  // Full Yjs state vectors can be larger than an individual edit frame. The
  // relay therefore caps binary sync frames at the same size as the document.
  maxSyncFrameBytes: 4 * 1024 * 1024 + 64 * 1024,
  maxDocumentBytes: 4 * 1024 * 1024,
  rateWindowMs: 10_000,
  maxSyncFramesPerWindow: 300,
  maxAwarenessFramesPerWindow: 900,
  maxControlFramesPerWindow: 40,
  maxBytesPerWindow: 10 * 1024 * 1024,
} as const;

export type RelayChannel = "sync" | "control";
export type RelayRole = "creator" | "member";

export interface RelayTicketRequest {
  code: string;
  roomInstanceId: string;
}

export interface RelayTicketResponse {
  syncTicket: string;
  controlTicket: string;
  expiresAt: number;
  websocketUrl: string;
}

export interface RelayTicketPayload {
  version: 1;
  roomInstanceId: string;
  code: string;
  uid: string;
  nickname: string;
  role: RelayRole;
  channel: RelayChannel;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

export interface RunRequestMessage {
  type: "run-request";
  requestId: string;
  cellId: string;
  sourceHash: string;
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

export type ClientControlMessage = RunRequestMessage | RunResultMessage;

export interface ControlReadyMessage {
  type: "control-ready";
  expiresAt: number;
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

export type RunRejectionCode =
  | "bad-message"
  | "cell-busy"
  | "cell-not-found"
  | "cooldown"
  | "document-full"
  | "document-syncing"
  | "duplicate-request"
  | "hash-mismatch"
  | "run-expired"
  | "run-mismatch"
  | "source-too-large"
  | "uid-busy";

export interface RunRejectedMessage {
  type: "run-rejected";
  code: RunRejectionCode;
  message: string;
  requestId?: string;
  cellId?: string;
  retryAfterMs?: number;
}

export interface RunRecordedMessage {
  type: "run-recorded";
  runId: string;
  cellId: string;
  stale: boolean;
}

export type ServerControlMessage =
  | ControlReadyMessage
  | RunAcceptedMessage
  | RunRejectedMessage
  | RunRecordedMessage;

export type ExecutionStatus =
  | "running"
  | "finished"
  | "error"
  | "timed_out"
  | "interrupted";

export interface SharedExecution {
  runId: string;
  sequence: number;
  cellId: string;
  status: ExecutionStatus;
  ranBy: { uid: string; nickname: string };
  acceptedAt: number;
  completedAt?: number;
  sourceHash: string;
  stdout?: string;
  stderr?: string;
  error?: string;
  stale?: boolean;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

export function parseTicketRequest(value: unknown): RelayTicketRequest | null {
  if (!isObject(value)) return null;

  const code = typeof value.code === "string" ? value.code.trim().toUpperCase() : "";
  const roomInstanceId =
    typeof value.roomInstanceId === "string" ? value.roomInstanceId.trim().toLowerCase() : "";

  if (!ROOM_CODE_PATTERN.test(code) || !ROOM_INSTANCE_PATTERN.test(roomInstanceId)) {
    return null;
  }

  return { code, roomInstanceId };
}

export function parseControlMessage(message: string): ClientControlMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(message);
  } catch {
    return null;
  }

  if (!isObject(value) || typeof value.type !== "string") return null;

  if (value.type === "run-request") {
    if (!isId(value.requestId) || !isId(value.cellId)) return null;
    if (typeof value.sourceHash !== "string" || !SHA256_PATTERN.test(value.sourceHash)) return null;
    return {
      type: "run-request",
      requestId: value.requestId,
      cellId: value.cellId,
      sourceHash: value.sourceHash,
    };
  }

  if (value.type === "run-result") {
    if (!isId(value.runId) || !isId(value.cellId)) return null;
    if (typeof value.sourceHash !== "string" || !SHA256_PATTERN.test(value.sourceHash)) return null;
    if (typeof value.stdout !== "string" || typeof value.stderr !== "string") return null;
    if (value.error !== undefined && typeof value.error !== "string") return null;
    if (value.timedOut !== undefined && typeof value.timedOut !== "boolean") return null;
    return {
      type: "run-result",
      runId: value.runId,
      cellId: value.cellId,
      sourceHash: value.sourceHash,
      stdout: value.stdout,
      stderr: value.stderr,
      error: value.error,
      timedOut: value.timedOut,
    };
  }

  return null;
}

export function serializeControlMessage(message: ServerControlMessage): string {
  return JSON.stringify(message);
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function truncateUtf8(value: string, maxBytes: number): string {
  const encoded = new TextEncoder().encode(value);
  if (encoded.byteLength <= maxBytes) return value;

  const decoder = new TextDecoder("utf-8", { fatal: false });
  let end = maxBytes;
  while (end > 0 && (encoded[end] & 0xc0) === 0x80) end -= 1;
  return decoder.decode(encoded.slice(0, end));
}

export function truncateExecutionOutput(
  stdout: string,
  stderr: string,
  error: string | undefined,
  maxBytes = RELAY_LIMITS.maxOutputBytes,
): { stdout: string; stderr: string; error?: string } {
  const nextStdout = truncateUtf8(stdout, maxBytes);
  let remaining = Math.max(0, maxBytes - utf8ByteLength(nextStdout));
  const nextStderr = truncateUtf8(stderr, remaining);
  remaining = Math.max(0, remaining - utf8ByteLength(nextStderr));
  const nextError = error === undefined ? undefined : truncateUtf8(error, remaining);
  return { stdout: nextStdout, stderr: nextStderr, error: nextError };
}
