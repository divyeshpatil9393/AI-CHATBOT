import { ChevronRight, FileText } from "lucide-react";

export default function SourcesList({ sources }) {
  if (!sources?.length) return null;
  return (
    <details className="group/sources mt-3 text-sm">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-1 text-muted hover:bg-hover hover:text-fg">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open/sources:rotate-90" />
        Sources ({sources.length})
      </summary>
      <ol className="mt-2 space-y-2">
        {sources.map((source, i) => (
          <li key={i} className="rounded-lg border border-line bg-panel px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-medium text-fg">
                [{i + 1}] {source.filename}
              </span>
              {source.page ? <span className="shrink-0">p. {source.page}</span> : null}
              <span className="ml-auto shrink-0">{Math.round(source.score * 100)}% match</span>
            </div>
            <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-muted">{source.snippet}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
