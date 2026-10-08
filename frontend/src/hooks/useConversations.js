import { useCallback, useEffect, useMemo, useState } from "react";
import { uid } from "../utils/helpers";

const STORAGE_KEY = "lumina.conversations.v1";

export function createConversation() {
  const now = Date.now();
  return { id: uid(), title: "New chat", createdAt: now, updatedAt: now, documentIds: [], messages: [] };
}

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return saved
      .filter((c) => Array.isArray(c.messages) && c.messages.length > 0)
      .map((c) => ({
        ...c,
        documentIds: c.documentIds || [],
        // A reload mid-stream leaves a half-written answer; keep what we have.
        messages: c.messages.map((m) => (m.status === "streaming" ? { ...m, status: "done", stopped: true } : m)),
      }));
  } catch {
    return [];
  }
}

export function useConversations() {
  const [state, setState] = useState(() => {
    const fresh = createConversation();
    return { conversations: [fresh, ...loadSaved()], activeId: fresh.id };
  });
  const { conversations, activeId } = state;

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? conversations[0],
    [conversations, activeId]
  );

  // Chats with messages, newest first. The empty "new chat" lives in the main view, not the list.
  const history = useMemo(
    () => conversations.filter((c) => c.messages.length > 0).sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations]
  );

  // Debounced so token streaming doesn't write to localStorage on every update.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.filter((c) => c.messages.length > 0)));
      } catch {
        /* storage full or blocked */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [conversations]);

  const update = useCallback((id, updater) => {
    setState((s) => ({ ...s, conversations: s.conversations.map((c) => (c.id === id ? updater(c) : c)) }));
  }, []);

  const newChat = useCallback(() => {
    setState((s) => {
      const current = s.conversations.find((c) => c.id === s.activeId);
      if (current && current.messages.length === 0) return s; // already on a blank chat
      const fresh = createConversation();
      return { conversations: [fresh, ...s.conversations], activeId: fresh.id };
    });
  }, []);

  const selectChat = useCallback((id) => {
    setState((s) => ({
      conversations: s.conversations.filter((c) => c.messages.length > 0 || c.id === id),
      activeId: id,
    }));
  }, []);

  const deleteChat = useCallback((id) => {
    setState((s) => {
      const rest = s.conversations.filter((c) => c.id !== id);
      if (s.activeId !== id) return { ...s, conversations: rest };
      const fresh = createConversation();
      return { conversations: [fresh, ...rest.filter((c) => c.messages.length > 0)], activeId: fresh.id };
    });
  }, []);

  const clearAll = useCallback(() => {
    const fresh = createConversation();
    setState({ conversations: [fresh], activeId: fresh.id });
  }, []);

  const attachDocument = useCallback(
    (id, documentId) =>
      update(id, (c) =>
        c.documentIds.includes(documentId) ? c : { ...c, documentIds: [...c.documentIds, documentId] }
      ),
    [update]
  );

  const toggleDocument = useCallback(
    (id, documentId) =>
      update(id, (c) => ({
        ...c,
        documentIds: c.documentIds.includes(documentId)
          ? c.documentIds.filter((d) => d !== documentId)
          : [...c.documentIds, documentId],
      })),
    [update]
  );

  // Drop references to documents that no longer exist on the server.
  const pruneDocuments = useCallback((validIds) => {
    const valid = new Set(validIds);
    setState((s) => {
      let changed = false;
      const conversations = s.conversations.map((c) => {
        const kept = c.documentIds.filter((d) => valid.has(d));
        if (kept.length === c.documentIds.length) return c;
        changed = true;
        return { ...c, documentIds: kept };
      });
      return changed ? { ...s, conversations } : s;
    });
  }, []);

  return {
    active,
    activeId: active.id,
    history,
    update,
    newChat,
    selectChat,
    deleteChat,
    clearAll,
    attachDocument,
    toggleDocument,
    pruneDocuments,
  };
}
