"""Document ingestion: validate -> extract -> clean -> chunk -> embed -> store."""
import json
import logging
import math
import os
import re
import threading
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile

from config import settings
from exceptions import (
    AppError,
    CorruptedDocumentError,
    DocumentNotFoundError,
    EmptyDocumentError,
    FileTooLargeError,
    InvalidFileError,
    UnsupportedFileTypeError,
)
from models.schemas import DocumentMeta
from nlp.chunking import build_chunks
from nlp.embeddings import get_embedder
from nlp.preprocessing import clean_text
from rag.vector_store import get_vector_store

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
CHARS_PER_PAGE = 3000  # used to estimate page counts for DOCX/TXT


# ---- registry (small JSON file with document metadata) --------------------------------------
class DocumentRegistry:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._docs: dict[str, dict] = self._load()

    def _load(self) -> dict[str, dict]:
        try:
            return json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def _save(self) -> None:
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._docs, indent=2), encoding="utf-8")
        tmp.replace(self._path)

    def add(self, meta: DocumentMeta) -> None:
        with self._lock:
            self._docs[meta.document_id] = meta.model_dump(mode="json")
            self._save()

    def get(self, document_id: str) -> dict | None:
        with self._lock:
            return self._docs.get(document_id)

    def remove(self, document_id: str) -> None:
        with self._lock:
            self._docs.pop(document_id, None)
            self._save()

    def list(self) -> list[DocumentMeta]:
        with self._lock:
            items = [DocumentMeta(**d) for d in self._docs.values()]
        return sorted(items, key=lambda d: d.uploaded_at, reverse=True)


registry = DocumentRegistry(settings.registry_path)


# ---- validation -----------------------------------------------------------------------------
def safe_filename(name: str) -> str:
    """Strip directories and unsafe characters; keeps a readable display name."""
    name = Path(name.replace("\\", "/")).name
    name = unicodedata.normalize("NFKC", name)
    stem, ext = os.path.splitext(name)
    stem = re.sub(r"[^\w\-. ()]", "_", stem).strip(" ._")[:80] or "document"
    return f"{stem}{ext.lower()}"


def _read_limited(file: UploadFile) -> bytes:
    limit = settings.max_upload_mb * 1024 * 1024
    buffer = bytearray()
    while True:
        block = file.file.read(1024 * 1024)
        if not block:
            break
        buffer.extend(block)
        if len(buffer) > limit:
            raise FileTooLargeError(f"This file is too large. The maximum size is {settings.max_upload_mb} MB.")
    return bytes(buffer)


def _validate_signature(extension: str, data: bytes) -> None:
    """Check file content, not just the extension."""
    if extension == ".pdf" and b"%PDF-" not in data[:1024]:
        raise InvalidFileError("This file has a .pdf extension but isn't a valid PDF.")
    if extension == ".docx" and data[:4] != b"PK\x03\x04":
        raise InvalidFileError("This file has a .docx extension but isn't a valid Word document.")
    if extension == ".txt" and b"\x00" in data[:8192]:
        raise InvalidFileError("This file has a .txt extension but looks like binary data.")


# ---- extraction -----------------------------------------------------------------------------
def _extract_pdf(path: Path) -> list[tuple[int, str]]:
    from pypdf import PdfReader

    try:
        reader = PdfReader(str(path))
        if reader.is_encrypted:
            try:
                unlocked = reader.decrypt("")
            except Exception:
                unlocked = 0
            if not unlocked:
                raise CorruptedDocumentError("This PDF is password-protected. Remove the password and try again.")
        pages = []
        for number, page in enumerate(reader.pages, start=1):
            try:
                pages.append((number, page.extract_text() or ""))
            except Exception:
                logger.warning("Could not extract text from page %d", number)
                pages.append((number, ""))
        return pages
    except AppError:
        raise
    except Exception as exc:
        logger.exception("PDF read failed")
        raise CorruptedDocumentError("Couldn't read this PDF. The file may be corrupted.") from exc


def _extract_docx(path: Path) -> list[tuple[int, str]]:
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    try:
        doc = Document(str(path))
        blocks: list[str] = []
        # Walk the body in order so tables stay where they appear in the document.
        for child in doc.element.body.iterchildren():
            if child.tag.endswith("}p"):
                blocks.append(Paragraph(child, doc).text)
            elif child.tag.endswith("}tbl"):
                rows = []
                for row in Table(child, doc).rows:
                    cells: list[str] = []
                    for cell in row.cells:
                        text = cell.text.strip()
                        if text and text not in cells:  # merged cells repeat
                            cells.append(text)
                    if cells:
                        rows.append(" | ".join(cells))
                blocks.append("\n".join(rows))
        return [(0, "\n\n".join(blocks))]
    except Exception as exc:
        logger.exception("DOCX read failed")
        raise CorruptedDocumentError("Couldn't read this Word document. The file may be corrupted.") from exc


def _extract_txt(path: Path) -> list[tuple[int, str]]:
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-16", "cp1252"):
        try:
            return [(0, raw.decode(encoding))]
        except UnicodeError:
            continue
    return [(0, raw.decode("latin-1"))]


# ---- pipeline -------------------------------------------------------------------------------
def ingest_upload(file: UploadFile) -> DocumentMeta:
    filename = safe_filename(file.filename or "")
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise UnsupportedFileTypeError(
            f"Unsupported file type '{extension or 'unknown'}'. Upload a PDF, DOCX, or TXT file."
        )

    data = _read_limited(file)
    if not data:
        raise EmptyDocumentError("The uploaded file is empty.")
    _validate_signature(extension, data)

    document_id = uuid.uuid4().hex
    stored_path = settings.uploads_dir / f"{document_id}{extension}"  # never uses the client's name
    stored_path.write_bytes(data)

    try:
        raw_pages = {".pdf": _extract_pdf, ".docx": _extract_docx, ".txt": _extract_txt}[extension](stored_path)
        pages = [(n, clean_text(t, strip_page_numbers=extension == ".pdf")) for n, t in raw_pages]
        pages = [(n, t) for n, t in pages if t]
        if not pages:
            raise EmptyDocumentError(
                "No readable text was found. Scanned or image-only documents aren't supported yet."
            )

        characters = sum(len(t) for _, t in pages)
        chunks = build_chunks(pages, settings.chunk_size, settings.chunk_overlap)
        if not chunks:
            raise EmptyDocumentError()
        if len(chunks) > settings.max_chunks_per_document:
            raise FileTooLargeError("This document is too large to process. Try splitting it into smaller files.")

        embeddings = get_embedder().embed_documents([c.text for c in chunks])
        get_vector_store().add_document(document_id, filename, chunks, embeddings)

        is_pdf = extension == ".pdf"
        meta = DocumentMeta(
            document_id=document_id,
            filename=filename,
            file_type=extension.lstrip("."),
            size_bytes=len(data),
            pages=len(raw_pages) if is_pdf else max(1, math.ceil(characters / CHARS_PER_PAGE)),
            pages_estimated=not is_pdf,
            chunks=len(chunks),
            characters=characters,
            uploaded_at=datetime.now(timezone.utc).isoformat(),
        )
        registry.add(meta)
        logger.info("Processed %s: %d chunks", filename, len(chunks))
        return meta
    except Exception:
        # Roll back everything so a failed upload leaves no orphans behind.
        stored_path.unlink(missing_ok=True)
        try:
            get_vector_store().delete_document(document_id)
        except Exception:
            pass
        raise


def list_documents() -> list[DocumentMeta]:
    return registry.list()


def delete_document(document_id: str) -> None:
    if registry.get(document_id) is None:
        raise DocumentNotFoundError()
    get_vector_store().delete_document(document_id)
    for path in settings.uploads_dir.glob(f"{document_id}.*"):
        path.unlink(missing_ok=True)
    registry.remove(document_id)
