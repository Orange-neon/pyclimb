import { useCallback, useEffect, useRef, useState } from "react";

export type PyodideStatus = "loading" | "ready" | "error";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  error?: string;
}

interface PendingRequest {
  resolve: (result: ExecutionResult) => void;
  timeoutId: number;
}

const EXECUTION_TIMEOUT_MS = 5_000;

export function usePyodide() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, PendingRequest>());
  const sequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<PyodideStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const settlePending = useCallback((message: string) => {
    for (const pending of pendingRef.current.values()) {
      window.clearTimeout(pending.timeoutId);
      pending.resolve({
        stdout: "",
        stderr: message,
        durationMs: 0,
        timedOut: false,
        error: message,
      });
    }
    pendingRef.current.clear();
  }, []);

  const startWorker = useCallback(() => {
    workerRef.current?.terminate();
    settlePending("Python restarted before the run completed.");

    if (!mountedRef.current) return;
    setStatus("loading");
    setError(null);

    const worker = new Worker(new URL("../workers/pyodide.worker.ts", import.meta.url), {
      type: "module",
      name: "col-python",
    });
    workerRef.current = worker;

    worker.addEventListener("message", (event) => {
      const message = event.data as {
        type: string;
        requestId?: string;
        stdout?: string;
        stderr?: string;
        durationMs?: number;
        error?: string;
      };

      if (message.type === "ready") {
        setStatus("ready");
        return;
      }

      if (message.type === "init-error") {
        setStatus("error");
        setError(message.error ?? "Python could not be loaded.");
        return;
      }

      if (message.type === "result" && message.requestId) {
        const pending = pendingRef.current.get(message.requestId);
        if (!pending) return;
        window.clearTimeout(pending.timeoutId);
        pendingRef.current.delete(message.requestId);
        pending.resolve({
          stdout: message.stdout ?? "",
          stderr: message.stderr ?? "",
          durationMs: message.durationMs ?? 0,
          timedOut: false,
          error: message.error,
        });
      }
    });

    worker.addEventListener("error", () => {
      setStatus("error");
      setError("The Python worker stopped unexpectedly.");
      settlePending("The Python worker stopped unexpectedly.");
    });

    worker.postMessage({ type: "init" });
  }, [settlePending]);

  useEffect(() => {
    mountedRef.current = true;
    startWorker();
    return () => {
      mountedRef.current = false;
      workerRef.current?.terminate();
      settlePending("Python was stopped.");
    };
  }, [settlePending, startWorker]);

  const execute = useCallback(
    (code: string, input: string): Promise<ExecutionResult> => {
      if (status !== "ready" || !workerRef.current) {
        return Promise.resolve({
          stdout: "",
          stderr: "Python is still warming up.",
          durationMs: 0,
          timedOut: false,
          error: "Python is not ready.",
        });
      }

      const requestId = `run-${Date.now()}-${sequenceRef.current++}`;
      return new Promise((resolve) => {
        const startedAt = performance.now();
        const timeoutId = window.setTimeout(() => {
          pendingRef.current.delete(requestId);
          resolve({
            stdout: "",
            stderr: "Time limit exceeded (5 seconds). Python is restarting.",
            durationMs: performance.now() - startedAt,
            timedOut: true,
            error: "Time limit exceeded.",
          });
          startWorker();
        }, EXECUTION_TIMEOUT_MS);

        pendingRef.current.set(requestId, { resolve, timeoutId });
        workerRef.current?.postMessage({ type: "run", requestId, code, input });
      });
    },
    [startWorker, status],
  );

  const cancel = useCallback(() => startWorker(), [startWorker]);

  return { status, error, execute, cancel, retry: startWorker };
}
