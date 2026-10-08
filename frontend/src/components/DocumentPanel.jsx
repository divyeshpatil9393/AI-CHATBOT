import { useState } from "react";
import { AlertCircle, Check, FileText, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_MB, cx, describeDocument } from "../utils/helpers";

function UploadRow({ upload, onDismiss }) {
  const failed = upload.phase === "error";
  return (
    <li className={cx("rounded-lg border px-3 py-2", failed ? "border-danger/40 bg-danger-soft" : "border-line bg-elevated")}>
      <div className="flex items-center gap-2 text-sm">
        {failed ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
        ) : (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />
        )}
        <span className="min-w-0 flex-1 truncate">{upload.name}</span>
        {failed && (
          <button onClick={() => onDismiss(upload.id)} aria-label="Dismiss" className="rounded p-0.5 text-muted hover:text-fg">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {failed ? (
        <p className="mt-1 text-xs leading-snug text-fg">{upload.error}</p>
      ) : (
        <>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-hover">
            <div
              className={cx("h-full rounded-full bg-accent transition-all", upload.phase === "processing" && "animate-pulse")}
              style={{ width: `${upload.phase === "processing" ? 100 : upload.progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            {upload.phase === "processing" ? "Extracting, chunking and indexing…" : `Uploading ${upload.progress}%`}
          </p>
        </>
      )}
    </li>
  );
}

function DocumentRow({ doc, selected, onToggle, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li
      className={cx(
        "group flex items-center gap-2.5 rounded-lg border px-2.5 py-2",
        selected ? "border-accent/50 bg-accent-soft" : "border-line bg-elevated"
      )}
    >
      <button
        onClick={onToggle}
        role="checkbox"
        aria-checked={selected}
        aria-label={`${selected ? "Stop using" : "Use"} ${doc.filename} in this chat`}
        title={selected ? "Used in this chat" : "Use in this chat"}
        className={cx(
          "grid h-[18px] w-[18px] shrink-0 place-items-center rounded border",
          selected ? "border-accent bg-accent text-accent-fg" : "border-muted/50 hover:border-fg"
        )}
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <FileText className="h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm" title={doc.filename}>
          {doc.filename}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted">
          <span className="truncate">{describeDocument(doc)}</span>
          <span className="flex shrink-0 items-center gap-0.5 text-success">
            <Check className="h-3 w-3" />
            Processed
          </span>
        </p>
      </div>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-1 text-xs">
          <button onClick={onDelete} className="rounded px-1.5 py-1 font-medium text-danger hover:bg-danger-soft">
            Delete
          </button>
          <button onClick={() => setConfirming(false)} className="rounded px-1.5 py-1 text-muted hover:bg-hover">
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${doc.filename}`}
          className="shrink-0 rounded p-1 text-muted hover:bg-hover hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

export default function DocumentPanel({
  documents,
  uploads,
  selectedIds,
  onToggle,
  onDelete,
  onDismissUpload,
  onFiles,
  onPickFiles,
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <section aria-label="Documents" className="flex min-h-0 flex-col border-t border-line px-3 pb-2 pt-3">
      <h3 className="mb-2 px-1 text-xs font-medium text-muted">Documents</h3>

      <button
        onClick={onPickFiles}
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
          "flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-3 text-center transition-colors",
          dragging ? "border-accent bg-accent-soft" : "border-line hover:bg-hover"
        )}
      >
        <UploadCloud className="h-5 w-5 text-muted" />
        <span className="text-sm">Drop files or click to upload</span>
        <span className="text-xs text-muted">
          {ACCEPTED_EXTENSIONS.map((e) => e.slice(1).toUpperCase()).join(", ")} up to {MAX_UPLOAD_MB} MB
        </span>
      </button>

      {(uploads.length > 0 || documents.length > 0) && (
        <ul className="mt-2 min-h-0 space-y-1.5 overflow-y-auto pb-1">
          {uploads.map((u) => (
            <UploadRow key={u.id} upload={u} onDismiss={onDismissUpload} />
          ))}
          {documents.map((doc) => (
            <DocumentRow
              key={doc.document_id}
              doc={doc}
              selected={selectedIds.includes(doc.document_id)}
              onToggle={() => onToggle(doc.document_id)}
              onDelete={() => onDelete(doc.document_id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
