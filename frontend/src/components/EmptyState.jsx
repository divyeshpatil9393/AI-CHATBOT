import { FileText, Paperclip, Sparkles } from "lucide-react";

const GENERAL_PROMPTS = [
  "Explain how retrieval-augmented generation works",
  "Write a Python function that debounces another function",
  "Help me prepare for a backend developer interview",
];

const DOCUMENT_PROMPTS = [
  "What is this document about?",
  "Summarize the key points",
  "List the important names, dates, and numbers",
];

export default function EmptyState({ hasDocuments, onPrompt, onPickFiles }) {
  const prompts = hasDocuments ? DOCUMENT_PROMPTS : GENERAL_PROMPTS;
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center px-4 pb-10 text-center">
      <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-fg">
        <Sparkles className="h-5 w-5" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
        {hasDocuments ? "Ask about your documents" : "How can I help today?"}
      </h1>
      <p className="mt-2 max-w-md text-[15px] text-muted">
        {hasDocuments
          ? "Answers come from the passages that best match your question, with sources you can check."
          : "Chat about anything, or add a PDF, DOCX, or TXT file to ask questions about it."}
      </p>

      <div className="mt-8 grid w-full gap-2 sm:grid-cols-1">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPrompt(prompt)}
            className="flex items-center gap-3 rounded-lg border border-line px-4 py-3 text-left text-sm hover:bg-hover"
          >
            <FileText className="h-4 w-4 shrink-0 text-muted" />
            {prompt}
          </button>
        ))}
      </div>

      {!hasDocuments && (
        <button
          onClick={onPickFiles}
          className="mt-5 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-accent-text hover:bg-accent-soft"
        >
          <Paperclip className="h-4 w-4" />
          Add a document
        </button>
      )}
    </div>
  );
}
