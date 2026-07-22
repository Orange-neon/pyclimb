export type BoundedBodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too-large" | "invalid-utf8" };

/** Reads at most maxBytes from a request stream, independent of Content-Length. */
export async function readBoundedUtf8Body(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<BoundedBodyResult> {
  if (!body) return { ok: true, text: "" };
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel("request body limit exceeded").catch(() => undefined);
        return { ok: false, reason: "too-large" };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, text };
  } catch {
    await reader.cancel("invalid request body").catch(() => undefined);
    return { ok: false, reason: "invalid-utf8" };
  } finally {
    reader.releaseLock();
  }
}
