"""Local embeddings via Sentence Transformers (no paid API required)."""
import logging
import threading
from functools import lru_cache

from config import settings
from exceptions import EmbeddingError

logger = logging.getLogger(__name__)


class Embedder:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self._model = None
        self._lock = threading.Lock()

    def load(self):
        """Load the model once (the first call downloads it, ~90 MB for MiniLM)."""
        if self._model is None:
            with self._lock:
                if self._model is None:
                    try:
                        from sentence_transformers import SentenceTransformer

                        logger.info("Loading embedding model %s", self.model_name)
                        self._model = SentenceTransformer(self.model_name)
                    except Exception as exc:
                        logger.exception("Failed to load embedding model")
                        raise EmbeddingError(
                            "Couldn't load the embedding model. Check your internet connection "
                            "for the first-time download, then try again."
                        ) from exc
        return self._model

    def embed_documents(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        model = self.load()
        try:
            vectors = model.encode(
                texts,
                batch_size=batch_size,
                normalize_embeddings=True,  # unit vectors -> cosine similarity
                show_progress_bar=False,
                convert_to_numpy=True,
            )
            return vectors.tolist()
        except Exception as exc:
            logger.exception("Embedding failed")
            raise EmbeddingError() from exc

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]


@lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    return Embedder(settings.embedding_model)
