const USER_FRAME = /^\s*File ["']<exec>["'], line (\d+)(?:, in (.+))?\s*$/;
const PYTHON_FRAME = /^\s*File ["'][^"']+["'], line \d+(?:, in .+)?\s*$/;
const TRACEBACK_HEADER = /^Traceback \(most recent call last\):\s*$/;

/**
 * Runs student code behind a Python-side BaseException boundary.
 *
 * Catching here is important for SystemExit: Pyodide's async event loop can
 * report it as an uncaught worker error even though runPythonAsync eventually
 * rejects. The runner also preserves top-level await and returns a regular
 * traceback string for the UI to format.
 */
export const PYTHON_RUNNER_SOURCE = `
async def __col_run_user_code(__col_source, __col_namespace):
    import ast as __col_ast
    import inspect as __col_inspect
    import linecache as __col_linecache
    import traceback as __col_traceback

    __col_base_exception = BaseException
    __col_exception_type = type
    __col_format_exception = __col_traceback.format_exception
    __col_filename = "<exec>"
    __col_linecache.cache[__col_filename] = (
        len(__col_source),
        None,
        __col_source.splitlines(keepends=True),
        __col_filename,
    )
    try:
        __col_compiled = compile(
            __col_source,
            __col_filename,
            "exec",
            flags=__col_ast.PyCF_ALLOW_TOP_LEVEL_AWAIT,
        )
        __col_result = eval(__col_compiled, __col_namespace)
        if __col_inspect.isawaitable(__col_result):
            await __col_result
    except __col_base_exception as __col_reason:
        __col_trace = __col_reason.__traceback__
        while (
            __col_trace is not None
            and __col_trace.tb_frame.f_code.co_filename == "<col-runner>"
        ):
            __col_trace = __col_trace.tb_next
        return "".join(
            __col_format_exception(
                __col_exception_type(__col_reason),
                __col_reason,
                __col_trace,
            )
        )
    finally:
        __col_linecache.cache.pop(__col_filename, None)
    return None

await __col_run_user_code(__col_user_code__, globals())
`.trim();

/** Removes Pyodide's implementation frames while preserving frames from student code. */
export function formatPythonError(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "Python stopped without an error message.";

  const lines = normalized.split("\n");
  if (!lines.some((line) => USER_FRAME.test(line))) return normalized;

  const output: string[] = [];
  let index = lines.findIndex((line) => TRACEBACK_HEADER.test(line));
  if (index === -1) {
    return lines
      .map((line) => {
        const match = line.match(USER_FRAME);
        if (!match) return line;
        const [, lineNumber, context] = match;
        const location = context && context !== "<module>" ? ` in ${context}` : "";
        return `Your code, line ${lineNumber}${location}:`;
      })
      .join("\n")
      .trim();
  }

  while (index < lines.length) {
    const line = lines[index];
    if (!TRACEBACK_HEADER.test(line)) {
      output.push(line);
      index += 1;
      continue;
    }

    // Each chained exception has its own traceback header. Remove every
    // non-student frame from that block, rather than only trimming the first
    // block in the message.
    index += 1;
    while (index < lines.length && !TRACEBACK_HEADER.test(lines[index])) {
      const frame = lines[index];
      const userMatch = frame.match(USER_FRAME);
      if (!PYTHON_FRAME.test(frame)) {
        output.push(frame);
        index += 1;
        continue;
      }

      if (userMatch) {
        const [, lineNumber, context] = userMatch;
        const location = context && context !== "<module>" ? ` in ${context}` : "";
        output.push(`Your code, line ${lineNumber}${location}:`);
      }

      // Source excerpts and caret indicators belong to the preceding frame.
      // Keep them only when that frame came from the student's code.
      index += 1;
      while (
        index < lines.length &&
        !PYTHON_FRAME.test(lines[index]) &&
        /^\s+/.test(lines[index])
      ) {
        if (userMatch) output.push(lines[index]);
        index += 1;
      }
    }
  }

  return output.join("\n").trim();
}
