const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        panel: token("panel"),
        elevated: token("elevated"),
        hover: token("hover"),
        line: token("line"),
        fg: token("fg"),
        muted: token("muted"),
        accent: token("accent"),
        "accent-fg": token("accent-fg"),
        "accent-soft": token("accent-soft"),
        "accent-text": token("accent-text"),
        danger: token("danger"),
        "danger-soft": token("danger-soft"),
        success: token("success"),
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      keyframes: {
        dot: { "0%, 80%, 100%": { opacity: "0.25", transform: "translateY(0)" }, "40%": { opacity: "1", transform: "translateY(-3px)" } },
        toast: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        fade: { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        dot: "dot 1.2s ease-in-out infinite",
        toast: "toast 0.2s ease-out",
        fade: "fade 0.15s ease-out",
      },
    },
  },
  plugins: [],
};
