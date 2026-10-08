import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, X } from "lucide-react";
import { cx } from "../utils/helpers";

const THEMES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

export default function SettingsModal({ open, onClose, theme, onThemeChange, topK, onTopKChange, onClearChats }) {
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setConfirmClear(false);
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 animate-fade"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label="Settings" className="w-full max-w-md rounded-xl border border-line bg-bg shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold">Settings</h2>
          <button onClick={onClose} aria-label="Close settings" className="rounded-lg p-1.5 text-muted hover:bg-hover hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          <div>
            <p className="mb-2 text-sm font-medium">Appearance</p>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-hover p-1" role="radiogroup" aria-label="Theme">
              {THEMES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={theme === id}
                  onClick={() => onThemeChange(id)}
                  className={cx(
                    "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm",
                    theme === id ? "bg-elevated font-medium shadow-sm" : "text-muted hover:text-fg"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="topk" className="text-sm font-medium">
                Passages per answer
              </label>
              <span className="text-sm tabular-nums text-muted">{topK}</span>
            </div>
            <input
              id="topk"
              type="range"
              min="1"
              max="10"
              value={topK}
              onChange={(e) => onTopKChange(Number(e.target.value))}
              className="w-full accent-[rgb(var(--accent))]"
            />
            <p className="mt-1.5 text-xs text-muted">
              How many document passages are retrieved for each question. More passages give broader context but
              use more of the model's input.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Conversations</p>
            {confirmClear ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onClearChats();
                    onClose();
                  }}
                  className="rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Delete all chats
                </button>
                <button onClick={() => setConfirmClear(false)} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-hover">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-hover"
              >
                Clear chat history
              </button>
            )}
            <p className="mt-1.5 text-xs text-muted">Chats are stored in this browser only. Uploaded documents are kept.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
