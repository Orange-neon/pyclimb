import { useCallback, useEffect, useState } from "react";
import {
  OpaquePythonSandbox,
  type CollaborationPythonResult,
} from "../lib/collaborationPythonSandbox";

export function useCollaborationPython() {
  const [sandbox, setSandbox] = useState<OpaquePythonSandbox | null>(null);
  const [snapshot, setSnapshot] = useState<PythonStoreSnapshot>({
    status: "loading",
    error: null,
  });

  useEffect(() => {
    const next = new OpaquePythonSandbox();
    const update = () => setSnapshot({ status: next.status, error: next.error });
    const unsubscribe = next.subscribe(update);
    update();
    setSandbox(next);
    return () => {
      unsubscribe();
      next.destroy();
    };
  }, []);

  const execute = useCallback(
    (code: string, stdin = "", timeoutMs?: number): Promise<CollaborationPythonResult> =>
      sandbox
        ? sandbox.execute(code, stdin, timeoutMs)
        : Promise.resolve({
            stdout: "",
            stderr: "Python is still warming up.",
            error: "Python is not ready.",
            durationMs: 0,
            timedOut: false,
          }),
    [sandbox],
  );

  return {
    status: snapshot.status,
    error: snapshot.error,
    execute,
    retry: () => sandbox?.restart(),
  };
}

interface PythonStoreSnapshot {
  status: "loading" | "ready" | "error";
  error: string | null;
}
