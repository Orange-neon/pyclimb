import { describe, expect, it } from "vitest";

import { readBoundedUtf8Body } from "./http-body";

function chunkedBody(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe("bounded relay request bodies", () => {
  it("accepts a body exactly at the byte limit across chunks", async () => {
    const encoder = new TextEncoder();
    await expect(
      readBoundedUtf8Body(chunkedBody([encoder.encode("é"), encoder.encode("ab")]), 4),
    ).resolves.toEqual({ ok: true, text: "éab" });
  });

  it("stops streamed bodies that exceed the limit without trusting a header", async () => {
    const encoder = new TextEncoder();
    await expect(
      readBoundedUtf8Body(
        chunkedBody([encoder.encode("x".repeat(4_096)), encoder.encode("overflow")]),
        4_096,
      ),
    ).resolves.toEqual({ ok: false, reason: "too-large" });
  });

  it("rejects invalid UTF-8", async () => {
    await expect(
      readBoundedUtf8Body(chunkedBody([Uint8Array.of(0xc3, 0x28)]), 4_096),
    ).resolves.toEqual({ ok: false, reason: "invalid-utf8" });
  });
});
