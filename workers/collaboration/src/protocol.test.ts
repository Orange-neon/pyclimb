import { describe, expect, it } from "vitest";

import {
  parseControlMessage,
  parseTicketRequest,
  truncateExecutionOutput,
  utf8ByteLength,
} from "./protocol";

const hash = "a".repeat(64);

describe("relay protocol parsing", () => {
  it("normalizes valid ticket requests and rejects ambiguous room codes", () => {
    expect(
      parseTicketRequest({
        code: "abc234",
        roomInstanceId: "13C5BA32-BB06-49EA-A5DC-9CD40FA9AA58",
      }),
    ).toEqual({
      code: "ABC234",
      roomInstanceId: "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
    });
    expect(parseTicketRequest({ code: "ABCI23", roomInstanceId: "a".repeat(32) })).toBeNull();
  });

  it("accepts only bounded run identifiers and SHA-256 hashes", () => {
    expect(
      parseControlMessage(JSON.stringify({
        type: "run-request",
        requestId: "request_1",
        cellId: "cell-1",
        sourceHash: hash,
      })),
    ).toMatchObject({ type: "run-request", cellId: "cell-1" });
    expect(
      parseControlMessage(JSON.stringify({
        type: "run-request",
        requestId: "request 1",
        cellId: "cell-1",
        sourceHash: hash,
      })),
    ).toBeNull();
    expect(parseControlMessage("not json")).toBeNull();
  });

  it("caps combined execution output without breaking UTF-8", () => {
    const result = truncateExecutionOutput("🙂".repeat(10), "stderr", "error", 17);
    expect(utf8ByteLength(`${result.stdout}${result.stderr}${result.error ?? ""}`)).toBeLessThanOrEqual(17);
    expect(result.stdout).not.toContain("�");
  });
});
