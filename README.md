# Lumina - AI Chatbot with Document Q&A (RAG)

Lumina is a full-stack AI assistant. You can chat with it normally, or upload PDF, DOCX and TXT files and ask questions about them. Documents are processed **locally** (text extraction, cleaning, chunking, embeddings, vector search), and only the question plus a few relevant passages are sent to the **Groq** API for inference.

## Features

- Streaming chat with conversation memory, a **Stop generating** button, and **Regenerate**
- Upload **PDF / DOCX / TXT** by drag and drop or click, with upload progress and processing status
- **Retrieval-Augmented Generation**: answers are grounded in retrieved passages and show their sources (file, page, match score)
- Honest answers: if the documents don't contain the information, the assistant says so
- Chat history in the sidebar, New Chat, per-chat choice of which documents to use
- Light and dark mode, responsive layout (mobile drawer sidebar), toast notifications, friendly error states
- Markdown rendering with syntax-highlighted code blocks and a copy button
- Message actions: copy, regenerate, like, dislike
- Security basics: secrets only in `.env`, file type/size/signature validation, safe stored filenames, CORS allow-list, no stack traces in responses

## Architecture

```text
┌───────────────────────── Frontend (React + Vite + Tailwind) ─────────────────────────┐
│ Sidebar · Chat window · Composer · Document panel · Toasts · Theme                    │
│ axios: upload / list / delete        fetch + AbortController: streamed chat (SSE)     │
└───────────────────────────────────────┬──────────────────────────────────────────────┘
                                        │  /api  (proxied by Vite in development)
┌───────────────────────────────────────▼──────────────────────────────────────────────┐
│ Backend (FastAPI)                                                                    │
│  api/       chat.py · documents.py · health.py                                       │
│  services/  document_service.py (ingestion)  ·  groq_service.py (LLM inference only) │
│  nlp/       preprocessing.py → chunking.py → embeddings.py                           │
│  rag/       vector_store.py (ChromaDB)  ·  retriever.py                              │
└─────────────┬────────────────────────────────────────────────────┬───────────────────┘
              │ local disk                                         │ HTTPS
      ChromaDB + uploads/ + documents.json                    Groq API (question + top-k chunks only)
```

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS 3, Lucide React, Axios, React Markdown, remark-gfm, rehype-highlight |
| Backend | Python, FastAPI, Uvicorn, Pydantic v2, python-dotenv |
| LLM | Groq API (model set via `GROQ_MODEL`) |
| NLP | Sentence Transformers (`all-MiniLM-L6-v2`), pure-Python cleaning and sentence splitting |
| Vector DB | ChromaDB (persistent, local, cosine similarity) |
| Parsing | pypdf, python-docx |

## NLP pipeline

```text
Upload → validate → extract text → clean → normalize → paragraphs → sentences
       → chunk (size + overlap) → embed (local) → ChromaDB
```

1. **Validation** - extension allow-list, size limit, and a content check (PDF header, DOCX zip signature, TXT not binary).
2. **Extraction** - `pypdf` per page (page numbers are kept), `python-docx` in document order including tables, TXT with encoding fallbacks.
3. **Cleaning** - control characters, zero-width characters, repeated decoration (`-----`), page-number lines, hyphenated line breaks, extra whitespace and blank lines.
4. **Normalization** - Unicode NFKC (ligatures, full-width forms), typographic quotes and dashes folded to plain ASCII.
5. **Segmentation** - hard-wrapped PDF lines are re-joined into paragraphs, then split into sentences with an abbreviation-aware splitter (`Dr.`, `e.g.`, `Fig.`).
6. **Chunking** - sentences are packed into chunks of about `CHUNK_SIZE` characters; chunks end on sentence boundaries, and consecutive chunks share up to `CHUNK_OVERLAP` characters of trailing sentences. Each chunk remembers its page range.
7. **Embeddings** - `all-MiniLM-L6-v2` runs locally on CPU and produces normalized vectors.
8. **Storage** - chunks, vectors and metadata go into a persistent ChromaDB collection using cosine distance.

## How RAG works here

```text
Question → normalize (short follow-ups are expanded with the previous turn)
         → intent: summary or question?
         → embed the question locally → vector search in the selected documents
         → drop passages below MIN_SIMILARITY → keep the top K → build numbered context
         → Groq LLM (system prompt: answer only from the passages, cite [Source n], say when not found)
         → streamed answer + source cards
```

- **Summary questions** ("What is this document about?") have little semantic signal, so the retriever samples passages evenly across the document instead of doing a similarity search.
- **Nothing relevant found:** the model is told that no passage matched and is instructed to say it couldn't find the information rather than guess.
- **Prompt-injection hygiene:** retrieved text is wrapped in `<context>` tags and the prompt tells the model to treat it as data, not instructions.
- The full document is never sent to Groq.

## Project structure

```text
AI-CHATBOT/
├── .env.example
├── .gitignore
├── README.md
├── requirements.txt              # points to backend/requirements.txt
├── backend/
│   ├── main.py                   # app, CORS, error handlers
│   ├── config.py                 # environment-based settings
│   ├── exceptions.py             # typed, user-safe errors
│   ├── api/                      # chat.py, documents.py, health.py
│   ├── services/                 # groq_service.py, document_service.py
│   ├── nlp/                      # preprocessing.py, chunking.py, embeddings.py
│   ├── rag/                      # vector_store.py, retriever.py
│   ├── models/schemas.py         # Pydantic models
│   ├── uploads/                  # saved files (git-ignored)
│   └── data/                     # ChromaDB + documents.json, created at runtime (git-ignored)
└── frontend/
    ├── index.html, vite.config.js, tailwind.config.js, package.json
    └── src/
        ├── App.jsx, main.jsx, index.css
        ├── api/client.js         # axios + SSE streaming client
        ├── hooks/                # useChat, useConversations, useDocuments, useTheme, useSettings
        ├── components/           # Sidebar, DocumentPanel, ChatWindow, MessageBubble, Composer, ...
        └── utils/helpers.js
```

## Installation (Windows)

**Requirements:** Python 3.10-3.12, Node.js 18+, and a free Groq API key from <https://console.groq.com/keys>.

### 1. Environment variables

From the project root (`AI-CHATBOT`):

```bash
copy .env.example .env
notepad .env
```

Set your key:

```env
GROQ_API_KEY=your_api_key
GROQ_MODEL=llama-3.3-70b-versatile
```

`GROQ_MODEL` can be any chat model listed in your Groq console. Groq retires models from time to time, so if you see "couldn't run the model", pick a current one and restart the backend.

| Variable | Default | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | - | Your Groq key (backend only, never sent to the browser) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Chat model used for answers |
| `LLM_TEMPERATURE` | `0.2` | Lower = more factual |
| `LLM_MAX_TOKENS` | `1024` | Maximum answer length |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Local embedding model |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `800` / `150` | Chunking in characters |
| `TOP_K` | `5` | Passages retrieved per question (also adjustable in Settings) |
| `MIN_SIMILARITY` | `0.15` | Minimum cosine similarity for a passage to count as relevant |
| `MAX_UPLOAD_MB` | `15` | Upload size limit |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed browser origins |

### 2. Backend setup

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope Process Bypass` first and try again.

### 3. Frontend setup

```bash
cd frontend
npm install
```

## How to run

Open two terminals.

**Terminal 1 - backend** (from the project root):

```bash
venv\Scripts\activate
cd backend
uvicorn main:app --reload --port 8000
```

The first start downloads the embedding model (about 90 MB, once). Check <http://127.0.0.1:8000/api/health>.

**Terminal 2 - frontend:**

```bash
cd frontend
npm run dev
```

Open <http://localhost:5173>, upload a document from the sidebar, and ask a question.

Production build of the frontend: `npm run build` (output in `frontend/dist`).

## API documentation

All errors use the same shape: `{"error": {"code": "...", "message": "..."}}`. Interactive docs are available at <http://127.0.0.1:8000/docs>.

### `GET /api/health`

```json
{
  "status": "ok", "groq_configured": true, "model": "llama-3.3-70b-versatile",
  "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
  "vector_store": "ok", "documents": 2, "max_upload_mb": 15
}
```

### `POST /api/documents/upload`

Multipart form with a `file` field (`.pdf`, `.docx`, `.txt`).

```json
{
  "document_id": "9f1c...e2", "filename": "example.pdf", "file_type": "pdf",
  "size_bytes": 482113, "pages": 10, "pages_estimated": false,
  "chunks": 42, "characters": 31870, "status": "processed",
  "uploaded_at": "2026-10-08T07:46:33.424739+00:00"
}
```

`pages` is exact for PDFs; for DOCX/TXT it is estimated from length (`pages_estimated: true`).

### `GET /api/documents`

Returns `{"documents": [ ...metadata above... ]}`, newest first.

### `DELETE /api/documents/{document_id}`

Removes the file, its vectors and its metadata. Returns `{"deleted": true, "document_id": "..."}`.

### `POST /api/chat`

```json
{
  "message": "What does chapter 2 conclude?",
  "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
  "document_ids": ["9f1c...e2"],
  "top_k": 5,
  "stream": true
}
```

- `document_ids` empty means plain chat with no retrieval.
- With `stream: true` (default) the response is `text/event-stream`:
  - `data: {"type":"sources","sources":[{"filename":"...","page":3,"score":0.61,"snippet":"..."}]}`
  - `data: {"type":"token","content":"..."}` (repeated)
  - `data: {"type":"error","message":"..."}` (only on failure)
  - `data: {"type":"done"}`
- With `stream: false` it returns `{"answer": "...", "sources": [...]}`.

| Status | Meaning |
| --- | --- |
| 400 / 415 / 413 | Invalid file / unsupported type / file too large |
| 422 | Empty message, empty or unreadable document, corrupted PDF |
| 429 / 502 | Groq rate limit / Groq error (also bad key or model name) |
| 503 | Missing `GROQ_API_KEY`, vector database or embedding model unavailable |

## Screenshots

Add your own images to `docs/screenshots/` and reference them here:

| Light mode | Dark mode |
| --- | --- |
| `![Chat](docs/screenshots/chat-light.png)` | `![Chat](docs/screenshots/chat-dark.png)` |
| `![Documents](docs/screenshots/documents.png)` | `![Sources](docs/screenshots/sources.png)` |

## Known limitations

- Scanned (image-only) PDFs contain no extractable text; OCR is not included.
- Chat history is stored in the browser (`localStorage`); documents are shared across all chats on the server, and there is no user authentication, so it is designed for single-user or local use.
- A password-protected PDF is rejected with a clear message.

## Troubleshooting

- **"Can't reach the server"** - the backend isn't running on port 8000.
- **"The server has no Groq API key"** - `.env` is missing or `GROQ_API_KEY` is empty; restart `uvicorn` after editing it.
- **Slow first upload** - the embedding model is downloading or loading; later uploads are faster.
- **Port 5173 or 8000 in use** - change the port and update `vite.config.js` (`proxy.target`) and `CORS_ORIGINS`.

## Future improvements

- OCR for scanned PDFs, plus PPTX/HTML/Markdown support
- User accounts and server-side chat history
- Hybrid search (BM25 + vectors) and a cross-encoder re-ranker
- Query rewriting with the LLM for follow-up questions
- Highlighting the cited passage inside a document viewer
- Evaluation set for retrieval quality, Docker Compose, CI
