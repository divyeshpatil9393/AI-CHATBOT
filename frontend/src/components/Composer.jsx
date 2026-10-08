import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileText, Loader2, Paperclip, Square, X } from "lucide-react";
import { cx } from "../utils/helpers";

export default function Composer({
  isStreaming,
  isBusy,
  attachedDocuments,
  uploads,
  onSend,
  onStop,
  onDetach,
  onFiles,
  onPickFiles,
}) {
  const [value, setValue] = useState("");
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !isBusy;

  const submit = () => {
    if (!canSend) return;
    onSend(value);
    setValue("");
    textareaRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const activeUploads = uploads.filter((u) => u.phase !== "error");

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
        }}
        className={cx(
          "mx-auto w-full max-w-3xl rounded-2xl border bg-elevated shadow-sm transition-colors",
          dragging ? "border-accent bg-accent-soft" : "border-line focus-within:border-muted/60"
        )}
      >
        {(attachedDocuments.length > 0 || activeUploads.length > 0) && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {attachedDocuments.map((doc) => (
              <span
                key={doc.document_id}
                className="flex max-w-[16rem] items-center gap-1.5 rounded-md bg-accent-soft py-1 pl-2 pr-1 text-xs text-accent-text"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{doc.filename}</span>
                <button
                  onClick={() => onDetach(doc.document_id)}
                  aria-label={`Stop using ${doc.filename} in this chat`}
                  className="rounded p-0.5 hover:bg-accent/15"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {activeUploads.map((u) => (
              <span key={u.id} className="flex items-center gap-1.5 rounded-md bg-hover px-2 py-1 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="max-w-[10rem] truncate">{u.name}</span>
                {u.phase === "uploading" ? `${u.progress}%` : "Processing…"}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end gap-1 p-2">
          <button
            onClick={onPickFiles}
            aria-label="Attach a document"
            title="Attach a PDF, DOCX, or TXT file"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"
          >
            <Paperclip className="h-[18px] w-[18px]" />
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={8000}
            placeholder={attachedDocuments.length ? "Ask about your documents…" : "Ask anything…"}
            aria-label="Message"
            className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-5 outline-none placeholder:text-muted"
          />

          {isStreaming ? (
            <button
              onClick={onStop}
              aria-label="Stop generating"
              title="Stop generating"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-fg text-bg hover:opacity-85"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!canSend}
              aria-label="Send message"
              title="Send (Enter)"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ArrowUp className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted">
        Lumina can make mistakes. Check important information against the sources.
      </p>
    </div>
  );
}
