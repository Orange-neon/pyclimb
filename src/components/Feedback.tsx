import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CircleCheck, CircleX, Info, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ToastTone = "success" | "error" | "warning" | "info";

interface ToastOptions {
  title: string;
  message?: string;
  tone?: ToastTone;
  duration?: number;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
}

interface Toast extends Required<Pick<ToastOptions, "title" | "tone" | "duration">> {
  id: number;
  message?: string;
}

interface Confirmation extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

interface FeedbackContextValue {
  notify: (options: ToastOptions) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const toneStyles = {
  success: {
    icon: CircleCheck,
    accent: "text-emerald-300",
    border: "border-emerald-400/30",
    glow: "shadow-emerald-950/40",
    progress: "bg-emerald-400",
  },
  error: {
    icon: CircleX,
    accent: "text-rose-300",
    border: "border-rose-400/30",
    glow: "shadow-rose-950/40",
    progress: "bg-rose-400",
  },
  warning: {
    icon: AlertTriangle,
    accent: "text-amber-300",
    border: "border-amber-400/30",
    glow: "shadow-amber-950/40",
    progress: "bg-amber-400",
  },
  info: {
    icon: Info,
    accent: "text-sky-300",
    border: "border-sky-400/30",
    glow: "shadow-sky-950/40",
    progress: "bg-sky-400",
  },
} as const;

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const styles = toneStyles[toast.tone];
  const Icon = styles.icon;

  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, toast.duration);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 36, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 28, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 440, damping: 34 }}
      className={`relative overflow-hidden rounded-2xl border bg-slate-950/95 shadow-2xl backdrop-blur-xl ${styles.border} ${styles.glow}`}
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <div className="flex gap-3 p-4 pr-11">
        <Icon className={`mt-0.5 shrink-0 ${styles.accent}`} size={20} strokeWidth={2.4} />
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{toast.title}</p>
          {toast.message && <p className="mt-1 text-xs leading-5 text-slate-300">{toast.message}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-white"
      >
        <X size={15} />
      </button>
      <motion.div
        className={`h-0.5 origin-left ${styles.progress}`}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: toast.duration / 1000, ease: "linear" }}
      />
    </motion.div>
  );
}

function ConfirmDialog({
  confirmation,
  onSettle,
}: {
  confirmation: Confirmation;
  onSettle: (confirmed: boolean) => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = "feedback-confirm-title";
  const descriptionId = "feedback-confirm-description";

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSettle(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onSettle]);

  const danger = confirmation.tone !== "primary";

  return (
    <motion.div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onSettle(false);
      }}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="panel w-full max-w-md overflow-hidden border-slate-600/80 bg-slate-950/95 shadow-2xl"
      >
        <div className="p-6">
          <div className={`mb-4 grid size-11 place-items-center rounded-xl ${danger ? "bg-rose-400/10 text-rose-300" : "bg-sky-400/10 text-sky-300"}`}>
            <AlertTriangle size={22} />
          </div>
          <h2 id={titleId} className="text-lg font-black text-white">
            {confirmation.title}
          </h2>
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-400">
            {confirmation.message}
          </p>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-800 bg-slate-900/50 px-6 py-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onSettle(false)}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
          >
            {confirmation.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => onSettle(true)}
            className={`rounded-xl px-4 py-2 text-sm font-black transition ${danger ? "bg-rose-400 text-rose-950 hover:bg-rose-300" : "bg-sky-400 text-slate-950 hover:bg-sky-300"}`}
          >
            {confirmation.confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationRef = useRef<Confirmation | null>(null);
  const nextToastId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((options: ToastOptions) => {
    const toast: Toast = {
      id: nextToastId.current++,
      title: options.title,
      message: options.message,
      tone: options.tone ?? "info",
      duration: options.duration ?? 4_500,
    };
    setToasts((current) => [...current.slice(-3), toast]);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    confirmationRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { ...options, resolve };
      confirmationRef.current = next;
      setConfirmation(next);
    });
  }, []);

  const settleConfirmation = useCallback((confirmed: boolean) => {
    const current = confirmationRef.current;
    if (!current) return;
    confirmationRef.current = null;
    setConfirmation(null);
    current.resolve(confirmed);
  }, []);

  useEffect(
    () => () => {
      confirmationRef.current?.resolve(false);
    },
    [],
  );

  return (
    <FeedbackContext.Provider value={{ notify, confirm }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 top-4 z-[100] grid w-[min(92vw,24rem)] gap-3 sm:right-6 sm:top-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastCard toast={toast} onDismiss={() => dismiss(toast.id)} />
            </div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {confirmation && (
          <ConfirmDialog confirmation={confirmation} onSettle={settleConfirmation} />
        )}
      </AnimatePresence>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const feedback = useContext(FeedbackContext);
  if (!feedback) throw new Error("useFeedback must be used inside FeedbackProvider.");
  return feedback;
}
