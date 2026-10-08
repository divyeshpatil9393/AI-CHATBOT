import { Children, isValidElement, memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "../utils/helpers";

function nodeText(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement(node)) return nodeText(node.props.children);
  return "";
}

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const code = Children.toArray(children)[0];
  const language = /language-([\w-]+)/.exec(code?.props?.className || "")?.[1];
  const raw = nodeText(code?.props?.children).replace(/\n$/, "");

  const copy = async () => {
    if (await copyToClipboard(raw)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="code-block my-4 overflow-hidden rounded-lg border border-line bg-[rgb(var(--code-bg))]">
      <div className="flex items-center justify-between bg-[rgb(var(--code-head))] px-4 py-1.5 text-xs text-muted">
        <span className="font-mono">{language || "text"}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-hover hover:text-fg"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

const components = {
  pre: CodeBlock,
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: ({ node, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-line">
      <table {...props} />
    </div>
  ),
};

function MarkdownRenderer({ content }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownRenderer);
