import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const http = axios.create({ baseURL: API_BASE, timeout: 60000 });

export class ApiError extends Error {}

/** Turn any failure into a short, friendly message. Returns null for user-cancelled requests. */
export function getErrorMessage(error) {
  if (axios.isAxiosError(error)) {
    if (error.code === "ERR_CANCELED") return null;
    const serverMessage = error.response?.data?.error?.message;
    if (serverMessage) return serverMessage;
    if (!error.response) return "Can't reach the server. Make sure the backend is running on port 8000.";
    if (error.response.status === 413) return "This file is too large.";
    return `The server returned an error (${error.response.status}).`;
  }
  if (error instanceof TypeError) {
    return "Can't reach the server. Make sure the backend is running on port 8000.";
  }
  return error?.message || "Something went wrong. Please try again.";
}

export const fetchDocuments = () => http.get("/documents").then((r) => r.data.documents);

export const deleteDocument = (id) => http.delete(`/documents/${id}`).then((r) => r.data);

export const fetchHealth = () => http.get("/health").then((r) => r.data);

export function uploadDocument(file, onProgress) {
  const form = new FormData();
  form.append("file", file);
  return http
    .post("/documents/upload", form, {
      timeout: 5 * 60 * 1000, // embedding a large document on CPU can take a while
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round((event.loaded * 100) / event.total));
      },
    })
    .then((r) => r.data);
}

/**
 * Stream a chat answer over Server-Sent Events.
 * fetch is used here (not axios) because browsers only expose streaming bodies through fetch.
 */
export async function streamChat({ message, history, documentIds, topK }, { signal, onSources, onToken }) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, document_ids: documentIds, top_k: topK, stream: true }),
    signal,
  });

  if (!response.ok) {
    let message = `The server returned an error (${response.status}).`;
    try {
      const data = await response.json();
      if (data?.error?.message) message = data.error.message;
    } catch {
      /* body wasn't JSON */
    }
    throw new ApiError(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop();

    for (const raw of events) {
      const line = raw.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const event = JSON.parse(line.slice(5).trim());
      if (event.type === "sources") onSources?.(event.sources);
      else if (event.type === "token") onToken?.(event.content);
      else if (event.type === "error") throw new ApiError(event.message);
      else if (event.type === "done") return;
    }
  }
}
