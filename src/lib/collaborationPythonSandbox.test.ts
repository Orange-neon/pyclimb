import { describe, expect, it } from "vitest";
import {
  COLLABORATION_IFRAME_SANDBOX,
  COLLABORATION_SANDBOX_CSP,
  createCollaborationSandboxSrcdoc,
} from "./collaborationPythonSandbox";

describe("opaque collaboration Python sandbox", () => {
  it("uses an opaque-origin iframe policy", () => {
    expect(COLLABORATION_IFRAME_SANDBOX).toBe("allow-scripts");
    expect(COLLABORATION_IFRAME_SANDBOX).not.toContain("allow-same-origin");
  });

  it("restricts network access and validates parent messages", () => {
    const srcdoc = createCollaborationSandboxSrcdoc("channel-test");
    expect(srcdoc).toContain(COLLABORATION_SANDBOX_CSP);
    expect(srcdoc).toContain('event.source !== parent');
    expect(srcdoc).toContain('message.channel !== channel');
    expect(srcdoc).toContain("runtime.toPy");
    expect(srcdoc).toContain("globals.destroy");
    expect(srcdoc).toContain("createInputReader");
    expect(srcdoc).toContain("runtime.setStdin");
    expect(srcdoc).toContain('typeof message.stdin !== "string"');
    expect(srcdoc).toContain("connect-src https://cdn.jsdelivr.net");
    expect(srcdoc).toContain("'wasm-unsafe-eval'");
    expect(srcdoc).toContain("importScripts");
    expect(srcdoc).toContain("pyodide.js");
    expect(srcdoc).not.toContain("pyodide.mjs");
    expect(srcdoc).not.toContain('type: "module"');
    expect(srcdoc).toContain("new TextDecoder");
    expect(srcdoc).toContain("write: (buffer)");
    expect(srcdoc).not.toContain("String.fromCharCode");
    expect(srcdoc).not.toContain("firebase");
    expect(srcdoc).not.toContain("localStorage");
  });
});
