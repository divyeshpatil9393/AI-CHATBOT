"""ChromaDB wrapper: persistent, local, cosine-similarity vector index."""
import logging
from dataclasses import dataclass
from functools import lru_cache

import chromadb
from chromadb.config import Settings as ChromaSettings

from config import settings
from exceptions import VectorStoreError
from nlp.chunking import Chunk

logger = logging.getLogger(__name__)
COLLECTION_NAME = "documents"
_BATCH = 500


@dataclass
class StoredChunk:
    id: str
    text: str
    document_id: str
    filename: str
    page: int  # 0 = unknown
    chunk_index: int
    score: float | None = None  # cosine similarity (higher = closer)


def _rows_to_chunks(documents, metadatas, ids, distances=None) -> list[StoredChunk]:
    chunks = []
    for i, text in enumerate(documents):
        meta = metadatas[i]
        chunks.append(
            StoredChunk(
                id=ids[i],
                text=text,
                document_id=meta["document_id"],
                filename=meta["filename"],
                page=int(meta.get("page_start", 0)),
                chunk_index=int(meta.get("chunk_index", 0)),
                score=None if distances is None else 1.0 - float(distances[i]),
            )
        )
    return chunks


class VectorStore:
    def __init__(self) -> None:
        try:
            client = chromadb.PersistentClient(
                path=str(settings.chroma_dir),
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self._collection = client.get_or_create_collection(
                name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
            )
        except Exception as exc:
            logger.exception("Could not open ChromaDB")
            raise VectorStoreError() from exc

    def add_document(
        self, document_id: str, filename: str, chunks: list[Chunk], embeddings: list[list[float]]
    ) -> None:
        try:
            for start in range(0, len(chunks), _BATCH):
                batch = chunks[start : start + _BATCH]
                self._collection.add(
                    ids=[f"{document_id}:{c.index}" for c in batch],
                    documents=[c.text for c in batch],
                    embeddings=embeddings[start : start + _BATCH],
                    metadatas=[
                        {
                            "document_id": document_id,
                            "filename": filename,
                            "chunk_index": c.index,
                            "page_start": c.page_start,
                            "page_end": c.page_end,
                        }
                        for c in batch
                    ],
                )
        except Exception as exc:
            logger.exception("Failed to store chunks")
            raise VectorStoreError("Couldn't save the document to the search index.") from exc

    def search(self, embedding: list[float], top_k: int, document_ids: list[str]) -> list[StoredChunk]:
        if not document_ids:
            return []
        try:
            result = self._collection.query(
                query_embeddings=[embedding],
                n_results=top_k,
                where={"document_id": {"$in": document_ids}},
                include=["documents", "metadatas", "distances"],
            )
            if not result["ids"] or not result["ids"][0]:
                return []
            return _rows_to_chunks(
                result["documents"][0], result["metadatas"][0], result["ids"][0], result["distances"][0]
            )
        except Exception as exc:
            logger.exception("Vector search failed")
            raise VectorStoreError() from exc

    def document_chunks(self, document_id: str) -> list[StoredChunk]:
        """All chunks of one document, in reading order."""
        try:
            result = self._collection.get(
                where={"document_id": document_id}, include=["documents", "metadatas"]
            )
            chunks = _rows_to_chunks(result["documents"], result["metadatas"], result["ids"])
            return sorted(chunks, key=lambda c: c.chunk_index)
        except Exception as exc:
            logger.exception("Failed to read chunks")
            raise VectorStoreError() from exc

    def delete_document(self, document_id: str) -> None:
        try:
            self._collection.delete(where={"document_id": document_id})
        except Exception as exc:
            logger.exception("Failed to delete chunks")
            raise VectorStoreError("Couldn't remove the document from the search index.") from exc

    def count(self) -> int:
        return self._collection.count()


@lru_cache(maxsize=1)
def _cached_store() -> VectorStore:
    return VectorStore()


def get_vector_store() -> VectorStore:
    # lru_cache doesn't cache exceptions, so a failed init is retried on the next call.
    return _cached_store()
