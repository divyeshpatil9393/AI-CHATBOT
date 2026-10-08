"""Question processing, intent detection, semantic retrieval and context construction."""
import logging
import math
import re
from dataclasses import dataclass, field

from config import settings
from models.schemas import ChatMessage, Source
from nlp.embeddings import get_embedder
from nlp.preprocessing import normalize_query
from rag.vector_store import StoredChunk, get_vector_store

logger = logging.getLogger(__name__)

_SUMMARY_PATTERN = re.compile(
    r"\b(summar(?:y|ise|ize|ies)|overview|tl;?dr|key (?:points|takeaways|ideas)|"
    r"main (?:points|ideas|topics)|gist)\b",
    re.IGNORECASE,
)
_ABOUT_PATTERN = re.compile(
    r"\bwhat(?:'s| is| are)\b.{0,30}\b(?:this|the|these|my)\b.{0,30}\babout\b", re.IGNORECASE
)


@dataclass
class RetrievalResult:
    intent: str = "chat"  # "chat" (no documents) | "qa" | "summary"
    chunks: list[StoredChunk] = field(default_factory=list)
    context: str = ""
    documents_selected: bool = False

    @property
    def sources(self) -> list[Source]:
        return [
            Source(
                document_id=c.document_id,
                filename=c.filename,
                page=c.page or None,
                score=round(max(c.score or 0.0, 0.0), 3),
                snippet=_snippet(c.text),
            )
            for c in self.chunks
        ]


def _snippet(text: str, limit: int = 220) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= limit else flat[: limit - 1].rstrip() + "…"


def detect_intent(question: str) -> str:
    return "summary" if _SUMMARY_PATTERN.search(question) or _ABOUT_PATTERN.search(question) else "qa"


def _build_search_query(question: str, history: list[ChatMessage]) -> str:
    """Short follow-ups ("and the second one?") are expanded with the previous user turn."""
    query = normalize_query(question)
    if len(query.split()) <= 5:
        previous = [m.content for m in history if m.role == "user"]
        if previous:
            query = f"{normalize_query(previous[-1])[:300]} {query}"
    return query


def _evenly_spaced(items: list[StoredChunk], count: int) -> list[StoredChunk]:
    if count >= len(items):
        return items
    if count <= 1:
        return items[:1]
    step = (len(items) - 1) / (count - 1)
    indexes = sorted({round(i * step) for i in range(count)})
    return [items[i] for i in indexes]


def build_context(chunks: list[StoredChunk], max_chars: int) -> tuple[str, list[StoredChunk]]:
    """Number each excerpt so the model can cite [Source n]; stop at the character budget."""
    parts: list[str] = []
    included: list[StoredChunk] = []
    used = 0
    for chunk in chunks:
        label = f"[Source {len(included) + 1}: {chunk.filename}"
        label += f", page {chunk.page}]" if chunk.page else "]"
        block = f"{label}\n{chunk.text}"
        if included and used + len(block) > max_chars:
            break
        parts.append(block)
        included.append(chunk)
        used += len(block)
    return "\n\n".join(parts), included


class Retriever:
    def retrieve(
        self,
        question: str,
        history: list[ChatMessage],
        document_ids: list[str],
        top_k: int | None = None,
    ) -> RetrievalResult:
        if not document_ids:
            return RetrievalResult()

        top_k = top_k or settings.top_k
        store = get_vector_store()
        intent = detect_intent(question)

        if intent == "summary":
            # "What is this about?" has little semantic signal, so sample across each document.
            per_document = max(2, math.ceil(top_k * 2 / len(document_ids)))
            chunks: list[StoredChunk] = []
            for document_id in document_ids:
                chunks.extend(_evenly_spaced(store.document_chunks(document_id), per_document))
        else:
            embedding = get_embedder().embed_query(_build_search_query(question, history))
            hits = store.search(embedding, top_k=top_k * 2, document_ids=document_ids)
            hits = [h for h in hits if (h.score or 0.0) >= settings.min_similarity]
            chunks = sorted(hits, key=lambda h: h.score or 0.0, reverse=True)[:top_k]
            # Present excerpts in reading order so the model sees coherent text.
            chunks.sort(key=lambda h: (h.document_id, h.chunk_index))

        context, included = build_context(chunks, settings.max_context_chars)
        logger.info("Retrieval intent=%s chunks=%d", intent, len(included))
        return RetrievalResult(intent=intent, chunks=included, context=context, documents_selected=True)


retriever = Retriever()
