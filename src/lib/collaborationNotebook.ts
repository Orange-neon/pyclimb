import * as Y from "yjs";

export const COLLABORATION_SCHEMA_VERSION = 1;
export const INITIAL_CELL_ID = "cell-initial";
export const MAX_NOTEBOOK_CELLS = 50;
export const MAX_CELL_SOURCE_BYTES = 50 * 1024;
export const MAX_EXECUTION_OUTPUT_BYTES = 20 * 1024;

const INITIAL_NOTEBOOK_UPDATE_BASE64 =
  "AQbMmL2aBAAnAQVjZWxscwxjZWxsLWluaXRpYWwBKADMmL2aBAACaWQBdwxjZWxsLWluaXRpYWwoAMyYvZoEAAhsYW5ndWFnZQF3BnB5dGhvbigAzJi9mgQAB2RlbGV0ZWQBeScAzJi9mgQABnNvdXJjZQIIAQljZWxsT3JkZXIBdwxjZWxsLWluaXRpYWwA";

export type NotebookExecutionStatus =
  | "running"
  | "finished"
  | "error"
  | "timed_out"
  | "interrupted";

export interface NotebookExecution {
  status: NotebookExecutionStatus;
  runId: string;
  sequence?: number;
  ranBy: { uid: string; nickname: string };
  acceptedAt: number;
  completedAt?: number;
  sourceHash: string;
  stdout?: string;
  stderr?: string;
  error?: string;
  stale?: boolean;
}

export interface NotebookCell {
  id: string;
  language: "python";
  source: Y.Text;
  execution: NotebookExecution | null;
}

export interface NotebookSnapshot {
  cells: NotebookCell[];
}

function canonicalVisibleCellIds(document: Y.Doc): string[] {
  const cells = getNotebookCells(document);
  const seen = new Set<string>();
  const orderedIds: string[] = [];

  for (const id of getNotebookCellOrder(document).toArray()) {
    if (typeof id !== "string" || seen.has(id) || !isVisibleCell(cells.get(id))) continue;
    seen.add(id);
    orderedIds.push(id);
  }

  const unorderedIds = Array.from(cells.entries())
    .filter(([id, cell]) => !seen.has(id) && isVisibleCell(cell))
    .map(([id]) => id)
    .sort();
  return [...orderedIds, ...unorderedIds];
}

function decodeBase64(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function applyInitialNotebookUpdate(document: Y.Doc): void {
  Y.applyUpdate(document, decodeBase64(INITIAL_NOTEBOOK_UPDATE_BASE64), "notebook-seed");
}

export function getNotebookCellOrder(document: Y.Doc): Y.Array<string> {
  return document.getArray<string>("cellOrder");
}

export function getNotebookCells(document: Y.Doc): Y.Map<Y.Map<unknown>> {
  return document.getMap<Y.Map<unknown>>("cells");
}

export function getNotebookExecutions(document: Y.Doc): Y.Map<NotebookExecution> {
  return document.getMap<NotebookExecution>("executions");
}

export function getNotebookCellMap(
  document: Y.Doc,
  cellId: string,
): Y.Map<unknown> | null {
  const value = getNotebookCells(document).get(cellId);
  return value instanceof Y.Map ? value : null;
}

export function getNotebookCellSource(document: Y.Doc, cellId: string): Y.Text | null {
  const value = getNotebookCellMap(document, cellId)?.get("source");
  return value instanceof Y.Text ? value : null;
}

export function notebookSourceByteLength(source: string | Y.Text): number {
  return new TextEncoder().encode(typeof source === "string" ? source : source.toString()).byteLength;
}

export function trimNotebookCellSource(source: Y.Text): boolean {
  const value = source.toString();
  if (notebookSourceByteLength(value) <= MAX_CELL_SOURCE_BYTES) return false;
  const encoder = new TextEncoder();
  let bytes = 0;
  let end = 0;
  for (const character of value) {
    const characterBytes = encoder.encode(character).byteLength;
    if (bytes + characterBytes > MAX_CELL_SOURCE_BYTES) break;
    bytes += characterBytes;
    end += character.length;
  }
  source.delete(end, source.length - end);
  return true;
}

function isVisibleCell(cell: Y.Map<unknown> | undefined): cell is Y.Map<unknown> {
  return cell instanceof Y.Map && cell.get("deleted") !== true && cell.get("source") instanceof Y.Text;
}

function parseExecution(value: unknown): NotebookExecution | null {
  if (!value || typeof value !== "object" || value instanceof Y.AbstractType) return null;
  const candidate = value as Partial<NotebookExecution>;
  if (
    typeof candidate.runId !== "string" ||
    typeof candidate.status !== "string" ||
    typeof candidate.acceptedAt !== "number" ||
    typeof candidate.sourceHash !== "string"
  ) {
    return null;
  }
  return candidate as NotebookExecution;
}

/**
 * Builds a canonical view without rewriting concurrently inserted array items.
 * Duplicate order entries are hidden, while unordered live cells are appended
 * by id so every peer renders the same structure after updates converge.
 */
export function readNotebookSnapshot(document: Y.Doc): NotebookSnapshot {
  const cells = getNotebookCells(document);
  const executions = getNotebookExecutions(document);

  return {
    cells: canonicalVisibleCellIds(document).slice(0, MAX_NOTEBOOK_CELLS).map((id) => {
      const cell = cells.get(id)!;
      return {
        id,
        language: "python" as const,
        source: cell.get("source") as Y.Text,
        execution: parseExecution(executions.get(id)),
      };
    }),
  };
}

/**
 * Removes deterministic overflow, legacy tombstones, and execution records
 * whose cell is no longer visible. Duplicate and missing order entries are
 * otherwise normalized by the canonical read-only view.
 */
export function normalizeNotebookStructure(document: Y.Doc): boolean {
  const canonical = canonicalVisibleCellIds(document);
  const visibleIds = new Set(canonical.slice(0, MAX_NOTEBOOK_CELLS));
  const overflow = canonical.slice(MAX_NOTEBOOK_CELLS);
  const legacyTombstones = Array.from(getNotebookCells(document).entries())
    .filter(([, cell]) => cell instanceof Y.Map && cell.get("deleted") === true)
    .map(([id]) => id);
  const removals = new Set([...overflow, ...legacyTombstones]);
  const orphanExecutions = Array.from(getNotebookExecutions(document).keys()).filter(
    (id) => !visibleIds.has(id),
  );
  if (removals.size === 0 && orphanExecutions.length === 0) return false;

  document.transact(() => {
    for (const id of removals) {
      const cell = getNotebookCellMap(document, id);
      const source = cell?.get("source");
      if (source instanceof Y.Text && source.length) source.delete(0, source.length);
      getNotebookCells(document).delete(id);
      getNotebookExecutions(document).delete(id);
    }
    const order = getNotebookCellOrder(document);
    for (let index = order.length - 1; index >= 0; index -= 1) {
      if (removals.has(order.get(index))) order.delete(index, 1);
    }
    for (const id of orphanExecutions) getNotebookExecutions(document).delete(id);
  }, "notebook-normalize");
  return true;
}

function createCellMap(id: string): Y.Map<unknown> {
  const cell = new Y.Map<unknown>();
  cell.set("id", id);
  cell.set("language", "python");
  cell.set("deleted", false);
  cell.set("source", new Y.Text());
  return cell;
}

function makeCellId(): string {
  return `cell-${crypto.randomUUID()}`;
}

/** Repairs only the otherwise unusable zero-cell state after concurrent deletes. */
export function ensureNotebookHasCell(document: Y.Doc): void {
  if (readNotebookSnapshot(document).cells.length > 0) return;
  const cells = getNotebookCells(document);
  const reusableId = Array.from(cells.keys()).sort()[0] ?? INITIAL_CELL_ID;

  document.transact(() => {
    let cell = cells.get(reusableId);
    if (!(cell instanceof Y.Map)) {
      cell = createCellMap(reusableId);
      cells.set(reusableId, cell);
    }
    cell.set("deleted", false);
    const source = cell.get("source");
    if (source instanceof Y.Text) {
      if (source.length) source.delete(0, source.length);
    } else {
      cell.set("source", new Y.Text());
    }
    getNotebookExecutions(document).delete(reusableId);
    const order = getNotebookCellOrder(document);
    if (!order.toArray().includes(reusableId)) order.push([reusableId]);
  }, "notebook-repair");
}

export function addNotebookCell(document: Y.Doc, afterCellId?: string): string | null {
  const snapshot = readNotebookSnapshot(document);
  if (snapshot.cells.length >= MAX_NOTEBOOK_CELLS) return null;

  const id = makeCellId();
  const order = getNotebookCellOrder(document);
  const rawOrder = order.toArray();
  const anchorIndex = afterCellId ? rawOrder.indexOf(afterCellId) : -1;
  const targetIndex = anchorIndex >= 0 ? anchorIndex + 1 : rawOrder.length;

  document.transact(() => {
    getNotebookCells(document).set(id, createCellMap(id));
    order.insert(Math.max(0, targetIndex), [id]);
  }, "notebook-structure");
  return id;
}

export function moveNotebookCell(
  document: Y.Doc,
  cellId: string,
  direction: -1 | 1,
): boolean {
  const ids = readNotebookSnapshot(document).cells.map((cell) => cell.id);
  const from = ids.indexOf(cellId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return false;
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);

  document.transact(() => {
    const order = getNotebookCellOrder(document);
    if (order.length) order.delete(0, order.length);
    order.insert(0, ids);
  }, "notebook-structure");
  return true;
}

export function deleteNotebookCell(document: Y.Doc, cellId: string): boolean {
  const snapshot = readNotebookSnapshot(document);
  const cell = snapshot.cells.find((candidate) => candidate.id === cellId);
  if (!cell) return false;

  document.transact(() => {
    if (snapshot.cells.length === 1) {
      if (cell.source.length) cell.source.delete(0, cell.source.length);
    } else {
      if (cell.source.length) cell.source.delete(0, cell.source.length);
      getNotebookCells(document).delete(cellId);
      const order = getNotebookCellOrder(document);
      for (let index = order.length - 1; index >= 0; index -= 1) {
        if (order.get(index) === cellId) order.delete(index, 1);
      }
    }
    getNotebookExecutions(document).delete(cellId);
  }, "notebook-structure");
  ensureNotebookHasCell(document);
  return true;
}

export async function hashNotebookSource(source: string): Promise<string> {
  const bytes = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function participantColor(uid: string): string {
  const palette = ["#38bdf8", "#34d399", "#fbbf24", "#c084fc", "#fb7185", "#22d3ee"];
  let hash = 0;
  for (const character of uid) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

export function truncateExecutionOutput(result: {
  stdout?: string;
  stderr?: string;
  error?: string;
}): { stdout: string; stderr: string; error?: string } {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const stdoutValue = result.stdout ?? "";
  const stderrValue = result.stderr ?? "";
  const errorValue = result.error ?? "";
  const totalBytes =
    encoder.encode(stdoutValue).byteLength +
    encoder.encode(stderrValue).byteLength +
    encoder.encode(errorValue).byteLength;
  if (totalBytes <= MAX_EXECUTION_OUTPUT_BYTES) {
    return { stdout: stdoutValue, stderr: stderrValue, error: result.error };
  }

  const marker = "… output truncated";
  let remaining = MAX_EXECUTION_OUTPUT_BYTES - encoder.encode(`\n${marker}`).byteLength;
  const take = (value: string | undefined): string => {
    if (!value || remaining <= 0) return "";
    const encoded = encoder.encode(value);
    if (encoded.byteLength <= remaining) {
      remaining -= encoded.byteLength;
      return value;
    }
    let end = remaining;
    while (end > 0 && (encoded[end] & 0xc0) === 0x80) end -= 1;
    const next = decoder.decode(encoded.slice(0, end));
    remaining -= encoder.encode(next).byteLength;
    return next;
  };
  // Preserve the exception before ordinary output so a noisy program cannot
  // be mislabeled or hide the reason it failed.
  const error = take(errorValue);
  const stdout = take(stdoutValue);
  const stderr = take(stderrValue);
  return {
    stdout,
    stderr: `${stderr}${stderr ? "\n" : ""}${marker}`,
    error: error || undefined,
  };
}
