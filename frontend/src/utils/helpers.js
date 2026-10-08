export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];
export const MAX_UPLOAD_MB = 15; // keep in sync with MAX_UPLOAD_MB on the backend

export const cx = (...parts) => parts.filter(Boolean).join(" ");

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function makeTitle(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? `${clean.slice(0, 42).trimEnd()}…` : clean || "New chat";
}

export function validateFile(file) {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `"${file.name}" isn't supported. Upload a PDF, DOCX, or TXT file.`;
  }
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `"${file.name}" is larger than ${MAX_UPLOAD_MB} MB.`;
  }
  return null;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

export function describeDocument(doc) {
  const pages = `${doc.pages_estimated ? "~" : ""}${doc.pages} ${doc.pages === 1 ? "page" : "pages"}`;
  return `${pages} • ${doc.chunks} chunks`;
}
