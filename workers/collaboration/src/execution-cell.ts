import * as Y from "yjs";

export function getExecutableCellSource(document: Y.Doc, cellId: string): string | null {
  const cell = document.getMap<unknown>("cells").get(cellId);
  if (!(cell instanceof Y.Map) || cell.get("deleted") === true) return null;
  const source = cell.get("source");
  return source instanceof Y.Text ? source.toString() : null;
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
