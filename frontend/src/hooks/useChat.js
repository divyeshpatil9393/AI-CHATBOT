import { useCallback, useRef, useState } from "react";
import { getErrorMessage, streamChat } from "../api/client";
import { makeTitle, uid } from "../utils/helpers";

// Only finished, non-empty turns are sent back to the model as conversation context.
const toHistory = (messages) =>
  messages
    .filter((m) => m.status !== "error" && m.content?.trim())
    .map((m) => ({ role: m.role, content: m.content }))
    .slice(-30);

const newAssistantMessage = () => ({
  id: uid(),
  role: "assistant",
  content: "",
  sources: [],
  status: "streaming",
  feedback: null,
});

export function useChat({ active, updateConversation, topK, notify }) {
  const [streamingId, setStreamingId] = useState(null); // id of the conversation being answered
  const abortRef = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const stream = useCallback(
    async (conversationId, botId, question, history, documentIds) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStreamingId(conversationId);

      const patch = (fn) =>
        updateConversation(conversationId, (c) => ({
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.map((m) => (m.id === botId ? fn(m) : m)),
        }));

      // Batch tokens into one state update per animation frame.
      let buffer = "";
      let frame = null;
      const flush = () => {
        frame = null;
        if (!buffer) return;
        const text = buffer;
        buffer = "";
        patch((m) => ({ ...m, content: m.content + text }));
      };

      try {
        await streamChat(
          { message: question, history, documentIds, topK },
          {
            signal: controller.signal,
            onSources: (sources) => patch((m) => ({ ...m, sources })),
            onToken: (token) => {
              buffer += token;
              if (frame === null) frame = requestAnimationFrame(flush);
            },
          }
        );
        if (frame !== null) cancelAnimationFrame(frame);
        flush();
        patch((m) =>
          m.content
            ? { ...m, status: "done" }
            : { ...m, status: "error", error: "The model returned an empty response. Try again." }
        );
      } catch (error) {
        if (frame !== null) cancelAnimationFrame(frame);
        flush();
        if (error.name === "AbortError") {
          // Stopped by the user: keep the partial answer, or drop the bubble if nothing arrived.
          updateConversation(conversationId, (c) => ({
            ...c,
            messages: c.messages.filter((m) => !(m.id === botId && !m.content)),
          }));
          patch((m) => ({ ...m, status: "done", stopped: true }));
        } else {
          const message = getErrorMessage(error);
          patch((m) => ({ ...m, status: "error", error: message }));
          notify.error(message);
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setStreamingId(null);
        }
      }
    },
    [updateConversation, topK, notify]
  );

  const sendMessage = useCallback(
    async (text) => {
      const question = text.trim();
      const conversation = activeRef.current;
      if (!question || abortRef.current) return;

      const userMessage = { id: uid(), role: "user", content: question, createdAt: Date.now() };
      const botMessage = newAssistantMessage();
      const history = toHistory(conversation.messages);

      updateConversation(conversation.id, (c) => ({
        ...c,
        title: c.messages.length === 0 ? makeTitle(question) : c.title,
        updatedAt: Date.now(),
        messages: [...c.messages, userMessage, botMessage],
      }));
      await stream(conversation.id, botMessage.id, question, history, conversation.documentIds);
    },
    [updateConversation, stream]
  );

  const regenerate = useCallback(async () => {
    const conversation = activeRef.current;
    const messages = conversation.messages;
    const last = messages[messages.length - 1];
    const prompt = messages[messages.length - 2];
    if (abortRef.current || last?.role !== "assistant" || prompt?.role !== "user") return;

    const botMessage = newAssistantMessage();
    const history = toHistory(messages.slice(0, -2));
    updateConversation(conversation.id, (c) => ({ ...c, messages: [...c.messages.slice(0, -1), botMessage] }));
    await stream(conversation.id, botMessage.id, prompt.content, history, conversation.documentIds);
  }, [updateConversation, stream]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const setFeedback = useCallback(
    (messageId, value) =>
      updateConversation(activeRef.current.id, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === messageId ? { ...m, feedback: m.feedback === value ? null : value } : m
        ),
      })),
    [updateConversation]
  );

  return {
    sendMessage,
    regenerate,
    stop,
    setFeedback,
    isStreaming: streamingId !== null && streamingId === active.id,
    isBusy: streamingId !== null,
  };
}
