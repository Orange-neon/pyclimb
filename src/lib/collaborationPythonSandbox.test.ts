import { describe, expect, it } from "vitest";
import {
  COLLABORATION_IFRAME_SANDBOX,
  COLLABORATION_SANDBOX_CSP,
  createCollaborationSandboxSrcdoc,
  formatCollaborationExecutionError,
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
    expect(srcdoc).toContain("__col_user_code__");
    expect(srcdoc).toContain("__col_base_exception = BaseException");
    expect(srcdoc).toContain("except __col_base_exception");
    expect(srcdoc).toContain("<col-runner>");
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
    expect(srcdoc).toContain("stderr: capturedStderr");
    expect(srcdoc).not.toContain("String.fromCharCode");
    expect(srcdoc).not.toContain("firebase");
    expect(srcdoc).not.toContain("localStorage");
  });

  it("keeps captured stderr but removes Pyodide internals from exceptions", () => {
    const traceback = `Traceback (most recent call last):
  File "/lib/python311.zip/_pyodide/_base.py", line 573, in eval_code_async
    await CodeRunner(
  File "/lib/python311.zip/_pyodide/_base.py", line 393, in run_async
    coroutine = eval(self.code, globals, locals)
  File "<exec>", line 4, in <module>
    calculate()
  File "<exec>", line 2, in calculate
    return 1 / 0
           ~~^~~
ZeroDivisionError: division by zero`;

    expect(formatCollaborationExecutionError("warning from your code\n", traceback)).toEqual({
      stderr: `warning from your code
Your code, line 4:
    calculate()
Your code, line 2 in calculate:
    return 1 / 0
           ~~^~~
ZeroDivisionError: division by zero`,
      error: `Your code, line 4:
    calculate()
Your code, line 2 in calculate:
    return 1 / 0
           ~~^~~
ZeroDivisionError: division by zero`,
    });
  });
});
