import { formatPythonError } from "../lib/pythonError";

const PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/";
const PYODIDE_MODULE = `${PYODIDE_BASE}pyodide.mjs`;

interface PyodideRuntime {
  setStdin(options: { stdin: () => string | undefined; isatty: boolean }): void;
  setStdout(options: { raw: (value: number) => void }): void;
  setStderr(options: { raw: (value: number) => void }): void;
  runPythonAsync(code: string, options?: { globals?: unknown }): Promise<unknown>;
  toPy(value: unknown): { destroy?: () => void };
}

type WorkerRequest =
  | { type: "init" }
  | { type: "run"; requestId: string; code: string; input: string };

let runtimePromise: Promise<PyodideRuntime> | null = null;

async function getRuntime(): Promise<PyodideRuntime> {
  if (!runtimePromise) {
    runtimePromise = import(/* @vite-ignore */ PYODIDE_MODULE).then(
      async (module: { loadPyodide: (options: { indexURL: string }) => Promise<PyodideRuntime> }) =>
        module.loadPyodide({ indexURL: PYODIDE_BASE }),
    );
  }
  return runtimePromise;
}

function createInputReader(input: string): () => string | undefined {
  const normalized = input.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) lines.pop();
  let index = 0;
  return () => (index < lines.length ? lines[index++] : undefined);
}

async function runCode(code: string, input: string) {
  const runtime = await getRuntime();
  let stdout = "";
  let stderr = "";

  runtime.setStdin({ stdin: createInputReader(input), isatty: false });
  runtime.setStdout({ raw: (value) => (stdout += String.fromCharCode(value)) });
  runtime.setStderr({ raw: (value) => (stderr += String.fromCharCode(value)) });

  const globals = runtime.toPy({ __name__: "__main__" });
  try {
    await runtime.runPythonAsync(code, { globals });
    return { stdout, stderr };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const formattedError = formatPythonError(message);
    return {
      stdout,
      stderr: [stderr.trimEnd(), formattedError].filter(Boolean).join("\n"),
      error: formattedError,
    };
  } finally {
    globals.destroy?.();
  }
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === "init") {
    try {
      await getRuntime();
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({
        type: "init-error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  const startedAt = performance.now();
  const result = await runCode(message.code, message.input);
  self.postMessage({
    type: "result",
    requestId: message.requestId,
    durationMs: performance.now() - startedAt,
    ...result,
  });
});

export {};
