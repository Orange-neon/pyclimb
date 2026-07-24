import { truncateExecutionOutput } from "./collaborationNotebook";
import { formatPythonError, PYTHON_RUNNER_SOURCE } from "./pythonError";

export const COLLABORATION_EXECUTION_TIMEOUT_MS = 5_000;
export const COLLABORATION_IFRAME_SANDBOX = "allow-scripts";

export type CollaborationPythonStatus = "loading" | "ready" | "error";

export interface CollaborationPythonResult {
  stdout: string;
  stderr: string;
  error?: string;
  durationMs: number;
  timedOut: boolean;
}

interface PendingExecution {
  resolve: (result: CollaborationPythonResult) => void;
  timeoutId: number;
  startedAt: number;
}

export function formatCollaborationExecutionError(
  capturedStderr: string,
  rawError: string,
): Pick<CollaborationPythonResult, "stderr" | "error"> {
  const error = formatPythonError(rawError);
  return {
    stderr: [capturedStderr.trimEnd(), error].filter(Boolean).join("\n"),
    error,
  };
}

const PYODIDE_WORKER_SOURCE = String.raw`
const PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/";
const MAX_OUTPUT = 20 * 1024;
const PYTHON_RUNNER_SOURCE = ${JSON.stringify(PYTHON_RUNNER_SOURCE)};
let runtimePromise = null;

importScripts(PYODIDE_BASE + "pyodide.js");

function getRuntime() {
  if (!runtimePromise) {
    runtimePromise = loadPyodide({ indexURL: PYODIDE_BASE });
  }
  return runtimePromise;
}

function safeText(value) {
  try { return typeof value === "string" ? value : String(value ?? ""); }
  catch { return "Unknown Python error"; }
}

function createInputReader(input) {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) lines.pop();
  let index = 0;
  return () => (index < lines.length ? lines[index++] : undefined);
}

async function execute(message) {
  const runtime = await getRuntime();
  const stdoutChunks = [];
  const stderrChunks = [];
  let outputBytes = 0;
  const append = (target, buffer) => {
    const available = Math.max(0, MAX_OUTPUT - outputBytes);
    const accepted = Math.min(available, buffer.byteLength);
    if (accepted > 0) {
      target.push(buffer.slice(0, accepted));
      outputBytes += accepted;
    }
    // Report the complete input as consumed even after the capture limit; the
    // remainder is intentionally discarded instead of blocking Python writes.
    return buffer.byteLength;
  };
  const decode = (chunks) => {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let value = "";
    for (const chunk of chunks) value += decoder.decode(chunk, { stream: true });
    return value + decoder.decode();
  };

  runtime.setStdin({ stdin: createInputReader(message.stdin), isatty: false });
  runtime.setStdout({ write: (buffer) => append(stdoutChunks, buffer), isatty: false });
  runtime.setStderr({ write: (buffer) => append(stderrChunks, buffer), isatty: false });

  const globals = runtime.toPy({
    __name__: "__main__",
    __col_user_code__: message.code,
  });
  const startedAt = performance.now();
  let error;
  try {
    const pythonError = await runtime.runPythonAsync(PYTHON_RUNNER_SOURCE, {
      globals,
      filename: "<col-runner>",
    });
    if (typeof pythonError === "string" && pythonError) error = pythonError;
  } catch (reason) {
    error = safeText(reason && reason.message ? reason.message : reason);
  } finally {
    if (globals && typeof globals.destroy === "function") globals.destroy();
  }

  const stdout = decode(stdoutChunks);
  const capturedStderr = decode(stderrChunks);
  return { stdout, stderr: capturedStderr, error, durationMs: performance.now() - startedAt };
}

self.addEventListener("message", async (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;
  if (message.type === "init") {
    try {
      await getRuntime();
      self.postMessage({ type: "ready" });
    } catch (reason) {
      self.postMessage({
        type: "init-error",
        error: safeText(reason && reason.message ? reason.message : reason),
      });
    }
    return;
  }
  if (
    message.type !== "run" ||
    typeof message.requestId !== "string" ||
    typeof message.code !== "string" ||
    typeof message.stdin !== "string"
  ) return;
  const result = await execute(message);
  self.postMessage({ type: "result", requestId: message.requestId, ...result });
});
`;

export const COLLABORATION_SANDBOX_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
  "worker-src blob:",
  "connect-src https://cdn.jsdelivr.net",
  "img-src 'none'",
  "style-src 'none'",
].join("; ");

export function createCollaborationSandboxSrcdoc(channel: string): string {
  const encodedChannel = JSON.stringify(channel);
  const encodedWorker = JSON.stringify(PYODIDE_WORKER_SOURCE);
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${COLLABORATION_SANDBOX_CSP}"></head>
<body><script>
(() => {
  "use strict";
  const channel = ${encodedChannel};
  const workerSource = ${encodedWorker};
  let worker = null;
  let workerBlobUrl = null;

  const revokeWorkerBlobUrl = () => {
    if (!workerBlobUrl) return;
    URL.revokeObjectURL(workerBlobUrl);
    workerBlobUrl = null;
  };

  const startWorker = () => {
    if (worker) worker.terminate();
    revokeWorkerBlobUrl();
    workerBlobUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    worker = new Worker(workerBlobUrl, { name: "col-collaboration-python" });
    worker.addEventListener("message", (event) => {
      const message = event.data;
      if (!message || typeof message !== "object") return;
      if (!["ready", "init-error", "result"].includes(message.type)) return;
      if (message.type === "ready" || message.type === "init-error") revokeWorkerBlobUrl();
      parent.postMessage({ ...message, channel }, "*");
    });
    worker.addEventListener("error", (event) => {
      revokeWorkerBlobUrl();
      const detail = typeof event.message === "string" && event.message && event.message !== "Script error."
        ? " " + event.message
        : "";
      parent.postMessage({ type: "init-error", error: "The isolated Python worker stopped unexpectedly." + detail, channel }, "*");
    });
    worker.postMessage({ type: "init" });
  };

  window.addEventListener("message", (event) => {
    if (event.source !== parent) return;
    const message = event.data;
    if (!message || message.channel !== channel || message.type !== "run") return;
    if (
      typeof message.requestId !== "string" ||
      typeof message.code !== "string" ||
      typeof message.stdin !== "string"
    ) return;
    worker?.postMessage({
      type: "run",
      requestId: message.requestId,
      code: message.code,
      stdin: message.stdin,
    });
  });

  startWorker();
})();
</script></body></html>`;
}

export class OpaquePythonSandbox {
  private iframe: HTMLIFrameElement | null = null;
  private channel = "";
  private statusValue: CollaborationPythonStatus = "loading";
  private errorValue: string | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly pending = new Map<string, PendingExecution>();
  private sequence = 0;
  private destroyed = false;

  constructor() {
    window.addEventListener("message", this.handleMessage);
    this.replaceFrame();
  }

  get status(): CollaborationPythonStatus {
    return this.statusValue;
  }

  get error(): string | null {
    return this.errorValue;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  execute = (
    code: string,
    stdin = "",
    timeoutMs = COLLABORATION_EXECUTION_TIMEOUT_MS,
  ): Promise<CollaborationPythonResult> => {
    if (this.statusValue !== "ready" || !this.iframe?.contentWindow) {
      return Promise.resolve({
        stdout: "",
        stderr: "Python is still warming up.",
        error: "Python is not ready.",
        durationMs: 0,
        timedOut: false,
      });
    }
    if (this.pending.size > 0) {
      return Promise.resolve({
        stdout: "",
        stderr: "Another cell is already running in this browser.",
        error: "Python is busy.",
        durationMs: 0,
        timedOut: false,
      });
    }

    const requestId = `python-${Date.now()}-${this.sequence++}`;
    return new Promise((resolve) => {
      const startedAt = performance.now();
      const timeoutId = window.setTimeout(() => {
        this.pending.delete(requestId);
        resolve({
          stdout: "",
          stderr: "Time limit exceeded (5 seconds). Python is restarting.",
          error: "Time limit exceeded.",
          durationMs: performance.now() - startedAt,
          timedOut: true,
        });
        this.replaceFrame();
      }, Math.max(100, Math.min(COLLABORATION_EXECUTION_TIMEOUT_MS, timeoutMs)));

      this.pending.set(requestId, { resolve, timeoutId, startedAt });
      this.iframe?.contentWindow?.postMessage(
        { type: "run", requestId, code, stdin, channel: this.channel },
        "*",
      );
    });
  };

  restart = (): void => {
    this.settlePending("Python was restarted before the run completed.");
    this.replaceFrame();
  };

  destroy = (): void => {
    if (this.destroyed) return;
    this.destroyed = true;
    this.settlePending("Python was stopped.");
    window.removeEventListener("message", this.handleMessage);
    this.iframe?.remove();
    this.iframe = null;
    this.listeners.clear();
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private setStatus(status: CollaborationPythonStatus, error: string | null = null): void {
    this.statusValue = status;
    this.errorValue = error;
    this.emit();
  }

  private settlePending(message: string): void {
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timeoutId);
      pending.resolve({
        stdout: "",
        stderr: message,
        error: message,
        durationMs: performance.now() - pending.startedAt,
        timedOut: false,
      });
    }
    this.pending.clear();
  }

  private replaceFrame(): void {
    if (this.destroyed) return;
    this.iframe?.remove();
    this.channel = crypto.randomUUID();
    this.setStatus("loading");

    const iframe = document.createElement("iframe");
    iframe.hidden = true;
    iframe.tabIndex = -1;
    iframe.title = "Isolated Python executor";
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("sandbox", COLLABORATION_IFRAME_SANDBOX);
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.srcdoc = createCollaborationSandboxSrcdoc(this.channel);
    document.body.append(iframe);
    this.iframe = iframe;
  }

  private handleMessage = (event: MessageEvent): void => {
    if (event.source !== this.iframe?.contentWindow || event.origin !== "null") return;
    const message = event.data as Record<string, unknown> | null;
    if (!message || message.channel !== this.channel || typeof message.type !== "string") return;

    if (message.type === "ready") {
      this.setStatus("ready");
      return;
    }
    if (message.type === "init-error") {
      const error = typeof message.error === "string" ? message.error : "Python could not be loaded.";
      this.setStatus("error", error);
      this.settlePending(error);
      return;
    }
    if (message.type !== "result" || typeof message.requestId !== "string") return;
    const pending = this.pending.get(message.requestId);
    if (!pending) return;

    this.pending.delete(message.requestId);
    window.clearTimeout(pending.timeoutId);
    const stderr = typeof message.stderr === "string" ? message.stderr : "";
    const formatted =
      typeof message.error === "string"
        ? formatCollaborationExecutionError(stderr, message.error)
        : { stderr, error: undefined };
    const bounded = truncateExecutionOutput({
      stdout: typeof message.stdout === "string" ? message.stdout : "",
      ...formatted,
    });
    pending.resolve({
      ...bounded,
      durationMs:
        typeof message.durationMs === "number" && Number.isFinite(message.durationMs)
          ? Math.max(0, message.durationMs)
          : performance.now() - pending.startedAt,
      timedOut: false,
    });
  };
}
