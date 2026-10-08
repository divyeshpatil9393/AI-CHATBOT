import { memo, useState } from "react";
import { AlertCircle, Check, Copy, RefreshCw, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import SourcesList from "./SourcesList";
import TypingIndicator from "./TypingIndicator";
import { copyToClipboard, cx } from "../utils/helpers";

function ActionButton({ label, onClick, active, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(
        "rounded-md p-1.5 hover:bg-hover hover:text-fg",
        active ? "text-accent-text" : "text-muted"
      )}
    >
      {children}
    </button>
  );
}

function MessageBubble({ message, isLast, isStreaming, onRegenerate, onFeedback }) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-hover px-4 py-2.5 text-[15px] leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  const waiting = message.status === "streaming" && !message.content;
  const finished = message.status !== "streaming";

  const copy = async () => {
    if (await copyToClipboard(message.content)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="flex gap-3">
      <div
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg"
        aria-hidden="true"
      >
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        {waiting ? <TypingIndicator /> : message.content && <MarkdownRenderer content={message.content} />}

        {message.status === "error" && (
          <div
            role="alert"
            className="mt-2 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <p className="min-w-0 flex-1 break-words text-fg">{message.error}</p>
            {isLast && !isStreaming && (
              <button onClick={onRegenerate} className="shrink-0 font-medium text-accent-text hover:underline">
                Retry
              </button>
            )}
          </div>
        )}

        <SourcesList sources={message.sources} />

        {message.stopped && <p className="mt-2 text-xs text-muted">Generation stopped.</p>}

        {finished && message.content && (
          <div className="-ml-1.5 mt-2 flex items-center gap-0.5">
            <ActionButton label={copied ? "Copied" : "Copy"} onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </ActionButton>
            {isLast && !isStreaming && (
              <ActionButton label="Regenerate" onClick={onRegenerate}>
                <RefreshCw className="h-4 w-4" />
              </ActionButton>
            )}
            <ActionButton
              label="Good response"
              active={message.feedback === "up"}
              onClick={() => onFeedback(message.id, "up")}
            >
              <ThumbsUp className="h-4 w-4" />
            </ActionButton>
            <ActionButton
              label="Bad response"
              active={message.feedback === "down"}
              onClick={() => onFeedback(message.id, "down")}
            >
              <ThumbsDown className="h-4 w-4" />
            </ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
