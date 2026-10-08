import { useCallback, useEffect, useState } from "react";

const KEY = "lumina.theme";

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(KEY) || "system");
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      setIsDark(dark);
    };
    apply();
    localStorage.setItem(KEY, theme);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const toggle = useCallback(() => setTheme(isDark ? "light" : "dark"), [isDark]);
  return { theme, setTheme, isDark, toggle };
}
