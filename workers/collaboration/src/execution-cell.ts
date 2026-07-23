import * as Y from "yjs";

const INITIAL_CELL_ID = "cell-initial";
const MAX_NOTEBOOK_CELLS = 50;
// This is the same additive update used by the browser seed. Applying the
// exact update gives the initial cell's stdin Y.Text one stable Yjs identity,
// regardless of whether a modern browser or the relay sees the legacy room
// first.
const INITIAL_STDIN_UPDATE_BASE64 = "AQGfxP+nCgAnAMyYvZoEAAVzdGRpbgIA";

function decodeBase64(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function isVisibleCell(cell: unknown): cell is Y.Map<unknown> {
  return (
    cell instanceof Y.Map &&
    cell.get("deleted") !== true &&
    cell.get("source") instanceof Y.Text
  );
}

export function getExecutableCellSource(document: Y.Doc, cellId: string): string | null {
  const cell = document.getMap<unknown>("cells").get(cellId);
  if (!(cell instanceof Y.Map) || cell.get("deleted") === true) return null;
  const source = cell.get("source");
  return source instanceof Y.Text ? source.toString() : null;
}

/**
 * Adds the shared-input type for cells written by pre-stdin clients. This runs
 * only in the room's single Durable Object, avoiding competing nested Y.Text
 * assignments when multiple browsers migrate the same legacy cell.
 */
export function ensureSharedCellInputs(document: Y.Doc): boolean {
  const cells = document.getMap<unknown>("cells");
  let changed = false;

  const initialCell = cells.get(INITIAL_CELL_ID);
  if (isVisibleCell(initialCell) && !(initialCell.get("stdin") instanceof Y.Text)) {
    Y.applyUpdate(
      document,
      decodeBase64(INITIAL_STDIN_UPDATE_BASE64),
      "relay-schema-repair",
    );
    changed = initialCell.get("stdin") instanceof Y.Text;
  }

  const orderedIds = document.getArray<string>("cellOrder").toArray();
  const seen = new Set<string>();
  const candidateIds = [
    ...orderedIds,
    ...Array.from(cells.keys()).sort(),
  ].filter((id) => {
    if (typeof id !== "string" || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const missingIds = candidateIds
    .filter((id) => {
      const cell = cells.get(id);
      return (
        isVisibleCell(cell) &&
        !(cell.get("stdin") instanceof Y.Text)
      );
    })
    .slice(0, MAX_NOTEBOOK_CELLS);
  if (missingIds.length === 0) return changed;

  document.transact(() => {
    for (const id of missingIds) {
      const cell = cells.get(id);
      if (isVisibleCell(cell) && !(cell.get("stdin") instanceof Y.Text)) {
        cell.set("stdin", new Y.Text());
      }
    }
  }, "relay-schema-repair");
  return true;
}

/**
 * Repairs the otherwise unusable zero-cell state in the room's single relay.
 * Browsers must not independently create a replacement nested map because
 * concurrent map assignments can make early source or stdin edits disappear.
 */
export function ensureNotebookHasCell(document: Y.Doc): boolean {
  const cells = document.getMap<unknown>("cells");
  if (Array.from(cells.values()).some(isVisibleCell)) return false;

  const executions = document.getMap("executions");
  let replacementId: string;
  do {
    replacementId = `cell-recovered-${crypto.randomUUID()}`;
  } while (cells.has(replacementId) || executions.has(replacementId));

  document.transact(() => {
    const cell = new Y.Map<unknown>();
    cell.set("id", replacementId);
    cell.set("language", "python");
    cell.set("deleted", false);
    cell.set("source", new Y.Text());
    cell.set("stdin", new Y.Text());
    cells.set(replacementId, cell);
    for (const cellId of executions.keys()) executions.delete(cellId);
    const order = document.getArray<string>("cellOrder");
    if (order.length) order.delete(0, order.length);
    order.push([replacementId]);
  }, "relay-schema-repair");
  return true;
}

export function ensureRelayNotebookSchema(document: Y.Doc): boolean {
  const repairedInput = ensureSharedCellInputs(document);
  const repairedEmptyNotebook = ensureNotebookHasCell(document);
  return repairedInput || repairedEmptyNotebook;
}

/** Removes this run's output if its cell was deleted while execution was active. */
export function removeExecutionForMissingCell(
  document: Y.Doc,
  cellId: string,
  runId: string,
): boolean {
  if (getExecutableCellSource(document, cellId) !== null) return false;
  const executions = document.getMap<{ runId?: unknown }>("executions");
  if (executions.get(cellId)?.runId === runId) {
    document.transact(() => executions.delete(cellId), "relay-execution");
  }
  return true;
}
