import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cx, uid } from "../utils/helpers";

const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircle2 className="h-4 w-4 text-success" />,
  error: <AlertCircle className="h-4 w-4 text-danger" />,
  info: <Info className="h-4 w-4 text-accent-text" />,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (type, message) => {
      if (!message) return;
      const id = uid();
      setToasts((list) => [...list.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), type === "error" ? 7000 : 3500);
    },
    [dismiss]
  );

  // Stable object so hooks can list `notify` as a dependency without re-running.
  const notify = useMemo(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className={cx(
              "pointer-events-auto flex animate-toast items-start gap-2.5 rounded-lg border bg-elevated px-3 py-2.5 text-sm shadow-lg",
              toast.type === "error" ? "border-danger/40" : "border-line"
            )}
          >
            <span className="mt-0.5 shrink-0">{ICONS[toast.type]}</span>
            <p className="min-w-0 flex-1 break-words leading-snug">{toast.message}</p>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded p-0.5 text-muted hover:bg-hover hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
