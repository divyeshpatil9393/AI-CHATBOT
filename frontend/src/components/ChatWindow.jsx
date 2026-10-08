import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import MessageBubble from "./MessageBubble";

export default function ChatWindow({ messages, isStreaming, onRegenerate, onFeedback }) {
  const scrollRef = useRef(null);
  const stickRef = useRef(true); // follow the stream only while the reader is at the bottom
  const [showJump, setShowJump] = useState(false);
  const last = messages[messages.length - 1];

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // A new message (or switching chats) always jumps to the bottom.
  useLayoutEffect(() => {
    stickRef.current = true;
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // While streaming, follow new text unless the user scrolled up to read.
  useLayoutEffect(() => {
    if (stickRef.current) scrollToBottom();
  }, [last?.content, last?.status, scrollToBottom]);

  const onScroll = (event) => {
    const el = event.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickRef.current = nearBottom;
    setShowJump(!nearBottom);
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-6">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isLast={index === messages.length - 1}
              isStreaming={isStreaming}
              onRegenerate={onRegenerate}
              onFeedback={onFeedback}
            />
          ))}
        </div>
      </div>
      {showJump && (
        <button
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to latest message"
          className="absolute bottom-3 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border border-line bg-elevated shadow-md hover:bg-hover"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
