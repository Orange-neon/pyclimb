import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  classifyYjsFrame,
  extractSyncUpdate,
  getSyncMessageSubtype,
  measureMergedDocumentBytes,
} from "./yjs-frame";
import { ensureRelayNotebookSchema } from "./execution-cell";
import { RELAY_LIMITS } from "./protocol";

const PRE_STDIN_NOTEBOOK_UPDATE_BASE64 =
  "AQbMmL2aBAAnAQVjZWxscwxjZWxsLWluaXRpYWwBKADMmL2aBAACaWQBdwxjZWxsLWluaXRpYWwoAMyYvZoEAAhsYW5ndWFnZQF3BnB5dGhvbigAzJi9mgQAB2RlbGV0ZWQBeScAzJi9mgQABnNvdXJjZQIIAQljZWxsT3JkZXIBdwxjZWxsLWluaXRpYWwA";

function decodeBase64(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function encodeVarUint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;
  while (remaining > 0x7f) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 128);
  }
  bytes.push(remaining);
  return bytes;
}

function syncFrame(subtype: 1 | 2, update: Uint8Array): Uint8Array {
  return Uint8Array.from([
    0,
    subtype,
    ...encodeVarUint(update.byteLength),
    ...update,
  ]);
}

describe("Yjs relay frame parsing", () => {
  it("classifies awareness separately from document sync", () => {
    expect(classifyYjsFrame(Uint8Array.of(0, 0))).toBe("sync");
    expect(classifyYjsFrame(Uint8Array.of(1, 0))).toBe("awareness");
    expect(classifyYjsFrame(Uint8Array.of(3))).toBe("other");
    expect(getSyncMessageSubtype(Uint8Array.of(0, 2, 0))).toBe(2);
    expect(RELAY_LIMITS.maxAwarenessFrameBytes).toBe(64 * 1024);
    expect(RELAY_LIMITS.maxAwarenessFramesPerWindow).toBeGreaterThanOrEqual(60 * 10);
  });

  it("extracts only complete sync-step-2 and update payloads", () => {
    const update = Uint8Array.of(1, 2, 3);
    expect(extractSyncUpdate(syncFrame(1, update))).toEqual(update);
    expect(extractSyncUpdate(syncFrame(2, update))).toEqual(update);
    expect(extractSyncUpdate(Uint8Array.of(0, 1, 4, 1, 2, 3))).toBeNull();
    expect(extractSyncUpdate(Uint8Array.of(0, 0))).toBeNull();
  });

  it("does not double-count duplicate full sync from a multi-client document", () => {
    const firstClient = new Y.Doc();
    firstClient.getText("code").insert(0, "from-a");

    const secondClient = new Y.Doc();
    Y.applyUpdate(secondClient, Y.encodeStateAsUpdate(firstClient));
    secondClient.getText("code").insert(secondClient.getText("code").length, "-and-b");

    const server = new Y.Doc();
    const multiClientState = Y.encodeStateAsUpdate(secondClient);
    Y.applyUpdate(server, multiClientState);
    const currentBytes = Y.encodeStateAsUpdate(server).byteLength;

    expect(measureMergedDocumentBytes(server, syncFrame(1, multiClientState))).toBe(currentBytes);

    const thirdClient = new Y.Doc();
    Y.applyUpdate(thirdClient, multiClientState);
    thirdClient.getText("code").insert(thirdClient.getText("code").length, "-and-c");
    const thirdState = Y.encodeStateAsUpdate(thirdClient);

    const expected = new Y.Doc();
    Y.applyUpdate(expected, Y.encodeStateAsUpdate(server));
    Y.applyUpdate(expected, thirdState);
    expect(measureMergedDocumentBytes(server, syncFrame(1, thirdState))).toBe(
      Y.encodeStateAsUpdate(expected).byteLength,
    );

    firstClient.destroy();
    secondClient.destroy();
    thirdClient.destroy();
    server.destroy();
    expected.destroy();
  });

  it("includes authoritative schema repair in near-cap admission measurement", () => {
    const server = new Y.Doc();
    server.clientID = 0x70000001;
    server
      .getText("padding")
      .insert(0, "x".repeat(RELAY_LIMITS.maxDocumentBytes - 1_200));

    const client = new Y.Doc();
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server));
    Y.applyUpdate(client, decodeBase64(PRE_STDIN_NOTEBOOK_UPDATE_BASE64));
    const incomingUpdate = Y.encodeStateAsUpdate(client, Y.encodeStateVector(server));
    const frame = syncFrame(2, incomingUpdate);

    const rawMergedSize = measureMergedDocumentBytes(server, frame);
    const repairedMergedSize = measureMergedDocumentBytes(
      server,
      frame,
      ensureRelayNotebookSchema,
    );

    const expected = new Y.Doc();
    Y.applyUpdate(expected, Y.encodeStateAsUpdate(server));
    Y.applyUpdate(expected, incomingUpdate);
    ensureRelayNotebookSchema(expected);
    expect(repairedMergedSize).toBe(Y.encodeStateAsUpdate(expected).byteLength);
    expect(repairedMergedSize).toBeGreaterThan(rawMergedSize!);

    // Without measuring the relay-owned Y.Text, the 1 KiB encoding margin
    // would accept this update. Including repair correctly rejects it.
    expect(
      rawMergedSize! + RELAY_LIMITS.schemaRepairEncodingMarginBytes,
    ).toBeLessThanOrEqual(RELAY_LIMITS.maxDocumentBytes);
    expect(
      repairedMergedSize! + RELAY_LIMITS.schemaRepairEncodingMarginBytes,
    ).toBeGreaterThan(RELAY_LIMITS.maxDocumentBytes);

    server.destroy();
    client.destroy();
    expected.destroy();
  });
});
