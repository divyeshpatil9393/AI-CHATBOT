import { useCallback, useState } from "react";

const KEY = "lumina.settings.v1";
const DEFAULTS = { topK: 5 };

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    } catch {
      return DEFAULTS;
    }
  });

  const updateSettings = useCallback((patch) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage full or blocked */
      }
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
