import * as Y from "yjs";

export type YjsFrameKind = "sync" | "awareness" | "other";

interface VarUint {
  value: number;
  nextOffset: number;
}

function readVarUint(bytes: Uint8Array, offset: number): VarUint | null {
  let value = 0;
  let multiplier = 1;
  for (let index = offset; index < bytes.length && index - offset < 8; index += 1) {
    const byte = bytes[index];
    value += (byte & 0x7f) * multiplier;
    if (!Number.isSafeInteger(value)) return null;
    if ((byte & 0x80) === 0) return { value, nextOffset: index + 1 };
    multiplier *= 128;
  }
  return null;
}

export function classifyYjsFrame(bytes: Uint8Array): YjsFrameKind {
  const outer = readVarUint(bytes, 0)?.value;
  if (outer === 0) return "sync";
  if (outer === 1) return "awareness";
  return "other";
}

export function getSyncMessageSubtype(bytes: Uint8Array): number | null {
  const outer = readVarUint(bytes, 0);
  if (!outer || outer.value !== 0) return null;
  return readVarUint(bytes, outer.nextOffset)?.value ?? null;
}

/** Extracts the Yjs update from sync-step-2 (1) or update (2) frames. */
export function extractSyncUpdate(bytes: Uint8Array): Uint8Array | null {
  const outer = readVarUint(bytes, 0);
  if (!outer || outer.value !== 0) return null;
  const subtype = readVarUint(bytes, outer.nextOffset);
  if (!subtype || (subtype.value !== 1 && subtype.value !== 2)) return null;
  const length = readVarUint(bytes, subtype.nextOffset);
  if (!length) return null;
  const end = length.nextOffset + length.value;
  if (end !== bytes.length || end < length.nextOffset) return null;
  return bytes.slice(length.nextOffset, end);
}

/** Validates an update without copying the existing shared document. */
export function isValidYjsUpdate(update: Uint8Array): boolean {
  try {
    Y.decodeUpdate(update);
    return true;
  } catch {
    return false;
  }
}

/**
 * Measures the canonical state after merging an incoming sync update without
 * mutating the live document. Duplicate full-state frames therefore cost zero
 * additional document state instead of being pessimistically double-counted.
 */
export function measureMergedDocumentBytes(document: Y.Doc, frame: Uint8Array): number | null {
  const incomingUpdate = extractSyncUpdate(frame);
  if (!incomingUpdate) return null;

  const temporary = new Y.Doc();
  try {
    Y.applyUpdate(temporary, Y.encodeStateAsUpdate(document));
    Y.applyUpdate(temporary, incomingUpdate);
    return Y.encodeStateAsUpdate(temporary).byteLength;
  } catch {
    return null;
  } finally {
    temporary.destroy();
  }
}
