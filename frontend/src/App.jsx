import { useEffect, useRef, useState } from "react";
import ChatHeader from "./components/ChatHeader";
import ChatWindow from "./components/ChatWindow";
import Composer from "./components/Composer";
import EmptyState from "./components/EmptyState";
import SettingsModal from "./components/SettingsModal";
import Sidebar from "./components/Sidebar";
import { useToast } from "./components/Toasts";
import { useChat } from "./hooks/useChat";
import { useConversations } from "./hooks/useConversations";
import { useDocuments } from "./hooks/useDocuments";
import { useSettings } from "./hooks/useSettings";
import { useTheme } from "./hooks/useTheme";
import { ACCEPTED_EXTENSIONS } from "./utils/helpers";

export default function App() {
  const notify = useToast();
  const { theme, setTheme, isDark, toggle } = useTheme();
  const { settings, updateSettings } = useSettings();
  const conversations = useConversations();
  const docs = useDocuments(notify);
  const chat = useChat({
    active: conversations.active,
    updateConversation: conversations.update,
    topK: settings.topK,
    notify,
  });

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileInputRef = useRef(null);

  const { active } = conversations;
  const attachedDocuments = docs.documents.filter((d) => active.documentIds.includes(d.document_id));

  // Remove references to documents deleted on the server (only once the list has really loaded).
  const { ready, documents } = docs;
  const { pruneDocuments } = conversations;
  useEffect(() => {
    if (ready) pruneDocuments(documents.map((d) => d.document_id));
  }, [ready, documents, pruneDocuments]);

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleNewChat = () => {
    chat.stop();
    conversations.newChat();
    closeSidebarOnMobile();
  };

  const handleSelectChat = (id) => {
    if (id !== conversations.activeId) {
      chat.stop();
      conversations.selectChat(id);
    }
    closeSidebarOnMobile();
  };

  const handleDeleteChat = (id) => {
    if (id === conversations.activeId) chat.stop();
    conversations.deleteChat(id);
  };

  // Files are processed one at a time (embedding is CPU-bound) and attached to the current chat.
  const handleFiles = async (fileList) => {
    const targetChat = conversations.activeId;
    for (const file of Array.from(fileList)) {
      const doc = await docs.upload(file);
      if (doc) conversations.attachDocument(targetChat, doc.document_id);
    }
  };

  const onFileInputChange = (event) => {
    if (event.target.files?.length) handleFiles(event.target.files);
    event.target.value = ""; // allow picking the same file again
  };

  const pickFiles = () => fileInputRef.current?.click();

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg text-fg">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(",")}
        onChange={onFileInputChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={conversations.history}
        activeId={conversations.activeId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onOpenSettings={() => setSettingsOpen(true)}
        documentProps={{
          documents: docs.documents,
          uploads: docs.uploads,
          selectedIds: active.documentIds,
          onToggle: (id) => conversations.toggleDocument(active.id, id),
          onDelete: docs.remove,
          onDismissUpload: docs.dismissUpload,
          onFiles: handleFiles,
          onPickFiles: pickFiles,
        }}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          title={active.messages.length ? active.title : "New chat"}
          documentCount={attachedDocuments.length}
          sidebarOpen={sidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
          isDark={isDark}
          onToggleTheme={toggle}
        />

        {active.messages.length === 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <EmptyState
              hasDocuments={attachedDocuments.length > 0}
              onPrompt={chat.sendMessage}
              onPickFiles={pickFiles}
            />
          </div>
        ) : (
          <ChatWindow
            key={active.id}
            messages={active.messages}
            isStreaming={chat.isStreaming}
            onRegenerate={chat.regenerate}
            onFeedback={chat.setFeedback}
          />
        )}

        <Composer
          isStreaming={chat.isStreaming}
          isBusy={chat.isBusy}
          attachedDocuments={attachedDocuments}
          uploads={docs.uploads}
          onSend={chat.sendMessage}
          onStop={chat.stop}
          onDetach={(id) => conversations.toggleDocument(active.id, id)}
          onFiles={handleFiles}
          onPickFiles={pickFiles}
        />
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        topK={settings.topK}
        onTopKChange={(topK) => updateSettings({ topK })}
        onClearChats={() => {
          chat.stop();
          conversations.clearAll();
        }}
      />
    </div>
  );
}
