import { FileText, Menu, Moon, Sun } from "lucide-react";

export default function ChatHeader({ title, documentCount, sidebarOpen, onOpenSidebar, isDark, onToggleTheme }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3">
      {!sidebarOpen && (
        <button
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      <h2 className="min-w-0 flex-1 truncate px-1 text-sm font-medium">{title}</h2>
      {documentCount > 0 && (
        <span className="flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-xs text-accent-text">
          <FileText className="h-3.5 w-3.5" />
          {documentCount} {documentCount === 1 ? "document" : "documents"}
        </span>
      )}
      <button
        onClick={onToggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"
      >
        {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </button>
    </header>
  );
}
