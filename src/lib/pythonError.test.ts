import { beforeAll, describe, expect, it } from "vitest";
import { loadPyodide } from "pyodide";
import { formatPythonError, PYTHON_RUNNER_SOURCE } from "./pythonError";

describe("formatPythonError", () => {
  it("removes Pyodide frames and keeps the student-code error", () => {
    const traceback = `Traceback (most recent call last):
  File "/lib/python311.zip/_pyodide/_base.py", line 573, in eval_code_async
    await CodeRunner(
  File "/lib/python311.zip/_pyodide/_base.py", line 393, in run_async
    coroutine = eval(self.code, globals, locals)
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "<exec>", line 10, in <module>
    for item, count in inventory:
        ^^^^^^^^^^^
ValueError: too many values to unpack (expected 2)`;

    expect(formatPythonError(traceback)).toBe(`Your code, line 10:
    for item, count in inventory:
        ^^^^^^^^^^^
ValueError: too many values to unpack (expected 2)`);
  });

  it("preserves multiple student-code frames", () => {
    const traceback = `Traceback (most recent call last):
  File "/lib/python311.zip/_pyodide/_base.py", line 573, in eval_code_async
  File "<exec>", line 8, in <module>
  File "<exec>", line 3, in calculate
ZeroDivisionError: division by zero`;

    expect(formatPythonError(traceback)).toBe(`Your code, line 8:
Your code, line 3 in calculate:
ZeroDivisionError: division by zero`);
  });

  it("cleans every traceback in a chained exception", () => {
    const traceback = `Traceback (most recent call last):
  File "<exec>", line 2, in <module>
ZeroDivisionError: division by zero

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/lib/python311.zip/_pyodide/_base.py", line 573, in eval_code_async
    await CodeRunner(
  File "/lib/python311.zip/_pyodide/_base.py", line 393, in run_async
    coroutine = eval(self.code, globals, locals)
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "<exec>", line 4, in <module>
NameError: name 'prin' is not defined`;

    expect(formatPythonError(traceback)).toBe(`Your code, line 2:
ZeroDivisionError: division by zero

During handling of the above exception, another exception occurred:

Your code, line 4:
NameError: name 'prin' is not defined`);
  });

  it("removes the interpreter frame added by exit()", () => {
    const traceback = `Traceback (most recent call last):
  File "/lib/python311.zip/_pyodide/_base.py", line 573, in eval_code_async
    await CodeRunner(
  File "<exec>", line 1, in <module>
  File "<frozen _sitebuiltins>", line 26, in __call__
SystemExit: None`;

    expect(formatPythonError(traceback)).toBe(`Your code, line 1:
SystemExit: None`);
  });

  it("leaves non-Pyodide errors intact", () => {
    expect(formatPythonError("RuntimeError: unavailable")).toBe("RuntimeError: unavailable");
  });
});

describe("PYTHON_RUNNER_SOURCE", () => {
  let runtime: Awaited<ReturnType<typeof loadPyodide>>;

  beforeAll(async () => {
    runtime = await loadPyodide();
  }, 20_000);

  async function runUserCode(source: string): Promise<unknown> {
    const globals = runtime.toPy({ __name__: "__main__", __col_user_code__: source });
    try {
      return await runtime.runPythonAsync(PYTHON_RUNNER_SOURCE, {
        globals,
        filename: "<col-runner>",
      });
    } finally {
      globals.destroy();
    }
  }

  it("catches exit() and direct SystemExit without stopping later runs", async () => {
    const exitError = await runUserCode("exit()");
    expect(formatPythonError(String(exitError))).toBe(`Your code, line 1:
    exit()
SystemExit: None`);

    const directError = await runUserCode("raise SystemExit(3)");
    expect(formatPythonError(String(directError))).toBe(`Your code, line 1:
    raise SystemExit(3)
SystemExit: 3`);

    const shadowedBaseException = await runUserCode(`BaseException = Exception
exit()`);
    expect(formatPythonError(String(shadowedBaseException))).toContain("SystemExit: None");

    await expect(runUserCode("assert 6 * 7 == 42")).resolves.toBeUndefined();
  });

  it("preserves top-level await while catching user exceptions", async () => {
    const error = await runUserCode(`import asyncio
await asyncio.sleep(0)
raise RuntimeError("after await")`);

    expect(formatPythonError(String(error))).toBe(`Your code, line 3:
    raise RuntimeError("after await")
RuntimeError: after await`);
  });

  it("translates every student frame in an actual chained Pyodide exception", async () => {
    const error = await runUserCode(`try:
    1 / 0
except Exception:
    prin`);

    expect(formatPythonError(String(error))).toBe(`Your code, line 2:
    1 / 0
    ~~^~~
ZeroDivisionError: division by zero

During handling of the above exception, another exception occurred:

Your code, line 4:
    prin
NameError: name 'prin' is not defined`);

    // A chained error must not poison the shared runtime for the next cell.
    await expect(runUserCode("assert sum([1, 2, 3]) == 6")).resolves.toBeUndefined();
  });
});
