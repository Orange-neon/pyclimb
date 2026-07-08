import { describe, expect, it } from "vitest";
import { formatPythonError } from "./pythonError";

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

  it("leaves non-Pyodide errors intact", () => {
    expect(formatPythonError("RuntimeError: unavailable")).toBe("RuntimeError: unavailable");
  });
});
