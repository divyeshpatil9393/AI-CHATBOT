import { FileText, MessageSquare, PanelLeftClose, Plus, Settings, Sparkles, Trash2 } from "lucide-react";
import DocumentPanel from "./DocumentPanel";
import { cx } from "../utils/helpers";

export default function Sidebar({
  open,
  onClose,
  chats,
  activeId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onOpenSettings,
  documentProps,
}) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 animate-fade md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        aria-label="Sidebar"
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-line bg-panel transition-transform duration-200 md:static md:z-auto",
          open ? "translate-x-0" : "-translate-x-full md:hidden"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-3">
          <div className="flex items-center gap-2 px-1">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-fg">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Lumina</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"
          >
            <PanelLeftClose className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={onNewChat}
            className="flex w-full items-center gap-2 rounded-lg border border-line bg-elevated px-3 py-2 text-sm font-medium hover:bg-hover"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>
        </div>

        <nav aria-label="Chat history" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <h3 className="mb-1 mt-2 px-1 text-xs font-medium text-muted">Recent chats</h3>
          {chats.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted">Your conversations will appear here.</p>
          ) : (
            <ul className="space-y-0.5">
              {chats.map((chat) => (
                <li key={chat.id} className="group relative">
                  <button
                    onClick={() => onSelectChat(chat.id)}
                    aria-current={chat.id === activeId ? "true" : undefined}
                    className={cx(
                      "flex w-full items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-9 text-left text-sm",
                      chat.id === activeId ? "bg-hover font-medium" : "hover:bg-hover/70"
                    )}
                  >
                    {chat.documentIds.length > 0 ? (
                      <FileText className="h-4 w-4 shrink-0 text-muted" />
                    ) : (
                      <MessageSquare className="h-4 w-4 shrink-0 text-muted" />
                    )}
                    <span className="truncate">{chat.title}</span>
                  </button>
                  <button
                    onClick={() => onDeleteChat(chat.id)}
                    aria-label={`Delete chat: ${chat.title}`}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:bg-bg hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="max-h-[48%] shrink-0 flex flex-col">
          <DocumentPanel {...documentProps} />
        </div>

        <div className="shrink-0 border-t border-line p-2">
          <button
            onClick={onOpenSettings}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-hover hover:text-fg"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </aside>
    </>
  );
}
